import "server-only";
import { render } from "@react-email/render";
import type { EmailStore } from "@/components/email/layout";
import {
  emailTemplates,
  type EmailTemplateName,
  type EmailTemplateProps,
  type OrderEmailData,
} from "@/components/email/templates";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatDateKey, formatDateOnly, formatDateTime } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { appUrl } from "@/lib/seo/metadata";
import { formatCep } from "@/lib/validators/cep";
import { getEmailProvider } from "@/server/providers/email";
import { orderStatusLabels, paymentMethodLabels } from "./order-status";
import { getStoreSettings } from "./settings";

export async function emailStore(): Promise<EmailStore & { notificationEmail: string }> {
  const settings = await getStoreSettings();
  return {
    name: settings.name,
    url: appUrl(),
    email: settings.email,
    phoneDisplay: settings.phoneDisplay,
    whatsapp: settings.whatsapp,
    legalName: settings.legalName,
    cnpj: settings.cnpj,
    address: settings.address,
    notificationEmail: settings.notificationEmail,
  };
}

/** Renderiza um modelo em HTML e em texto puro. Usado pelo envio, pelo admin e pelos testes. */
export async function renderEmail<T extends EmailTemplateName>(
  template: T,
  props: EmailTemplateProps<T>,
  store: EmailStore,
) {
  const definition = emailTemplates[template] as unknown as {
    subject: (props: unknown) => string;
    render: (store: EmailStore, props: unknown) => React.ReactElement;
  };
  const element = definition.render(store, props);
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { subject: definition.subject(props), html, text };
}

type SendOptions = { orderId?: string | null; headers?: Record<string, string> };

/**
 * Envia um e-mail transacional e grava o EmailLog (enviado ou falhou). Nunca lança erro:
 * uma falha de e-mail não pode derrubar a compra.
 */
export async function sendEmail<T extends EmailTemplateName>(
  to: string,
  template: T,
  props: EmailTemplateProps<T>,
  options: SendOptions = {},
): Promise<boolean> {
  let subject = template as string;
  try {
    const store = await emailStore();
    const rendered = await renderEmail(template, props, store);
    subject = rendered.subject;
    await getEmailProvider().send({
      to,
      subject,
      html: rendered.html,
      text: rendered.text,
      headers: options.headers,
    });
    await db.emailLog.create({
      data: {
        to,
        subject,
        template,
        payload: props as Prisma.InputJsonValue,
        status: "SENT",
        orderId: options.orderId ?? null,
      },
    });
    return true;
  } catch (error) {
    await db.emailLog
      .create({
        data: {
          to,
          subject,
          template,
          payload: props as Prisma.InputJsonValue,
          status: "FAILED",
          error: error instanceof Error ? error.message.slice(0, 500) : "Erro desconhecido",
          orderId: options.orderId ?? null,
        },
      })
      .catch(() => undefined);
    return false;
  }
}

/** Notificação interna para o e-mail da loja definido na configuração. */
export async function sendInternalEmail<T extends EmailTemplateName>(
  template: T,
  props: EmailTemplateProps<T>,
  options: SendOptions = {},
) {
  const store = await emailStore();
  return sendEmail(store.notificationEmail, template, props, options);
}

type AddressSnapshot = {
  recipientName?: string;
  street?: string;
  number?: string;
  complement?: string | null;
  district?: string;
  city?: string;
  state?: string;
  cep?: string;
};

export function addressLinesOf(address: AddressSnapshot): string[] {
  return [
    address.recipientName,
    [address.street, address.number].filter(Boolean).join(", ") +
      (address.complement ? `, ${address.complement}` : ""),
    [
      address.district,
      address.city && address.state ? `${address.city}/${address.state}` : address.city,
    ]
      .filter(Boolean)
      .join(", "),
    address.cep ? `CEP ${formatCep(address.cep)}` : null,
  ].filter((line): line is string => Boolean(line && line.trim()));
}

/** "Hoje, até 20h", "sábado, 3 de outubro, manhã" ou "de 07/10/2026 a 10/10/2026". */
export function deliveryInfoOf(order: {
  deliveryDate: Date | null;
  deliveryWindow: string | null;
  estimatedDeliveryFrom: Date | null;
  estimatedDeliveryTo: Date | null;
}): string {
  if (order.deliveryDate) {
    const key = order.deliveryDate.toISOString().slice(0, 10);
    return [formatDateKey(key), order.deliveryWindow?.toLowerCase()].filter(Boolean).join(", ");
  }
  if (order.estimatedDeliveryFrom && order.estimatedDeliveryTo) {
    return `previsão de ${formatDateOnly(order.estimatedDeliveryFrom)} a ${formatDateOnly(order.estimatedDeliveryTo)}`;
  }
  return "a combinar";
}

