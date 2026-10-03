import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { addBusinessDays, zonedParts } from "@/lib/dates";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/seo/metadata";
import { activePaymentProvider } from "@/server/providers/payment";
import { MOCK_SIGNATURE_HEADER, signMockWebhook } from "@/server/providers/payment/mock";
import type {
  CardToken,
  ProviderPaymentStatus,
  WebhookEvent,
} from "@/server/providers/payment/types";
import { sendOrderEmail } from "./emails";
import { transitionOrder } from "./orders";
import { getStoreSettings } from "./settings";
import { computeTotals } from "./totals";

export type PaymentInput = {
  method: "PIX" | "CREDIT_CARD" | "BOLETO";
  installments: number;
  card?: CardToken | null;
};

const BOLETO_BUSINESS_DAYS = 3;

/** Cria a cobrança no provider e grava o Payment. Cartão aprovado já marca o pedido como pago. */
export async function createPaymentForOrder(orderId: string, input: PaymentInput) {
  const [order, settings] = await Promise.all([
    db.order.findUniqueOrThrow({ where: { id: orderId } }),
    getStoreSettings(),
  ]);
  const provider = activePaymentProvider();
  const forPayment = {
    id: order.id,
    number: order.number,
    amountCents: order.totalCents,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerCpf: order.customerCpf,
  };
  const base = {
    orderId,
    provider: provider.name,
    method: input.method,
    amountCents: order.totalCents,
  } as const;

  let data: Prisma.PaymentUncheckedCreateInput;
  if (input.method === "PIX") {
    const charge = await provider.createPixCharge(forPayment, {
      expirationMinutes: settings.pixExpirationMinutes,
    });
    data = {
      ...base,
      status: charge.status,
      externalId: charge.externalId,
      pixPayload: charge.pixPayload,
      pixQrCodeDataUrl: charge.pixQrCodeDataUrl,
      pixExpiresAt: charge.pixExpiresAt,
      rawResponse: charge.raw as Prisma.InputJsonValue,
    };
  } else if (input.method === "BOLETO") {
    const dueKey = addBusinessDays(
      zonedParts(new Date()).dateKey,
      BOLETO_BUSINESS_DAYS,
      settings.holidays,
    );
    const charge = await provider.createBoleto(forPayment, {
      dueDate: new Date(`${dueKey}T00:00:00Z`),
      boletoUrl: `${appUrl()}/pedido/${order.number}/boleto?token=${order.accessToken}`,
    });
    data = {
      ...base,
      status: charge.status,
      externalId: charge.externalId,
      boletoLine: charge.boletoLine,
      boletoUrl: charge.boletoUrl,
      boletoDueDate: charge.boletoDueDate,
      rawResponse: charge.raw as Prisma.InputJsonValue,
    };
  } else {
    if (!input.card) throw new Error("Dados do cartão ausentes.");
    const charge = await provider.createCardCharge(forPayment, input.card, input.installments);
    data = {
      ...base,
      installments: input.installments,
      // O pagamento entra como pendente; a aprovação é aplicada logo abaixo, pelo mesmo caminho do webhook.
      status: charge.status === "PAID" ? "PENDING" : charge.status,
      externalId: charge.externalId,
      cardBrand: charge.cardBrand,
      cardLast4: charge.cardLast4,
      failureReason: charge.failureReason,
      rawResponse: charge.raw as Prisma.InputJsonValue,
    };
    const payment = await db.payment.create({ data });
    if (charge.status === "PAID") {
      await applyPaymentEvent({ externalId: charge.externalId, status: "PAID", raw: charge.raw });
    } else {
      await db.order.update({ where: { id: orderId }, data: { paymentStatus: "FAILED" } });
      await sendOrderEmail(orderId, "payment-failed");
    }
    return db.payment.findUniqueOrThrow({ where: { id: payment.id } });
  }
  return db.payment.create({ data });
}

const FINAL_STATUSES: ProviderPaymentStatus[] = [
  "PAID",
  "REFUNDED",
  "EXPIRED",
  "CANCELED",
  "FAILED",
];

/**
 * Aplica um evento do gateway (webhook ou resposta direta). Idempotente: receber o mesmo evento
 * duas vezes não muda nada na segunda.
 */
