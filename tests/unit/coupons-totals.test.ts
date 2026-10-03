import { describe, expect, it } from "vitest";
import {
  COUPON_NOT_FOUND,
  describeCoupon,
  validateCoupon,
  type CouponContext,
  type CouponData,
} from "@/server/services/coupons";
import { computeTotals } from "@/server/services/totals";

const now = new Date("2026-10-03T12:00:00-03:00");
const coupon = (overrides: Partial<CouponData> = {}): CouponData => ({
  id: "c1",
  code: "TESTE10",
  type: "PERCENT",
  value: 10,
  minSubtotalCents: null,
  maxDiscountCents: null,
  usageLimit: null,
  usageCount: 0,
  perCustomerLimit: null,
  firstPurchaseOnly: false,
  startsAt: null,
  endsAt: null,
  isActive: true,
  combinableWithPix: true,
  appliesToSameDay: false,
  categoryIds: [],
  productIds: [],
  ...overrides,
});
const context = (overrides: Partial<CouponContext> = {}): CouponContext => ({
  now,
  lines: [
    { productId: "planta", categoryIds: ["plantas"], totalCents: 20000 },
    { productId: "vaso", categoryIds: ["vasos"], totalCents: 10000 },
  ],
  subtotalCents: 30000,
  customerRedemptions: 0,
  hasPaidOrder: false,
  ...overrides,
});
const errorOf = (c: CouponData | null, ctx = context()) => {
  const result = validateCoupon(c, ctx);
  return result.ok ? null : result.error;
};

describe("validação de cupom, na ordem da seção 9.2", () => {
  it("1. inexistente ou inativo", () => {
    expect(errorOf(null)).toBe(COUPON_NOT_FOUND);
    expect(errorOf(coupon({ isActive: false }))).toBe(
      "Este cupom não existe. Confira se digitou corretamente.",
    );
  });

  it("2. fora do período, com a data na mensagem", () => {
    expect(errorOf(coupon({ endsAt: new Date("2026-09-10T23:59:00-03:00") }))).toBe(
      "Este cupom expirou em 10/09/2026.",
    );
    expect(errorOf(coupon({ startsAt: new Date("2026-11-01T00:00:00-03:00") }))).toBe(
      "Este cupom só vale a partir de 01/11/2026.",
    );
  });

  it("3. limite total de uso", () => {
    expect(errorOf(coupon({ usageLimit: 20, usageCount: 20 }))).toMatch(/limite de usos/);
    expect(errorOf(coupon({ usageLimit: 20, usageCount: 19 }))).toBeNull();
  });

  it("4. limite por cliente", () => {
    expect(errorOf(coupon({ perCustomerLimit: 1 }), context({ customerRedemptions: 1 }))).toBe(
      "Você já usou este cupom.",
    );
  });

  it("5. primeira compra", () => {
    expect(errorOf(coupon({ firstPurchaseOnly: true }), context({ hasPaidOrder: true }))).toBe(
      "Este cupom vale só para a primeira compra.",
    );
    expect(errorOf(coupon({ firstPurchaseOnly: true }))).toBeNull();
  });

  it("6. subtotal mínimo, dizendo quanto falta", () => {
    const message = errorOf(coupon({ minSubtotalCents: 33200 }));
    expect(message).toBe("Faltam R$ 32,00 para usar este cupom.");
  });

  it("7. restrição de categoria e produto: desconto só nos itens elegíveis", () => {
    const byCategory = validateCoupon(coupon({ value: 15, categoryIds: ["plantas"] }), context());
    expect(byCategory).toMatchObject({ ok: true, discountCents: 3000 });
    const byProduct = validateCoupon(coupon({ productIds: ["vaso"] }), context());
    expect(byProduct).toMatchObject({ ok: true, discountCents: 1000 });
    expect(errorOf(coupon({ categoryIds: ["jardinagem"] }))).toBe(
      "Este cupom não vale para os produtos da sua sacola.",
    );
  });

  it("a ordem das regras é respeitada: período vem antes de subtotal mínimo", () => {
    const both = coupon({
      endsAt: new Date("2026-09-10T23:59:00-03:00"),
      minSubtotalCents: 999999,
    });
    expect(errorOf(both)).toMatch(/expirou/);
  });
});

