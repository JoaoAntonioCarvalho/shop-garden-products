import "server-only";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { invalidate } from "@/server/cache";
import { getPaymentProvider } from "@/server/providers/payment";
import { CATALOG_TAG } from "./catalog";
import { sendOrderEmail, sendOrderStatusEmail } from "./emails";
import { commitSale, releaseReservation, returnToStock } from "./inventory";
import { assertTransition, orderStatusLabels, wasPaid, type OrderStatusCode } from "./order-status";

type Tx = Prisma.TransactionClient;

export class OrderNotFoundError extends Error {
  constructor() {
    super("Pedido não encontrado.");
  }
}

/** Próximo número legível do pedido, pela sequência do Postgres: NSG-000123. */
export async function nextOrderNumber(tx: Tx): Promise<string> {
  const [row] = await tx.$queryRaw<
    Array<{ value: bigint }>
  >`SELECT nextval('order_number_seq') AS value`;
  return `NSG-${String(row.value).padStart(6, "0")}`;
}

export type TransitionOptions = {
  /** Quem alterou. Nulo quando foi o sistema (webhook, tarefa agendada). */
  userId?: string | null;
  note?: string | null;
  notifyCustomer?: boolean;
  /** Cancelamento ou devolução de pedido pago: estorna o pagamento (padrão: sim). */
  refund?: boolean;
  /** Cancelamento ou devolução de pedido pago: devolve os itens ao estoque (padrão: não). */
  restock?: boolean;
  trackingCode?: string | null;
  carrier?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
};

/**
 * Única porta de mudança de status do pedido (seção 9.5). Valida a transição, aplica os efeitos
 * (estoque, cupom, pagamento, datas), grava o histórico e a auditoria e, se pedido, avisa o cliente.
 */
