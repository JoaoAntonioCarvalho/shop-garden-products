import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import {
  WebhookSignatureError,
  type BoletoResult,
  type CardChargeResult,
  type CardToken,
  type OrderForPayment,
  type PaymentProvider,
  type PixChargeResult,
  type ProviderPaymentStatus,
  type RefundResult,
  type WebhookEvent,
} from "./types";

export const MOCK_SIGNATURE_HEADER = "x-mock-signature";

const VALID_STATUSES: ProviderPaymentStatus[] = [
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
  "CANCELED",
];

/** Regras de teste do cartão, pelos últimos 4 dígitos. Documentadas na tela (fora de produção) e no README. */
export const MOCK_CARD_RULES: Record<
  string,
  { approved: boolean; reason: string | null; description: string }
> = {
  "0000": { approved: true, reason: null, description: "aprovado" },
  "0002": { approved: false, reason: "Saldo insuficiente", description: "recusado por saldo" },
  "0005": {
    approved: false,
    reason: "Transação não autorizada por suspeita de fraude",
    description: "recusado por suspeita de fraude",
  },
};

export function mockWebhookSecret(): string {
  return process.env.PAYMENT_WEBHOOK_SECRET || process.env.AUTH_SECRET || "";
}

/** Assinatura HMAC do corpo do webhook, como um gateway real faria. */
export function signMockWebhook(body: string, secret: string = mockWebhookSecret()): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/** Payload fictício no formato do Pix copia e cola: começa com 000201 e leva o pedido e o texto MOCK. */
export function buildMockPixPayload(
  orderNumber: string,
  amountCents: number,
  externalId: string,
): string {
  const account = tlv("00", "BR.GOV.BCB.PIX") + tlv("01", `MOCK-${orderNumber}`);
  return [
    tlv("00", "01"),
    tlv("26", account),
    tlv("52", "0000"),
    tlv("53", "986"),
    tlv("54", (amountCents / 100).toFixed(2)),
    tlv("58", "BR"),
    tlv("59", "PAGAMENTO DE TESTE MOCK"),
    tlv("60", "SAO PAULO"),
    tlv("62", tlv("05", externalId.slice(-20))),
    "6304MOCK",
  ].join("");
}

/**
 * Gateway simulado. Nenhum dinheiro é movimentado. A arquitetura é a de um gateway real:
 * a cobrança é criada aqui e a confirmação chega pelo webhook assinado.
 */
// TODO(integracao): criar um provider real (Mercado Pago, Pagar.me, Stripe...) implementando PaymentProvider.
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  /** Consulta de status: no mock, a "verdade do gateway" é o que está gravado no próprio banco. */
  constructor(
    private readonly lookupStatus: (externalId: string) => Promise<ProviderPaymentStatus | null>,
  ) {}

  private newId(): string {
    return `mock_${randomBytes(12).toString("hex")}`;
  }

  async createPixCharge(
    order: OrderForPayment,
    options: { expirationMinutes: number },
  ): Promise<PixChargeResult> {
    const externalId = this.newId();
    const pixPayload = buildMockPixPayload(order.number, order.amountCents, externalId);
    const pixQrCodeDataUrl = await QRCode.toDataURL(pixPayload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
      color: { dark: "#23251B", light: "#FFFFFF" },
    });
    const pixExpiresAt = new Date(Date.now() + options.expirationMinutes * 60_000);
    return {
      externalId,
      status: "PENDING",
      pixPayload,
      pixQrCodeDataUrl,
      pixExpiresAt,
      raw: { mock: true, kind: "pix" },
    };
  }

  async createCardCharge(
    order: OrderForPayment,
    card: CardToken,
    installments: number,
  ): Promise<CardChargeResult> {
    const externalId = this.newId();
    const validToken = /^mock_tok_[a-z0-9]{8,}$/i.test(card.token) && /^\d{4}$/.test(card.last4);
    // Qualquer final fora das regras de teste é aprovado.
    const rule = MOCK_CARD_RULES[card.last4] ?? { approved: true, reason: null };
    const approved = validToken && rule.approved;
    return {
      externalId,
      status: approved ? "PAID" : "FAILED",
      cardBrand: card.brand,
      cardLast4: card.last4,
      failureReason: approved ? null : validToken ? rule.reason : "Dados do cartão inválidos",
      raw: { mock: true, kind: "card", installments },
    };
  }

  async createBoleto(
    order: OrderForPayment,
    options: { dueDate: Date; boletoUrl: string },
  ): Promise<BoletoResult> {
    const externalId = this.newId();
    const digits = (externalId.replace(/\D/g, "") + "0".repeat(25)).slice(0, 25);
    const amount = String(order.amountCents).padStart(10, "0");
    // Linha digitável fictícia, no formato de 47 dígitos.
    const boletoLine = `00190.00009 ${digits.slice(0, 5)}.${digits.slice(5, 11)} ${digits.slice(11, 16)}.${digits.slice(16, 22)} 1 0000${amount}`;
    return {
      externalId,
      status: "PENDING",
      boletoLine,
      boletoUrl: options.boletoUrl,
      boletoDueDate: options.dueDate,
      raw: { mock: true, kind: "boleto" },
    };
  }

  async getStatus(externalId: string): Promise<ProviderPaymentStatus> {
    return (await this.lookupStatus(externalId)) ?? "PENDING";
  }

  async refund(externalId: string, amountCents: number): Promise<RefundResult> {
    return { ok: true, raw: { mock: true, kind: "refund", externalId, amountCents } };
  }

  async parseWebhook(request: Request): Promise<WebhookEvent> {
    const body = await request.text();
    const received = request.headers.get(MOCK_SIGNATURE_HEADER) ?? "";
    const expected = signMockWebhook(body);
    const a = Buffer.from(received, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (!mockWebhookSecret() || a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new WebhookSignatureError("Assinatura do webhook inválida");
    }

    let payload: { externalId?: unknown; status?: unknown; reason?: unknown };
    try {
      payload = JSON.parse(body);
    } catch {
      throw new WebhookSignatureError("Corpo do webhook inválido");
    }
    if (
      typeof payload.externalId !== "string" ||
      !VALID_STATUSES.includes(payload.status as ProviderPaymentStatus)
    ) {
      throw new WebhookSignatureError("Evento do webhook inválido");
    }
    return {
      externalId: payload.externalId,
      status: payload.status as ProviderPaymentStatus,
      failureReason: typeof payload.reason === "string" ? payload.reason : null,
      raw: payload as Record<string, unknown>,
    };
  }
}
