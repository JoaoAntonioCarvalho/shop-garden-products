import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/store/logo";
import { PrintButton } from "@/components/ui/print-button";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatCep } from "@/lib/validators/cep";
import { formatPhone } from "@/lib/validators/phone";
import { deliveryInfoOf } from "@/server/services/emails";
import { getStoreSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Imprimir" };

/** Impressões do pedido: lista de separação, etiqueta de envio e cartão de presente (A6). */
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
  if (!order || !["separacao", "etiqueta", "cartao"].includes(tipo)) notFound();
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
            <Logo name={settings.name} className="text-[18px] md:text-[18px]" />
          </article>
        ) : (
          <p>Este pedido não tem mensagem de cartão.</p>
        )
      ) : null}
    </div>
  );
}
