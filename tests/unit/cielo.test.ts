import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";
import {
  CIELO_WEBHOOK_HEADER,
  CieloError,
  CieloPaymentProvider,
  cieloDenialReason,
  mapCieloStatus,
} from "@/server/providers/payment/cielo";
import { WebhookSignatureError } from "@/server/providers/payment/types";

const config = {
  environment: "sandbox" as const,
  merchantId: "8937bd5b-9796-494d-9fe5-f76b3e4da633",
  merchantKey: "chave-da-loja",
  clientId: "cliente",
  clientSecret: "segredo",
  webhookSecret: "segredo-do-aviso",
  softDescriptor: "Net Shop Gárden Loja",
};
const order = {
  id: "ord_1",
  number: "NSG-000123",
  amountCents: 15990,
  customerName: "João da Silva",
  customerEmail: "joao@example.com",
  customerCpf: "123.456.789-09",
};
const PAYMENT_ID = "e2802eae-2e40-45ea-8375-a8f9b705ff92";

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
  return { fetcher, calls };
}
const sent = (call: Call) => JSON.parse(String(call.init.body));
const header = (call: Call, name: string) =>
  (call.init.headers as Record<string, string> | undefined)?.[name];

describe("Cielo: status", () => {
  it("traduz os status da Cielo para os da loja", () => {
    expect(mapCieloStatus({ Status: 0 })).toBe("PENDING");
    expect(mapCieloStatus({ Status: 12 })).toBe("PENDING");
    expect(mapCieloStatus({ Status: 1 })).toBe("AUTHORIZED");
    expect(mapCieloStatus({ Status: 2 })).toBe("PAID");
    expect(mapCieloStatus({ Status: 3 })).toBe("FAILED");
    expect(mapCieloStatus({ Status: 13 })).toBe("FAILED");
    expect(mapCieloStatus({ Status: 11 })).toBe("REFUNDED");
  });

  it("cancelado é devolução só quando já tinha sido cobrado", () => {
    expect(mapCieloStatus({ Status: 10, CapturedAmount: 1500 })).toBe("REFUNDED");
    expect(mapCieloStatus({ Status: 10 })).toBe("CANCELED");
  });

  it("explica a recusa ao cliente, com texto padrão para código desconhecido", () => {
    expect(cieloDenialReason("51")).toBe("Saldo ou limite insuficiente");
    expect(cieloDenialReason("XX")).toMatch(/não foi autorizado/);
    expect(cieloDenialReason(undefined)).toMatch(/não foi autorizado/);
  });
});

describe("Cielo: Pix", () => {
  it("cria a cobrança com o valor em centavos e o CPF só com dígitos", async () => {
    const { fetcher, calls } = fakeFetch({
      "/1/sales/": () =>
        json(
          {
            Payment: {
              PaymentId: PAYMENT_ID,
              Type: "Pix",
              Status: 12,
              QrCodeString: "00020101021226990014br.gov.bcb.pix",
              QrCodeBase64Image: "aW1hZ2Vt",
            },
          },
          201,
        ),
    });
    const now = new Date("2026-10-10T12:00:00Z").getTime();
    const provider = new CieloPaymentProvider(config, fetcher, () => now);
    const charge = await provider.createPixCharge(order, { expirationMinutes: 20 });

    expect(calls[0].url).toBe("https://apisandbox.cieloecommerce.cielo.com.br/1/sales/");
    expect(header(calls[0], "MerchantKey")).toBe("chave-da-loja");
    expect(sent(calls[0])).toMatchObject({
      MerchantOrderId: "NSG000123",
      Customer: { Name: "Joao da Silva", Identity: "12345678909", IdentityType: "CPF" },
      Payment: { Type: "Pix", Amount: 15990 },
    });
    expect(charge).toMatchObject({
      externalId: PAYMENT_ID,
      status: "PENDING",
      pixPayload: "00020101021226990014br.gov.bcb.pix",
      pixQrCodeDataUrl: "data:image/png;base64,aW1hZ2Vt",
    });
    expect(charge.pixExpiresAt.toISOString()).toBe("2026-10-10T12:20:00.000Z");
    expect(JSON.stringify(charge.raw)).not.toContain("aW1hZ2Vt");
  });

  it("falha com mensagem quando a Cielo recusa a requisição", async () => {
    const { fetcher } = fakeFetch({
      "/1/sales/": () => json([{ Code: 132, Message: "MerchantKey is invalid" }], 400),
    });
    const provider = new CieloPaymentProvider(config, fetcher);
    await expect(provider.createPixCharge(order, { expirationMinutes: 20 })).rejects.toThrow(
      /132 MerchantKey is invalid/,
    );
  });
});

