import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  businessDaysUntil,
  formatMinutesLeft,
  getSameDayStatus,
  zonedParts,
} from "@/lib/dates";
import {
  computeShippingOptions,
  isBlockedByLocalOnly,
  type ShippingRuleData,
  type ShippingSettings,
} from "@/server/providers/shipping/mock";
import type { ShippingQuoteItem } from "@/server/providers/shipping/types";

const rule = (overrides: Partial<ShippingRuleData>): ShippingRuleData => ({
  code: "x",
  name: "x",
  method: "NATIONAL_ECONOMY",
  cepStart: "00000000",
  cepEnd: "99999999",
  baseFeeCents: 0,
  feePerKgCents: 0,
  freeAboveCents: null,
  usesStoreFreeThreshold: false,
  minDays: 0,
  maxDays: 0,
  cutoffTime: null,
  weekdays: [1, 2, 3, 4, 5, 6],
  allowsLocalOnlyProducts: false,
  description: null,
  isActive: true,
  position: 0,
  ...overrides,
});

const rules: ShippingRuleData[] = [
  rule({
    code: "entrega-hoje",
    name: "Entrega hoje",
    method: "SAME_DAY",
    cepStart: "01000000",
    cepEnd: "05999999",
    baseFeeCents: 2990,
    cutoffTime: "14:00",
    allowsLocalOnlyProducts: true,
    position: 0,
  }),
  rule({
    code: "agendada",
    name: "Entrega agendada",
    method: "LOCAL_SCHEDULED",
    cepStart: "01000000",
    cepEnd: "09999999",
    baseFeeCents: 1990,
    usesStoreFreeThreshold: true,
    minDays: 1,
    maxDays: 14,
    allowsLocalOnlyProducts: true,
    position: 1,
  }),
  rule({
    code: "economico-0",
    name: "Envio econômico",
    method: "NATIONAL_ECONOMY",
    cepStart: "00000000",
    cepEnd: "09999999",
    baseFeeCents: 1890,
    feePerKgCents: 350,
    usesStoreFreeThreshold: true,
    minDays: 2,
    maxDays: 4,
    weekdays: [1, 2, 3, 4, 5],
    position: 10,
  }),
  rule({
    code: "economico-2",
    name: "Envio econômico",
    method: "NATIONAL_ECONOMY",
    cepStart: "20000000",
    cepEnd: "29999999",
    baseFeeCents: 2790,
    feePerKgCents: 350,
    usesStoreFreeThreshold: true,
    minDays: 4,
    maxDays: 7,
    weekdays: [1, 2, 3, 4, 5],
    position: 12,
  }),
  rule({
    code: "expresso-2",
    name: "Envio expresso",
    method: "NATIONAL_EXPRESS",
    cepStart: "20000000",
    cepEnd: "29999999",
    baseFeeCents: 4290,
    feePerKgCents: 600,
    minDays: 2,
    maxDays: 3,
    weekdays: [1, 2, 3, 4, 5],
    position: 32,
  }),
  rule({
    code: "retirada",
    name: "Retirada na loja",
    method: "PICKUP",
    isActive: false,
    allowsLocalOnlyProducts: true,
    position: 50,
  }),
];

const settings: ShippingSettings = {
  sameDay: {
    enabled: true,
    cutoffTime: "14:00",
    days: [1, 2, 3, 4, 5, 6],
    cepRanges: [],
    deliverByHour: 20,
  },
  freeShippingThresholdCents: 29900,
  holidays: ["2026-10-12"],
  address: "Endereço de teste",
};

const vase: ShippingQuoteItem = {
  variantId: "v",
  quantity: 1,
  weightGrams: 2500,
  sameDayEligible: true,
  deliveryScope: "NATIONAL",
};
const plant: ShippingQuoteItem = {
  variantId: "p",
  quantity: 1,
  weightGrams: 1500,
  sameDayEligible: true,
  deliveryScope: "LOCAL_ONLY",
};

// 2026-10-03 é sábado; 2026-10-04 é domingo; 2026-10-12 é feriado (segunda).
const saturdayMorning = new Date("2026-10-03T10:00:00-03:00");
const saturdayAfternoon = new Date("2026-10-03T14:00:00-03:00");
const sunday = new Date("2026-10-04T10:00:00-03:00");
const holiday = new Date("2026-10-12T10:00:00-03:00");

const quote = (cep: string, items: ShippingQuoteItem[], now: Date, subtotalCents = 10000) =>
  computeShippingOptions({ cep, items, subtotalCents, now }, rules, settings);
const codes = (options: ReturnType<typeof quote>) => options.map((option) => option.code);

describe("horário de corte no fuso de São Paulo", () => {
  it("usa o horário de São Paulo, não o do servidor", () => {
    // 16:59 UTC = 13:59 em São Paulo
    const parts = zonedParts(new Date("2026-10-03T16:59:00Z"));
    expect(parts).toMatchObject({ dateKey: "2026-10-03", hour: 13, minute: 59, weekday: 6 });
    // 02:30 UTC de domingo ainda é sábado 23:30 em São Paulo
    expect(zonedParts(new Date("2026-10-04T02:30:00Z")).dateKey).toBe("2026-10-03");
  });

  it("abre até um minuto antes do corte e fecha no corte", () => {
    const sameDay = settings.sameDay;
    expect(getSameDayStatus(sameDay, [], new Date("2026-10-03T16:59:00Z"))).toEqual({
      open: true,
      minutesLeft: 1,
    });
    expect(getSameDayStatus(sameDay, [], new Date("2026-10-03T17:00:00Z")).open).toBe(false);
    expect(getSameDayStatus(sameDay, [], new Date("2026-10-03T14:46:00Z"))).toEqual({
      open: true,
      minutesLeft: 134,
    });
    expect(formatMinutesLeft(134)).toBe("2h14min");
    expect(formatMinutesLeft(45)).toBe("45min");
  });

  it("fecha em domingo, em feriado e quando desligado", () => {
    expect(getSameDayStatus(settings.sameDay, [], sunday).open).toBe(false);
    expect(getSameDayStatus(settings.sameDay, settings.holidays, holiday).open).toBe(false);
    expect(
      getSameDayStatus({ ...settings.sameDay, enabled: false }, [], saturdayMorning).open,
    ).toBe(false);
  });

  it("conta dias úteis pulando fim de semana e feriado", () => {
    // sexta 09/10 + 1 dia útil: segunda 12 é feriado, então terça 13
    expect(addBusinessDays("2026-10-09", 1, settings.holidays)).toBe("2026-10-13");
    expect(addBusinessDays("2026-10-02", 3, [])).toBe("2026-10-07");
    expect(businessDaysUntil("2026-10-03", "2026-10-06", [])).toBe(2);
    expect(businessDaysUntil("2026-10-03", "2026-10-03", [])).toBe(0);
  });
});

