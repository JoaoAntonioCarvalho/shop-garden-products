import { percentOf } from "@/lib/money";

export type PaymentMethodCode = "PIX" | "CREDIT_CARD" | "BOLETO" | "MANUAL";

export type TotalsInput = {
  subtotalCents: number;
  /** Desconto do cupom já validado (0 sem cupom). */
  couponDiscountCents: number;
  /** Falso: o cupom não acumula com o desconto do Pix; vale o maior dos dois. */
  couponCombinableWithPix: boolean;
  paymentMethod: PaymentMethodCode | null;
  pixDiscountPercent: number;
  shippingCents: number;
  giftWrapCents: number;
};

export type Totals = {
  subtotalCents: number;
  /** Desconto do cupom efetivamente aplicado. */
  discountCents: number;
  /** Desconto do Pix efetivamente aplicado. */
  pixDiscountCents: number;
  shippingCents: number;
  giftWrapCents: number;
  totalCents: number;
  /** Total se o pagamento for por Pix (para destacar na sacola e no checkout). */
  totalWithPixCents: number;
  /** Quanto se economiza escolhendo Pix em relação aos outros meios. */
  pixSavingsCents: number;
  /**
   * Quando o cupom não acumula com o Pix e o cliente paga por Pix: qual dos dois descontos venceu.
   * O cliente vê os dois valores e qual foi aplicado.
   */
  nonCombinable: { applied: "coupon" | "pix"; couponCents: number; pixCents: number } | null;
};

/**
 * Única conta de totais da loja: sacola, checkout e criação do pedido usam esta função.
 * O cupom é aplicado antes do desconto do Pix.
 */
export function computeTotals(input: TotalsInput): Totals {
  const { subtotalCents, couponDiscountCents, shippingCents, giftWrapCents, pixDiscountPercent } =
    input;
  const extras = shippingCents + giftWrapCents;
  const coupon = Math.min(couponDiscountCents, subtotalCents);

  // Cenário "paga por Pix".
  let pixCoupon = coupon;
  let pixDiscount = percentOf(subtotalCents - coupon, pixDiscountPercent);
  let nonCombinable: Totals["nonCombinable"] = null;
  if (!input.couponCombinableWithPix && coupon > 0 && pixDiscountPercent > 0) {
    const pixAlone = percentOf(subtotalCents, pixDiscountPercent);
    if (coupon >= pixAlone) {
      pixDiscount = 0;
      nonCombinable = { applied: "coupon", couponCents: coupon, pixCents: pixAlone };
    } else {
      pixCoupon = 0;
      pixDiscount = pixAlone;
      nonCombinable = { applied: "pix", couponCents: coupon, pixCents: pixAlone };
    }
  }
  const totalWithPixCents = subtotalCents - pixCoupon - pixDiscount + extras;
  const totalOtherCents = subtotalCents - coupon + extras;

  const isPix = input.paymentMethod === "PIX";
  return {
    subtotalCents,
    discountCents: isPix ? pixCoupon : coupon,
    pixDiscountCents: isPix ? pixDiscount : 0,
    shippingCents,
    giftWrapCents,
    totalCents: isPix ? totalWithPixCents : totalOtherCents,
    totalWithPixCents,
    pixSavingsCents: Math.max(0, totalOtherCents - totalWithPixCents),
    nonCombinable: isPix ? nonCombinable : null,
  };
}