describe("Cielo: cartão", () => {
  const card = { token: "c689d4ed-ff74-4fce-b32c-bc1b1e593037", brand: "visa", last4: "0000" };

  it("cobra com o token, captura na hora e nunca envia número de cartão", async () => {
    const { fetcher, calls } = fakeFetch({
      "/1/sales/": () =>
        json(
          {
            Payment: {
              PaymentId: PAYMENT_ID,
              Status: 2,
              ReturnCode: "6",
              CapturedAmount: 15990,
              CreditCard: { CardNumber: "402400******2931", Brand: "Visa" },
            },
          },
          201,
        ),
    });
    const provider = new CieloPaymentProvider(config, fetcher);
    const charge = await provider.createCardCharge(order, card, 3);

    expect(sent(calls[0]).Payment).toEqual({
      Amount: 15990,
      Type: "CreditCard",
      Installments: 3,
      Capture: true,
      SoftDescriptor: "Net Shop Gard",
      CreditCard: { PaymentToken: card.token },
    });
    expect(charge).toMatchObject({
      externalId: PAYMENT_ID,
      status: "PAID",
      cardBrand: "visa",
      cardLast4: "2931",
      failureReason: null,
    });
  });

  it("devolve a recusa com o motivo", async () => {
    const { fetcher } = fakeFetch({
      "/1/sales/": () =>
        json({ Payment: { PaymentId: PAYMENT_ID, Status: 3, ReturnCode: "05" } }, 201),
    });
    const charge = await new CieloPaymentProvider(config, fetcher).createCardCharge(order, card, 1);
    expect(charge.status).toBe("FAILED");
    expect(charge.failureReason).toMatch(/banco não autorizou/);
    expect(charge.cardLast4).toBe("0000");
  });

  it("prepara a tokenização com OAuth e reaproveita o token até vencer", async () => {
    let current = 0;
    const { fetcher, calls } = fakeFetch({
      "/oauth2/token": () => json({ access_token: "oauth-1", expires_in: 600 }),
      "/v2/accesstoken": () => json({ AccessToken: "c29wLXRva2Vu" }, 201),
    });
    const provider = new CieloPaymentProvider(config, fetcher, () => current);

    expect(await provider.cardTokenization()).toEqual({
      kind: "cielo",
      url: "https://transactionsandbox.pagador.com.br/post/api/public/v1/card",
      accessToken: "c29wLXRva2Vu",
    });
    await provider.cardTokenization();
    const count = (part: string) => calls.filter((call) => call.url.includes(part)).length;
    expect(count("/oauth2/token")).toBe(1);
    expect(count("/v2/accesstoken")).toBe(2);
    expect(header(calls[1], "Authorization")).toBe("Bearer oauth-1");
    // A chave da loja não vai para o serviço de tokenização.
    expect(header(calls[1], "MerchantKey")).toBeUndefined();

    current = 11 * 60 * 1000;
    await provider.cardTokenization();
    expect(count("/oauth2/token")).toBe(2);
  });

  it("sem as credenciais da tokenização, o cartão não é oferecido", async () => {
    const provider = new CieloPaymentProvider(
      { ...config, clientId: undefined },
      fakeFetch({}).fetcher,
    );
    await expect(provider.cardTokenization()).rejects.toBeInstanceOf(CieloError);
  });
});

