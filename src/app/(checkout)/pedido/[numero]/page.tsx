import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PaymentPanel } from "@/components/store/checkout/payment-panel";
import { OrderLookupForm } from "@/components/store/order-lookup-form";
import { OrderTimeline } from "@/components/store/order-timeline";
import { WhatsAppButton } from "@/components/store/whatsapp-button";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { db } from "@/lib/db";
import { formatDateOnly } from "@/lib/dates";
import { getCurrentUser } from "@/lib/session";
import { centsToReais, formatBRL } from "@/lib/money";
import { cardBrandLabels, type CardBrand } from "@/lib/validators/card";
import { shippingKindOf } from "@/server/services/checkout-rules";
import { addressLinesOf, deliveryInfoOf } from "@/server/services/emails";
import {
  orderStatusLabels,
  paymentMethodLabels,
  type OrderStatusCode,
} from "@/server/services/order-status";
import { getOrderForViewer } from "@/server/services/order-view";
import { expireOverduePayments, simulatorEnabled } from "@/server/services/payments";
import { getInstallments } from "@/server/services/pricing";
import { getStoreSettings } from "@/server/services/settings";

type Props = PageProps<"/pedido/[numero]">;

export const metadata: Metadata = { title: "Seu pedido", robots: { index: false, follow: false } };

const headings: Partial<Record<OrderStatusCode, (number: string) => string>> = {
  PENDING_PAYMENT: (number) => `Pedido ${number} recebido`,
  PAID: () => "Pagamento aprovado",
  CANCELED: (number) => `Pedido ${number} cancelado`,
  EXPIRED: () => "O prazo de pagamento terminou",
};

