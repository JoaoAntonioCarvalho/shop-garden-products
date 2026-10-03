import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { zonedParts } from "@/lib/dates";
import { onlyDigits } from "@/lib/validators/cpf";
import { ORDER_STATUSES } from "@/server/services/order-status";
import { normalizeOrderNumber } from "@/server/services/order-view";
import { dateRangeOf, type ListParams } from "./list";

const PAYMENT_STATUSES = [
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
  "CANCELED",
];
const METHODS = ["PIX", "CREDIT_CARD", "BOLETO", "MANUAL"];
const CHANNELS = ["SITE", "WHATSAPP", "STORE", "PHONE"];

export const shippingKindFilters: Record<string, string> = {
  "entrega-hoje": "entrega-hoje",
  agendada: "agendada",
  economico: "economico",
  expresso: "expresso",
  retirada: "retirada",
};

/** Filtros da lista de pedidos, usados também pela exportação CSV. */
export function orderWhere({ q, filters }: ListParams): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];
  const today = new Date(`${zonedParts(new Date()).dateKey}T00:00:00Z`);

  if (ORDER_STATUSES.includes(filters.status as never))
    and.push({ status: filters.status as never });
  if (PAYMENT_STATUSES.includes(filters.pagamento))
    and.push({ paymentStatus: filters.pagamento as never });
  if (METHODS.includes(filters.metodo)) and.push({ paymentMethod: filters.metodo as never });
  if (CHANNELS.includes(filters.canal)) and.push({ channel: filters.canal as never });
  if (shippingKindFilters[filters.entrega])
    and.push({ shippingMethodCode: { startsWith: shippingKindFilters[filters.entrega] } });
  if (filters.cupom) and.push({ couponCode: { equals: filters.cupom.toUpperCase() } });

  const created = dateRangeOf(filters.de, filters.ate);
  if (created) and.push({ createdAt: created });
  const delivery = dateRangeOf(filters["entrega-de"], filters["entrega-ate"]);
  if (delivery) {
    and.push({
      deliveryDate: {
        ...(filters["entrega-de"] ? { gte: new Date(`${filters["entrega-de"]}T00:00:00Z`) } : {}),
        ...(filters["entrega-ate"] ? { lte: new Date(`${filters["entrega-ate"]}T00:00:00Z`) } : {}),
      },
    });
  }
  if (filters.hoje === "1") and.push({ deliveryDate: today });
  if (filters.atrasados === "1") {
    and.push({
      OR: [
        // Pago há mais de 24h e ainda não preparado.
        { status: "PAID", paidAt: { lt: new Date(Date.now() - 86_400_000) } },
        // Data de entrega combinada já passou e o pedido não foi entregue.
        {
          deliveryDate: { lt: today },
          status: { in: ["PAID", "PREPARING", "OUT_FOR_DELIVERY", "READY_FOR_PICKUP"] },
        },
        { estimatedDeliveryTo: { lt: today }, status: { in: ["PAID", "PREPARING", "SHIPPED"] } },
      ],
    });
  }
  const min = Number(filters["valor-min"]);
  const max = Number(filters["valor-max"]);
  if (min > 0) and.push({ totalCents: { gte: Math.round(min * 100) } });
  if (max > 0) and.push({ totalCents: { lte: Math.round(max * 100) } });

  if (q) {
    const digits = onlyDigits(q);
    const number = /^(nsg-?)?\d+$/i.test(q.trim()) ? normalizeOrderNumber(q) : null;
    and.push({
      OR: [
        ...(number ? [{ number }] : []),
        { customerName: { contains: q, mode: "insensitive" } },
        { customerEmail: { contains: q.toLowerCase() } },
        ...(digits.length >= 4
          ? [{ customerCpf: { contains: digits } }, { customerPhone: { contains: digits } }]
          : []),
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

export const channelLabels: Record<string, string> = {
  SITE: "Site",
  WHATSAPP: "WhatsApp",
  STORE: "Loja",
  PHONE: "Telefone",
};

export function sourceLabel(order: { utmSource: string | null; utmMedium: string | null }): string {
  return order.utmSource
    ? [order.utmSource, order.utmMedium].filter(Boolean).join(" / ")
    : "direto";
}
