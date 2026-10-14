import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/store/logo";
import { PrintButton } from "@/components/ui/print-button";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { formatCep } from "@/lib/validators/cep";
import { formatPhone } from "@/lib/validators/phone";
import { addressLinesOf, deliveryInfoOf } from "@/server/services/emails";
import {
  orderStatusLabels,
  paymentMethodLabels,
  paymentStatusLabels,
  type OrderStatusCode,
} from "@/server/services/order-status";
import { getStoreSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Imprimir" };

/** Impressões do pedido: pedido completo, lista de separação, etiqueta de envio e cartão de presente (A6). */
export default async function PrintPage({
  params,
}: PageProps<"/admin/pedidos/[numero]/imprimir/[tipo]">) {
  await requireAdminPage("orders.print");
  const { numero, tipo } = await params;
  const [order, settings] = await Promise.all([
    db.order.findUnique({
      where: { number: numero },
      include: { items: { orderBy: { id: "asc" } } },
    }),
    getStoreSettings(),
  ]);
  if (!order || !["pedido", "separacao", "etiqueta", "cartao"].includes(tipo)) notFound();
  const address = order.shippingAddress as Record<string, string>;
  const recipient = order.recipientName ?? address.recipientName ?? order.customerName;
  const phone = order.recipientPhone ?? order.customerPhone;

  return (
    <div className="bg-white text-ink">
      <style>
        {tipo === "cartao" ? "@page { size: A6; margin: 0 }" : "@page { margin: 14mm }"}
      </style>
      <div className="mb-4 flex gap-2 print:hidden">
        <PrintButton>Imprimir</PrintButton>
      </div>

      {tipo === "pedido" ? (
        <article className="max-w-3xl text-sm">
          <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-3">
            <div>
              <h1 className="text-2xl font-semibold">Pedido {order.number}</h1>
              <p className="mt-1">
                Feito em {formatDateTime(order.createdAt)}. Situação:{" "}
                {orderStatusLabels[order.status as OrderStatusCode]}.
              </p>
            </div>
            <p className="text-right font-semibold">{settings.name}</p>
          </header>

          <div className="mt-4 grid grid-cols-2 gap-6">
            <section>
              <h2 className="font-semibold">Cliente</h2>
              <p>{order.customerName}</p>
              <p>{order.customerEmail}</p>
              {order.customerPhone ? (
                <p className="tabular-nums">{formatPhone(order.customerPhone)}</p>
              ) : null}
            </section>
            <section>
              <h2 className="font-semibold">Entrega</h2>
              <p>
                {order.shippingMethodName}: {deliveryInfoOf(order)}
              </p>
              <address className="not-italic">
                {addressLinesOf({ ...address, recipientName: recipient }).map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
              {address.reference ? <p>Referência: {address.reference}</p> : null}
              {order.recipientPhone ? (
                <p className="tabular-nums">Telefone: {formatPhone(order.recipientPhone)}</p>
              ) : null}
            </section>
          </div>

          <table className="mt-5 w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-ink text-left">
                <th scope="col" className="py-2">
                  Qtd.
                </th>
                <th scope="col" className="py-2">
                  SKU
                </th>
                <th scope="col" className="py-2">
                  Produto
                </th>
                <th scope="col" className="py-2 text-right">
                  Unitário
                </th>
                <th scope="col" className="py-2 text-right">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-line">
                  <td className="py-2 font-semibold tabular-nums">{item.quantity}</td>
                  <td className="py-2 tabular-nums">{item.sku}</td>
                  <td className="py-2">
                    {item.productName}
                    {item.variantName ? ` (${item.variantName})` : ""}
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatBRL(item.unitPriceCents)}</td>
                  <td className="py-2 text-right tabular-nums">{formatBRL(item.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="mt-3 ml-auto flex w-64 flex-col gap-1">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{formatBRL(order.subtotalCents)}</dd>
            </div>
            {order.discountCents > 0 ? (
              <div className="flex justify-between">
                <dt>Cupom {order.couponCode}</dt>
                <dd className="tabular-nums">- {formatBRL(order.discountCents)}</dd>
              </div>
            ) : null}
            {order.pixDiscountCents > 0 ? (
              <div className="flex justify-between">
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
              <dd className="tabular-nums">{formatBRL(order.shippingCents)}</dd>
            </div>
            <div className="flex justify-between border-t-2 border-ink pt-1 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatBRL(order.totalCents)}</dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-line pt-3">
            <p>
              Pagamento: {order.manualPaymentLabel ?? paymentMethodLabels[order.paymentMethod]}
              {order.paymentMethod === "CREDIT_CARD" && order.installments > 1
                ? ` em ${order.installments}x`
                : ""}{" "}
              ({paymentStatusLabels[order.paymentStatus].toLowerCase()}).
            </p>
            {order.giftWrap ? <p className="font-semibold">Embalar para presente.</p> : null}
            {order.giftMessage ? <p>Mensagem do cartão: {order.giftMessage}</p> : null}
            {order.customerNotes ? <p>Observação do cliente: {order.customerNotes}</p> : null}
            {order.internalNotes ? <p>Observação interna: {order.internalNotes}</p> : null}
          </div>
        </article>
      ) : null}

      {tipo === "separacao" ? (
        <article className="max-w-3xl">
          <h1 className="text-2xl font-semibold">Lista de separação: {order.number}</h1>
          <p className="mt-1 text-sm">
            {order.customerName}. Pedido de {formatDateTime(order.createdAt)}.{" "}
            {order.shippingMethodName}: {deliveryInfoOf(order)}.
          </p>
          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-left">
                <th scope="col" className="w-10 py-2">
                  OK
                </th>
                <th scope="col" className="py-2">
                  Qtd.
                </th>
                <th scope="col" className="py-2">
                  SKU
                </th>
                <th scope="col" className="py-2">
                  Produto
                </th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-line">
                  <td className="py-2">
                    <span className="inline-block size-4 border border-ink" />
                  </td>
                  <td className="py-2 text-lg font-semibold tabular-nums">{item.quantity}</td>
                  <td className="py-2 tabular-nums">{item.sku}</td>
                  <td className="py-2">
                    {item.productName}
                    {item.variantName ? ` (${item.variantName})` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 text-sm">
            {order.giftWrap ? <p className="font-semibold">Embalar para presente.</p> : null}
            {order.giftMessage ? (
              <p className="font-semibold">
                Incluir cartão com mensagem (imprimir o cartão de presente).
              </p>
            ) : null}
            {order.customerNotes ? <p>Observação do cliente: {order.customerNotes}</p> : null}
            {order.internalNotes ? <p>Observação interna: {order.internalNotes}</p> : null}
          </div>
        </article>
      ) : null}

      {tipo === "etiqueta" ? (
        <article className="max-w-xl border-2 border-ink p-6">
          <p className="text-sm">Destinatário</p>
          <h1 className="text-3xl leading-tight font-semibold">{recipient}</h1>
          <address className="mt-3 text-2xl leading-snug not-italic">
            {address.street}, {address.number}
            {address.complement ? `, ${address.complement}` : ""}
            <br />
            {address.district}
            <br />
            {address.city}/{address.state}
            <br />
            <strong className="text-3xl tabular-nums">
              CEP {address.cep ? formatCep(address.cep) : ""}
            </strong>
          </address>
          {address.reference ? (
            <p className="mt-2 text-base">Referência: {address.reference}</p>
          ) : null}
          {phone ? (
            <p className="mt-2 text-lg tabular-nums">Telefone: {formatPhone(phone)}</p>
          ) : null}
          <p className="mt-6 border-t border-ink pt-3 text-sm">
            Pedido {order.number}. {order.shippingMethodName}. Remetente: {settings.name},{" "}
            {settings.address}.
          </p>
        </article>
      ) : null}

      {tipo === "cartao" ? (
        order.giftMessage ? (
          <article className="flex h-[148mm] w-[105mm] flex-col items-center justify-between border border-line p-[12mm] text-center print:border-0">
            <div className="herbarium-rule w-full" aria-hidden="true" />
            <div>
              {order.recipientName ? (
                <p className="mb-4 font-serif text-[22px] text-moss-700 italic">
                  Para {order.recipientName.split(" ")[0]}
                </p>
              ) : null}
              <h1 className="font-serif text-[26px] leading-snug font-medium text-moss-900">
                {order.giftMessage}
              </h1>
            </div>
            <Logo name={settings.name} className="h-9 md:h-9" />
          </article>
        ) : (
          <p>Este pedido não tem mensagem de cartão.</p>
        )
      ) : null}
    </div>
  );
}
