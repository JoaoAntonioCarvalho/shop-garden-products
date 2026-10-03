"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { parseUtmCookie, UTM_COOKIE } from "@/lib/analytics/utm";
import { db } from "@/lib/db";
import { clientIpHash } from "@/lib/ip";
import { emailSchema, type CheckoutDraft, type PlaceOrderInput } from "@/lib/validators/checkout";
import { normalizeCep } from "@/lib/validators/cep";
import type { ShippingOption } from "@/server/providers/shipping/types";
import {
  buildCartView,
  getCart,
  revalidateCartStock,
  toShippingItems,
} from "@/server/services/cart";
import { placeOrder, type PlaceOrderResult } from "@/server/services/checkout";
import { boletoAvailability, type BoletoAvailability } from "@/server/services/checkout-rules";
import { requestNow } from "@/server/clock";
import { getInstallments } from "@/server/services/pricing";
import { rateLimit, rateLimitMessage } from "@/server/services/rate-limit";
import { getStoreSettings } from "@/server/services/settings";
import { blockedContactMessage } from "@/lib/delivery-areas";
import { quoteShipping } from "@/server/services/shipping";
import type { Totals } from "@/server/services/totals";

export type CheckoutQuote = {
  ok: true;
  options: ShippingOption[];
  notice: string | null;
  blockedByLocalOnly: boolean;
  /** WhatsApp da loja e mensagem já escrita, quando há item que não vai para o CEP. */
  contact: { whatsapp: string; message: string } | null;
  /** Totais com o frete escolhido, para cada meio de pagamento. */
  totals: Record<"PIX" | "CREDIT_CARD" | "BOLETO", Totals>;
  boleto: BoletoAvailability;
  /** Parcelas possíveis no cartão: [1, 2, 3...] com o valor de cada uma. */
  installments: Array<{ count: number; valueCents: number }>;
  notices: string[];
};

const quoteSchema = z.object({
  cep: z.string().max(12),
  shippingCode: z.string().max(60).nullish(),
  deliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
});

/**
 * Cotação completa do checkout: opções de entrega, totais por meio de pagamento, disponibilidade
 * do boleto e parcelas. O navegador só exibe; nada disso é calculado nele.
 */
export async function checkoutQuoteAction(
  input: z.input<typeof quoteSchema>,
): Promise<CheckoutQuote | { ok: false; error: string }> {
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira os dados e tente de novo." };
  const settings = await getStoreSettings();
  const found = await getCart();
  if (!found || found.items.length === 0) return { ok: false, error: "Sua sacola está vazia." };
  const { cart, notices } = await revalidateCartStock(found);
  if (cart.items.length === 0)
    return { ok: false, error: notices.join(" ") || "Sua sacola está vazia." };

  const now = await requestNow();
  const base = await buildCartView(cart, settings, { now });
  const coupon = base.coupon?.ok ? base.coupon : null;
  const cep = normalizeCep(parsed.data.cep);

  let options: ShippingOption[] = [];
  let notice: string | null = null;
  let blockedByLocalOnly = false;
  let contact: CheckoutQuote["contact"] = null;
  if (cep) {
    const quote = await quoteShipping({
      cep,
      items: toShippingItems(base.lines),
      subtotalCents: base.subtotalCents - (coupon?.discountCents ?? 0),
      freeShippingCoupon: coupon?.coupon ?? null,
      now,
    });
    ({ options, notice, blockedByLocalOnly } = quote);
    if (quote.blockedItems.length > 0)
      contact = {
        whatsapp: settings.whatsapp,
        message: blockedContactMessage(quote.blockedItems, cep),
      };
    if (cart.shippingCep !== cep)
      await db.cart.update({ where: { id: cart.id }, data: { shippingCep: cep } });
  }

  const option = options.find((item) => item.code === parsed.data.shippingCode) ?? null;
  const shippingCents = option?.priceCents ?? 0;
  const totalsFor = async (paymentMethod: "PIX" | "CREDIT_CARD" | "BOLETO") =>
    (await buildCartView(cart, settings, { paymentMethod, shippingCents, now })).totals;
  const totals = {
    PIX: await totalsFor("PIX"),
    CREDIT_CARD: await totalsFor("CREDIT_CARD"),
    BOLETO: await totalsFor("BOLETO"),
  };

  const maxInstallments = getInstallments(totals.CREDIT_CARD.totalCents, settings)?.count ?? 1;
  return {
    ok: true,
    options,
    notice,
    blockedByLocalOnly,
    contact,
    totals,
    boleto: boletoAvailability({
      option,
      deliveryDate: parsed.data.deliveryDate,
      hasPerishable: base.hasPerishable,
      holidays: settings.holidays,
      now,
    }),
    installments: Array.from({ length: maxInstallments }, (_, index) => ({
      count: index + 1,
      valueCents: Math.round(totals.CREDIT_CARD.totalCents / (index + 1)),
    })),
    notices,
  };
}

