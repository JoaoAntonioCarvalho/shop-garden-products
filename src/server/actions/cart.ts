"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { CouponActionResult } from "@/components/store/coupon-field";
import type { ProductCardData, ProductImageData } from "@/components/store/product-card";
import type { ShippingQuoteResult } from "@/components/store/shipping-calculator";
import type { AnalyticsItem } from "@/lib/analytics/events";
import { db } from "@/lib/db";
import { clientIpHash } from "@/lib/ip";
import { centsToReais } from "@/lib/money";
import { normalizeCep } from "@/lib/validators/cep";
import {
  addCartItem,
  buildCartView,
  getCart,
  getCartSuggestionIds,
  removeCartItem,
  revalidateCartStock,
  setCartItemQuantity,
  toShippingItems,
  updateCart,
  type CartLine,
} from "@/server/services/cart";
import { getCards } from "@/server/services/catalog";
import { getPriceDisplay } from "@/server/services/pricing";
import { rateLimit, rateLimitMessage } from "@/server/services/rate-limit";
import { getStoreSettings } from "@/server/services/settings";
import { quoteShipping } from "@/server/services/shipping";

export type MiniCartLine = {
  itemId: string;
  sku: string;
  slug: string;
  name: string;
  variantName: string | null;
  image: ProductImageData | null;
  quantity: number;
  available: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type MiniCartData = {
  lines: MiniCartLine[];
  itemCount: number;
  subtotalCents: number;
  totalWithPixCents: number;
  freeShippingThresholdCents: number;
  suggestions: ProductCardData[];
  notices: string[];
};

const toAnalyticsItem = (line: CartLine, quantity = line.quantity): AnalyticsItem => ({
  item_id: line.sku,
  item_name: line.name,
  item_category: line.categoryName ?? undefined,
  item_variant: line.variantName ?? undefined,
  price: centsToReais(line.price.priceCents),
  quantity,
});

async function loadMiniCart(withSuggestions: boolean): Promise<MiniCartData> {
  const settings = await getStoreSettings();
  const found = await getCart();
  if (!found) {
    return { lines: [], itemCount: 0, subtotalCents: 0, totalWithPixCents: 0, freeShippingThresholdCents: settings.freeShippingThresholdCents, suggestions: [], notices: [] };
  }
  const { cart, notices } = await revalidateCartStock(found);
  const view = await buildCartView(cart, settings);
  const suggestions = withSuggestions && view.lines.length > 0 ? await getCards(await getCartSuggestionIds(view.lines, 2), settings) : [];
  return {
    lines: view.lines.map((line) => ({
      itemId: line.itemId,
      sku: line.sku,
      slug: line.productSlug,
      name: line.name,
      variantName: line.variantName,
      image: line.image,
      quantity: line.quantity,
      available: line.available,
      unitPriceCents: line.price.priceCents,
      lineTotalCents: line.lineTotalCents,
    })),
    itemCount: view.itemCount,
    subtotalCents: view.subtotalCents,
    totalWithPixCents: view.totals.totalWithPixCents,
    freeShippingThresholdCents: settings.freeShippingThresholdCents,
    suggestions,
    notices,
  };
}

export async function getMiniCartAction(): Promise<MiniCartData> {
  return loadMiniCart(false);
}

const addSchema = z.object({ variantId: z.string().min(1).max(40), quantity: z.number().int().min(1).max(99) });

export type AddToCartResult = { ok: boolean; message?: string; cart?: MiniCartData; added?: AnalyticsItem };

export async function addToCartAction(variantId: string, quantity: number): Promise<AddToCartResult> {
  const parsed = addSchema.safeParse({ variantId, quantity });
  if (!parsed.success) return { ok: false, message: "Não foi possível adicionar. Tente de novo." };

  const settings = await getStoreSettings();
  const result = await addCartItem(parsed.data.variantId, parsed.data.quantity, settings);
  if (!result.ok) return { ok: false, message: result.message };

  const found = await getCart();
  const view = found ? await buildCartView(found, settings) : null;
  const line = view?.lines.find((item) => item.variantId === parsed.data.variantId);
  return {
    ok: true,
    message: result.message,
    cart: await loadMiniCart(true),
    added: line ? toAnalyticsItem(line, parsed.data.quantity) : undefined,
  };
}

/** "Comprar agora": adiciona e vai direto ao checkout. */
export async function buyNowAction(variantId: string, quantity: number): Promise<{ ok: boolean; message?: string }> {
  const result = await addToCartAction(variantId, quantity);
  if (!result.ok) {
    // Se o item já está na sacola no máximo disponível, o checkout ainda faz sentido.
    const cart = await getCart();
    if (!cart?.items.some((item) => item.variantId === variantId)) return { ok: false, message: result.message };
  }
  redirect("/checkout");
}

export type CartActionResult = { ok: boolean; message?: string; cart: MiniCartData; removed?: { variantId: string; quantity: number; name: string; item?: AnalyticsItem } };

export async function setCartQuantityAction(itemId: string, quantity: number): Promise<CartActionResult> {
  const settings = await getStoreSettings();
  const result = Number.isInteger(quantity) && quantity >= 1
    ? await setCartItemQuantity(String(itemId).slice(0, 40), quantity, settings)
    : { ok: false, message: "Quantidade inválida." };
  return { ok: result.ok, message: result.message, cart: await loadMiniCart(false) };
}

export async function removeCartItemAction(itemId: string): Promise<CartActionResult> {
  const settings = await getStoreSettings();
  const before = await getCart();
  const line = before ? (await buildCartView(before, settings)).lines.find((item) => item.itemId === itemId) : undefined;
  const result = await removeCartItem(String(itemId).slice(0, 40), settings);
  return {
    ok: result.ok,
    cart: await loadMiniCart(false),
    removed: result.removed ? { ...result.removed, item: line ? toAnalyticsItem(line) : undefined } : undefined,
  };
}

export async function applyCouponAction(code: string): Promise<CouponActionResult> {
  const ipHash = clientIpHash(await headers());
  const limit = await rateLimit("coupon", ipHash);
  if (!limit.allowed) return { ok: false, error: rateLimitMessage(limit) };

  const cleaned = String(code).trim().toUpperCase().slice(0, 40);
  if (!cleaned) return { ok: false, error: "Digite o código do cupom." };

  const settings = await getStoreSettings();
  const cart = await getCart();
  if (!cart || cart.items.length === 0) return { ok: false, error: "Adicione um produto à sacola antes de usar o cupom." };

  // Valida com o cupom aplicado; se não valer, a sacola fica como estava.
  const view = await buildCartView({ ...cart, couponCode: cleaned }, settings);
  if (!view.coupon?.ok) return { ok: false, error: view.coupon?.error ?? "Este cupom não é válido." };
  await updateCart(cart.id, settings, { couponCode: cleaned });
  return { ok: true };
}

export async function removeCouponAction(): Promise<CouponActionResult> {
  const settings = await getStoreSettings();
  const cart = await getCart();
  if (cart) await updateCart(cart.id, settings, { couponCode: null });
  return { ok: true };
}

const giftSchema = z.object({ giftMessage: z.string().trim().max(240), giftWrap: z.boolean() });

export async function setGiftOptionsAction(input: { giftMessage: string; giftWrap: boolean }): Promise<{ ok: boolean; message?: string }> {
  const parsed = giftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "A mensagem do cartão pode ter até 240 caracteres." };
  const settings = await getStoreSettings();
  const cart = await getCart();
  if (!cart) return { ok: false, message: "Sua sacola está vazia." };
  await updateCart(cart.id, settings, { giftMessage: parsed.data.giftMessage || null, giftWrap: parsed.data.giftWrap });
  return { ok: true };
}

