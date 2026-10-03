import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { addBusinessDays, zonedParts } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { can } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/session";
import { isValidCep, normalizeCep } from "@/lib/validators/cep";
import { emailSchema, UF } from "@/lib/validators/checkout";
import { isValidCpf, onlyDigits } from "@/lib/validators/cpf";
import { isValidPhone } from "@/lib/validators/phone";
import type { ShippingOption } from "@/server/providers/shipping/types";
import { loadCoupon } from "@/server/services/cart";
import { availableOf } from "@/server/services/catalog";
import { validateCoupon } from "@/server/services/coupons";
import { sendOrderEmail } from "@/server/services/emails";
import { InsufficientStockError, reserveStock } from "@/server/services/inventory";
import { nextOrderNumber, transitionOrder } from "@/server/services/orders";
import { createPaymentForOrder } from "@/server/services/payments";
import { getEffectivePriceCents } from "@/server/services/pricing";
import { getStoreSettings } from "@/server/services/settings";
import { quoteShipping } from "@/server/services/shipping";
import { computeTotals, type Totals } from "@/server/services/totals";
import { AdminError } from "./action";

export const MANUAL_PAYMENTS = {
  PIX_RECEIVED: { label: "Pix já recebido", paid: true, pix: true },
  GENERATE_PIX: { label: "Gerar Pix", paid: false, pix: true },
  CARD_MACHINE: { label: "Cartão na maquininha", paid: true, pix: false },
  CASH: { label: "Dinheiro", paid: true, pix: false },
  PAYMENT_LINK: { label: "Link de pagamento", paid: false, pix: true },
} as const;

export const manualOrderSchema = z
  .object({
    customer: z.object({
      id: z.string().optional(),
      name: z.string().trim().min(2, "Digite o nome do cliente.").max(120),
      email: emailSchema,
      phone: z
        .string()
        .optional()
        .default("")
        .refine((value) => !value || isValidPhone(value), "Telefone inválido."),
      cpf: z
        .string()
        .optional()
        .default("")
        .refine((value) => !value || isValidCpf(value), "CPF inválido."),
    }),
    items: z
      .array(
        z.object({
          variantId: z.string().min(1),
          quantity: z.number().int().min(1).max(999),
          /** Preço unitário ajustado (só ADMIN), com motivo. */
          unitPriceCents: z.number().int().min(0).nullish(),
          priceReason: z.string().trim().max(200).optional(),
        }),
      )
      .min(1, "Adicione ao menos um produto."),
    couponCode: z.string().trim().max(40).optional().default(""),
    shipping: z.object({
      /** "quote": opção calculada pelo CEP; "manual": nome e valor digitados; "none": venda na loja, sem entrega. */
      mode: z.enum(["quote", "manual", "none"]),
      code: z.string().max(60).optional(),
      manualName: z.string().trim().max(60).optional(),
      manualCents: z.number().int().min(0).optional(),
      deliveryDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      window: z.string().trim().max(30).optional(),
    }),
    address: z.object({
      cep: z.string().optional().default(""),
      street: z.string().trim().max(160).optional().default(""),
      number: z.string().trim().max(20).optional().default(""),
      complement: z.string().trim().max(80).optional().default(""),
      district: z.string().trim().max(80).optional().default(""),
      city: z.string().trim().max(80).optional().default(""),
      state: z
        .union([z.enum(UF), z.literal("")])
        .optional()
        .default(""),
    }),
    payment: z.enum(["PIX_RECEIVED", "GENERATE_PIX", "CARD_MACHINE", "CASH", "PAYMENT_LINK"]),
    channel: z.enum(["WHATSAPP", "STORE", "PHONE", "SITE"]).default("WHATSAPP"),
    origin: z.string().trim().max(60).optional().default(""),
    giftMessage: z.string().trim().max(240).optional().default(""),
    notes: z.string().trim().max(1000).optional().default(""),
    sendEmail: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (value.shipping.mode !== "none") {
      if (!isValidCep(value.address.cep))
        context.addIssue({
          code: "custom",
          path: ["address", "cep"],
          message: "Digite o CEP da entrega.",
        });
      if (
        !value.address.street ||
        !value.address.number ||
        !value.address.city ||
        !value.address.state
      ) {
        context.addIssue({
          code: "custom",
          path: ["address", "street"],
          message: "Preencha rua, número, cidade e estado da entrega.",
        });
      }
    }
    if (value.shipping.mode === "quote" && !value.shipping.code)
      context.addIssue({
        code: "custom",
        path: ["shipping", "code"],
        message: "Escolha uma opção de entrega.",
      });
    if (value.shipping.mode === "manual" && !value.shipping.manualName)
      context.addIssue({
        code: "custom",
        path: ["shipping", "manualName"],
        message: "Informe o nome da entrega.",
      });
  });