describe("opções de frete", () => {
  it("capital de SP antes do corte: entrega hoje, agendada e envio econômico", () => {
    const options = quote("01310-100", [vase], saturdayMorning);
    expect(codes(options)).toEqual(["entrega-hoje", "agendada", "economico-0"]);
    expect(options[0]).toMatchObject({
      priceCents: 2990,
      deliveryDate: "2026-10-03",
      description: "Receba hoje até 20h.",
    });
  });

  it("depois do corte, no domingo e no feriado não há entrega hoje", () => {
    expect(codes(quote("01310-100", [vase], saturdayAfternoon))).not.toContain("entrega-hoje");
    expect(codes(quote("01310-100", [vase], sunday))).not.toContain("entrega-hoje");
    expect(codes(quote("01310-100", [vase], holiday))).not.toContain("entrega-hoje");
  });

  it("entrega hoje exige todos os itens elegíveis e CEP na faixa da capital", () => {
    expect(
      codes(
        quote(
          "01310-100",
          [vase, { ...vase, variantId: "z", sameDayEligible: false }],
          saturdayMorning,
        ),
      ),
    ).not.toContain("entrega-hoje");
    // Santo André: Grande SP, fora da capital
    expect(codes(quote("09010-000", [vase], saturdayMorning))).toEqual(["agendada", "economico-0"]);
  });

  it("agendada oferece 14 datas, sem domingos e feriados, a partir de amanhã", () => {
    const scheduled = quote("09010-000", [vase], saturdayMorning).find(
      (option) => option.code === "agendada",
    )!;
    expect(scheduled.requiresScheduling).toBe(true);
    expect(scheduled.availableDates).toHaveLength(14);
    expect(scheduled.availableDates![0]).toBe("2026-10-05"); // domingo 04 fica de fora
    expect(scheduled.availableDates).not.toContain("2026-10-11");
    expect(scheduled.availableDates).not.toContain("2026-10-12");
  });

  it("frete grátis acima do limite na agendada e no econômico, nunca na entrega hoje nem no expresso", () => {
    const local = quote("01310-100", [vase], saturdayMorning, 29900);
    expect(local.find((o) => o.code === "agendada")).toMatchObject({
      isFree: true,
      priceCents: 0,
      originalPriceCents: 1990,
    });
    expect(local.find((o) => o.code === "entrega-hoje")).toMatchObject({
      isFree: false,
      priceCents: 2990,
    });
    const national = quote("22041-001", [vase], saturdayMorning, 50000);
    expect(national.find((o) => o.code === "economico-2")?.isFree).toBe(true);
    expect(national.find((o) => o.code === "expresso-2")?.isFree).toBe(false);
    expect(
      quote("01310-100", [vase], saturdayMorning, 29899).find((o) => o.code === "agendada")?.isFree,
    ).toBe(false);
  });

  it("nacional: base mais valor por quilo, arredondando o peso para cima", () => {
    const options = quote("22041-001", [{ ...vase, quantity: 2 }], saturdayMorning); // 5 kg
    expect(options.find((o) => o.code === "economico-2")).toMatchObject({
      priceCents: 2790 + 350 * 5,
      minDays: 4,
      maxDays: 7,
    });
    expect(options.find((o) => o.code === "expresso-2")).toMatchObject({
      priceCents: 4290 + 600 * 5,
    });
    const light = quote("22041-001", [{ ...vase, weightGrams: 2100 }], saturdayMorning); // 2,1 kg → 3 kg
    expect(light.find((o) => o.code === "economico-2")?.priceCents).toBe(2790 + 350 * 3);
  });

  it("itens só locais: na Grande SP só entregas locais; fora dela, nenhuma opção e o aviso", () => {
    expect(codes(quote("01310-100", [plant, vase], saturdayMorning))).toEqual([
      "entrega-hoje",
      "agendada",
    ]);
    const rio = {
      cep: "22041-001",
      items: [plant, vase],
      subtotalCents: 10000,
      now: saturdayMorning,
    };
    expect(computeShippingOptions(rio, rules, settings)).toEqual([]);
    expect(isBlockedByLocalOnly(rio, rules)).toBe(true);
    expect(isBlockedByLocalOnly({ ...rio, items: [vase] }, rules)).toBe(false);
    expect(isBlockedByLocalOnly({ ...rio, cep: "01310-100" }, rules)).toBe(false);
  });

  it("regra inativa não aparece; CEP inválido não devolve nada", () => {
    expect(codes(quote("01310-100", [vase], saturdayMorning))).not.toContain("retirada");
    expect(quote("123", [vase], saturdayMorning)).toEqual([]);
  });
});
