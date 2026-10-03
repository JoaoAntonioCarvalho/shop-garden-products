"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientIpHash } from "@/lib/ip";
import { cardTokenSchema, emailSchema } from "@/lib/validators/checkout";
import { getOrderForViewer, normalizeOrderNumber } from "@/server/services/order-view";
import {
  callMockWebhook,
  retryPayment,
  RetryPaymentError,
  simulatorEnabled,
} from "@/server/services/payments";
import { getInstallments } from "@/server/services/pricing";
import { rateLimit, rateLimitMessage } from "@/server/services/rate-limit";
import { getStoreSettings } from "@/server/services/settings";

type Result = { ok: true } | { ok: false; error: string };

const outcomes = {
  paid: { status: "PAID", reason: undefined },
  failed: { status: "FAILED", reason: "Pagamento recusado (simulação)" },
  expired: { status: "EXPIRED", reason: undefined },
} as const;

/**
 * Simulador de pagamento: chama o webhook do gateway simulado com assinatura válida.
 * Só funciona fora de produção e com ENABLE_PAYMENT_SIMULATOR=true.
 */
export async function simulatePaymentAction(
  number: string,
  token: string,
  outcome: keyof typeof outcomes,
): Promise<Result> {
  if (!simulatorEnabled())
    return { ok: false, error: "O simulador não está disponível neste ambiente." };
  if (!(outcome in outcomes)) return { ok: false, error: "Simulação desconhecida." };
  const order = await getOrderForViewer(number, { token });
  const payment = order?.payments.find((item) => item.status === "PENDING" && item.externalId);
  if (!order || !payment?.externalId)
    return { ok: false, error: "Este pedido não tem cobrança pendente." };
  const { status, reason } = outcomes[outcome];
  const delivered = await callMockWebhook(payment.externalId, status, reason);
  return delivered
    ? { ok: true }
    : {
        ok: false,
        error: "O webhook não respondeu. Confira se APP_URL aponta para este servidor.",
      };
}

const retrySchema = z.object({
  method: z.enum(["PIX", "CREDIT_CARD", "BOLETO"]),
  installments: z.number().int().min(1).max(12).default(1),
  card: cardTokenSchema.nullish(),
});

/** Nova cobrança para o mesmo pedido: cartão recusado ou "Pagar agora". Não cria outro pedido. */
export async function retryPaymentAction(
  number: string,
  token: string | null,
  input: z.input<typeof retrySchema>,
): Promise<Result> {
  const limit = await rateLimit("publicForm", clientIpHash(await headers()));
  if (!limit.allowed) return { ok: false, error: rateLimitMessage(limit) };
  const parsed = retrySchema.safeParse(input);
  if (!parsed.success || (parsed.data.method === "CREDIT_CARD" && !parsed.data.card)) {
    return { ok: false, error: "Confira os dados do pagamento e tente de novo." };
  }
  const order = await getOrderForViewer(number, { token });
  if (!order) return { ok: false, error: "Pedido não encontrado." };

  const settings = await getStoreSettings();
  const maxInstallments = getInstallments(order.totalCents, settings)?.count ?? 1;
  try {
    await retryPayment(order.id, {
      method: parsed.data.method,
      installments: Math.min(parsed.data.installments, maxInstallments),
      card: parsed.data.card ?? null,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof RetryPaymentError) return { ok: false, error: error.message };
    throw error;
  }
}

/** Sem o link do e-mail: confere número e e-mail do pedido e devolve o endereço com o token. */
export async function findOrderAction(
  numberInput: string,
  emailInput: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const limit = await rateLimit("tracking", clientIpHash(await headers()));
  if (!limit.allowed) return { ok: false, error: rateLimitMessage(limit) };
  const number = normalizeOrderNumber(String(numberInput));
  const email = emailSchema.safeParse(emailInput);
  // A mesma mensagem para número errado e e-mail errado: não revela quais pedidos existem.
  const notFound = {
    ok: false as const,
    error: "Não encontramos um pedido com este número e este e-mail. Confira os dados.",
  };
  if (!number || !email.success) return notFound;
  const order = await db.order.findUnique({
    where: { number },
    select: { number: true, accessToken: true, customerEmail: true },
  });
  if (!order || order.customerEmail.toLowerCase() !== email.data) return notFound;
  return { ok: true, url: `/pedido/${order.number}?token=${order.accessToken}` };
}