export type ManualOrderInput = z.output<typeof manualOrderSchema>;

export type ManualOrderPreview = {
  lines: Array<{
    variantId: string;
    name: string;
    sku: string;
    quantity: number;
    available: number;
    listPriceCents: number;
    unitPriceCents: number;
    totalCents: number;
  }>;
  totals: Totals;
  coupon: { code: string; summary: string } | null;
  couponError: string | null;
  shippingOptions: ShippingOption[];
  shippingNotice: string | null;
  problems: string[];
};

/** Calcula o pedido manual no servidor: preços, cupom, frete e totais. Usado na prévia e na criação. */
export async function computeManualOrder(input: ManualOrderInput, user: CurrentUser) {
  const settings = await getStoreSettings();
  const now = new Date();
  const problems: string[] = [];
  const variants = await db.productVariant.findMany({
    where: { id: { in: input.items.map((item) => item.variantId) } },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          primaryCategoryId: true,
          primaryCategory: { select: { parentId: true } },
          sameDayEligible: true,
          deliveryScope: true,
          images: {
            where: { isCover: true },
            take: 1,
            select: { media: { select: { variants: true } } },
          },
        },
      },
    },
  });
  const byId = new Map(variants.map((variant) => [variant.id, variant]));

  const lines = input.items.flatMap((item) => {
    const variant = byId.get(item.variantId);
    if (!variant) {
      problems.push("Um dos produtos não existe mais.");
      return [];
    }
    const listPriceCents = getEffectivePriceCents(variant, now);
    let unitPriceCents = listPriceCents;
    if (item.unitPriceCents != null && item.unitPriceCents !== listPriceCents) {
      if (!can(user, "orders.override_price"))
        problems.push("Só administradores podem ajustar o preço unitário.");
      else if (!item.priceReason)
        problems.push(`Informe o motivo do ajuste de preço de ${variant.product.name}.`);
      else unitPriceCents = item.unitPriceCents;
    }
    const available = availableOf(variant);
    if (item.quantity > available)
      problems.push(
        `${variant.product.name}: há ${available} em estoque, e o pedido tem ${item.quantity}.`,
      );
    return [
      {
        item,
        variant,
        listPriceCents,
        unitPriceCents,
        available,
        totalCents: unitPriceCents * item.quantity,
      },
    ];
  });
  const subtotalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);

  // Cupom
  let couponResult: ReturnType<typeof validateCoupon> | null = null;
  if (input.couponCode) {
    const coupon = await loadCoupon(input.couponCode);
    const email = input.customer.email;
    const [customerRedemptions, paidOrder] = coupon
      ? await Promise.all([
          db.couponRedemption.count({ where: { couponId: coupon.id, email } }),
          db.order.findFirst({
            where: { customerEmail: email, paidAt: { not: null } },
            select: { id: true },
          }),
        ])
      : [0, null];
    couponResult = validateCoupon(coupon, {
      now,
      subtotalCents,
      customerRedemptions,
      hasPaidOrder: Boolean(paidOrder),
      lines: lines.map((line) => ({
        productId: line.variant.product.id,
        categoryIds: [
          line.variant.product.primaryCategoryId,
          line.variant.product.primaryCategory?.parentId,
        ].filter((id): id is string => Boolean(id)),
        totalCents: line.totalCents,
      })),
    });
  }
  const coupon = couponResult?.ok ? couponResult : null;

  // Frete
  let shippingOptions: ShippingOption[] = [];
  let shippingNotice: string | null = null;
  const cep = normalizeCep(input.address.cep);
  if (cep && lines.length > 0 && input.shipping.mode !== "none") {
    const quote = await quoteShipping({
      cep,
      subtotalCents: subtotalCents - (coupon?.discountCents ?? 0),
      freeShippingCoupon: coupon?.coupon ?? null,
      now,
      items: lines.map((line) => ({
        variantId: line.variant.id,
        quantity: line.item.quantity,
        weightGrams: line.variant.weightGrams,
        sameDayEligible: line.variant.product.sameDayEligible,
        deliveryScope: line.variant.product.deliveryScope,
      })),
    });
    shippingOptions = quote.options;
    shippingNotice = quote.notice;
  }
  const option =
    input.shipping.mode === "quote"
      ? (shippingOptions.find((item) => item.code === input.shipping.code) ?? null)
      : null;
  if (input.shipping.mode === "quote" && input.shipping.code && !option)
    problems.push("A opção de entrega escolhida não está disponível para este CEP.");
  const shippingCents =
    input.shipping.mode === "manual"
      ? (input.shipping.manualCents ?? 0)
      : (option?.priceCents ?? 0);

  const payment = MANUAL_PAYMENTS[input.payment];
  const totals = computeTotals({
    subtotalCents,
    couponDiscountCents: coupon?.discountCents ?? 0,
    couponCombinableWithPix: coupon?.coupon.combinableWithPix ?? true,
    paymentMethod: payment.pix ? "PIX" : "MANUAL",
    pixDiscountPercent: settings.pixDiscountPercent,
    shippingCents,
    giftWrapCents: 0,
  });

  return {
    settings,
    now,
    lines,
    totals,
    coupon,
    couponError: couponResult && !couponResult.ok ? couponResult.error : null,
    shippingOptions,
    shippingNotice,
    option,
    problems,
    payment,
    cep,
  };
}

