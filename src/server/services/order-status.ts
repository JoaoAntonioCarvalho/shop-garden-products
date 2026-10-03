/** Máquina de estados do pedido (seção 9.5). Pura: os efeitos colaterais ficam em orders.ts. */

export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "PREPARING",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELED",
  "EXPIRED",
  "RETURNED",
] as const;

export type OrderStatusCode = (typeof ORDER_STATUSES)[number];

export const ORDER_TRANSITIONS: Record<OrderStatusCode, readonly OrderStatusCode[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELED", "EXPIRED"],
  PAID: ["PREPARING", "CANCELED"],
  PREPARING: ["READY_FOR_PICKUP", "SHIPPED", "OUT_FOR_DELIVERY", "CANCELED"],
  READY_FOR_PICKUP: ["DELIVERED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  // Volta para "em preparação" quando a tentativa de entrega falha.
  OUT_FOR_DELIVERY: ["DELIVERED", "PREPARING"],
  DELIVERED: ["RETURNED"],
  CANCELED: [],
  EXPIRED: [],
  RETURNED: [],
};

export const orderStatusLabels: Record<OrderStatusCode, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pagamento aprovado",
  PREPARING: "Em preparação",
  READY_FOR_PICKUP: "Pronto para retirada",
  SHIPPED: "Enviado",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
  EXPIRED: "Pagamento não realizado",
  RETURNED: "Devolvido",
};

export const paymentMethodLabels: Record<string, string> = {
  PIX: "Pix",
  CREDIT_CARD: "Cartão de crédito",
  BOLETO: "Boleto",
  MANUAL: "Pagamento registrado pela loja",
};

export const paymentStatusLabels: Record<string, string> = {
  PENDING: "Aguardando",
  AUTHORIZED: "Autorizado",
  PAID: "Pago",
  FAILED: "Recusado",
  EXPIRED: "Expirado",
  REFUNDED: "Estornado",
  CANCELED: "Cancelado",
};

export function canTransition(from: OrderStatusCode, to: OrderStatusCode): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: OrderStatusCode,
    public readonly to: OrderStatusCode,
  ) {
    const allowed = ORDER_TRANSITIONS[from].map((status) => orderStatusLabels[status]);
    super(
      allowed.length
        ? `Um pedido "${orderStatusLabels[from]}" não pode ir para "${orderStatusLabels[to]}". Próximos status possíveis: ${allowed.join(", ")}.`
        : `Um pedido "${orderStatusLabels[from]}" não pode mais mudar de status.`,
    );
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: OrderStatusCode, to: OrderStatusCode): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/** O pedido já foi pago em algum momento (define se o cancelamento exige estorno e devolução). */
export function wasPaid(status: OrderStatusCode): boolean {
  return !["PENDING_PAYMENT", "EXPIRED"].includes(status);
}

/** Etapas da linha do tempo exibida ao cliente. */
export function timelineSteps(shippingKind: "transport" | "local" | "pickup"): OrderStatusCode[] {
  const middle: OrderStatusCode =
    shippingKind === "transport"
      ? "SHIPPED"
      : shippingKind === "pickup"
        ? "READY_FOR_PICKUP"
        : "OUT_FOR_DELIVERY";
  return ["PENDING_PAYMENT", "PAID", "PREPARING", middle, "DELIVERED"];
}