async function guardCep(cep: string): Promise<{ cep: string } | { error: string }> {
  const normalized = normalizeCep(cep);
  if (!normalized) return { error: "Digite um CEP com 8 números." };
  const limit = await rateLimit("cep", clientIpHash(await headers()));
  if (!limit.allowed) return { error: rateLimitMessage(limit) };
  return { cep: normalized };
}

/** Frete para a sacola inteira (sacola e checkout). Guarda o CEP no carrinho. */
export async function quoteCartShippingAction(cep: string): Promise<ShippingQuoteResult> {
  const guard = await guardCep(cep);
  if ("error" in guard) return { ok: false, error: guard.error };
  const settings = await getStoreSettings();
  const cart = await getCart();
  if (!cart || cart.items.length === 0) return { ok: false, error: "Sua sacola está vazia." };

  const view = await buildCartView(cart, settings);
  const quote = await quoteShipping({
    cep: guard.cep,
    items: toShippingItems(view.lines),
    subtotalCents: view.subtotalCents - (view.coupon?.ok ? view.coupon.discountCents : 0),
    freeShippingCoupon: view.coupon?.ok ? view.coupon.coupon : null,
  });
  await db.cart.update({ where: { id: cart.id }, data: { shippingCep: guard.cep } });
  return { ok: true, options: quote.options, notice: quote.notice ?? undefined };
}

/** Frete para um produto, na página de produto. */
export async function quoteProductShippingAction(variantId: string, quantity: number, cep: string): Promise<ShippingQuoteResult> {
  const guard = await guardCep(cep);
  if ("error" in guard) return { ok: false, error: guard.error };
  const settings = await getStoreSettings();
  const variant = await db.productVariant.findFirst({
    where: { id: String(variantId).slice(0, 40), isActive: true },
    include: { product: { select: { sameDayEligible: true, deliveryScope: true } } },
  });
  if (!variant) return { ok: false, error: "Este produto não está mais disponível." };

  const units = Math.max(1, Math.min(99, Math.floor(quantity) || 1));
  const quote = await quoteShipping({
    cep: guard.cep,
    items: [{ variantId: variant.id, quantity: units, weightGrams: variant.weightGrams, sameDayEligible: variant.product.sameDayEligible, deliveryScope: variant.product.deliveryScope }],
    subtotalCents: getPriceDisplay(variant, settings).priceCents * units,
  });
  const notice = quote.blockedByLocalOnly
    ? "Este produto é entregue apenas na Grande São Paulo."
    : (quote.notice ?? undefined);
  return { ok: true, options: quote.options, notice };
}