/** Guarda o andamento do checkout no carrinho, para o cliente poder sair e voltar. Nunca dados de cartão. */
export async function saveCheckoutDraftAction(
  draft: CheckoutDraft,
): Promise<{ ok: boolean; hasAccount?: boolean }> {
  const cart = await getCart();
  if (!cart) return { ok: false };
  const email = emailSchema.safeParse(draft.identification?.email ?? "");
  const safeDraft: CheckoutDraft = {
    identification: draft.identification,
    address: draft.address,
    recipient: draft.recipient,
    shipping: draft.shipping,
    paymentMethod: draft.paymentMethod,
  };
  await db.cart.update({
    where: { id: cart.id },
    data: {
      checkoutData: JSON.parse(JSON.stringify(safeDraft)) as Prisma.InputJsonValue,
      ...(email.success ? { email: email.data } : {}),
      lastActivityAt: new Date(),
      status: "ACTIVE",
    },
  });
  if (!email.success) return { ok: true };
  const account = await db.user.findFirst({
    where: { email: email.data, passwordHash: { not: null }, anonymizedAt: null },
    select: { id: true },
  });
  return { ok: true, hasAccount: Boolean(account) };
}

/** Tira da sacola os itens que não podem ser entregues no CEP informado. */
export async function removeLocalOnlyItemsAction(
  cep: string,
): Promise<{ ok: boolean; removed: number }> {
  const cart = await getCart();
  const destination = normalizeCep(String(cep));
  if (!cart || !destination) return { ok: false, removed: 0 };
  const settings = await getStoreSettings();
  const view = await buildCartView(cart, settings);
  const quote = await quoteShipping({
    cep: destination,
    items: toShippingItems(view.lines),
    subtotalCents: view.subtotalCents,
    now: await requestNow(),
  });
  const blocked = new Set(quote.blockedItems.map((item) => item.variantId));
  const ids = cart.items.filter((item) => blocked.has(item.variantId)).map((item) => item.id);
  if (ids.length) await db.cartItem.deleteMany({ where: { id: { in: ids } } });
  return { ok: true, removed: ids.length };
}

async function readUtm() {
  return parseUtmCookie((await cookies()).get(UTM_COOKIE)?.value);
}

/** Faz o pedido. Todo o cálculo e a reserva de estoque acontecem em placeOrder, no servidor. */
export async function placeOrderAction(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const limit = await rateLimit("publicForm", clientIpHash(await headers()));
  if (!limit.allowed) return { ok: false, kind: "invalid", errors: [rateLimitMessage(limit)] };

  const cart = await getCart();
  if (!cart) {
    // O carrinho já foi convertido: um reenvio com a mesma chave devolve o pedido criado.
    const existing = await db.order.findUnique({
      where: { idempotencyKey: String(input.idempotencyKey ?? "") },
      select: { number: true, accessToken: true },
    });
    if (existing) return { ok: true, ...existing };
    return {
      ok: false,
      kind: "invalid",
      errors: ["Sua sacola está vazia. Adicione os produtos de novo para continuar."],
    };
  }
  // O usuário nunca vem do navegador: é o dono do carrinho, definido no servidor.
  return placeOrder(input, {
    cartId: cart.id,
    userId: cart.userId,
    now: await requestNow(),
    utm: (await readUtm()) ?? (cart.utm as never) ?? null,
  });
}