/** Monta os dados do pedido para os modelos de e-mail. */
export async function buildOrderEmailData(
  orderId: string,
  extra: Partial<OrderEmailData> = {},
): Promise<{ order: OrderEmailData; email: string } | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: { select: { slug: true } } } },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!order) return null;
  const payment = order.payments[0];
  const base = appUrl();
  const url = `${base}/pedido/${order.number}?token=${order.accessToken}`;
  const pendingPix =
    payment?.method === "PIX" &&
    payment.status === "PENDING" &&
    payment.pixPayload &&
    payment.pixExpiresAt;
  const pendingBoleto =
    payment?.method === "BOLETO" &&
    payment.status === "PENDING" &&
    payment.boletoLine &&
    payment.boletoDueDate;
  const reviewed = new Set<string>();

  return {
    email: order.customerEmail,
    order: {
      number: order.number,
      url,
      customerName: order.customerName,
      items: order.items.map((item) => ({
        name: item.productName,
        variant: item.variantName,
        quantity: item.quantity,
        total: formatBRL(item.totalCents),
      })),
      totals: {
        subtotal: formatBRL(order.subtotalCents),
        discount: order.discountCents > 0 ? formatBRL(order.discountCents) : null,
        pixDiscount: order.pixDiscountCents > 0 ? formatBRL(order.pixDiscountCents) : null,
        shipping: order.shippingCents > 0 ? formatBRL(order.shippingCents) : "Grátis",
        giftWrap: order.giftWrapCents > 0 ? formatBRL(order.giftWrapCents) : null,
        total: formatBRL(order.totalCents),
      },
      shippingMethod: order.shippingMethodName,
      deliveryInfo: deliveryInfoOf(order),
      addressLines: addressLinesOf(order.shippingAddress as AddressSnapshot),
      paymentMethod:
        order.manualPaymentLabel ?? paymentMethodLabels[order.paymentMethod] ?? order.paymentMethod,
      giftMessage: order.giftMessage,
      pix: pendingPix
        ? { payload: payment.pixPayload!, expiresAt: formatDateTime(payment.pixExpiresAt!) }
        : null,
      boleto: pendingBoleto
        ? {
            line: payment.boletoLine!,
            dueDate: formatDateOnly(payment.boletoDueDate!),
            url: `${base}/pedido/${order.number}/boleto?token=${order.accessToken}`,
          }
        : null,
      failureReason: payment?.failureReason ?? null,
      trackingCode: order.trackingCode,
      carrier: order.carrier,
      cancelReason: order.cancelReason,
      refunded: order.paymentStatus === "REFUNDED",
      reviewLinks: order.items
        .filter(
          (item) =>
            item.product && !reviewed.has(item.product.slug) && reviewed.add(item.product.slug),
        )
        .map((item) => ({
          name: item.productName,
          url: `${base}/conta/avaliar/${item.product!.slug}?pedido=${order.number}&token=${order.accessToken}`,
        })),
      statusLabel: orderStatusLabels[order.status],
      ...extra,
    },
  };
}

const STATUS_TEMPLATES: Partial<Record<string, EmailTemplateName>> = {
  PAID: "payment-approved",
  PREPARING: "order-preparing",
  SHIPPED: "order-shipped",
  OUT_FOR_DELIVERY: "order-shipped",
  DELIVERED: "order-delivered",
  CANCELED: "order-canceled",
  EXPIRED: "pix-expired",
};

/** E-mail ao cliente correspondente ao novo status do pedido. */
export async function sendOrderStatusEmail(orderId: string, status: string): Promise<boolean> {
  const data = await buildOrderEmailData(orderId);
  if (!data) return false;
  const template = STATUS_TEMPLATES[status] ?? "order-status";
  return sendEmail(data.email, template as "order-status", { order: data.order }, { orderId });
}

/** Envia um modelo de pedido específico (pedido recebido, pagamento recusado, reenvio pelo admin). */
export async function sendOrderEmail(
  orderId: string,
  template: Extract<
    EmailTemplateName,
    `order-${string}` | `payment-${string}` | "pix-expired" | "internal-new-order"
  >,
  extra: Partial<OrderEmailData> = {},
): Promise<boolean> {
  const data = await buildOrderEmailData(orderId, extra);
  if (!data) return false;
  if (template === "internal-new-order")
    return sendInternalEmail(template, { order: data.order }, { orderId });
  return sendEmail(data.email, template, { order: data.order }, { orderId });
}