describe("Cielo: consulta, devolução e aviso", () => {
  it("consulta no endereço de consulta e devolve pelo cancelamento", async () => {
    const { fetcher, calls } = fakeFetch({
      "/void": () => json({ Status: 10, ReturnCode: "0" }),
      apiquerysandbox: () => json({ Payment: { PaymentId: PAYMENT_ID, Status: 2 } }),
    });
    const provider = new CieloPaymentProvider(config, fetcher);
    expect(await provider.getStatus(PAYMENT_ID)).toBe("PAID");
    expect(await provider.refund(PAYMENT_ID, 500)).toMatchObject({ ok: true });
    expect(calls[1].url).toBe(
      `https://apisandbox.cieloecommerce.cielo.com.br/1/sales/${PAYMENT_ID}/void?amount=500`,
    );
    expect(calls[1].init.method).toBe("PUT");
  });

  it("devolução negada com resposta 200 e status pago não conta como devolvida", async () => {
    const denied = { Status: 2, ReasonCode: 7, ReasonMessage: "Denied", ReturnCode: "422" };
    const partial = { Status: 2, ReasonCode: 0, ReasonMessage: "Successful", ReturnCode: "0" };
    for (const [body, ok] of [
      [denied, false],
      [partial, true],
    ] as const) {
      const { fetcher } = fakeFetch({ "/void": () => json(body) });
      expect(await new CieloPaymentProvider(config, fetcher).refund(PAYMENT_ID, 100)).toMatchObject(
        { ok },
      );
    }
  });

  it("devolução recusada não lança erro", async () => {
    const { fetcher } = fakeFetch({
      "/void": () => json([{ Code: 308, Message: "Transaction not available to void" }], 400),
    });
    const result = await new CieloPaymentProvider(config, fetcher).refund(PAYMENT_ID, 500);
    expect(result.ok).toBe(false);
  });

  const notice = (secret: string | null, body: unknown) =>
    new Request("https://loja.test/api/webhooks/payments/cielo", {
      method: "POST",
      headers: secret ? { [CIELO_WEBHOOK_HEADER]: secret } : {},
      body: JSON.stringify(body),
    });

  it("o aviso só vale com o cabeçalho secreto, e o status vem da consulta", async () => {
    const { fetcher, calls } = fakeFetch({
      apiquerysandbox: () => json({ Payment: { PaymentId: PAYMENT_ID, Status: 2 } }),
    });
    const provider = new CieloPaymentProvider(config, fetcher);
    const body = { PaymentId: PAYMENT_ID, ChangeType: 1, Status: 3 };

    await expect(provider.parseWebhook(notice(null, body))).rejects.toBeInstanceOf(
      WebhookSignatureError,
    );
    await expect(provider.parseWebhook(notice("errado", body))).rejects.toBeInstanceOf(
      WebhookSignatureError,
    );
    expect(calls).toHaveLength(0);

    const event = await provider.parseWebhook(notice("segredo-do-aviso", body));
    expect(event).toMatchObject({ externalId: PAYMENT_ID, status: "PAID" });
  });

  it("recusa aviso sem identificador válido", async () => {
    const provider = new CieloPaymentProvider(config, fakeFetch({}).fetcher);
    await expect(
      provider.parseWebhook(notice("segredo-do-aviso", { PaymentId: "../outra-coisa" })),
    ).rejects.toBeInstanceOf(WebhookSignatureError);
  });
});

describe("Cielo: variáveis de ambiente", () => {
  const base = { DATABASE_URL: "postgres://x", AUTH_SECRET: "a".repeat(32) };

  it("exige as credenciais quando a Cielo é o gateway", () => {
    const result = parseEnv({ ...base, PAYMENT_PROVIDER: "cielo" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([
      "CIELO_MERCHANT_ID",
      "CIELO_MERCHANT_KEY",
      "CIELO_CLIENT_ID",
      "CIELO_CLIENT_SECRET",
      "CIELO_WEBHOOK_SECRET",
    ]);
  });

  it("começa no ambiente de testes", () => {
    expect(parseEnv(base).data?.CIELO_ENV).toBe("sandbox");
  });
});