describe("valor do desconto", () => {
  it("percentual, com teto", () => {
    expect(validateCoupon(coupon(), context())).toMatchObject({
      ok: true,
      discountCents: 3000,
      summary: "10% de desconto",
    });
    expect(validateCoupon(coupon({ value: 50, maxDiscountCents: 5000 }), context())).toMatchObject({
      discountCents: 5000,
    });
  });

  it("valor fixo nunca passa do valor dos itens", () => {
    expect(validateCoupon(coupon({ type: "FIXED", value: 2500 }), context())).toMatchObject({
      discountCents: 2500,
    });
    expect(validateCoupon(coupon({ type: "FIXED", value: 99999 }), context())).toMatchObject({
      discountCents: 30000,
    });
  });

  it("frete grátis não dá desconto nos produtos", () => {
    expect(validateCoupon(coupon({ type: "FREE_SHIPPING" }), context())).toMatchObject({
      ok: true,
      discountCents: 0,
      freeShipping: true,
    });
  });

  it("prévia em linguagem simples", () => {
    const text = describeCoupon({
      ...coupon({
        firstPurchaseOnly: true,
        minSubtotalCents: 10000,
        endsAt: new Date("2026-11-30T12:00:00-03:00"),
      }),
    });
    expect(text).toBe(
      "10% de desconto, válido na primeira compra, a partir de R$ 100,00, até 30/11/2026",
    );
  });
});

describe("totais do pedido", () => {
  const base = {
    subtotalCents: 28990,
    couponDiscountCents: 0,
    couponCombinableWithPix: true,
    pixDiscountPercent: 5,
    shippingCents: 0,
    giftWrapCents: 0,
  };

  it("Pix: desconto sobre os produtos, como no exemplo da especificação", () => {
    const totals = computeTotals({ ...base, paymentMethod: "PIX" });
    // R$ 289,90 → paga R$ 275,40 e economiza R$ 14,50
    expect(totals.totalCents).toBe(27540);
    expect(totals.pixDiscountCents).toBe(1450);
    expect(totals.pixSavingsCents).toBe(1450);
  });

  it("cartão e boleto não têm desconto do Pix, mas informam quanto o Pix economizaria", () => {
    const totals = computeTotals({ ...base, paymentMethod: "CREDIT_CARD" });
    expect(totals.totalCents).toBe(28990);
    expect(totals.pixDiscountCents).toBe(0);
    expect(totals.totalWithPixCents).toBe(27540);
  });

  it("o cupom é aplicado antes do Pix; frete e embalagem não entram no desconto", () => {
    const totals = computeTotals({
      ...base,
      subtotalCents: 30000,
      couponDiscountCents: 3000,
      shippingCents: 1990,
      giftWrapCents: 1500,
      paymentMethod: "PIX",
    });
    expect(totals.discountCents).toBe(3000);
    expect(totals.pixDiscountCents).toBe(1350); // 5% de 27000
    expect(totals.totalCents).toBe(30000 - 3000 - 1350 + 1990 + 1500);
  });

  it("cupom que não acumula com Pix: aplica o maior e informa os dois valores", () => {
    const couponWins = computeTotals({
      ...base,
      subtotalCents: 30000,
      couponDiscountCents: 2500,
      couponCombinableWithPix: false,
      paymentMethod: "PIX",
    });
    expect(couponWins.nonCombinable).toEqual({
      applied: "coupon",
      couponCents: 2500,
      pixCents: 1500,
    });
    expect(couponWins.discountCents).toBe(2500);
    expect(couponWins.pixDiscountCents).toBe(0);
    expect(couponWins.totalCents).toBe(27500);

    const pixWins = computeTotals({
      ...base,
      subtotalCents: 80000,
      couponDiscountCents: 2500,
      couponCombinableWithPix: false,
      paymentMethod: "PIX",
    });
    expect(pixWins.nonCombinable?.applied).toBe("pix");
    expect(pixWins.discountCents).toBe(0);
    expect(pixWins.pixDiscountCents).toBe(4000);
  });

  it("cupom que não acumula continua valendo no cartão", () => {
    const totals = computeTotals({
      ...base,
      subtotalCents: 80000,
      couponDiscountCents: 2500,
      couponCombinableWithPix: false,
      paymentMethod: "CREDIT_CARD",
    });
    expect(totals.discountCents).toBe(2500);
    expect(totals.totalCents).toBe(77500);
    expect(totals.nonCombinable).toBeNull();
  });
});