export function toPreview(
  computed: Awaited<ReturnType<typeof computeManualOrder>>,
): ManualOrderPreview {
  return {
    lines: computed.lines.map((line) => ({
      variantId: line.variant.id,
      name: `${line.variant.product.name}${line.variant.name !== "Padrão" ? ` (${line.variant.name})` : ""}`,
      sku: line.variant.sku,
      quantity: line.item.quantity,
      available: line.available,
      listPriceCents: line.listPriceCents,
      unitPriceCents: line.unitPriceCents,
      totalCents: line.totalCents,
    })),
    totals: computed.totals,
    coupon: computed.coupon
      ? { code: computed.coupon.coupon.code, summary: computed.coupon.summary }
      : null,
    couponError: computed.couponError,
    shippingOptions: computed.shippingOptions,
    shippingNotice: computed.shippingNotice,
    problems: computed.problems,
  };
}

/**
 * Cria um pedido manual (venda fechada no WhatsApp, por telefone ou na loja). Reserva e baixa o
 * estoque como qualquer pedido e entra em todos os relatórios, com o canal informado.
 */
export async function createManualOrder(
  input: ManualOrderInput,
  user: CurrentUser,
  request: { ipHash: string; userAgent: string | null },
) {
  const computed = await computeManualOrder(input, user);
  const { lines, totals, coupon, option, payment, settings, now } = computed;
  if (computed.problems.length) throw new AdminError(computed.problems.join(" "));
  if (computed.couponError) throw new AdminError(`Cupom: ${computed.couponError}`);
  if (lines.length === 0) throw new AdminError("Adicione ao menos um produto.");

  // Cliente: usa o cadastro existente ou cria um sem senha (ele pode criar a senha depois).
  const cpf = input.customer.cpf ? onlyDigits(input.customer.cpf) : null;
  const phone = input.customer.phone ? onlyDigits(input.customer.phone) : null;
  const existing = input.customer.id
    ? await db.user.findUnique({ where: { id: input.customer.id }, select: { id: true } })
    : await db.user.findUnique({ where: { email: input.customer.email }, select: { id: true } });
  const cpfTaken =
    cpf && !existing ? await db.user.findUnique({ where: { cpf }, select: { id: true } }) : null;
  const customerId =
    existing?.id ??
    (
      await db.user.create({
        data: {
          name: input.customer.name,
          email: input.customer.email,
          phone,
          cpf: cpfTaken ? null : cpf,
          role: "CUSTOMER",
        },
        select: { id: true },
      })
    ).id;

  const today = zonedParts(now).dateKey;
  const dateOnly = (key: string) => new Date(`${key}T00:00:00Z`);
  const hasAddress = input.shipping.mode !== "none";
  const shippingAddress = hasAddress
    ? {
        recipientName: input.customer.name,
        cep: computed.cep,
        street: input.address.street,
        number: input.address.number,
        complement: input.address.complement || null,
        district: input.address.district,
        city: input.address.city,
        state: input.address.state,
      }
    : {};
  const shippingMethodCode =
    input.shipping.mode === "quote"
      ? option!.code
      : input.shipping.mode === "manual"
        ? "manual-entrega"
        : "retirada-loja";
  const shippingMethodName =
    input.shipping.mode === "quote"
      ? option!.name
      : input.shipping.mode === "manual"
        ? input.shipping.manualName!
        : "Venda na loja";
  const deliveryDate = option?.deliveryDate
    ? dateOnly(option.deliveryDate)
    : input.shipping.deliveryDate
      ? dateOnly(input.shipping.deliveryDate)
      : null;
  const estimated = option && !option.deliveryDate && !option.requiresScheduling;

  let order: { id: string; number: string };
  try {
    order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          number: await nextOrderNumber(tx),
          accessToken: randomBytes(24).toString("hex"),
          userId: customerId,
          customerName: input.customer.name,
          customerEmail: input.customer.email,
          customerPhone: phone,
          customerCpf: cpf,
          shippingAddress,
          shippingCity: hasAddress ? input.address.city : null,
          shippingState: hasAddress && input.address.state ? input.address.state : null,
          paymentMethod: payment.paid ? "MANUAL" : "PIX",
          manualPaymentLabel: payment.paid ? payment.label : null,
          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          pixDiscountCents: totals.pixDiscountCents,
          shippingCents: totals.shippingCents,
          totalCents: totals.totalCents,
          costCents: lines.every((line) => line.variant.costCents !== null)
            ? lines.reduce(
                (sum, line) => sum + (line.variant.costCents ?? 0) * line.item.quantity,
                0,
              )
            : null,
          couponId: coupon?.coupon.id ?? null,
          couponCode: coupon?.coupon.code ?? null,
          shippingMethodCode,
          shippingMethodName,
          deliveryDate,
          deliveryWindow: option?.deliveryDate
            ? `Até ${settings.sameDay.deliverByHour}h`
            : input.shipping.window || null,
          estimatedDeliveryFrom: estimated
            ? dateOnly(addBusinessDays(today, option.minDays, settings.holidays))
            : null,
          estimatedDeliveryTo: estimated
            ? dateOnly(addBusinessDays(today, option.maxDays, settings.holidays))
            : null,
          giftMessage: input.giftMessage || null,
          internalNotes: input.notes || null,
          channel: input.channel,
          utmSource: input.origin || (input.channel === "WHATSAPP" ? "whatsapp" : null),
          utmMedium: "atendimento",
          idempotencyKey: `manual-${randomBytes(16).toString("hex")}`,
          items: {
            create: lines.map((line) => ({
              variantId: line.variant.id,
              productId: line.variant.product.id,
              productName: line.variant.product.name,
              variantName: line.variant.name === "Padrão" ? null : line.variant.name,
              sku: line.variant.sku,
              imageUrl:
                ((line.variant.product.images[0]?.media.variants ?? {}) as Record<string, string>)[
                  "400"
                ] ?? null,
              unitPriceCents: line.unitPriceCents,
              compareAtPriceCents:
                line.unitPriceCents < line.listPriceCents ? line.listPriceCents : null,
              unitCostCents: line.variant.costCents,
              quantity: line.item.quantity,
              totalCents: line.totalCents,
            })),
          },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: "PENDING_PAYMENT",
              note: `Pedido manual criado no painel (${payment.label})`,
              userId: user.id,
            },
          },
        },
        select: { id: true, number: true },
      });
      await reserveStock(
        tx,
        lines.map((line) => ({
          variantId: line.variant.id,
          quantity: line.item.quantity,
          name: line.variant.product.name,
        })),
        created.id,
      );
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "order.create_manual",
          entityType: "Order",
          entityId: created.id,
          ipHash: request.ipHash,
          userAgent: request.userAgent?.slice(0, 300) ?? null,
          diff: {
            pedido: created.number,
            canal: input.channel,
            pagamento: payment.label,
            total: formatBRL(totals.totalCents),
            ajustesDePreco: lines
              .filter((line) => line.unitPriceCents !== line.listPriceCents)
              .map((line) => ({
                sku: line.variant.sku,
                de: formatBRL(line.listPriceCents),
                para: formatBRL(line.unitPriceCents),
                motivo: line.item.priceReason,
              })),
          },
        },
      });
      return created;
    });
  } catch (error) {
    if (error instanceof InsufficientStockError) throw new AdminError(error.message);
    throw error;
  }

  if (payment.paid) {
    await db.payment.create({
      data: {
        orderId: order.id,
        provider: "manual",
        method: "MANUAL",
        status: "PAID",
        amountCents: totals.totalCents,
      },
    });
    await transitionOrder(order.id, "PAID", {
      userId: user.id,
      note: `${payment.label}, registrado no painel`,
      notifyCustomer: false,
      ...request,
    });
  } else {
    await createPaymentForOrder(order.id, { method: "PIX", installments: 1 });
  }
  if (input.sendEmail) await sendOrderEmail(order.id, "order-manual-summary");
  return order;
}
