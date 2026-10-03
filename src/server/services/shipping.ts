import "server-only";
import { getShippingProvider, loadShippingRules } from "@/server/providers/shipping";
import { isBlockedByLocalOnly, LOCAL_ONLY_NOTICE } from "@/server/providers/shipping/mock";
import type { ShippingOption, ShippingQuoteItem } from "@/server/providers/shipping/types";
import type { CouponData } from "./coupons";

export type ShippingQuote = {
  options: ShippingOption[];
  notice: string | null;
  blockedByLocalOnly: boolean;
};

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
  const [options, rules] = await Promise.all([
    getShippingProvider().quote(quoteInput),
    loadShippingRules(),
  ]);
  const blockedByLocalOnly = isBlockedByLocalOnly(quoteInput, rules);

  return {
    options: applyFreeShippingCoupon(options, input.freeShippingCoupon ?? null),
    blockedByLocalOnly,
    notice: blockedByLocalOnly
      ? LOCAL_ONLY_NOTICE
      : options.length === 0
        ? "Não encontramos opções de entrega para este CEP. Confira os números ou fale com a gente pelo WhatsApp."
        : null,
  };
}
