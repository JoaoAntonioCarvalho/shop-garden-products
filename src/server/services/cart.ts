import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { ProductImageData } from "@/components/store/product-card";
import type { StoreSettings } from "@/config/store.config";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { availableOf, toImage } from "./catalog";
import { COUPON_NOT_FOUND, validateCoupon, type CouponData, type CouponResult } from "./coupons";
import { getPriceDisplay, type PriceDisplay } from "./pricing";
import { computeTotals, type PaymentMethodCode, type Totals } from "./totals";

export const CART_COOKIE = "nsg_cart";
const MAX_QUANTITY = 99;

const cartInclude = {
  items: {
    orderBy: { addedAt: "asc" },
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              sku: true,
              status: true,
              sameDayEligible: true,
              deliveryScope: true,
              perishable: true,
              isGiftable: true,
              productType: true,
              primaryCategoryId: true,
              primaryCategory: { select: { name: true, parentId: true } },
              additionalCategories: { select: { id: true, parentId: true } },
              images: {
                orderBy: [{ isCover: "desc" }, { position: "asc" }],
                take: 1,
                select: { media: { select: { alt: true, blurDataUrl: true, variants: true } } },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

export type CartRecord = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

// ───────────────────────── Cookie e carrinho ─────────────────────────

async function readToken(): Promise<string | null> {
  return (await cookies()).get(CART_COOKIE)?.value ?? null;
}

/** Carrinho ativo do visitante (pelo cookie httpOnly), ou null. Pode ser usado em qualquer página. */
export async function getCart(): Promise<CartRecord | null> {
  const token = await readToken();
  if (!token) return null;
  return db.cart.findFirst({ where: { token, status: { in: ["ACTIVE", "ABANDONED"] } }, include: cartInclude });
}

export async function getCartById(id: string): Promise<CartRecord | null> {
  return db.cart.findUnique({ where: { id }, include: cartInclude });
}

/** Quantidade total de itens, para o contador do cabeçalho. Uma consulta leve. */
export async function getCartCount(): Promise<number> {
  const token = await readToken();
  if (!token) return 0;
  const result = await db.cartItem.aggregate({
    where: { cart: { token, status: { in: ["ACTIVE", "ABANDONED"] } } },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

export async function setCartCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(CART_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Devolve o carrinho do visitante, criando um se não existir. Só em server actions e route handlers. */
export async function ensureCart(settings: StoreSettings, extra: { userId?: string | null; utm?: Prisma.InputJsonValue } = {}): Promise<CartRecord> {
  const existing = await getCart();
  if (existing) return existing;
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + settings.cartExpirationDays * 86_400_000);
  const cart = await db.cart.create({
    data: { token, expiresAt, userId: extra.userId ?? null, utm: extra.utm },
    include: cartInclude,
  });
  await setCartCookie(token, expiresAt);
  return cart;
}

async function touch(cartId: string, settings: StoreSettings, data: Prisma.CartUpdateInput = {}) {
  await db.cart.update({
    where: { id: cartId },
    data: {
      ...data,
      status: "ACTIVE",
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + settings.cartExpirationDays * 86_400_000),
    },
  });
}

// ───────────────────────── Alterações ─────────────────────────

export type CartMutation = { ok: true; message?: string } | { ok: false; message: string };

/** Adiciona ao carrinho, limitando a quantidade ao disponível. O carrinho não reserva estoque. */
export async function addCartItem(variantId: string, quantity: number, settings: StoreSettings): Promise<CartMutation & { productName?: string }> {
  const variant = await db.productVariant.findFirst({
    where: { id: variantId, isActive: true, product: { status: "ACTIVE" } },
    select: { id: true, stockOnHand: true, stockReserved: true, product: { select: { name: true } } },
  });
  if (!variant) return { ok: false, message: "Este produto não está mais disponível." };
  const available = availableOf(variant);
  if (available <= 0) return { ok: false, message: `${variant.product.name} está esgotado.` };

  const cart = await ensureCart(settings);
  const current = cart.items.find((item) => item.variantId === variantId)?.quantity ?? 0;
  const wanted = Math.min(MAX_QUANTITY, current + Math.max(1, Math.floor(quantity)));
  const final = Math.min(wanted, available);
  if (final === current) {
    return { ok: false, message: `Você já tem na sacola todas as ${available} unidades disponíveis de ${variant.product.name}.` };
  }

  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    create: { cartId: cart.id, variantId, quantity: final },
    update: { quantity: final },
  });
  await touch(cart.id, settings);
  return {
    ok: true,
    productName: variant.product.name,
    message: final < wanted ? `Adicionamos ${final - current}, que é o que temos disponível de ${variant.product.name}.` : undefined,
  };
}

export async function setCartItemQuantity(itemId: string, quantity: number, settings: StoreSettings): Promise<CartMutation> {
  const cart = await getCart();
  const item = cart?.items.find((entry) => entry.id === itemId);
  if (!cart || !item) return { ok: false, message: "Este item não está mais na sacola." };
  const available = availableOf(item.variant);
  const final = Math.max(1, Math.min(Math.floor(quantity), available, MAX_QUANTITY));
  await db.cartItem.update({ where: { id: itemId }, data: { quantity: final } });
  await touch(cart.id, settings);
  return final < quantity
    ? { ok: true, message: `Temos ${available} ${available === 1 ? "unidade disponível" : "unidades disponíveis"} de ${item.variant.product.name}.` }
    : { ok: true };
}

/** Remove o item e devolve o que foi removido, para o "Desfazer". */
export async function removeCartItem(itemId: string, settings: StoreSettings): Promise<{ ok: boolean; removed?: { variantId: string; quantity: number; name: string } }> {
  const cart = await getCart();
  const item = cart?.items.find((entry) => entry.id === itemId);
  if (!cart || !item) return { ok: false };
  await db.cartItem.delete({ where: { id: itemId } });
  await touch(cart.id, settings);
  return { ok: true, removed: { variantId: item.variantId, quantity: item.quantity, name: item.variant.product.name } };
}

export async function updateCart(cartId: string, settings: StoreSettings, data: Prisma.CartUpdateInput): Promise<void> {
  await touch(cartId, settings, data);
}

/**
 * Revalida a disponibilidade ao abrir a sacola e o checkout: ajusta quantidades acima do disponível
 * e tira itens que saíram do catálogo. Devolve os avisos explicando o que mudou.
 */
export async function revalidateCartStock(cart: CartRecord): Promise<{ cart: CartRecord; notices: string[] }> {
  const notices: string[] = [];
  let changed = false;

  for (const item of cart.items) {
    const name = item.variant.product.name;
    const available = item.variant.isActive && item.variant.product.status === "ACTIVE" ? availableOf(item.variant) : 0;
    if (available <= 0) {
      await db.cartItem.delete({ where: { id: item.id } });
      notices.push(`${name} esgotou e saiu da sua sacola.`);
      changed = true;
    } else if (item.quantity > available) {
      await db.cartItem.update({ where: { id: item.id }, data: { quantity: available } });
      notices.push(`A quantidade de ${name} foi ajustada para ${available}, que é o que temos disponível.`);
      changed = true;
    }
  }

  if (!changed) return { cart, notices };
  const fresh = await getCartById(cart.id);
  return { cart: fresh ?? cart, notices };
}

// ───────────────────────── Cupom ─────────────────────────

/** Carrega o cupom com as categorias (e subcategorias) e produtos aos quais se aplica. */
export async function loadCoupon(code: string): Promise<CouponData | null> {
  const coupon = await db.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { categories: { select: { id: true, children: { select: { id: true } } } }, products: { select: { id: true } } },
  });
  if (!coupon) return null;
  return {
    id: coupon.id,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    minSubtotalCents: coupon.minSubtotalCents,
    maxDiscountCents: coupon.maxDiscountCents,
    usageLimit: coupon.usageLimit,
    usageCount: coupon.usageCount,
    perCustomerLimit: coupon.perCustomerLimit,
    firstPurchaseOnly: coupon.firstPurchaseOnly,
    startsAt: coupon.startsAt,
    endsAt: coupon.endsAt,
    isActive: coupon.isActive,
    combinableWithPix: coupon.combinableWithPix,
    appliesToSameDay: coupon.appliesToSameDay,
    categoryIds: coupon.categories.flatMap((category) => [category.id, ...category.children.map((child) => child.id)]),
    productIds: coupon.products.map((product) => product.id),
  };
}

export type CustomerIdentity = { userId?: string | null; email?: string | null; cpf?: string | null };

/** Histórico do cliente para as regras de limite por cliente e de primeira compra. */
async function customerHistory(couponId: string, identity: CustomerIdentity) {
  const email = identity.email?.toLowerCase() || null;
  const who: Prisma.OrderWhereInput[] = [
    ...(identity.userId ? [{ userId: identity.userId }] : []),
    ...(email ? [{ customerEmail: email }] : []),
    ...(identity.cpf ? [{ customerCpf: identity.cpf }] : []),
  ];
  if (who.length === 0) return { customerRedemptions: 0, hasPaidOrder: false };

  const [customerRedemptions, paidOrder] = await Promise.all([
    db.couponRedemption.count({
      where: { couponId, OR: [...(identity.userId ? [{ userId: identity.userId }] : []), ...(email ? [{ email }] : [])] },
    }),
    db.order.findFirst({ where: { paidAt: { not: null }, OR: who }, select: { id: true } }),
  ]);
  return { customerRedemptions, hasPaidOrder: Boolean(paidOrder) };
}

// ───────────────────────── Visão calculada ─────────────────────────

export type CartLine = {
  itemId: string;
  variantId: string;
  productId: string;
  productSlug: string;
  name: string;
  variantName: string | null;
  sku: string;
  categoryName: string | null;
  image: ProductImageData | null;
  quantity: number;
  available: number;
  price: PriceDisplay;
  lineTotalCents: number;
  weightGrams: number;
  costCents: number | null;
  sameDayEligible: boolean;
  deliveryScope: "LOCAL_ONLY" | "NATIONAL";
  perishable: boolean;
  productType: string;
  categoryIds: string[];
};

export type CartView = {
  id: string;
  lines: CartLine[];
  itemCount: number;
  subtotalCents: number;
  coupon: (CouponResult & { code: string }) | null;
  giftWrap: boolean;
  giftMessage: string | null;
  shippingCep: string | null;
  email: string | null;
  totals: Totals;
  hasLocalOnly: boolean;
  hasPerishable: boolean;
};

export function buildCartLines(cart: CartRecord, settings: StoreSettings, now: Date = new Date()): CartLine[] {
  return cart.items.map((item) => {
    const { variant } = item;
    const { product } = variant;
    const price = getPriceDisplay(variant, settings, now);
    // O cupom por categoria vale também para as subcategorias: inclui o pai de cada categoria do produto.
    const categoryIds = [
      product.primaryCategoryId,
      product.primaryCategory?.parentId,
      ...product.additionalCategories.flatMap((category) => [category.id, category.parentId]),
    ].filter((id): id is string => Boolean(id));
    return {
      itemId: item.id,
      variantId: variant.id,
      productId: product.id,
      productSlug: product.slug,
      name: product.name,
      variantName: variant.name === "Padrão" ? null : variant.name,
      sku: variant.sku,
      categoryName: product.primaryCategory?.name ?? null,
      image: toImage(product.images[0]?.media, product.name),
      quantity: item.quantity,
      available: availableOf(variant),
      price,
      lineTotalCents: price.priceCents * item.quantity,
      weightGrams: variant.weightGrams,
      costCents: variant.costCents,
      sameDayEligible: product.sameDayEligible,
      deliveryScope: product.deliveryScope,
      perishable: product.perishable,
      productType: product.productType,
      categoryIds: [...new Set(categoryIds)],
    };
  });
}

/**
 * Sacola calculada no servidor: preços, cupom e totais. Nada disso vem do navegador.
 * O frete entra pelo checkout (shippingCents), porque depende do CEP e do método escolhido.
 */
export async function buildCartView(
  cart: CartRecord,
  settings: StoreSettings,
  options: { paymentMethod?: PaymentMethodCode | null; shippingCents?: number; identity?: CustomerIdentity; now?: Date } = {},
): Promise<CartView> {
  const now = options.now ?? new Date();
  const lines = buildCartLines(cart, settings, now);
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);

  let coupon: CartView["coupon"] = null;
  if (cart.couponCode) {
    const data = await loadCoupon(cart.couponCode);
    const history = data
      ? await customerHistory(data.id, { userId: cart.userId, email: cart.email, ...options.identity })
      : { customerRedemptions: 0, hasPaidOrder: false };
    const result = data
      ? validateCoupon(data, {
          now,
          subtotalCents,
          lines: lines.map((line) => ({ productId: line.productId, categoryIds: line.categoryIds, totalCents: line.lineTotalCents })),
          ...history,
        })
      : ({ ok: false, error: COUPON_NOT_FOUND } as const);
    coupon = { ...result, code: cart.couponCode };
  }

  const giftWrapCents = cart.giftWrap ? settings.giftWrapPriceCents : 0;
  return {
    id: cart.id,
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalCents,
    coupon,
    giftWrap: cart.giftWrap,
    giftMessage: cart.giftMessage,
    shippingCep: cart.shippingCep,
    email: cart.email,
    totals: computeTotals({
      subtotalCents,
      couponDiscountCents: coupon?.ok ? coupon.discountCents : 0,
      couponCombinableWithPix: coupon?.ok ? coupon.coupon.combinableWithPix : true,
      paymentMethod: options.paymentMethod ?? null,
      pixDiscountPercent: settings.pixDiscountPercent,
      shippingCents: options.shippingCents ?? 0,
      giftWrapCents,
    }),
    hasLocalOnly: lines.some((line) => line.deliveryScope === "LOCAL_ONLY"),
    hasPerishable: lines.some((line) => line.perishable),
  };
}

/** Itens no formato que o provider de frete espera. */
export function toShippingItems(lines: CartLine[]) {
  return lines.map((line) => ({
    variantId: line.variantId,
    quantity: line.quantity,
    weightGrams: line.weightGrams,
    sameDayEligible: line.sameDayEligible,
    deliveryScope: line.deliveryScope,
  }));
}

/** Sugestões de complemento para a sacola: mais vendidos disponíveis que ainda não estão nela. */
export async function getCartSuggestionIds(lines: CartLine[], limit: number): Promise<string[]> {
  const inCart = new Set(lines.map((line) => line.productId));
  const wantsPots = lines.some((line) => ["NATURAL_PLANT", "ORCHID"].includes(line.productType));
  const rows = await db.product.findMany({
    where: {
      status: "ACTIVE",
      totalAvailable: { gt: 0 },
      id: { notIn: [...inCart] },
      ...(wantsPots ? { productType: { in: ["CACHEPOT", "GARDEN_SUPPLY", "AROMA"] } } : {}),
    },
    orderBy: [{ salesCount30d: "desc" }, { ratingCount: "desc" }],
    take: limit,
    select: { id: true },
  });
  return rows.map((row) => row.id);
}