export default async function OrderPage({ params, searchParams }: Props) {
  const [{ numero }, query, settings] = await Promise.all([
    params,
    searchParams,
    getStoreSettings(),
  ]);
  const queryToken = (Array.isArray(query.token) ? query.token[0] : query.token) ?? null;
  const viewer = await getCurrentUser();
  let order = await getOrderForViewer(numero, { token: queryToken, userId: viewer?.id });

  // Sem o link do e-mail e sem ser o dono logado, pede o número e o e-mail do pedido.
  if (!order) {
    return (
      <div className="container-store py-12">
        <div className="mx-auto max-w-md rounded-photo bg-white p-6">
          <h1 className="type-h2 text-moss-900">Acompanhar pedido</h1>
          <p className="mt-2 mb-6 type-body text-ink-muted">
            Informe o número do pedido e o e-mail usado na compra.
          </p>
          <OrderLookupForm defaultNumber={numero} />
        </div>
      </div>
    );
  }

  if (order.status === "PENDING_PAYMENT" && (await expireOverduePayments(order.id)) > 0) {
    order = (await getOrderForViewer(numero, { token: order.accessToken })) ?? order;
  }

  const token = order.accessToken;

  // O evento purchase é disparado uma única vez por pedido: na primeira exibição da confirmação.
  const firstView = !order.purchaseTrackedAt;
  if (firstView)
    await db.order.update({ where: { id: order.id }, data: { purchaseTrackedAt: new Date() } });

  const payment = order.payments[0];
  const status = order.status as OrderStatusCode;
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
  const maxInstallments = getInstallments(order.totalCents, settings)?.count ?? 1;
  const heading =
    headings[status]?.(order.number) ??
    `Pedido ${order.number}: ${orderStatusLabels[status].toLowerCase()}`;
  const addressLines = addressLinesOf(order.shippingAddress as Record<string, string>);

  return (
    <div className="container-store py-10">
      <header className="mb-8">
        <h1 className="flex items-start gap-3 type-h1 text-moss-900">
          {status !== "CANCELED" && status !== "EXPIRED" && status !== "PENDING_PAYMENT" ? (
            <CircleCheck
              aria-hidden="true"
              strokeWidth={1.5}
              className="mt-2 size-8 flex-none text-success"
            />
          ) : null}
          {heading}
        </h1>
        <p className="mt-3 measure type-body-lg text-ink-muted">
          {status === "PENDING_PAYMENT" && payment?.status === "PENDING"
            ? `Falta só o pagamento. Enviamos os detalhes para ${order.customerEmail}.`
            : status === "PENDING_PAYMENT"
              ? "O pagamento não foi aprovado. Você pode tentar de novo abaixo."
              : status === "EXPIRED"
                ? "O pedido foi encerrado e os produtos voltaram ao estoque. Sua sacola continua guardada."
                : status === "CANCELED"
                  ? (order.cancelReason ?? "Este pedido foi cancelado.")
                  : `Pedido ${order.number}. Avisamos por e-mail a cada novidade.`}
        </p>
        {status === "EXPIRED" ? (
          <Link href="/carrinho" className={buttonClasses("primary", "md", "mt-4")}>
            Refazer o pedido
          </Link>
        ) : null}
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6">
          <PaymentPanel
            number={order.number}
            token={token}
            status={order.status}
            paymentStatus={payment?.status ?? order.paymentStatus}
            totalCents={order.totalCents}
            pix={
              pendingPix
                ? {
                    payload: payment.pixPayload!,
                    qrCode: payment.pixQrCodeDataUrl,
                    expiresAt: payment.pixExpiresAt!.toISOString(),
                  }
                : null
            }
            boleto={
              pendingBoleto
                ? {
                    line: payment.boletoLine!,
                    dueDate: formatDateOnly(payment.boletoDueDate!),
                    url: `/pedido/${order.number}/boleto?token=${token}`,
                  }
                : null
            }
            failureReason={payment?.failureReason ?? null}
            installments={Array.from({ length: maxInstallments }, (_, i) => ({
              count: i + 1,
              valueCents: Math.round(order!.totalCents / (i + 1)),
            }))}
            simulator={simulatorEnabled()}
            purchase={
              firstView
                ? {
                    value: centsToReais(order.totalCents),
                    shipping: centsToReais(order.shippingCents),
                    coupon: order.couponCode ?? undefined,
                    items: order.items.map((item) => ({
                      item_id: item.sku,
                      item_name: item.productName,
                      item_variant: item.variantName ?? undefined,
                      price: centsToReais(item.unitPriceCents),
                      quantity: item.quantity,
                    })),
                  }
                : null
            }
          />

          <section aria-labelledby="itens-pedido" className="rounded-photo bg-white p-6">
            <h2 id="itens-pedido" className="type-h3 text-moss-900">
              Itens do pedido
            </h2>
            <ul className="mt-3 divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-4 py-4">
                  <div className="relative aspect-4/5 w-14 flex-none overflow-hidden rounded-photo bg-cream-50">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="type-body text-ink">{item.productName}</p>
                    <p className="type-small text-ink-muted">
                      {item.variantName ? `${item.variantName}, ` : ""}
                      {item.quantity} {item.quantity === 1 ? "unidade" : "unidades"}
                    </p>
                  </div>
                  <p className="type-body font-medium whitespace-nowrap text-ink tabular-nums">
                    {formatBRL(item.totalCents)}
                  </p>
                </li>
              ))}
            </ul>
            <dl className="flex flex-col gap-2 border-t border-line pt-4 type-small text-ink">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatBRL(order.subtotalCents)}</dd>
              </div>
              {order.discountCents > 0 ? (
                <div className="flex justify-between text-moss-700">
                  <dt>Cupom {order.couponCode}</dt>
                  <dd className="tabular-nums">- {formatBRL(order.discountCents)}</dd>
                </div>
              ) : null}
              {order.pixDiscountCents > 0 ? (
                <div className="flex justify-between text-moss-700">
                  <dt>Desconto do Pix</dt>
                  <dd className="tabular-nums">- {formatBRL(order.pixDiscountCents)}</dd>
                </div>
              ) : null}
              {order.giftWrapCents > 0 ? (
                <div className="flex justify-between">
                  <dt>Embalagem para presente</dt>
                  <dd className="tabular-nums">{formatBRL(order.giftWrapCents)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt>Frete</dt>
                <dd className="tabular-nums">
                  {order.shippingCents === 0 ? "Grátis" : formatBRL(order.shippingCents)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-[18px] font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatBRL(order.totalCents)}</dd>
              </div>
            </dl>
          </section>

          {!order.userId && status !== "CANCELED" && status !== "EXPIRED" ? (
            <Alert tone="info" title="Crie sua senha para acompanhar seus pedidos">
              <p>
                Com uma conta você vê os pedidos, salva endereços e compra mais rápido.{" "}
                <Link
                  href={`/criar-conta?email=${encodeURIComponent(order.customerEmail)}`}
                  className="font-medium text-moss-700 underline underline-offset-3"
                >
                  Criar senha
                </Link>
              </p>
            </Alert>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6 self-start">
          <section aria-labelledby="andamento" className="rounded-photo bg-white p-6">
            <h2 id="andamento" className="mb-4 type-h3 text-moss-900">
              Andamento
            </h2>
            <OrderTimeline
              status={status}
              shippingKind={shippingKindOf(order.shippingMethodCode)}
              dates={order}
            />
            {order.trackingCode ? (
              <p className="mt-4 border-t border-line pt-4 type-small text-ink">
                Código de rastreio{order.carrier ? ` (${order.carrier})` : ""}:{" "}
                <strong className="font-semibold">{order.trackingCode}</strong>
              </p>
            ) : null}
          </section>

          <section aria-labelledby="entrega-pedido" className="rounded-photo bg-white p-6">
            <h2 id="entrega-pedido" className="type-h3 text-moss-900">
              Entrega
            </h2>
            <p className="mt-3 type-small font-medium text-ink">
              {order.shippingMethodName}: {deliveryInfoOf(order)}
            </p>
            <address className="mt-2 type-small text-ink-muted not-italic">
              {addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
            {order.giftMessage ? (
              <p className="mt-3 border-t border-line pt-3 type-small text-ink">
                <span className="block font-medium">Mensagem do cartão</span>
                <span className="text-ink-muted italic">{order.giftMessage}</span>
              </p>
            ) : null}
            {order.giftWrap ? (
              <p className="mt-2 type-small text-ink-muted">Com embalagem para presente.</p>
            ) : null}
          </section>

          <section aria-labelledby="pagamento-pedido" className="rounded-photo bg-white p-6">
            <h2 id="pagamento-pedido" className="type-h3 text-moss-900">
              Pagamento
            </h2>
            <p className="mt-3 type-small text-ink">
              {order.manualPaymentLabel ?? paymentMethodLabels[order.paymentMethod]}
              {payment?.cardLast4
                ? `, ${cardBrandLabels[payment.cardBrand as CardBrand] ?? "cartão"} final ${payment.cardLast4}`
                : ""}
              {order.installments > 1
                ? `, em ${order.installments}x de ${formatBRL(Math.round(order.totalCents / order.installments))}`
                : ""}
            </p>
          </section>

          <WhatsAppButton
            number={settings.whatsapp}
            message={`Olá! Tenho uma dúvida sobre o pedido ${order.number}.`}
            position="pedido"
            variant="secondary"
          >
            Enviar dúvida sobre o pedido {order.number}
          </WhatsAppButton>
        </aside>
      </div>
    </div>
  );
}
