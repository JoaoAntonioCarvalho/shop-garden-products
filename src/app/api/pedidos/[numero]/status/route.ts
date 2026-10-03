import { getOrderForViewer } from "@/server/services/order-view";
import { expireOverduePayments } from "@/server/services/payments";

/** Status do pedido para a verificação automática na página de confirmação (a cada 5 segundos). */
export async function GET(request: Request, context: RouteContext<"/api/pedidos/[numero]/status">) {
  const { numero } = await context.params;
  const token = new URL(request.url).searchParams.get("token");
  let order = await getOrderForViewer(numero, { token });
  if (!order) return Response.json({ error: "Pedido não encontrado" }, { status: 404 });

  // Se o Pix ou o boleto venceu enquanto a página estava aberta, expira agora.
  if (order.status === "PENDING_PAYMENT" && (await expireOverduePayments(order.id)) > 0) {
    order = (await getOrderForViewer(numero, { token })) ?? order;
  }
  return Response.json(
    { status: order.status, paymentStatus: order.paymentStatus },
    { headers: { "Cache-Control": "no-store" } },
  );
}
