"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { formatBRL } from "@/lib/money";
import { sanitizeRichText } from "@/lib/sanitize";
import { isValidCpf, onlyDigits } from "@/lib/validators/cpf";
import { AdminError, runAdmin, type AdminResult } from "@/server/admin/action";
import { notifyBackInStock } from "@/server/admin/back-in-stock";
import { refreshProductRating } from "@/server/admin/customers";
import { optionalText, requiredText } from "@/server/admin/fields";
import { invalidateProducts } from "@/server/admin/products";
import { anonymizeUser, requestPasswordReset } from "@/server/services/accounts";
import { sendEmail } from "@/server/services/emails";
import { getEffectivePriceCents } from "@/server/services/pricing";

const idSchema = z.object({ id: z.string().min(1).max(40) });

// ───────────── Clientes ─────────────

const customerSchema = z.object({
  id: z.string().max(40),
  name: requiredText("o nome", 120),
  phone: optionalText(20).transform((value) => (value ? onlyDigits(value) : null)),
  cpf: optionalText(20)
    .transform((value) => (value ? onlyDigits(value) : null))
    .refine((value) => value === null || isValidCpf(value), "CPF inválido."),
  birthDate: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
      .nullable(),
  ),
});

export async function updateCustomerAction(
  input: z.input<typeof customerSchema>,
): Promise<AdminResult> {
  return runAdmin("customers.edit", customerSchema, input, async (data, { audit }) => {
    const before = await db.user.findUnique({
      where: { id: data.id },
      select: { name: true, phone: true, cpf: true, role: true },
    });
    if (!before || before.role !== "CUSTOMER") throw new AdminError("Cliente não encontrado.");
    if (
      data.cpf &&
      (await db.user.findFirst({
        where: { cpf: data.cpf, id: { not: data.id } },
        select: { id: true },
      }))
    )
      throw new AdminError("Este CPF já está em outra conta.");
    await db.user.update({
      where: { id: data.id },
      data: {
        name: data.name,
        phone: data.phone,
        cpf: data.cpf,
        birthDate: data.birthDate ? new Date(`${data.birthDate}T00:00:00.000Z`) : null,
      },
    });
    // A auditoria registra quais campos mudaram, sem copiar dados pessoais.
    await audit({
      action: "customer.update",
      entityType: "User",
      entityId: data.id,
      diff: {
        campos: ["name", "phone", "cpf"].filter(
          (field) => before[field as "name"] !== data[field as "name"],
        ),
      },
    });
    return { message: "Cliente salvo" };
  });
}

const noteSchema = z.object({
  id: z.string().max(40),
  body: z.string().trim().min(2, "Escreva a nota.").max(2000),
});

export async function addCustomerNoteAction(
  input: z.input<typeof noteSchema>,
): Promise<AdminResult> {
  return runAdmin("customers.notes", noteSchema, input, async (data, { user, audit }) => {
    await db.customerNote.create({
      data: { customerId: data.id, authorId: user.id, body: data.body },
    });
    await audit({ action: "customer.note", entityType: "User", entityId: data.id });
    return { message: "Nota adicionada" };
  });
}

export async function sendCustomerPasswordResetAction(
  input: z.input<typeof idSchema>,
): Promise<AdminResult> {
  return runAdmin("customers.edit", idSchema, input, async (data, { audit }) => {
    const customer = await db.user.findUnique({
      where: { id: data.id },
      select: { email: true, anonymizedAt: true },
    });
    if (!customer || customer.anonymizedAt) throw new AdminError("Cliente não encontrado.");
    await requestPasswordReset(customer.email);
    await audit({ action: "customer.password_reset", entityType: "User", entityId: data.id });
    return { message: "Link para redefinir a senha enviado ao cliente" };
  });
}

export async function anonymizeCustomerAction(
  input: z.input<typeof idSchema>,
): Promise<AdminResult<{ redirect?: string }>> {
  return runAdmin<typeof idSchema, { redirect?: string }>(
    "customers.anonymize",
    idSchema,
    input,
    async (data, { audit }) => {
      const customer = await db.user.findUnique({
        where: { id: data.id },
        select: { role: true, anonymizedAt: true },
      });
      if (!customer || customer.role !== "CUSTOMER")
        throw new AdminError("Só contas de cliente podem ser anonimizadas.");
      if (customer.anonymizedAt) throw new AdminError("Esta conta já foi anonimizada.");
      await anonymizeUser(data.id);
      await db.dataRequest.updateMany({
        where: { userId: data.id, status: "OPEN", type: "DELETE" },
        data: { status: "DONE", resolvedAt: new Date() },
      });
      await audit({ action: "customer.anonymize", entityType: "User", entityId: data.id });
      return {
        message: "Cliente anonimizado. Os pedidos foram mantidos sem identificação",
        data: { redirect: "/admin/clientes" },
      };
    },
  );
}

