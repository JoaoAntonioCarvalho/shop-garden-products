import { getPaymentProvider } from "@/server/providers/payment";
import { WebhookSignatureError } from "@/server/providers/payment/types";
import { applyPaymentEvent } from "@/server/services/payments";

/**
 * Webhook de pagamento. O gateway chama esta rota quando o status de uma cobrança muda;
 * o provider valida a assinatura e normaliza o evento, e o pedido segue pela máquina de estados.
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/webhooks/payments/[provider]">,
) {
  const { provider: name } = await context.params;
  const provider = getPaymentProvider(name);
  if (!provider) return Response.json({ error: "Provider desconhecido" }, { status: 404 });

  let event;
  try {
    event = await provider.parseWebhook(request);
  } catch (error) {
    if (error instanceof WebhookSignatureError)
      return Response.json({ error: error.message }, { status: 401 });
    throw error;
  }

  const result = await applyPaymentEvent(event);
  // Responde 200 mesmo para cobranças desconhecidas, para o gateway não ficar reenviando.
  return Response.json({ received: true, handled: result.handled });
}
