import "server-only";
import { db } from "@/lib/db";
import {
  blockedCartNotice,
  findBlockedItems,
  readCepRanges,
  type BlockedItem,
  type RestrictedItem,
} from "@/lib/delivery-areas";
import { normalizeCep } from "@/lib/validators/cep";
import { getShippingProvider, loadShippingRules } from "@/server/providers/shipping";
import { isBlockedByLocalOnly } from "@/server/providers/shipping/mock";
import type { ShippingOption, ShippingQuoteItem } from "@/server/providers/shipping/types";
import type { CouponData } from "./coupons";

export type ShippingQuote = {
  options: ShippingOption[];
  notice: string | null;
  /** Há item que não pode ser entregue no CEP (área do produto ou entrega só local). */
  blockedByLocalOnly: boolean;
  /** Quais itens, e a área em que cada um é entregue. */
  blockedItems: BlockedItem[];
};

/** Nome, escopo e área de entrega do produto de cada item. */
async function loadRestrictions(items: ShippingQuoteItem[]): Promise<RestrictedItem[]> {
  const variants = await db.productVariant.findMany({
    where: { id: { in: items.map((item) => item.variantId) } },
    select: {
      id: true,
      product: {
        select: { name: true, deliveryArea: { select: { name: true, cepRanges: true } } },
      },
    },
  });
  const byId = new Map(variants.map((variant) => [variant.id, variant.product]));
  return items.map((item) => {
    const product = byId.get(item.variantId);
    return {
      variantId: item.variantId,
      name: product?.name ?? "Um item da sacola",
      localOnly: item.deliveryScope === "LOCAL_ONLY",
      area: product?.deliveryArea
        ? { name: product.deliveryArea.name, ranges: readCepRanges(product.deliveryArea.cepRanges) }
        : null,
    };
  });
}

/** Métodos em que o cupom de frete grátis vale: entregas locais; a do mesmo dia só se o cupom permitir. */
function couponCoversOption(coupon: CouponData, option: ShippingOption): boolean {
  if (option.requiresScheduling) return true;
  if (option.deliveryDate && option.minDays === 0) return coupon.appliesToSameDay;
  return false;
}

/** Zera o frete dos métodos elegíveis quando há cupom de frete grátis válido. */
export function applyFreeShippingCoupon(
  options: ShippingOption[],
  coupon: CouponData | null,
): ShippingOption[] {
  if (!coupon || coupon.type !== "FREE_SHIPPING") return options;
  return options.map((option) =>
    couponCoversOption(coupon, option) ? { ...option, priceCents: 0, isFree: true } : option,
  );
}

/**
 * Cotação de frete usada pelo produto, pela sacola e pelo checkout. Sempre no servidor,
 * sempre pelo mesmo provider.
 */
export async function quoteShipping(input: {
  cep: string;
  items: ShippingQuoteItem[];
  subtotalCents: number;
  freeShippingCoupon?: CouponData | null;
  now?: Date;
}): Promise<ShippingQuote> {
  const now = input.now ?? new Date();
  const quoteInput = {
    cep: input.cep,
    items: input.items,
    subtotalCents: input.subtotalCents,
    now,
  };
  const [options, rules, restrictions] = await Promise.all([
    getShippingProvider().quote(quoteInput),
    loadShippingRules(),
    loadRestrictions(input.items),
  ]);
  const cep = normalizeCep(input.cep);
  const blockedItems = cep
    ? findBlockedItems(cep, restrictions, !isBlockedByLocalOnly(quoteInput, rules))
    : [];
  // Com item que não vai para o CEP, nenhuma opção é oferecida: o pedido não pode ser fechado assim.
  if (blockedItems.length > 0)
    return {
      options: [],
      blockedByLocalOnly: true,
      blockedItems,
      notice: blockedCartNotice(blockedItems),
    };

  return {
    options: applyFreeShippingCoupon(options, input.freeShippingCoupon ?? null),
    blockedByLocalOnly: false,
    blockedItems,
    notice:
      options.length === 0
        ? "Não encontramos opções de entrega para este CEP. Confira os números ou fale com a gente pelo WhatsApp."
        : null,
  };
}