// ───────────── Pedidos LGPD ─────────────

const requestSchema = z.object({ id: z.string().max(40), status: z.enum(["DONE", "REJECTED"]) });

export async function resolveDataRequestAction(
  input: z.input<typeof requestSchema>,
): Promise<AdminResult> {
  return runAdmin("data_requests.manage", requestSchema, input, async (data, { user, audit }) => {
    const request = await db.dataRequest.findUnique({
      where: { id: data.id },
      include: { user: { select: { id: true, name: true, anonymizedAt: true } } },
    });
    if (!request || request.status !== "OPEN")
      throw new AdminError("Pedido não encontrado ou já resolvido.");
    if (
      data.status === "DONE" &&
      request.type === "DELETE" &&
      request.user &&
      !request.user.anonymizedAt
    )
      await anonymizeUser(request.user.id);
    if (data.status === "DONE" && request.type === "EXPORT" && request.user) {
      await sendEmail(request.email, "data-export-ready", {
        name: request.user.name,
        message: `Seus dados estão disponíveis para download em ${getEnv().APP_URL}/conta/privacidade.`,
      });
    }
    await db.dataRequest.update({
      where: { id: data.id },
      data: { status: data.status, handledById: user.id, resolvedAt: new Date() },
    });
    await audit({
      action: "data_request.resolve",
      entityType: "DataRequest",
      entityId: data.id,
      diff: { tipo: request.type, resultado: data.status },
    });
    return {
      message:
        data.status === "DONE"
          ? request.type === "DELETE"
            ? "Conta anonimizada e pedido concluído"
            : "Pedido concluído e cliente avisado"
          : "Pedido recusado",
    };
  });
}

// ───────────── Carrinhos abandonados ─────────────

async function loadCart(id: string) {
  const cart = await db.cart.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, marketingEmailOptIn: true } },
      items: { include: { variant: { include: { product: { select: { name: true } } } } } },
    },
  });
  if (!cart || cart.status === "CONVERTED")
    throw new AdminError("Carrinho não encontrado ou já convertido em pedido.");
  return cart;
}

export async function sendCartRecoveryAction(
  input: z.input<typeof idSchema>,
): Promise<AdminResult> {
  return runAdmin("carts.recover", idSchema, input, async (data, { audit }) => {
    const cart = await loadCart(data.id);
    const email = cart.email ?? cart.user?.email;
    if (!email) throw new AdminError("Este carrinho não tem e-mail.");
    const lead = await db.lead.findFirst({
      where: { email },
      select: { unsubscribedAt: true, unsubscribeToken: true },
      orderBy: { createdAt: "desc" },
    });
    if (lead?.unsubscribedAt)
      throw new AdminError(
        "Este cliente pediu para não receber e-mails. Não é possível enviar a recuperação.",
      );
    const total = cart.items.reduce(
      (sum, item) => sum + item.quantity * getEffectivePriceCents(item.variant),
      0,
    );
    const base = getEnv().APP_URL;
    const sent = await sendEmail(email, "abandoned-cart", {
      cart: {
        customerName: cart.user?.name ?? null,
        items: cart.items.map((item) => ({
          name: item.variant.product.name,
          quantity: item.quantity,
        })),
        total: formatBRL(total),
        url: `${base}/carrinho/recuperar/${cart.token}?utm_source=email&utm_medium=recuperacao`,
        unsubscribeUrl: lead ? `${base}/descadastrar/${lead.unsubscribeToken}` : undefined,
      },
    });
    if (!sent) throw new AdminError("O e-mail não foi enviado. Veja o motivo em E-mails enviados.");
    await db.cart.update({
      where: { id: cart.id },
      data: { recoveryEmailSentAt: new Date(), status: "ABANDONED" },
    });
    await audit({ action: "cart.recovery_email", entityType: "Cart", entityId: cart.id });
    return { message: "E-mail de recuperação enviado" };
  });
}

export async function markCartContactedAction(
  input: z.input<typeof idSchema>,
): Promise<AdminResult> {
  return runAdmin("carts.recover", idSchema, input, async (data, { audit }) => {
    const cart = await loadCart(data.id);
    await db.cart.update({
      where: { id: cart.id },
      data: { contactedAt: cart.contactedAt ? null : new Date(), status: "ABANDONED" },
    });
    await audit({ action: "cart.contacted", entityType: "Cart", entityId: cart.id });
    return {
      message: cart.contactedAt
        ? "Marcação de contato removida"
        : "Carrinho marcado como contatado",
    };
  });
}

// ───────────── Avaliações ─────────────

const reviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), id: z.string().max(40) }),
  z.object({
    action: z.literal("reject"),
    id: z.string().max(40),
    reason: z.string().trim().min(3, "Informe o motivo interno da rejeição.").max(300),
  }),
  z.object({
    action: z.literal("reply"),
    id: z.string().max(40),
    reply: z.string().trim().max(1000),
  }),
  z.object({
    action: z.literal("edit"),
    id: z.string().max(40),
    title: z.string().trim().max(120),
    body: z.string().trim().min(3, "O texto não pode ficar vazio.").max(2000),
  }),
]);

export async function moderateReviewAction(
  input: z.input<typeof reviewSchema>,
): Promise<AdminResult> {
  return runAdmin("reviews.manage", reviewSchema, input, async (data, { audit }) => {
    const review = await db.review.findUnique({
      where: { id: data.id },
      include: { product: { select: { id: true, slug: true } } },
    });
    if (!review) throw new AdminError("Avaliação não encontrada.");
    let message: string;
    let diff: Record<string, unknown>;
    if (data.action === "approve") {
      await db.review.update({
        where: { id: review.id },
        data: { status: "APPROVED", rejectionReason: null },
      });
      message = "Avaliação aprovada";
      diff = { status: { antes: review.status, depois: "APPROVED" } };
    } else if (data.action === "reject") {
      await db.review.update({
        where: { id: review.id },
        data: { status: "REJECTED", rejectionReason: data.reason },
      });
      message = "Avaliação rejeitada";
      diff = { status: { antes: review.status, depois: "REJECTED" }, motivo: data.reason };
    } else if (data.action === "reply") {
      await db.review.update({
        where: { id: review.id },
        data: { adminReply: data.reply || null, repliedAt: data.reply ? new Date() : null },
      });
      message = data.reply ? "Resposta publicada" : "Resposta removida";
      diff = { resposta: data.reply };
    } else {
      // Só para corrigir erros de digitação: o texto anterior fica registrado na auditoria.
      const body = sanitizeRichText(data.body).replace(/<[^>]+>/g, "");
      await db.review.update({
        where: { id: review.id },
        data: { title: data.title || null, body },
      });
      message = "Texto da avaliação corrigido";
      diff = {
        titulo: { antes: review.title, depois: data.title || null },
        texto: { antes: review.body, depois: body },
      };
    }
    await refreshProductRating(review.product.id);
    await audit({
      action: `review.${data.action}`,
      entityType: "Review",
      entityId: review.id,
      diff: diff as never,
    });
    invalidateProducts([review.product.slug]);
    return { message };
  });
}

// ───────────── Solicitações, contatos e avise-me ─────────────

const inboxSchema = z.object({
  kind: z.enum(["request", "contact"]),
  id: z.string().max(40),
  status: z.string().max(20),
  assignedToId: z.preprocess(
    (value) => (value === "" ? null : value),
    z.string().max(40).nullable(),
  ),
  internalNotes: optionalText(4000),
});

export async function updateInboxItemAction(
  input: z.input<typeof inboxSchema>,
): Promise<AdminResult> {
  return runAdmin("requests.manage", inboxSchema, input, async (data, { audit }) => {
    const fields = { assignedToId: data.assignedToId, internalNotes: data.internalNotes };
    if (data.kind === "request") {
      const status = z.enum(["NEW", "IN_PROGRESS", "QUOTED", "CLOSED"]).parse(data.status);
      await db.productRequest.update({ where: { id: data.id }, data: { ...fields, status } });
    } else {
      const status = z.enum(["NEW", "READ", "ANSWERED", "CLOSED"]).parse(data.status);
      await db.contactMessage.update({ where: { id: data.id }, data: { ...fields, status } });
    }
    await audit({
      action: `${data.kind === "request" ? "product_request" : "contact"}.update`,
      entityType: data.kind === "request" ? "ProductRequest" : "ContactMessage",
      entityId: data.id,
      diff: { status: data.status },
    });
    return { message: data.kind === "request" ? "Solicitação atualizada" : "Contato atualizado" };
  });
}

const productSchema = z.object({ productId: z.string().max(40) });

/** Dispara agora o e-mail "Chegou" para quem pediu aviso deste produto. */
export async function notifyBackInStockAction(
  input: z.input<typeof productSchema>,
): Promise<AdminResult> {
  return runAdmin("requests.manage", productSchema, input, async (data, { audit }) => {
    const sent = await notifyBackInStock(data.productId);
    if (sent === 0)
      throw new AdminError(
        "Nenhum aviso enviado: o produto precisa estar publicado e com estoque, e ter pedidos de aviso pendentes.",
      );
    await audit({
      action: "back_in_stock.notify",
      entityType: "Product",
      entityId: data.productId,
      diff: { avisos: sent },
    });
    return { message: `${sent} ${sent === 1 ? "aviso enviado" : "avisos enviados"}` };
  });
}
