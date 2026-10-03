import { describe, expect, it } from "vitest";
import { formatBRL, formatBRLShort, parseBRLToCents } from "@/lib/money";
import { getInstallments, getPixPriceCents, getPriceDisplay } from "@/server/services/pricing";

const settings = { pixDiscountPercent: 5, maxInstallments: 6, minInstallmentCents: 3000 };
const now = new Date("2026-10-03T12:00:00-03:00");

describe("preço efetivo e promoção por data", () => {
  it("sem promoção usa o preço normal", () => {
    const price = getPriceDisplay({ priceCents: 24900 }, settings, now);
    expect(price.priceCents).toBe(24900);
    expect(price.compareAtCents).toBeNull();
    expect(price.onPromotion).toBe(false);
  });

  it("promoção dentro do período vale e o preço normal vira o preço 'de'", () => {
    const price = getPriceDisplay(
      {
        priceCents: 20000,
        promoPriceCents: 17000,
        promoStartsAt: new Date("2026-10-01T00:00:00-03:00"),
        promoEndsAt: new Date("2026-10-10T23:59:59-03:00"),
      },
      settings,
      now,
    );
    expect(price.priceCents).toBe(17000);
    expect(price.compareAtCents).toBe(20000);
    expect(price.discountPercent).toBe(15);
    expect(price.promoEndsAt).toEqual(new Date("2026-10-10T23:59:59-03:00"));
  });

  it("promoção que ainda não começou ou já terminou não vale", () => {
    const future = {
      priceCents: 20000,
      promoPriceCents: 17000,
      promoStartsAt: new Date("2026-10-04T00:00:00-03:00"),
    };
    const past = {
      priceCents: 20000,
      promoPriceCents: 17000,
      promoEndsAt: new Date("2026-10-02T00:00:00-03:00"),
    };
    expect(getPriceDisplay(future, settings, now).priceCents).toBe(20000);
    expect(getPriceDisplay(past, settings, now).priceCents).toBe(20000);
  });

  it("promoção sem datas vale sempre; preço promocional maior que o normal é ignorado", () => {
    expect(
      getPriceDisplay({ priceCents: 20000, promoPriceCents: 15000 }, settings, now).priceCents,
    ).toBe(15000);
    expect(
      getPriceDisplay({ priceCents: 20000, promoPriceCents: 25000 }, settings, now).priceCents,
    ).toBe(20000);
  });

  it("preço 'de' só aparece quando é maior que o efetivo", () => {
    expect(
      getPriceDisplay({ priceCents: 20000, compareAtPriceCents: 25000 }, settings, now)
        .compareAtCents,
    ).toBe(25000);
    expect(
      getPriceDisplay({ priceCents: 20000, compareAtPriceCents: 20000 }, settings, now)
        .compareAtCents,
    ).toBeNull();
    expect(
      getPriceDisplay({ priceCents: 20000, compareAtPriceCents: 15000 }, settings, now)
        .compareAtCents,
    ).toBeNull();
  });

  it("com promoção ativa, o 'de' é o maior entre preço normal e compareAt", () => {
    const price = getPriceDisplay(
      { priceCents: 18900, compareAtPriceCents: 22900, promoPriceCents: 15900 },
      settings,
      now,
    );
    expect(price.compareAtCents).toBe(22900);
  });

  it("percentual de desconto é arredondado para baixo", () => {
    // 22900 → 15900 = 30,56%
    const price = getPriceDisplay({ priceCents: 22900, promoPriceCents: 15900 }, settings, now);
    expect(price.discountPercent).toBe(30);
  });
});

describe("preço no Pix", () => {
  it("aplica o percentual configurado", () => {
    expect(getPixPriceCents(10000, 5)).toBe(9500);
    expect(getPixPriceCents(28990, 5)).toBe(27541); // 27540,5 → meio centavo sobe
  });

  it("meio centavo arredonda para cima e abaixo disso para baixo", () => {
    expect(getPixPriceCents(1010, 5)).toBe(960); // 959,5 → 960
    expect(getPixPriceCents(1009, 5)).toBe(959); // 958,55 → 959
    expect(getPixPriceCents(1001, 5)).toBe(951); // 950,95 → 951
    expect(getPixPriceCents(1007, 5)).toBe(957); // 956,65 → 957
    expect(getPixPriceCents(1008, 5)).toBe(958); // 957,6 → 958
    expect(getPixPriceCents(1006, 10)).toBe(905); // 905,4 → 905
  });

  it("desconto zero mantém o preço", () => {
    expect(getPixPriceCents(12345, 0)).toBe(12345);
  });
});

describe("parcelamento", () => {
  it("usa o máximo de parcelas quando a parcela mínima permite", () => {
    expect(getInstallments(24900, settings)).toEqual({ count: 6, valueCents: 4150 });
  });

  it("reduz o número de parcelas para respeitar a parcela mínima", () => {
    expect(getInstallments(10000, settings)).toEqual({ count: 3, valueCents: 3333 });
    expect(getInstallments(6000, settings)).toEqual({ count: 2, valueCents: 3000 });
  });

  it("quando só cabe uma parcela, não oferece parcelamento", () => {
    expect(getInstallments(5999, settings)).toBeNull();
    expect(getInstallments(2900, settings)).toBeNull();
  });
});

describe("formatação de dinheiro", () => {
  const nbsp = " ";
  it("formata centavos em BRL", () => {
    expect(formatBRL(4150)).toBe(`R$${nbsp}41,50`);
    expect(formatBRL(123456)).toBe(`R$${nbsp}1.234,56`);
    expect(formatBRLShort(29900)).toBe(`R$${nbsp}299`);
    expect(formatBRLShort(2990)).toBe(`R$${nbsp}29,90`);
  });

  it("converte texto em reais para centavos", () => {
    expect(parseBRLToCents("1.234,56")).toBe(123456);
    expect(parseBRLToCents("R$ 12")).toBe(1200);
    expect(parseBRLToCents("19,9")).toBe(1990);
    expect(parseBRLToCents("12.50")).toBe(1250);
    expect(parseBRLToCents("abc")).toBeNull();
    expect(parseBRLToCents("")).toBeNull();
  });
});
