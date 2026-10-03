import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { addBusinessDays, zonedParts } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import {
  deliveryWindowLabels,
  placeOrderSchema,
  type PlaceOrderInput,
} from "@/lib/validators/checkout";
import { normalizeCep } from "@/lib/validators/cep";
import { onlyDigits } from "@/lib/validators/cpf";
import {
  buildCartView,
  getCartById,
  revalidateCartStock,
  toShippingItems,
  type CartView,
} from "./cart";
import { boletoAvailability } from "./checkout-rules";
import { sendOrderEmail } from "./emails";
import { InsufficientStockError, reserveStock, stockShortageMessage } from "./inventory";
import { nextOrderNumber } from "./orders";
import { createPaymentForOrder } from "./payments";
import { getInstallments } from "./pricing";
import { getStoreSettings } from "./settings";
import { quoteShipping } from "./shipping";

export type PlaceOrderResult =
  | { ok: true; number: string; accessToken: string }
  /** Algo mudou entre o que o cliente viu e o recalculado: mostra o que mudou e pede confirmação. */
  | { ok: false; kind: "changed"; changes: string[]; newTotalCents?: number }
  | { ok: false; kind: "invalid"; errors: string[] };

export type OrderContext = {
  cartId: string;
  userId: string | null;
  utm: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    referrer?: string;
  } | null;
};

const CONSENT_TEXT = "Quero receber novidades e ofertas por e-mail.";

/**
 * Cria o pedido a partir do carrinho. O navegador envia escolhas (endereço, entrega, pagamento);
 * preço, cupom, frete e estoque são todos recalculados aqui, no servidor.
 */
