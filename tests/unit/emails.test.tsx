import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import type { EmailStore } from "@/components/email/layout";
import {
  emailTemplates,
  type EmailTemplateName,
  type OrderEmailData,
} from "@/components/email/templates";
import {
  MOCK_SIGNATURE_HEADER,
  MockPaymentProvider,
  signMockWebhook,
  buildMockPixPayload,
} from "@/server/providers/payment/mock";
import { WebhookSignatureError } from "@/server/providers/payment/types";
import { boletoAvailability } from "@/server/services/checkout-rules";

const store: EmailStore = {
  name: "Net Shop Garden",
  url: "http://localhost:3100",
  email: "contato@example.com",
  phoneDisplay: "(11) 95581-7159",
  whatsapp: "5511955817159",
  legalName: "Razão Social de Teste",
  cnpj: "00.000.000/0001-00",
  address: "Rua de Teste, 1",
};

const order: OrderEmailData = {
  number: "NSG-000123",
  url: "http://localhost:3100/pedido/NSG-000123?token=abc",
  customerName: "Marina Teste",
  items: [{ name: "Orquídea Phalaenopsis branca", variant: null, quantity: 1, total: "R$ 249,00" }],
  totals: {
    subtotal: "R$ 249,00",
    discount: "R$ 24,90",
    pixDiscount: "R$ 11,21",
    shipping: "Grátis",
    giftWrap: null,
    total: "R$ 212,89",
  },
  shippingMethod: "Entrega hoje",
  deliveryInfo: "sábado, 3 de outubro, até 20h",
  addressLines: [
    "Marina Teste",
    "Avenida Paulista, 1000",
    "Bela Vista, São Paulo/SP",
    "CEP 01310-100",
  ],
  paymentMethod: "Pix",
  giftMessage: "Feliz aniversário!",
  pix: { payload: "000201MOCK", expiresAt: "03/10/2026, 12:30" },
  trackingCode: "BR123",
  carrier: "Transportadora",
  cancelReason: "Cliente desistiu",
  refunded: true,
  reviewLinks: [{ name: "Orquídea", url: "http://localhost:3100/conta/avaliar/orquidea" }],
  statusLabel: "Pronto para retirada",
};

const props: Record<EmailTemplateName, unknown> = {
  "order-received": { order },
  "payment-approved": { order },
  "payment-failed": { order: { ...order, failureReason: "Saldo insuficiente" } },
  "pix-expired": { order },
  "order-preparing": { order },
  "order-shipped": { order },
  "order-delivered": { order },
  "order-canceled": { order },
  "order-status": { order },
  "order-manual-summary": { order },
  "internal-new-order": { order },
  "welcome-coupon": {
    coupon: "BEMVINDO10",
    percent: 10,
    confirmUrl: "http://x/confirmar",
    unsubscribeUrl: "http://x/sair",
  },
  "account-created": { name: "Marina Teste", verifyUrl: "http://x/verificar" },
  "email-verification": { name: "Marina Teste", verifyUrl: "http://x/verificar" },
  "password-reset": { name: "Marina Teste", resetUrl: "http://x/redefinir" },
  "team-invite": { name: "Equipe", inviteUrl: "http://x/convite", storeName: "Net Shop Garden" },
  "back-in-stock": { productName: "Zamioculca", productUrl: "http://x/produto/zamioculca" },
  "abandoned-cart": {
    cart: {
      customerName: "Marina",
      items: [{ name: "Vaso", quantity: 2 }],
      total: "R$ 100,00",
      url: "http://x/carrinho",
    },
  },
  "data-export-ready": { name: "Marina", message: "Seus dados foram excluídos." },
  "internal-product-request": {
    name: "João",
    email: "j@example.com",
    whatsapp: "",
    description: "Bonsai",
    budget: "",
  },
  "internal-contact": {
    name: "João",
    email: "j@example.com",
    phone: "",
    subject: "Dúvida",
    orderNumber: "",
    message: "Olá",
  },
  "internal-low-stock": { items: [{ name: "Vaso", sku: "X-01", available: 0 }] },
  test: { sentBy: "admin@example.com" },
};

describe("modelos de e-mail", () => {
  it.each(Object.keys(emailTemplates) as EmailTemplateName[])(
    "%s renderiza em HTML e em texto puro",
    async (name) => {
      const template = emailTemplates[name] as unknown as {
        subject: (p: unknown) => string;
        render: (s: EmailStore, p: unknown) => React.ReactElement;
      };
      const element = template.render(store, props[name]);
      const [html, text] = await Promise.all([
        render(element),
        render(element, { plainText: true }),
      ]);

      expect(template.subject(props[name]).length).toBeGreaterThan(5);
      expect(html).toContain('lang="pt-BR"');
      // Identidade visual: cabeçalho musgo e fundo creme; e-mail em HTML, nunca só imagem.
      expect(html).toContain("#4D5236");
      expect(html).toContain("#FBF8F2");
      expect(html).not.toContain("<img");
      expect(text.length).toBeGreaterThan(80);
      // Rodapé com os dados da empresa, vindos da configuração.
      expect(text).toContain("Razão Social de Teste");
      expect(html).not.toMatch(/undefined|\[object Object\]/);
    },
  );

  it("pedido recebido traz o código Pix e o resumo", async () => {
    const text = await render(emailTemplates["order-received"].render(store, { order }), {
      plainText: true,
    });
    expect(text).toContain("000201MOCK");
    expect(text).toContain("R$ 212,89");
    expect(text).toContain("Feliz aniversário!");
  });

  it("pedido entregue convida a avaliar cada item", async () => {
    const html = await render(emailTemplates["order-delivered"].render(store, { order }));
    expect(html).toContain("http://localhost:3100/conta/avaliar/orquidea");
  });
});

