import "server-only";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatCentsPlain } from "@/lib/money";
import type { Permission } from "@/lib/permissions";
import {
  orderStatusLabels,
  paymentMethodLabels,
  paymentStatusLabels,
} from "@/server/services/order-status";
import type { ListParams } from "./list";
import { channelLabels, orderWhere, sourceLabel } from "./orders";

export type Exporter = {
  permission: Permission;
  /** Entidade registrada na auditoria: "orders.export", "customers.export"... */
  auditEntity: string;
  build: (
    params: ListParams,
    raw: Record<string, string>,
  ) => Promise<{ headers: string[]; rows: unknown[][] }>;
};

const EXPORT_LIMIT = 10_000;

/** Exportações CSV do painel. Cada módulo registra a sua aqui. */
export const exporters: Record<string, Exporter> = {
  pedidos: {
    permission: "orders.export",
    auditEntity: "orders",
    build: async (params) => {
      const orders = await db.order.findMany({
        where: orderWhere(params),
        orderBy: { createdAt: "desc" },
        take: EXPORT_LIMIT,
      });
      return {
        headers: [
          "Número",
          "Data",
          "Cliente",
          "E-mail",
          "Status",
          "Pagamento",
          "Status do pagamento",
          "Subtotal",
          "Desconto",
          "Desconto Pix",
          "Frete",
          "Total",
          "Entrega",
          "Cidade",
          "UF",
          "Canal",
          "Origem",
          "Cupom",
        ],
        rows: orders.map((order) => [
          order.number,
          formatDateTime(order.createdAt),
          order.customerName,
          order.customerEmail,
          orderStatusLabels[order.status],
          order.manualPaymentLabel ?? paymentMethodLabels[order.paymentMethod],
          paymentStatusLabels[order.paymentStatus],
          formatCentsPlain(order.subtotalCents),
          formatCentsPlain(order.discountCents),
          formatCentsPlain(order.pixDiscountCents),
          formatCentsPlain(order.shippingCents),
          formatCentsPlain(order.totalCents),
          order.shippingMethodName,
          order.shippingCity,
          order.shippingState,
          channelLabels[order.channel],
          sourceLabel(order),
          order.couponCode,
        ]),
      };
    },
  },
};
