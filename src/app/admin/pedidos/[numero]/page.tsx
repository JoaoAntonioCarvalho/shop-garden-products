import { CarrierTracking } from "@/components/store/carrier-tracking";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/admin/admin-shell";
import {
  CopyButton,
  CpfReveal,
  OrderActions,
  OrderNoteForm,
  ResendEmailForm,
} from "@/components/admin/order-actions";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { OrderStatusBadge } from "@/components/store/account/order-status-badge";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { can } from "@/lib/permissions";
import { cardBrandLabels, type CardBrand } from "@/lib/validators/card";
import { maskCpf } from "@/lib/validators/cpf";
import { formatPhone } from "@/lib/validators/phone";
import { channelLabels, sourceLabel } from "@/server/admin/orders";
import { shippingKindOf } from "@/server/services/checkout-rules";
import { addressLinesOf, deliveryInfoOf } from "@/server/services/emails";
import {
  orderStatusLabels,
  paymentMethodLabels,
  paymentStatusLabels,
  wasPaid,
  type OrderStatusCode,
} from "@/server/services/order-status";

export const metadata: Metadata = { title: "Pedido" };

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">{children}</CardContent>
    </Card>
  );
}

export default async function AdminOrderPage({ params }: PageProps<"/admin/pedidos/[numero]">) {
  const user = await requireAdminPage("orders.view");
  const { numero } = await params;
  const order = await db.order.findUnique({
    where: { number: numero },
    include: {
      items: {
        orderBy: { id: "asc" },
        include: { variant: { select: { stockOnHand: true, stockReserved: true } } },
      },
      payments: { orderBy: { createdAt: "desc" }, include: { refunds: true } },
      statusHistory: { orderBy: { createdAt: "asc" } },
      notes: { orderBy: { createdAt: "desc" } },
      emailLogs: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!order) notFound();

  const status = order.status as OrderStatusCode;
  const kind = shippingKindOf(order.shippingMethodCode);
  const address = order.shippingAddress as Record<string, string>;
  const addressLines = addressLinesOf(address);
  const authorIds = [
    ...new Set(
      [...order.statusHistory.map((h) => h.userId), ...order.notes.map((n) => n.authorId)].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  ];
  const authors = new Map(
    (
      await db.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } })
    ).map((u) => [u.id, u.name]),
  );
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([address.street, address.number, address.district, address.city, address.state].filter(Boolean).join(", "))}`;

  // Linha do tempo: status, pagamentos, e-mails e notas, em ordem cronológica.
  const timeline = [
    ...order.statusHistory.map((entry) => ({
      at: entry.createdAt,
      title: entry.fromStatus ? `Status: ${orderStatusLabels[entry.toStatus]}` : "Pedido criado",
      detail: [
        entry.note,
        entry.userId ? `por ${authors.get(entry.userId) ?? "equipe"}` : "pelo sistema",
        entry.notifiedCustomer ? "cliente avisado" : null,
      ]
        .filter(Boolean)
        .join(", "),
    })),
    ...order.payments.map((payment) => ({
      at: payment.createdAt,
      title: `Cobrança ${paymentMethodLabels[payment.method].toLowerCase()} criada`,
      detail: `${formatBRL(payment.amountCents)}, ${paymentStatusLabels[payment.status].toLowerCase()}${payment.failureReason ? `: ${payment.failureReason}` : ""}`,
    })),
    ...order.emailLogs.map((email) => ({
      at: email.createdAt,
      title: `E-mail: ${email.subject}`,
      detail: `${email.status === "SENT" ? "enviado" : "falhou"} para ${email.to}`,
    })),
    ...order.notes.map((note) => ({
      at: note.createdAt,
      title: "Nota interna",
      detail: `${note.body} (${note.authorId ? (authors.get(note.authorId) ?? "equipe") : "equipe"})`,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <>
      <PageHeader
        back={{ href: "/admin/pedidos", label: "Pedidos" }}
        title={`Pedido ${order.number}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={status} />
            Criado em {formatDateTime(order.createdAt)}
            {order.paidAt ? `, pago em ${formatDateTime(order.paidAt)}` : ""}
            {order.isSample ? (
              <span className="rounded-xs bg-secondary px-1.5 text-xs">Pedido de teste</span>
            ) : null}
          </span>
        }
        actions={
          can(user, "orders.print") ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/pedidos/${order.number}/imprimir/separacao`} target="_blank">
                  Lista de separação
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/pedidos/${order.number}/imprimir/etiqueta`} target="_blank">
                  Etiqueta de envio
                </Link>
              </Button>
              {order.giftMessage ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/pedidos/${order.number}/imprimir/cartao`} target="_blank">
                    Cartão de presente
                  </Link>
                </Button>
              ) : null}
            </>
          ) : null
        }
      />

      {can(user, "orders.update_status") ? (
        <div className="mb-4">
          <OrderActions
            orderId={order.id}
            number={order.number}
            status={status}
            paid={wasPaid(status)}
            usesTransport={kind === "transport"}
            isPickup={kind === "pickup"}
            canRefund={can(user, "orders.refund")}
            canMarkPaid={can(user, "orders.mark_paid")}
          />
        </div>
      ) : null}

      {order.giftMessage || order.giftWrap || order.recipientName ? (
        <div className="mb-4 rounded-md border-2 border-primary bg-accent p-4 text-sm">
          <p className="font-semibold text-accent-foreground">Este pedido é um presente</p>
          {order.recipientName ? (
            <p className="mt-1">
              Destinatário: {order.recipientName}
              {order.recipientPhone ? `, ${formatPhone(order.recipientPhone)}` : ""}
            </p>
          ) : null}
          {order.giftMessage ? (
            <p className="mt-1">Mensagem do cartão: &ldquo;{order.giftMessage}&rdquo;</p>
          ) : null}
          {order.giftWrap ? <p className="mt-1 font-medium">Com embalagem para presente.</p> : null}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <Section title="Itens">
            <ul className="divide-y divide-border">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-3 py-3">
                  <div className="relative aspect-4/5 w-12 flex-none overflow-hidden rounded-xs bg-muted">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.sku}
                      {item.variantName ? `, ${item.variantName}` : ""}
                      {item.variant
                        ? `. Estoque atual: ${item.variant.stockOnHand - item.variant.stockReserved} disponíveis, ${item.variant.stockReserved} reservados`
                        : ". Variação removida do catálogo"}
                    </p>
                  </div>
                  <p className="text-right whitespace-nowrap tabular-nums">
                    {item.quantity} x {formatBRL(item.unitPriceCents)}
                    <span className="block font-medium">{formatBRL(item.totalCents)}</span>
                  </p>
                </li>
              ))}
            </ul>
            <dl className="mt-2 flex flex-col gap-1 border-t border-border pt-3 tabular-nums">
              {(
                [
                  ["Subtotal", formatBRL(order.subtotalCents)],
                  order.discountCents
                    ? [`Cupom ${order.couponCode ?? ""}`, `- ${formatBRL(order.discountCents)}`]
                    : null,
                  order.pixDiscountCents
                    ? ["Desconto do Pix", `- ${formatBRL(order.pixDiscountCents)}`]
                    : null,
                  ["Frete", order.shippingCents ? formatBRL(order.shippingCents) : "Grátis"],
                  order.giftWrapCents
                    ? ["Embalagem para presente", formatBRL(order.giftWrapCents)]
                    : null,
                ] as Array<[string, string] | null>
              )
                .filter((row): row is [string, string] => row !== null)
                .map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatBRL(order.totalCents)}</dd>
              </div>
            </dl>
          </Section>

          <Section title="Linha do tempo">
            <ol className="flex flex-col gap-3">
              {timeline.map((entry, index) => (
                <li key={index} className="border-l-2 border-border pl-3">
                  <p className="font-medium">{entry.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(entry.at)}
                    {entry.detail ? `. ${entry.detail}` : ""}
                  </p>
                </li>
              ))}
            </ol>
            {can(user, "orders.notes") ? (
              <div className="mt-4 border-t border-border pt-4">
                <OrderNoteForm orderId={order.id} />
              </div>
            ) : null}
          </Section>
        </div>

        <div className="flex flex-col gap-4">
          <Section title="Cliente">
            <p className="font-medium">
              {order.userId ? (
                <Link
                  href={`/admin/clientes/${order.userId}`}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {order.customerName}
                </Link>
              ) : (
                order.customerName
              )}
            </p>
            <p>{order.customerEmail}</p>
            {order.customerPhone ? <p>{formatPhone(order.customerPhone)}</p> : null}
            {order.customerCpf ? (
              <p className="mt-1">
                CPF: <CpfReveal orderId={order.id} masked={maskCpf(order.customerCpf)} />
              </p>
            ) : null}
            {order.customerNotes ? (
              <p className="mt-2 text-muted-foreground">
                Observação do cliente: {order.customerNotes}
              </p>
            ) : null}
          </Section>

          <Section title="Entrega">
            <p className="font-medium">{order.shippingMethodName}</p>
            <p className="text-muted-foreground">{deliveryInfoOf(order)}</p>
            <address className="mt-2 not-italic">
              {addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
              {address.reference ? (
                <span className="block text-muted-foreground">Referência: {address.reference}</span>
              ) : null}
            </address>
            {order.trackingCode ? (
              <p className="mt-2">
                Rastreio{order.carrier ? ` (${order.carrier})` : ""}:{" "}
                <strong>{order.trackingCode}</strong>
              </p>
            ) : null}
            <CarrierTracking code={order.trackingCode} variant="admin" />
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton value={addressLines.join(", ")} label="Copiar endereço" />
              <Button asChild size="sm" variant="outline">
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                  Abrir no mapa<span className="sr-only"> (abre em nova aba)</span>
                </a>
              </Button>
            </div>
          </Section>

          <Section title="Pagamento">
            <p className="font-medium">
              {order.manualPaymentLabel ?? paymentMethodLabels[order.paymentMethod]},{" "}
              {paymentStatusLabels[order.paymentStatus].toLowerCase()}
              {order.installments > 1 ? `, em ${order.installments}x` : ""}
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {order.payments.map((payment) => (
                <li key={payment.id} className="rounded-md border border-border p-2 text-xs">
                  <p className="font-medium">
                    {paymentMethodLabels[payment.method]}, {formatBRL(payment.amountCents)},{" "}
                    {paymentStatusLabels[payment.status].toLowerCase()}
                  </p>
                  <p className="text-muted-foreground">
                    {formatDateTime(payment.createdAt)}
                    {payment.cardLast4
                      ? `. ${cardBrandLabels[payment.cardBrand as CardBrand] ?? "Cartão"} final ${payment.cardLast4}`
                      : ""}
                    {payment.pixExpiresAt && payment.status === "PENDING"
                      ? `. Pix expira em ${formatDateTime(payment.pixExpiresAt)}`
                      : ""}
                    {payment.failureReason ? `. ${payment.failureReason}` : ""}
                  </p>
                  {payment.refunds.map((refund) => (
                    <p key={refund.id} className="mt-1 text-destructive">
                      Estorno de {formatBRL(refund.amountCents)} em{" "}
                      {formatDateTime(refund.createdAt)}
                      {refund.status === "FAILED" ? " (falhou no gateway: conferir)" : ""}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Canal e origem">
            <p>
              Canal: <strong>{channelLabels[order.channel]}</strong>
            </p>
            <p>Origem: {sourceLabel(order)}</p>
            {order.utmCampaign ? <p>Campanha: {order.utmCampaign}</p> : null}
            {order.referrer ? (
              <p className="break-all text-muted-foreground">Veio de: {order.referrer}</p>
            ) : null}
          </Section>

          {can(user, "orders.resend_email") ? (
            <Section title="E-mails">
              <ResendEmailForm orderId={order.id} delivered={status === "DELIVERED"} />
            </Section>
          ) : null}
        </div>
      </div>
    </>
  );
}