export async function placeOrder(
  rawInput: PlaceOrderInput,
  context: OrderContext,
): Promise<PlaceOrderResult> {
  const parsed = placeOrderSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      kind: "invalid",
      errors: [...new Set(parsed.error.issues.map((issue) => issue.message))],
    };
  }
  const input = parsed.data;

  // Idempotência: um segundo envio com a mesma chave devolve o mesmo pedido.
  const existing = await db.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { number: true, accessToken: true },
  });
  if (existing) return { ok: true, ...existing };

  const settings = await getStoreSettings();
  const found = await getCartById(context.cartId);
  if (!found || found.status === "CONVERTED" || found.items.length === 0) {
    return {
      ok: false,
      kind: "invalid",
      errors: ["Sua sacola está vazia. Adicione os produtos de novo para continuar."],
    };
  }

  const now = new Date();
  const changes: string[] = [];

  // 1. Estoque revalidado.
  const { cart, notices } = await revalidateCartStock(found);
  changes.push(...notices);
  if (cart.items.length === 0) return { ok: false, kind: "changed", changes };

  // 2. Preços e cupom recalculados.
  const cpf = onlyDigits(input.identification.cpf);
  const identity = { userId: context.userId, email: input.identification.email, cpf };
  let view: CartView = await buildCartView(cart, settings, {
    paymentMethod: input.payment.method,
    identity,
    now,
  });
  if (view.coupon && !view.coupon.ok) {
    changes.push(`O cupom ${view.coupon.code} não pôde ser aplicado. ${view.coupon.error}`);
    await db.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
    view = await buildCartView({ ...cart, couponCode: null }, settings, {
      paymentMethod: input.payment.method,
      identity,
      now,
    });
  }
  const coupon = view.coupon?.ok ? view.coupon : null;

  // 3. Frete recalculado pelo provider.
  const cep = normalizeCep(input.address.cep)!;
  const quote = await quoteShipping({
    cep,
    items: toShippingItems(view.lines),
    subtotalCents: view.subtotalCents - (coupon?.discountCents ?? 0),
    freeShippingCoupon: coupon?.coupon ?? null,
    now,
  });
  const option = quote.options.find((item) => item.code === input.shipping.code);
  if (!option) {
    changes.push(
      quote.notice ?? "A opção de entrega escolhida não está mais disponível. Escolha outra.",
    );
    return { ok: false, kind: "changed", changes };
  }
  if (option.requiresScheduling) {
    if (
      !input.shipping.deliveryDate ||
      !option.availableDates?.includes(input.shipping.deliveryDate)
    ) {
      changes.push("A data de entrega escolhida não está mais disponível. Escolha outra data.");
      return { ok: false, kind: "changed", changes };
    }
    if (!input.shipping.window)
      return {
        ok: false,
        kind: "invalid",
        errors: ["Escolha o período da entrega: manhã ou tarde."],
      };
  }

  // 4. Regras do meio de pagamento.
  if (input.payment.method === "BOLETO") {
    const boleto = boletoAvailability({
      option,
      deliveryDate: input.shipping.deliveryDate,
      hasPerishable: view.hasPerishable,
      holidays: settings.holidays,
      now,
    });
    if (!boleto.available)
      return { ok: false, kind: "invalid", errors: [`Boleto: ${boleto.reason}`] };
  }

  view = await buildCartView(await getCartById(cart.id).then((fresh) => fresh ?? cart), settings, {
    paymentMethod: input.payment.method,
    shippingCents: option.priceCents,
    identity,
    now,
  });
  const totals = view.totals;

  let installments = 1;
  if (input.payment.method === "CREDIT_CARD") {
    const maxInstallments = getInstallments(totals.totalCents, settings)?.count ?? 1;
    installments = Math.min(Math.max(1, input.payment.installments), maxInstallments);
  }

  // 5. Divergência entre o que o cliente viu e o recalculado: interrompe e mostra o que mudou.
  if (totals.totalCents !== input.expectedTotalCents) {
    changes.push(
      `O total do pedido mudou de ${formatBRL(input.expectedTotalCents)} para ${formatBRL(totals.totalCents)}.`,
    );
  }
  if (changes.length > 0)
    return { ok: false, kind: "changed", changes, newTotalCents: totals.totalCents };

  // 6. Datas de entrega.
  const today = zonedParts(now).dateKey;
  const dateOnly = (key: string) => new Date(`${key}T00:00:00Z`);
  let deliveryDate: Date | null = null;
  let deliveryWindow: string | null = null;
  let estimatedFrom: Date | null = null;
  let estimatedTo: Date | null = null;
  if (option.deliveryDate) {
    deliveryDate = dateOnly(option.deliveryDate);
    deliveryWindow = `Até ${settings.sameDay.deliverByHour}h`;
  } else if (option.requiresScheduling) {
    deliveryDate = dateOnly(input.shipping.deliveryDate!);
    deliveryWindow = deliveryWindowLabels[input.shipping.window!];
  } else {
    estimatedFrom = dateOnly(addBusinessDays(today, option.minDays, settings.holidays));
    estimatedTo = dateOnly(addBusinessDays(today, option.maxDays, settings.holidays));
  }

  const shippingAddress = {
    recipientName: input.recipient.isGift ? input.recipient.name : input.identification.name,
    cep,
    street: input.address.street,
    number: input.address.number,
    complement: input.address.complement || null,
    district: input.address.district,
    city: input.address.city,
    state: input.address.state,
    reference: input.address.reference || null,
  };

  // 7. Reserva de estoque e criação do pedido, na mesma transação.
  let order: { id: string; number: string; accessToken: string };
  try {
    order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          number: await nextOrderNumber(tx),
          accessToken: randomBytes(24).toString("hex"),
          userId: context.userId,
          customerName: input.identification.name,
          customerEmail: input.identification.email,
          customerPhone: onlyDigits(input.identification.phone),
          customerCpf: cpf,
          shippingAddress,
          shippingCity: input.address.city,
          shippingState: input.address.state,
          recipientName: input.recipient.isGift ? input.recipient.name : null,
          recipientPhone: input.recipient.isGift ? onlyDigits(input.recipient.phone) : null,
          paymentMethod: input.payment.method,
          installments,
          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          pixDiscountCents: totals.pixDiscountCents,
          shippingCents: totals.shippingCents,
          giftWrapCents: totals.giftWrapCents,
          totalCents: totals.totalCents,
          costCents: view.lines.every((line) => line.costCents !== null)
            ? view.lines.reduce((sum, line) => sum + (line.costCents ?? 0) * line.quantity, 0)
            : null,
          couponId:
            coupon && totals.discountCents + (coupon.freeShipping ? 1 : 0) > 0
              ? coupon.coupon.id
              : null,
          couponCode:
            coupon && totals.discountCents + (coupon.freeShipping ? 1 : 0) > 0 ? coupon.code : null,
          shippingMethodCode: option.code,
          shippingMethodName: option.name,
          deliveryDate,
          deliveryWindow,
          estimatedDeliveryFrom: estimatedFrom,
          estimatedDeliveryTo: estimatedTo,
          giftMessage: cart.giftMessage,
          giftWrap: cart.giftWrap,
          channel: "SITE",
          utmSource: context.utm?.source ?? null,
          utmMedium: context.utm?.medium ?? null,
          utmCampaign: context.utm?.campaign ?? null,
          utmContent: context.utm?.content ?? null,
          referrer: context.utm?.referrer ?? null,
          idempotencyKey: input.idempotencyKey,
          cartId: cart.id,
          items: {
            create: view.lines.map((line) => ({
              variantId: line.variantId,
              productId: line.productId,
              productName: line.name,
              variantName: line.variantName,
              sku: line.sku,
              imageUrl: line.image?.url.replace(/-1600\.webp$/, "-400.webp") ?? null,
              unitPriceCents: line.price.priceCents,
              compareAtPriceCents: line.price.compareAtCents,
              unitCostCents: line.costCents,
              quantity: line.quantity,
              totalCents: line.lineTotalCents,
            })),
          },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: "PENDING_PAYMENT",
              note: "Pedido criado no site",
            },
          },
        },
        select: { id: true, number: true, accessToken: true },
      });

      await reserveStock(
        tx,
        view.lines.map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
          name: line.name,
        })),
        created.id,
      );
      await tx.cart.update({
        where: { id: cart.id },
        data: {
          status: "CONVERTED",
          email: input.identification.email,
          checkoutData: {} as Prisma.InputJsonValue,
        },
      });
      return created;
    });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return { ok: false, kind: "changed", changes: error.shortages.map(stockShortageMessage) };
    }
    // Corrida entre dois envios com a mesma chave: o primeiro venceu, devolve o pedido dele.
    const raced = await db.order.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { number: true, accessToken: true },
    });
    if (raced) return { ok: true, ...raced };
    throw error;
  }

  // 8. Captura de lead, quando a pessoa marcou a caixa de novidades.
  if (input.identification.marketingOptIn) {
    const already = await db.lead.findFirst({
      where: { email: input.identification.email, source: "CHECKOUT" },
      select: { id: true },
    });
    if (!already) {
      await db.lead.create({
        data: {
          email: input.identification.email,
          name: input.identification.name,
          source: "CHECKOUT",
          consentText: CONSENT_TEXT,
          consentAt: now,
          utm: (context.utm ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    }
  }

  // 9. Cobrança e e-mail de pedido recebido. O cartão aprovado já deixa o pedido pago.
  await createPaymentForOrder(order.id, {
    method: input.payment.method,
    installments,
    card: input.payment.card ?? null,
  });
  const after = await db.order.findUniqueOrThrow({
    where: { id: order.id },
    select: { status: true },
  });
  if (after.status === "PENDING_PAYMENT" && input.payment.method !== "CREDIT_CARD") {
    await sendOrderEmail(order.id, "order-received");
  }

  return { ok: true, number: order.number, accessToken: order.accessToken };
}