export async function transitionOrder(
  orderId: string,
  toStatus: OrderStatusCode,
  options: TransitionOptions = {},
) {
  const refundsToRequest: Array<{
    externalId: string;
    provider: string;
    amountCents: number;
    refundId: string;
  }> = [];

  const result = await db.$transaction(async (tx) => {
    // Bloqueia o pedido: duas mudanças simultâneas (webhook e admin, por exemplo) entram em fila.
    const locked = await tx.$queryRaw<Array<{ id: string; status: OrderStatus }>>`
      SELECT id, status FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    if (locked.length === 0) throw new OrderNotFoundError();
    const fromStatus = locked[0].status as OrderStatusCode;
    assertTransition(fromStatus, toStatus);

    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { number: true, couponId: true, userId: true, customerEmail: true },
    });
    const now = new Date();
    const data: Prisma.OrderUncheckedUpdateInput = { status: toStatus };
    const paid = wasPaid(fromStatus);

    const refundPayments = async () => {
      const payments = await tx.payment.findMany({ where: { orderId, status: "PAID" } });
      for (const payment of payments) {
        const refund = await tx.refund.create({
          data: {
            paymentId: payment.id,
            amountCents: payment.amountCents,
            reason: options.note ?? null,
            status: "DONE",
            userId: options.userId ?? null,
          },
        });
        await tx.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
        if (payment.externalId) {
          refundsToRequest.push({
            externalId: payment.externalId,
            provider: payment.provider,
            amountCents: payment.amountCents,
            refundId: refund.id,
          });
        }
      }
      if (payments.length > 0) data.paymentStatus = "REFUNDED";
    };

    switch (toStatus) {
      case "PAID":
        await commitSale(tx, orderId);
        data.paidAt = now;
        data.paymentStatus = "PAID";
        // O uso do cupom só conta quando o pedido é pago.
        if (order.couponId) {
          const existing = await tx.couponRedemption.findUnique({
            where: { orderId },
            select: { id: true },
          });
          if (!existing) {
            await tx.couponRedemption.create({
              data: {
                couponId: order.couponId,
                orderId,
                userId: order.userId,
                email: order.customerEmail.toLowerCase(),
              },
            });
            await tx.coupon.update({
              where: { id: order.couponId },
              data: { usageCount: { increment: 1 } },
            });
          }
        }
        break;

      case "EXPIRED":
        await releaseReservation(tx, orderId);
        data.paymentStatus = "EXPIRED";
        data.canceledAt = now;
        await tx.payment.updateMany({
          where: { orderId, status: "PENDING" },
          data: { status: "EXPIRED" },
        });
        break;

      case "CANCELED":
        data.canceledAt = now;
        data.cancelReason = options.note ?? null;
        if (paid) {
          // Estorna o uso do cupom.
          if (order.couponId) {
            const removed = await tx.couponRedemption.deleteMany({ where: { orderId } });
            if (removed.count > 0) {
              await tx.coupon.update({
                where: { id: order.couponId },
                data: { usageCount: { decrement: removed.count } },
              });
            }
          }
          if (options.restock) await returnToStock(tx, orderId, options.userId, "Pedido cancelado");
          if (options.refund !== false) await refundPayments();
        } else {
          await releaseReservation(tx, orderId, options.userId);
          data.paymentStatus = "CANCELED";
          await tx.payment.updateMany({
            where: { orderId, status: "PENDING" },
            data: { status: "CANCELED" },
          });
        }
        break;

      case "RETURNED":
        if (options.restock) await returnToStock(tx, orderId, options.userId, "Pedido devolvido");
        if (options.refund !== false) await refundPayments();
        break;

      case "PREPARING":
        // Volta de "saiu para entrega" (tentativa falhou) mantém a data original de preparo.
        if (fromStatus !== "OUT_FOR_DELIVERY") data.preparedAt = now;
        break;

      case "SHIPPED":
      case "OUT_FOR_DELIVERY":
      case "READY_FOR_PICKUP":
        data.shippedAt = now;
        if (options.trackingCode !== undefined) data.trackingCode = options.trackingCode || null;
        if (options.carrier !== undefined) data.carrier = options.carrier || null;
        break;

      case "DELIVERED":
        data.deliveredAt = now;
        break;
    }

    await tx.order.update({ where: { id: orderId }, data });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus,
        toStatus,
        note: options.note ?? null,
        notifiedCustomer: options.notifyCustomer ?? false,
        userId: options.userId ?? null,
      },
    });
    await logAudit(
      {
        userId: options.userId,
        action: "order.status_change",
        entityType: "Order",
        entityId: orderId,
        diff: {
          status: { antes: fromStatus, depois: toStatus },
          ...(options.note ? { observacao: options.note } : {}),
          ...(options.trackingCode ? { rastreio: options.trackingCode } : {}),
          ...(paid && (toStatus === "CANCELED" || toStatus === "RETURNED")
            ? { estorno: options.refund !== false, devolucaoAoEstoque: Boolean(options.restock) }
            : {}),
        },
        ipHash: options.ipHash,
        userAgent: options.userAgent,
      },
      tx,
    );

    return { number: order.number, fromStatus, toStatus };
  });

  // Fora da transação: estorno no gateway, cache e e-mails. Uma falha aqui não desfaz o status.
  for (const refund of refundsToRequest) {
    try {
      const response = await getPaymentProvider(refund.provider)?.refund(
        refund.externalId,
        refund.amountCents,
      );
      if (response && !response.ok)
        await db.refund.update({ where: { id: refund.refundId }, data: { status: "FAILED" } });
    } catch {
      await db.refund
        .update({ where: { id: refund.refundId }, data: { status: "FAILED" } })
        .catch(() => undefined);
    }
  }
  invalidate(CATALOG_TAG);
  if (options.notifyCustomer) await sendOrderStatusEmail(orderId, toStatus);
  if (toStatus === "PAID") await sendOrderEmail(orderId, "internal-new-order");

  return result;
}

/** "Status alterado para Em preparação" */
export function transitionMessage(toStatus: OrderStatusCode): string {
  return `Status alterado para ${orderStatusLabels[toStatus]}`;
}