export async function applyPaymentEvent(
  event: Pick<WebhookEvent, "externalId" | "status" | "failureReason" | "raw">,
): Promise<{ handled: boolean; orderNumber?: string }> {
  const payment = await db.payment.findUnique({
    where: { externalId: event.externalId },
    include: { order: { select: { id: true, number: true, status: true } } },
  });
  if (!payment) return { handled: false };
  const { order } = payment;
  if (payment.status === event.status) return { handled: true, orderNumber: order.number };
  // Um pagamento já encerrado só pode mudar para estornado.
  if (FINAL_STATUSES.includes(payment.status) && event.status !== "REFUNDED")
    return { handled: true, orderNumber: order.number };

  await db.payment.update({
    where: { id: payment.id },
    data: {
      status: event.status,
      failureReason: event.failureReason ?? payment.failureReason,
      rawResponse: event.raw as Prisma.InputJsonValue,
    },
  });

  if (event.status === "PAID" && order.status === "PENDING_PAYMENT") {
    await transitionOrder(order.id, "PAID", {
      notifyCustomer: true,
      note: "Pagamento confirmado pelo gateway",
    });
  } else if (event.status === "FAILED" && order.status === "PENDING_PAYMENT") {
    await db.order.update({ where: { id: order.id }, data: { paymentStatus: "FAILED" } });
    await sendOrderEmail(order.id, "payment-failed");
  } else if (event.status === "EXPIRED" && order.status === "PENDING_PAYMENT") {
    const otherPending = await db.payment.count({
      where: { orderId: order.id, status: "PENDING", id: { not: payment.id } },
    });
    if (otherPending === 0) {
      await transitionOrder(order.id, "EXPIRED", {
        notifyCustomer: true,
        note: "Pagamento não realizado no prazo",
      });
    }
  }
  return { handled: true, orderNumber: order.number };
}

/** Expira Pix e boletos vencidos. Chamado pela tarefa agendada e ao consultar um pedido pendente. */
export async function expireOverduePayments(orderId?: string): Promise<number> {
  const now = new Date();
  const today = new Date(`${zonedParts(now).dateKey}T00:00:00Z`);
  const overdue = await db.payment.findMany({
    where: {
      status: "PENDING",
      ...(orderId ? { orderId } : {}),
      OR: [
        { method: "PIX", pixExpiresAt: { lt: now } },
        { method: "BOLETO", boletoDueDate: { lt: today } },
      ],
    },
    select: { externalId: true },
  });
  for (const payment of overdue) {
    if (payment.externalId)
      await applyPaymentEvent({
        externalId: payment.externalId,
        status: "EXPIRED",
        raw: { reason: "expirado" },
      });
  }
  return overdue.length;
}

export class RetryPaymentError extends Error {}

/** Nova cobrança para o mesmo pedido (cartão recusado, Pix expirado na tela). Não cria outro pedido. */
export async function retryPayment(orderId: string, input: PaymentInput) {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { coupon: { select: { combinableWithPix: true } } },
  });
  if (order.status !== "PENDING_PAYMENT")
    throw new RetryPaymentError("Este pedido não está mais aguardando pagamento.");
  const settings = await getStoreSettings();

  // O desconto do Pix depende do meio de pagamento: recalcula o total para o novo meio.
  const totals = computeTotals({
    subtotalCents: order.subtotalCents,
    couponDiscountCents: order.discountCents,
    couponCombinableWithPix: order.coupon?.combinableWithPix ?? true,
    paymentMethod: input.method,
    pixDiscountPercent: settings.pixDiscountPercent,
    shippingCents: order.shippingCents,
    giftWrapCents: order.giftWrapCents,
  });

  await db.payment.updateMany({
    where: { orderId, status: "PENDING" },
    data: { status: "CANCELED" },
  });
  await db.order.update({
    where: { id: orderId },
    data: {
      paymentMethod: input.method,
      paymentStatus: "PENDING",
      installments: input.method === "CREDIT_CARD" ? input.installments : 1,
      discountCents: totals.discountCents,
      pixDiscountCents: totals.pixDiscountCents,
      totalCents: totals.totalCents,
    },
  });
  return createPaymentForOrder(orderId, input);
}

/**
 * Simulador: chama o webhook do mock com assinatura válida, exatamente como um gateway faria.
 * Só existe fora de produção e com ENABLE_PAYMENT_SIMULATOR=true.
 */
export function simulatorEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_PAYMENT_SIMULATOR === "true";
}

export async function callMockWebhook(
  externalId: string,
  status: ProviderPaymentStatus,
  reason?: string,
): Promise<boolean> {
  const body = JSON.stringify({ event: "payment.updated", externalId, status, reason });
  const response = await fetch(`${appUrl()}/api/webhooks/payments/mock`, {
    method: "POST",
    headers: { "content-type": "application/json", [MOCK_SIGNATURE_HEADER]: signMockWebhook(body) },
    body,
  });
  return response.ok;
}
