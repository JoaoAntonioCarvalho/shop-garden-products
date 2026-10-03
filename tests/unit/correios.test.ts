import { describe, expect, it } from "vitest";
import {
  CorreiosClient,
  CorreiosUnavailableError,
  isDeliveredEvent,
  parseCorreiosDate,
  parseCorreiosMoney,
} from "@/server/providers/shipping/correios/client";

const config = {
  baseUrl: "https://correios.test",
  user: "usuario",
  accessCode: "codigo-de-acesso",
  postingCard: "0012345678",
  contract: "9912345678",
  dr: 72,
};

type Call = { url: string; init: RequestInit };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** fetch falso: responde por trecho da URL e guarda as chamadas. */
function fakeFetch(routes: Record<string, (call: Call) => Response>) {
  const calls: Call[] = [];
  const fetcher = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call = { url: String(input), init };
    calls.push(call);
    const match = Object.keys(routes).find((part) => call.url.includes(part));
    if (!match) throw new Error(`rota não prevista: ${call.url}`);
    return routes[match](call);
  }) as typeof fetch;
  return {
    fetcher,
    calls,
    count: (part: string) => calls.filter((c) => c.url.includes(part)).length,
  };
}

const token = () => json({ token: "tok-1", expiraEm: "2026-10-04T10:00:00" }, 201);
const parcel = { weightGrams: 2500, lengthCm: 30, widthCm: 24, heightCm: 24 };
const now = () => new Date("2026-10-03T10:00:00-03:00").getTime();

describe("Correios: leitura dos valores", () => {
  it("converte o preço com vírgula para centavos", () => {
    expect(parseCorreiosMoney("23,50")).toBe(2350);
    expect(parseCorreiosMoney("1.234,56")).toBe(123456);
    expect(parseCorreiosMoney("")).toBeNull();
    expect(parseCorreiosMoney(undefined)).toBeNull();
    expect(parseCorreiosMoney("abc")).toBeNull();
  });

  it("lê datas sem fuso como horário de Brasília", () => {
    expect(parseCorreiosDate("2026-10-03T14:30:00")?.toISOString()).toBe(
      "2026-10-03T17:30:00.000Z",
    );
    expect(parseCorreiosDate("2026-10-03T14:30:00Z")?.toISOString()).toBe(
      "2026-10-03T14:30:00.000Z",
    );
    expect(parseCorreiosDate("nada")).toBeNull();
  });

  it("reconhece o evento de entrega", () => {
    expect(isDeliveredEvent({ code: "BDE", type: "01" })).toBe(true);
    expect(isDeliveredEvent({ code: "BDE", type: "20" })).toBe(false);
    expect(isDeliveredEvent({ code: "OEC", type: "01" })).toBe(false);
  });
});

