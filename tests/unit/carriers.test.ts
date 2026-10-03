import { describe, expect, it } from "vitest";
import { estimatePackage } from "@/server/providers/shipping/carriers/package";
import {
  CarrierShippingProvider,
  type ItemShipmentInfo,
} from "@/server/providers/shipping/carriers/provider";
import {
  CarrierUnavailableError,
  type Carrier,
  type CarrierQuoteInput,
  type CarrierServiceQuote,
  type ServiceKind,
} from "@/server/providers/shipping/carriers/types";
import {
  CorreiosCarrier,
  exceedsCorreiosLimits,
} from "@/server/providers/shipping/correios/carrier";
import {
  JadlogClient,
  JadlogUnavailableError,
  jadlogChargedWeightKg,
  parseJadlogDate,
} from "@/server/providers/shipping/jadlog/client";
import type { ShippingRuleData, ShippingSettings } from "@/server/providers/shipping/mock";
import type { ShippingQuoteItem } from "@/server/providers/shipping/types";

describe("estimativa do pacote", () => {
  it("soma o peso, dá folga de embalagem e empilha as unidades", () => {
    const one = estimatePackage([
      { quantity: 1, weightGrams: 2500, dimensions: { widthCm: 20, depthCm: 20, heightCm: 26 } },
    ]);
    expect(one).toEqual({ weightGrams: 2500, lengthCm: 30, widthCm: 24, heightCm: 24 });

    const two = estimatePackage([
      { quantity: 2, weightGrams: 2500, dimensions: { widthCm: 20, depthCm: 20, heightCm: 26 } },
    ]);
    expect(two.weightGrams).toBe(5000);
    expect(two.heightCm).toBe(48);
  });

  it("usa medida padrão e peso mínimo quando o cadastro está incompleto", () => {
    expect(estimatePackage([{ quantity: 1, weightGrams: 0, dimensions: null }])).toEqual({
      weightGrams: 300,
      lengthCm: 20,
      widthCm: 20,
      heightCm: 20,
    });
  });

  it("respeita as medidas mínimas", () => {
    const small = estimatePackage([
      { quantity: 1, weightGrams: 100, dimensions: { widthCm: 5, depthCm: 3, heightCm: 1 } },
    ]);
    expect([small.lengthCm, small.widthCm]).toEqual([16, 11]);
    expect(small.heightCm).toBeGreaterThanOrEqual(2);
  });
});

const parcel = { weightGrams: 2500, lengthCm: 30, widthCm: 24, heightCm: 24 };
const tallPlant = estimatePackage([
  { quantity: 1, weightGrams: 9000, dimensions: { widthCm: 50, depthCm: 50, heightCm: 150 } },
]);

describe("Correios como transportadora", () => {
  it("recusa pacote acima de 100 cm por lado ou 200 cm na soma, sem chamar a API", async () => {
    expect(exceedsCorreiosLimits(parcel)).toBe(false);
    expect(exceedsCorreiosLimits(tallPlant)).toBe(true);
    expect(exceedsCorreiosLimits({ weightGrams: 1, lengthCm: 90, widthCm: 60, heightCm: 60 })).toBe(
      true,
    );

    const carrier = new CorreiosCarrier(
      {
        quote: async () => {
          throw new Error("não deveria chamar");
        },
      },
      { economy: "03298", express: "03220" },
    );
    const quotes = await carrier.quote({
      originCep: "04002000",
      destinationCep: "22041001",
      parcel: tallPlant,
      declaredValueCents: 10000,
      kinds: ["economy", "express"],
    });
    expect(quotes.economy?.ok).toBe(false);
    expect(quotes.express?.ok).toBe(false);
  });

  it("traduz econômico e expresso para os códigos de serviço do contrato", async () => {
    let asked: string[] = [];
    const carrier = new CorreiosCarrier(
      {
        quote: async (input) => {
          asked = input.services;
          return {
            "03298": { ok: true, priceCents: 2780, businessDays: 7 },
            "03220": { ok: false, error: "CEP não atendido" },
          };
        },
      },
      { economy: "03298", express: "03220" },
    );
    const quotes = await carrier.quote({
      originCep: "04002000",
      destinationCep: "22041001",
      parcel,
      declaredValueCents: 10000,
      kinds: ["economy", "express"],
    });
    expect(asked).toEqual(["03298", "03220"]);
    expect(quotes).toEqual({
      economy: { ok: true, priceCents: 2780, businessDays: 7 },
      express: { ok: false, error: "CEP não atendido" },
    });
  });
});