describe("gateway simulado", () => {
  const provider = new MockPaymentProvider(async () => null);
  const orderForPayment = {
    id: "1",
    number: "NSG-000123",
    amountCents: 27645,
    customerName: "M",
    customerEmail: "m@example.com",
    customerCpf: null,
  };
  process.env.AUTH_SECRET ||= "segredo-de-teste-com-tamanho-suficiente";

  it("Pix: payload começa com 000201, leva o pedido e o texto MOCK, e vem com QR Code", async () => {
    const charge = await provider.createPixCharge(orderForPayment, { expirationMinutes: 30 });
    expect(charge.pixPayload.startsWith("000201")).toBe(true);
    expect(charge.pixPayload).toContain("NSG-000123");
    expect(charge.pixPayload).toContain("MOCK");
    expect(charge.pixPayload).toContain("276.45");
    expect(charge.pixQrCodeDataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(charge.status).toBe("PENDING");
    const minutes = (charge.pixExpiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(29);
    expect(minutes).toBeLessThanOrEqual(30);
    expect(buildMockPixPayload("NSG-1", 100, "mock_abc")).toMatch(/^000201/);
  });

  it("cartão: o resultado depende dos quatro últimos dígitos", async () => {
    const card = (last4: string) => ({ token: "mock_tok_abcdef123456", brand: "visa", last4 });
    expect((await provider.createCardCharge(orderForPayment, card("0000"), 1)).status).toBe("PAID");
    expect(await provider.createCardCharge(orderForPayment, card("0002"), 1)).toMatchObject({
      status: "FAILED",
      failureReason: "Saldo insuficiente",
    });
    expect(
      (await provider.createCardCharge(orderForPayment, card("0005"), 1)).failureReason,
    ).toMatch(/fraude/);
    expect(
      (
        await provider.createCardCharge(
          orderForPayment,
          { ...card("0000"), token: "token-invalido" },
          1,
        )
      ).status,
    ).toBe("FAILED");
  });

  it("webhook: aceita assinatura válida e recusa inválida ou corpo adulterado", async () => {
    const body = JSON.stringify({ event: "payment.updated", externalId: "mock_1", status: "PAID" });
    const request = (payload: string, signature: string) =>
      new Request("http://localhost/api/webhooks/payments/mock", {
        method: "POST",
        body: payload,
        headers: { [MOCK_SIGNATURE_HEADER]: signature },
      });

    expect(await provider.parseWebhook(request(body, signMockWebhook(body)))).toMatchObject({
      externalId: "mock_1",
      status: "PAID",
    });
    await expect(provider.parseWebhook(request(body, "assinatura-errada"))).rejects.toBeInstanceOf(
      WebhookSignatureError,
    );
    await expect(
      provider.parseWebhook(request(body.replace("mock_1", "mock_2"), signMockWebhook(body))),
    ).rejects.toBeInstanceOf(WebhookSignatureError);
    const invalid = JSON.stringify({ externalId: "mock_1", status: "QUALQUER" });
    await expect(
      provider.parseWebhook(request(invalid, signMockWebhook(invalid))),
    ).rejects.toBeInstanceOf(WebhookSignatureError);
  });
});

describe("disponibilidade do boleto", () => {
  const now = new Date("2026-10-05T10:00:00-03:00"); // segunda-feira
  const option = (overrides: object) => ({
    code: "x",
    name: "x",
    priceCents: 0,
    originalPriceCents: 0,
    isFree: true,
    minDays: 2,
    maxDays: 4,
    requiresScheduling: false,
    description: "",
    ...overrides,
  });
  const check = (input: Partial<Parameters<typeof boletoAvailability>[0]>) =>
    boletoAvailability({ option: option({}), hasPerishable: false, holidays: [], now, ...input });

  it("disponível no envio por transportadora sem perecíveis", () => {
    expect(check({})).toEqual({ available: true });
  });

  it("indisponível com entrega hoje, com perecíveis e com agendada em menos de 3 dias úteis, sempre com o motivo", () => {
    expect(check({ option: option({ deliveryDate: "2026-10-05", minDays: 0 }) })).toMatchObject({
      available: false,
      reason: expect.stringContaining("entrega hoje"),
    });
    expect(check({ hasPerishable: true })).toMatchObject({
      available: false,
      reason: expect.stringContaining("plantas vivas"),
    });
    const scheduled = option({ requiresScheduling: true });
    expect(check({ option: scheduled, deliveryDate: "2026-10-07" })).toMatchObject({
      available: false,
    });
    expect(check({ option: scheduled, deliveryDate: "2026-10-08" })).toEqual({ available: true });
  });
});