describe("Correios: cliente da API", () => {
  it("autentica com o cartão de postagem, cota preço e prazo em lote e reaproveita o token", async () => {
    const api = fakeFetch({
      "/token/v1/autentica/cartaopostagem": token,
      "/preco/v1/nacional": () =>
        json([
          { coProduto: "03298", pcFinal: "27,80" },
          { coProduto: "03220", pcFinal: "54,10" },
        ]),
      "/prazo/v1/nacional": () =>
        json([
          { coProduto: "03298", prazoEntrega: 7 },
          { coProduto: "03220", prazoEntrega: 2 },
        ]),
    });
    const client = new CorreiosClient(config, api.fetcher, now);
    const input = {
      originCep: "04002000",
      destinationCep: "22041001",
      services: ["03298", "03220"],
      package: parcel,
    };
    const quotes = await client.quote(input);
    expect(quotes).toEqual({
      "03298": { ok: true, priceCents: 2780, businessDays: 7 },
      "03220": { ok: true, priceCents: 5410, businessDays: 2 },
    });

    const auth = api.calls.find((call) => call.url.includes("/token/"))!;
    const headers = auth.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from("usuario:codigo-de-acesso").toString("base64")}`,
    );
    expect(JSON.parse(String(auth.init.body))).toEqual({
      numero: "0012345678",
      contrato: "9912345678",
      dr: 72,
    });

    const price = api.calls.find((call) => call.url.includes("/preco/"))!;
    expect((price.init.headers as Record<string, string>).Authorization).toBe("Bearer tok-1");
    expect(JSON.parse(String(price.init.body)).parametrosProduto[0]).toEqual({
      coProduto: "03298",
      nuRequisicao: "1",
      cepOrigem: "04002000",
      cepDestino: "22041001",
      psObjeto: "2500",
      tpObjeto: "2",
      comprimento: "30",
      largura: "24",
      altura: "24",
      nuContrato: "9912345678",
      nuDR: 72,
    });

    await client.quote(input);
    expect(api.count("/token/")).toBe(1);
  });

  it("devolve o erro do serviço que não atende o envio, sem derrubar os outros", async () => {
    const api = fakeFetch({
      "/token/": token,
      "/preco/": () =>
        json([
          { coProduto: "03298", txErro: "PRC-124: CEP de destino não atendido" },
          { coProduto: "03220", pcFinal: "54,10" },
        ]),
      "/prazo/": () =>
        json([
          { coProduto: "03298", prazoEntrega: 7 },
          { coProduto: "03220", prazoEntrega: 2 },
        ]),
    });
    const quotes = await new CorreiosClient(config, api.fetcher, now).quote({
      originCep: "04002000",
      destinationCep: "69900000",
      services: ["03298", "03220"],
      package: parcel,
    });
    expect(quotes["03298"]).toEqual({ ok: false, error: "PRC-124: CEP de destino não atendido" });
    expect(quotes["03220"].ok).toBe(true);
  });

  it("renova o token uma vez quando a API responde 401", async () => {
    let priceCalls = 0;
    const api = fakeFetch({
      "/token/": token,
      "/preco/": () =>
        ++priceCalls === 1
          ? json({ msgs: ["Token expirado"] }, 401)
          : json([{ coProduto: "03298", pcFinal: "10,00" }]),
      "/prazo/": () => json([{ coProduto: "03298", prazoEntrega: 5 }]),
    });
    const quotes = await new CorreiosClient(config, api.fetcher, now).quote({
      originCep: "04002000",
      destinationCep: "22041001",
      services: ["03298"],
      package: parcel,
    });
    expect(quotes["03298"]).toEqual({ ok: true, priceCents: 1000, businessDays: 5 });
    expect(api.count("/token/")).toBe(2);
  });

  it("falha de autenticação e de rede viram CorreiosUnavailableError", async () => {
    const denied = fakeFetch({
      "/token/": () => json({ msgs: ["Usuário ou senha inválidos"] }, 401),
    });
    await expect(
      new CorreiosClient(config, denied.fetcher, now).track("AA123456789BR"),
    ).rejects.toThrow(CorreiosUnavailableError);

    const offline = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(new CorreiosClient(config, offline, now).track("AA123456789BR")).rejects.toThrow(
      CorreiosUnavailableError,
    );
  });

  it("lê os eventos do rastreio, do mais recente para o mais antigo", async () => {
    const api = fakeFetch({
      "/token/": token,
      "/srorastro/v1/objetos/AA123456789BR": () =>
        json({
          objetos: [
            {
              codObjeto: "AA123456789BR",
              eventos: [
                {
                  codigo: "PO",
                  tipo: "01",
                  descricao: "Objeto postado",
                  dtHrCriado: "2026-09-28T15:10:00",
                  unidade: {
                    nome: "AGF Vila Mariana",
                    endereco: { cidade: "SAO PAULO", uf: "SP" },
                  },
                },
                {
                  codigo: "BDE",
                  tipo: "01",
                  descricao: "Objeto entregue ao destinatário",
                  dtHrCriado: "2026-10-01T11:42:00",
                  unidade: { endereco: { cidade: "RIO DE JANEIRO", uf: "RJ" } },
                },
              ],
            },
          ],
        }),
      "/srorastro/v1/objetos/ZZ000000000BR": () =>
        json({
          objetos: [{ codObjeto: "ZZ000000000BR", mensagem: "SRO-020: Objeto não encontrado" }],
        }),
    });
    const client = new CorreiosClient(config, api.fetcher, now);
    const found = await client.track("AA123456789BR");
    expect(found.ok && found.events.map((event) => event.description)).toEqual([
      "Objeto entregue ao destinatário",
      "Objeto postado",
    ]);
    expect(found.ok && found.events[0].location).toBe("RIO DE JANEIRO, RJ");
    expect(found.ok && found.events.some(isDeliveredEvent)).toBe(true);

    expect(await client.track("ZZ000000000BR")).toEqual({
      ok: false,
      error: "SRO-020: Objeto não encontrado",
    });
  });
});
