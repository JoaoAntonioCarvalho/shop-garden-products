export type ProviderPaymentStatus =
  "PENDING" | "AUTHORIZED" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED" | "CANCELED";

export type OrderForPayment = {
  id: string;
  number: string;
  amountCents: number;
  customerName: string;
  customerEmail: string;
  customerCpf: string | null;
};

/**
 * Token do cartão gerado no navegador. Só bandeira e últimos 4 dígitos chegam ao servidor:
 * o número completo, a validade e o CVV nunca saem do navegador.
 */
export type CardToken = { token: string; brand: string; last4: string };

type ChargeBase = {
  externalId: string;
  status: ProviderPaymentStatus;
  raw: Record<string, unknown>;
};

export type PixChargeResult = ChargeBase & {
  pixPayload: string;
  pixQrCodeDataUrl: string;
  pixExpiresAt: Date;
};
export type CardChargeResult = ChargeBase & {
  cardBrand: string;
  cardLast4: string;
  failureReason: string | null;
};
export type BoletoResult = ChargeBase & {
  boletoLine: string;
  boletoUrl: string;
  boletoDueDate: Date;
};
export type RefundResult = { ok: boolean; raw: Record<string, unknown> };

export type WebhookEvent = {
  externalId: string;
  status: ProviderPaymentStatus;
  failureReason?: string | null;
  raw: Record<string, unknown>;
};

export class WebhookSignatureError extends Error {}

export interface PaymentProvider {
  readonly name: string;
  /** Payload copia e cola, QR Code e expiração. */
  createPixCharge(
    order: OrderForPayment,
    options: { expirationMinutes: number },
  ): Promise<PixChargeResult>;
  createCardCharge(
    order: OrderForPayment,
    card: CardToken,
    installments: number,
  ): Promise<CardChargeResult>;
  createBoleto(
    order: OrderForPayment,
    options: { dueDate: Date; boletoUrl: string },
  ): Promise<BoletoResult>;
  getStatus(externalId: string): Promise<ProviderPaymentStatus>;
  refund(externalId: string, amountCents: number): Promise<RefundResult>;
  /** Valida a assinatura e normaliza o evento. Lança WebhookSignatureError se a assinatura não confere. */
  parseWebhook(request: Request): Promise<WebhookEvent>;
}