type Call = { url: string; init: RequestInit };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function fakeFetch(respond: (call: Call) => Response) {
  const calls: Call[] = [];
  const fetcher = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call = { url: String(input), init };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  return { fetcher, calls };
}
const jadlogConfig = {
  baseUrl: "https://jadlog.test",
  trackingUrl: "https://tracking.jadlog.test",
  token: "token-da-jadlog",
  cnpj: "12345678000190",
  account: "001234",
  modalities: { economy: 3, express: 0 },
};
const quoteInput: CarrierQuoteInput = {
  originCep: "04002000",
  destinationCep: "22041001",
  parcel,
  declaredValueCents: 15990,
  kinds: ["economy", "express"],
};

describe("Jadlog: cliente da API", () => {
  it("cobra o maior entre o peso real e o cubado da modalidade", () => {
    // 30 × 24 × 24 = 17.280 cm³: 5,18 kg no rodoviário (÷ 3333) e 2,88 kg no aéreo (÷ 6000).
    expect(jadlogChargedWeightKg(parcel, 3)).toBe(5.18);
    expect(jadlogChargedWeightKg(parcel, 0)).toBe(2.88);
    expect(jadlogChargedWeightKg({ ...parcel, weightGrams: 9000 }, 3)).toBe(9);
  });

  it("lê a data dos eventos como horário de Brasília", () => {
    expect(parseJadlogDate("2023-03-22 15:12:06")?.toISOString()).toBe("2023-03-22T18:12:06.000Z");
    expect(parseJadlogDate("")).toBeNull();
  });

  it("simula o frete das modalidades em uma chamada, com token, CNPJ e valor declarado", async () => {
    const api = fakeFetch(() =>
      json({
        frete: [
          { modalidade: 3, prazo: 5, vltotal: 31.9 },
          { modalidade: 0, prazo: 2, vltotal: 58.45 },
        ],
      }),
    );
    const quotes = await new JadlogClient(jadlogConfig, api.fetcher).quote(quoteInput);
    expect(quotes).toEqual({
      economy: { ok: true, priceCents: 3190, businessDays: 5 },
      express: { ok: true, priceCents: 5845, businessDays: 2 },
    });

    const [call] = api.calls;
    expect(call.url).toBe("https://jadlog.test/embarcador/api/frete/valor");
    expect((call.init.headers as Record<string, string>).Authorization).toBe(
      "Bearer token-da-jadlog",
    );
    expect(JSON.parse(String(call.init.body)).frete[0]).toEqual({
      cepori: "04002000",
      cepdes: "22041001",
      frap: null,
      peso: 5.18,
      cnpj: "12345678000190",
      conta: "001234",
      contrato: null,
      modalidade: 3,
      tpentrega: "D",
      tpseguro: "N",
      vldeclarado: 159.9,
      vlcoleta: 0,
    });
  });

  it("modalidade sem código não é cotada; erro no item tira só aquele item", async () => {
    const api = fakeFetch(() =>
      json({
        frete: [
          { modalidade: 3, erro: { id: -2, descricao: "Destino fora da área de cobertura" } },
        ],
      }),
    );
    const client = new JadlogClient({ ...jadlogConfig, modalities: { economy: 3 } }, api.fetcher);
    const quotes = await client.quote(quoteInput);
    expect(quotes.economy).toEqual({ ok: false, error: "Destino fora da área de cobertura" });
    expect(quotes.express).toEqual({ ok: false, error: "Modalidade não contratada na Jadlog" });
    expect(JSON.parse(String(api.calls[0].init.body)).frete).toHaveLength(1);
  });

  it("erro na chamada inteira, token recusado e rede fora viram JadlogUnavailableError", async () => {
    const invalid = fakeFetch(() =>
      json({
        frete: [{ modalidade: 3 }],
        error: { id: -1, descricao: "frete[0].contrato Numero de contrato invalido" },
      }),
    );
    await expect(new JadlogClient(jadlogConfig, invalid.fetcher).quote(quoteInput)).rejects.toThrow(
      "Numero de contrato invalido",
    );

    const denied = fakeFetch(() => json({ descricao: "TOKEN INVALIDO", id: 1 }, 401));
    await expect(new JadlogClient(jadlogConfig, denied.fetcher).quote(quoteInput)).rejects.toThrow(
      JadlogUnavailableError,
    );

    const offline = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(new JadlogClient(jadlogConfig, offline).track("12345678901234")).rejects.toThrow(
      CarrierUnavailableError,
    );
  });

  it("consulta o tracking pelo número de rastreamento ou pelo shipmentId e reconhece a entrega", async () => {
    const api = fakeFetch(() =>
      json({
        consulta: [
          { cte: "12345678901234", erro: { id: 1, descricao: "Não localizado" } },
          {
            shipmentId: "12345678901234",
            tracking: {
              status: "ENTREGUE",
              eventos: [
                { data: "2023-03-22 15:12:06", status: "EMISSAO", unidade: "PA EXTREMA 02" },
                { data: "2023-03-24 10:02:00", status: "ENTREGUE", unidade: "CO RIO DE JANEIRO" },
              ],
            },
          },
        ],
      }),
    );
    const client = new JadlogClient(jadlogConfig, api.fetcher);
    const result = await client.track("12345678901234");
    expect(api.calls[0].url).toBe("https://tracking.jadlog.test/embarcador/api/tracking/consultar");
    expect(JSON.parse(String(api.calls[0].init.body))).toEqual({
      consulta: [{ cte: "12345678901234" }, { shipmentId: "12345678901234" }],
    });
    expect(result.ok && result.delivered).toBe(true);
    expect(result.ok && result.events.map((event) => event.description)).toEqual([
      "ENTREGUE",
      "EMISSAO",
    ]);

    const missing = fakeFetch(() =>
      json({ consulta: [{ cte: "1", erro: { id: 1, descricao: "Não localizado" } }] }),
    );
    expect(await new JadlogClient(jadlogConfig, missing.fetcher).track("1")).toEqual({
      ok: false,
      error: "Não localizado",
    });
  });
});

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
    code: "retirada",
    name: "Retirada",
    method: "PICKUP",
    cepStart: "01000000",
    cepEnd: "09999999",
  }),
  rule({
    code: "economico",
    name: "Envio econômico",
    baseFeeCents: 2000,
    feePerKgCents: 500,
    usesStoreFreeThreshold: true,
    minDays: 5,
    maxDays: 9,
    position: 1,
  }),
  rule({
    code: "expresso",
    name: "Envio expresso",
    method: "NATIONAL_EXPRESS",
    baseFeeCents: 4000,
    feePerKgCents: 800,
    minDays: 2,
    maxDays: 4,
    position: 2,
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
  holidays: [],
  address: "Endereço de teste",
};
const item = (variantId: string): ShippingQuoteItem => ({
  variantId,
  quantity: 1,
  weightGrams: 2500,
  sameDayEligible: true,
  deliveryScope: "NATIONAL",
});
const info = new Map<string, ItemShipmentInfo>([
  ["vaso", { dimensions: { widthCm: 20, depthCm: 20, heightCm: 26 }, jadlogOnly: false }],
  ["palmeira", { dimensions: { widthCm: 40, depthCm: 40, heightCm: 90 }, jadlogOnly: true }],
]);

type Quotes = Partial<Record<ServiceKind, CarrierServiceQuote>>;
function fakeCarrier(key: Carrier["key"], label: string, answer: () => Promise<Quotes>) {
  let calls = 0;
  const carrier: Carrier = {
    key,
    label,
    quote: async () => {
      calls++;
      return answer();
    },
  };
  return { carrier, calls: () => calls };
}
const ok = (priceCents: number, businessDays: number): CarrierServiceQuote => ({
  ok: true,
  priceCents,
  businessDays,
});
function makeProvider(carriers: Carrier[], ruleSet = rules) {
  const logs: string[] = [];
  const provider = new CarrierShippingProvider({
    carriers,
    load: async () => ({ rules: ruleSet, settings }),
    loadItemInfo: async () => info,
    originCep: "04002000",
    handlingDays: 1,
    log: (message) => logs.push(message),
  });
  return { provider, logs };
}
const input = (
  overrides: Partial<{ cep: string; subtotalCents: number; items: ShippingQuoteItem[] }> = {},
) => ({
  cep: "22041001",
  items: [item("vaso")],
  subtotalCents: 10000,
  now: new Date("2026-10-06T10:00:00-03:00"),
  ...overrides,
});
const summary = (
  options: Array<{
    code: string;
    name: string;
    priceCents: number;
    minDays: number;
    maxDays: number;
  }>,
) => options.map((o) => [o.code, o.name, o.priceCents, o.minDays, o.maxDays]);

describe("provider de frete com transportadoras", () => {
  it("escolhe a transportadora mais barata em cada modalidade e põe o nome dela na opção", async () => {
    const correios = fakeCarrier("correios", "Correios", async () => ({
      economy: ok(2780, 7),
      express: ok(5410, 2),
    }));
    const jadlog = fakeCarrier("jadlog", "Jadlog", async () => ({
      economy: ok(3190, 5),
      express: ok(4900, 3),
    }));
    const { provider } = makeProvider([correios.carrier, jadlog.carrier]);
    expect(summary(await provider.quote(input()))).toEqual([
      ["economico", "Envio econômico (Correios)", 2780, 8, 12],
      ["expresso", "Envio expresso (Jadlog)", 4900, 4, 6],
    ]);
  });

  it("produto só Jadlog na sacola: os Correios nem são consultados", async () => {
    const correios = fakeCarrier("correios", "Correios", async () => ({ economy: ok(1000, 3) }));
    const jadlog = fakeCarrier("jadlog", "Jadlog", async () => ({
      economy: ok(8900, 6),
      express: { ok: false, error: "Modalidade não contratada na Jadlog" },
    }));
    const { provider } = makeProvider([correios.carrier, jadlog.carrier]);
    const options = await provider.quote(input({ items: [item("vaso"), item("palmeira")] }));
    expect(summary(options)).toEqual([["economico", "Envio econômico (Jadlog)", 8900, 7, 11]]);
    expect(correios.calls()).toBe(0);
  });

  it("produto só Jadlog sem a Jadlog ligada: vale a tabela do painel, com aviso no log", async () => {
    const correios = fakeCarrier("correios", "Correios", async () => ({ economy: ok(1000, 3) }));
    const { provider, logs } = makeProvider([correios.carrier]);
    const options = await provider.quote(input({ items: [item("palmeira")] }));
    expect(options.map((o) => o.name)).toEqual(["Envio econômico", "Envio expresso"]);
    expect(correios.calls()).toBe(0);
    expect(logs[0]).toContain("só Jadlog");
  });

  it("mantém o frete grátis da loja e mostra o valor da transportadora como original", async () => {
    const correios = fakeCarrier("correios", "Correios", async () => ({
      economy: ok(2780, 7),
      express: ok(5410, 2),
    }));
    const { provider } = makeProvider([correios.carrier]);
    const [economy] = await provider.quote(input({ subtotalCents: 35000 }));
    expect(economy).toMatchObject({
      code: "economico",
      isFree: true,
      priceCents: 0,
      originalPriceCents: 2780,
    });
  });

  it("não consulta transportadora quando só há opções locais", async () => {
    const correios = fakeCarrier("correios", "Correios", async () => ({}));
    const { provider } = makeProvider([correios.carrier], [rules[0]]);
    const options = await provider.quote(input({ cep: "01310100" }));
    expect(options.map((o) => o.code)).toEqual(["retirada"]);
    expect(correios.calls()).toBe(0);
  });

  it("com uma transportadora fora do ar, usa a outra; com todas fora, vale a tabela", async () => {
    const down = fakeCarrier("correios", "Correios", async () => {
      throw new CarrierUnavailableError("timeout");
    });
    const jadlog = fakeCarrier("jadlog", "Jadlog", async () => ({ economy: ok(3190, 5) }));
    const mixed = makeProvider([down.carrier, jadlog.carrier]);
    // O expresso só existia nos Correios, que estão fora: fica o valor da tabela.
    expect(summary(await mixed.provider.quote(input()))).toEqual([
      ["economico", "Envio econômico (Jadlog)", 3190, 6, 10],
      ["expresso", "Envio expresso", 4000 + 800 * 3, 2, 4],
    ]);

    const allDown = makeProvider([down.carrier]);
    expect(summary(await allDown.provider.quote(input()))).toEqual([
      ["economico", "Envio econômico", 2000 + 500 * 3, 5, 9],
      ["expresso", "Envio expresso", 4000 + 800 * 3, 2, 4],
    ]);
    expect(allDown.logs.some((line) => line.includes("Correios indisponível"))).toBe(true);
  });

  it("tira a modalidade que nenhuma transportadora atende", async () => {
    const correios = fakeCarrier("correios", "Correios", async () => ({
      economy: { ok: false, error: "CEP não atendido" },
      express: ok(5410, 2),
    }));
    const { provider } = makeProvider([correios.carrier]);
    expect((await provider.quote(input())).map((o) => o.code)).toEqual(["expresso"]);
  });

  it("reaproveita a cotação da mesma sacola e do mesmo CEP por alguns minutos", async () => {
    const correios = fakeCarrier("correios", "Correios", async () => ({
      economy: ok(2780, 7),
      express: ok(5410, 2),
    }));
    const { provider } = makeProvider([correios.carrier]);
    await provider.quote(input());
    await provider.quote(input());
    expect(correios.calls()).toBe(1);
    await provider.quote(input({ cep: "30130010" }));
    expect(correios.calls()).toBe(2);
  });
});
