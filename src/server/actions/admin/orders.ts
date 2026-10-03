"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { formatCpf } from "@/lib/validators/cpf";
import { AdminError, runAdmin, type AdminResult } from "@/server/admin/action";
import { sendOrderEmail } from "@/server/services/emails";
import {
  ORDER_STATUSES,
  orderStatusLabels,
  wasPaid,
  type OrderStatusCode,
} from "@/server/services/order-status";
import { transitionMessage, transitionOrder } from "@/server/services/orders";

const statusSchema = z.object({
  orderId: z.string().min(1),
  toStatus: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional(),
  notifyCustomer: z.boolean().default(true),
  refund: z.boolean().default(true),
  restock: z.boolean().default(false),
  trackingCode: z.string().trim().max(60).optional(),
  carrier: z.string().trim().max(60).optional(),
});

export async function changeOrderStatusAction(
  input: z.input<typeof statusSchema>,
): Promise<AdminResult> {
  return runAdmin(
    "orders.update_status",
    statusSchema,
    input,
    async (data, { user, ipHash, userAgent }) => {
      const order = await db.order.findUnique({
        where: { id: data.orderId },
        select: { status: true, number: true },
      });
      if (!order) throw new AdminError("Pedido não encontrado.");
      const paid = wasPaid(order.status as OrderStatusCode);
      const closing = data.toStatus === "CANCELED" || data.toStatus === "RETURNED";

      if (data.toStatus === "PAID")
        throw new AdminError('Use "Marcar como pago" e informe a observação.');
      if (data.toStatus === "CANCELED" && !data.note)
        throw new AdminError("Informe o motivo do cancelamento.");
      if (data.toStatus === "SHIPPED" && !data.trackingCode)
        throw new AdminError("Informe o código de rastreio.");
      // Cancelar ou devolver um pedido pago envolve estorno, que só administradores fazem.
      if (closing && paid && data.refund && !can(user, "orders.refund")) {
        throw new AdminError(
          "Cancelar ou devolver um pedido pago envolve estorno, que só administradores podem fazer.",
        );
      }

      await transitionOrder(data.orderId, data.toStatus, {
        userId: user.id,
        note: data.note || null,
        notifyCustomer: data.notifyCustomer,
        refund: data.refund,
        restock: data.restock,
        trackingCode: data.trackingCode,
        carrier: data.carrier,
        ipHash,
        userAgent,
      });
      revalidatePath("/admin", "layout");
      return { message: transitionMessage(data.toStatus) };
    },
  );
}

const bulkSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
  toStatus: z.enum(ORDER_STATUSES),
});

/** Alteração em massa: respeita a máquina de estados; os pedidos que não podem mudar são listados e ignorados. */
export async function bulkChangeOrderStatusAction(
  input: z.input<typeof bulkSchema>,
): Promise<AdminResult> {
  return runAdmin(
    "orders.update_status",
    bulkSchema,
    input,
    async ({ ids, toStatus }, { user, ipHash, userAgent }) => {
      if (["PAID", "CANCELED", "RETURNED", "SHIPPED"].includes(toStatus)) {
        throw new AdminError(
          `"${orderStatusLabels[toStatus]}" pede informações de cada pedido. Altere um por vez.`,
        );
      }
      const orders = await db.order.findMany({
        where: { id: { in: ids } },
        select: { id: true, number: true },
      });
      const skipped: string[] = [];
      let changed = 0;
      for (const order of orders) {
        try {
          await transitionOrder(order.id, toStatus, {
            userId: user.id,
            notifyCustomer: true,
            ipHash,
            userAgent,
          });
          changed++;
        } catch {
          skipped.push(order.number);
        }
      }
      revalidatePath("/admin", "layout");
      const base = `${changed} ${changed === 1 ? "pedido alterado" : "pedidos alterados"} para ${orderStatusLabels[toStatus]}`;
      return {
        message: skipped.length
          ? `${base}. Ignorados por não permitirem essa mudança: ${skipped.join(", ")}.`
          : base,
      };
    },
  );
}

const markPaidSchema = z.object({
  orderId: z.string().min(1),
  note: z
    .string()
    .trim()
    .min(
      5,
      "Descreva como o pagamento foi confirmado (por exemplo: comprovante recebido pelo WhatsApp).",
    )
    .max(500),
});

