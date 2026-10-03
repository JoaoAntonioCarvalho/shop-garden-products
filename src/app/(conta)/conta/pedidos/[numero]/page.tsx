import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReorderButton } from "@/components/store/account/account-forms";
import { OrderStatusBadge } from "@/components/store/account/order-status-badge";
import { OrderTimeline } from "@/components/store/order-timeline";
import { WhatsAppButton } from "@/components/store/whatsapp-button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { buttonClasses } from "@/components/ui/button";
import { requireAccountUser } from "@/lib/account-guard";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { shippingKindOf } from "@/server/services/checkout-rules";
import { addressLinesOf, deliveryInfoOf } from "@/server/services/emails";
import { paymentMethodLabels, type OrderStatusCode } from "@/server/services/order-status";
import { getOrderForViewer } from "@/server/services/order-view";
import { getStoreSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Detalhe do pedido" };

export default async function AccountOrderPage({ params }: PageProps<"/conta/pedidos/[numero]">) {
  const { numero } = await params;
  const user = await requireAccountUser(`/conta/pedidos/${numero}`);
  const [order, settings] = await Promise.all([
    getOrderForViewer(numero, { userId: user.id }),
    getStoreSettings(),
  ]);
  if (!order) notFound();

  const status = order.status as OrderStatusCode;
  const slugs = await db.product.findMany({
    where: {
      id: {
        in: order.items.map((item) => item.productId).filter((id): id is string => Boolean(id)),
      },
    },
    select: { id: true, slug: true },
  });
  const slugOf = new Map(slugs.map((product) => [product.id, product.slug]));
  const orderUrl = `/pedido/${order.number}?token=${order.accessToken}`;

  return (
    <div>
      <Breadcrumb items={[{ label: "Pedidos", href: "/conta/pedidos" }, { label: order.number }]} />
      <header className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="type-h2 text-moss-900">Pedido {order.number}</h1>
        <OrderStatusBadge status={status} />
      </header>
      <p className="mt-1 type-small text-ink-muted">Feito em {formatDate(order.createdAt)}</p>

      <div className="mt-5 flex flex-wrap gap-3">
        {status === "PENDING_PAYMENT" ? (
          <Link href={orderUrl} className={buttonClasses("primary")}>
            Pagar agora
          </Link>
        ) : null}
        <ReorderButton orderNumber={order.number} />
        <WhatsAppButton
          number={settings.whatsapp}
          message={`Olá! Preciso de ajuda com o pedido ${order.number}.`}
          position="pedido"
          variant="ghost"
        >
          Preciso de ajuda
        </WhatsAppButton>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_320px]">
        <section
          aria-labelledby="itens"
          className="rounded-control border border-line bg-white p-6"
        >
          <h2 id="itens" className="type-h3 text-moss-900">
            Itens
          </h2>
          <ul className="mt-2 divide-y divide-line">
            {order.items.map((item) => {
              const slug = item.productId ? slugOf.get(item.productId) : undefined;
              return (
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
                    {status === "DELIVERED" && slug ? (
                      <Link
                        href={`/conta/avaliar/${slug}`}
                        className="inline-flex min-h-11 items-center type-small font-medium text-moss-700 underline underline-offset-3"
                      >
                        Avaliar produto<span className="sr-only">: {item.productName}</span>
                      </Link>
                    ) : null}
                  </div>
                  <p className="type-body font-medium whitespace-nowrap text-ink tabular-nums">
                    {formatBRL(item.totalCents)}
                  </p>
                </li>
              );
            })}
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

        <div className="flex flex-col gap-6">
          <section
            aria-labelledby="andamento"
            className="rounded-control border border-line bg-white p-6"
          >
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
          <section
            aria-labelledby="entrega"
            className="rounded-control border border-line bg-white p-6"
          >
            <h2 id="entrega" className="type-h3 text-moss-900">
              Entrega e pagamento
            </h2>
            <p className="mt-3 type-small font-medium text-ink">
              {order.shippingMethodName}: {deliveryInfoOf(order)}
            </p>
            <address className="mt-2 type-small text-ink-muted not-italic">
              {addressLinesOf(order.shippingAddress as Record<string, string>).map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
            <p className="mt-3 border-t border-line pt-3 type-small text-ink">
              {order.manualPaymentLabel ?? paymentMethodLabels[order.paymentMethod]}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