/** Pix pendente confirmado por comprovante: marca como pago manualmente, com observação obrigatória e auditoria. */
export async function markOrderPaidAction(
  input: z.input<typeof markPaidSchema>,
): Promise<AdminResult> {
  return runAdmin(
    "orders.mark_paid",
    markPaidSchema,
    input,
    async ({ orderId, note }, { user, audit, ipHash, userAgent }) => {
      const order = await db.order.findUnique({
        where: { id: orderId },
        include: {
          payments: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      });
      if (!order) throw new AdminError("Pedido não encontrado.");
      if (order.status !== "PENDING_PAYMENT")
        throw new AdminError("Este pedido não está aguardando pagamento.");

      const payment = order.payments[0];
      if (payment)
        await db.payment.update({
          where: { id: payment.id },
          data: { status: "PAID", rawResponse: { manual: true, note, by: user.id } },
        });
      await transitionOrder(orderId, "PAID", {
        userId: user.id,
        note: `Pago manualmente: ${note}`,
        notifyCustomer: true,
        ipHash,
        userAgent,
      });
      await audit({
        action: "order.mark_paid",
        entityType: "Order",
        entityId: orderId,
        diff: { observacao: note, pedido: order.number },
      });
      revalidatePath("/admin", "layout");
      return { message: "Pedido marcado como pago" };
    },
  );
}

const noteSchema = z.object({
  orderId: z.string().min(1),
  body: z.string().trim().min(1, "Escreva a nota.").max(2000),
});

export async function addOrderNoteAction(input: z.input<typeof noteSchema>): Promise<AdminResult> {
  return runAdmin("orders.notes", noteSchema, input, async ({ orderId, body }, { user, audit }) => {
    await db.orderNote.create({ data: { orderId, authorId: user.id, body } });
    await audit({ action: "order.note_add", entityType: "Order", entityId: orderId });
    revalidatePath(`/admin/pedidos`, "layout");
    return { message: "Nota adicionada" };
  });
}

const resendSchema = z.object({
  orderId: z.string().min(1),
  template: z.enum([
    "order-received",
    "payment-approved",
    "order-preparing",
    "order-shipped",
    "order-delivered",
    "order-canceled",
    "order-manual-summary",
  ]),
});

export async function resendOrderEmailAction(
  input: z.input<typeof resendSchema>,
): Promise<AdminResult> {
  return runAdmin(
    "orders.resend_email",
    resendSchema,
    input,
    async ({ orderId, template }, { audit }) => {
      const sent = await sendOrderEmail(orderId, template);
      if (!sent) throw new AdminError("O e-mail não foi enviado. Veja o erro em E-mails enviados.");
      await audit({
        action: "order.email_resend",
        entityType: "Order",
        entityId: orderId,
        diff: { modelo: template },
      });
      revalidatePath(`/admin/pedidos`, "layout");
      return { message: "E-mail reenviado" };
    },
  );
}

const idSchema = z.object({ orderId: z.string().min(1) });

/** Mostra o CPF completo. Cada exibição fica na auditoria. */
export async function revealOrderCpfAction(
  input: z.input<typeof idSchema>,
): Promise<AdminResult<string>> {
  return runAdmin<typeof idSchema, string>(
    "orders.reveal_cpf",
    idSchema,
    input,
    async ({ orderId }, { audit }) => {
      const order = await db.order.findUnique({
        where: { id: orderId },
        select: { customerCpf: true },
      });
      if (!order?.customerCpf) throw new AdminError("Este pedido não tem CPF.");
      await audit({ action: "order.reveal_cpf", entityType: "Order", entityId: orderId });
      return { message: "CPF exibido", data: formatCpf(order.customerCpf) };
    },
  );
}

/** "Solicitar avaliação": reenvia o e-mail de pedido entregue, com os links para avaliar. */
export async function requestReviewAction(input: z.input<typeof idSchema>): Promise<AdminResult> {
  return runAdmin("reviews.manage", idSchema, input, async ({ orderId }, { audit }) => {
    const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (order?.status !== "DELIVERED")
      throw new AdminError("Só é possível pedir avaliação de pedidos entregues.");
    if (!(await sendOrderEmail(orderId, "order-delivered")))
      throw new AdminError("O e-mail não foi enviado.");
    await audit({ action: "order.review_request", entityType: "Order", entityId: orderId });
    return { message: "Convite para avaliar enviado" };
  });
}
