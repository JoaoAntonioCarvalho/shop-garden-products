import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/ui/print-button";
import { formatDateOnly } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { formatCpf } from "@/lib/validators/cpf";
import { getOrderForViewer } from "@/server/services/order-view";
import { getStoreSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Boleto", robots: { index: false, follow: false } };

/** Página imprimível do boleto simulado. */
export default async function BoletoPage({
  params,
  searchParams,
}: PageProps<"/pedido/[numero]/boleto">) {
  const [{ numero }, query, settings] = await Promise.all([
    params,
    searchParams,
    getStoreSettings(),
  ]);
  const token = (Array.isArray(query.token) ? query.token[0] : query.token) ?? null;
  const order = await getOrderForViewer(numero, { token });
  const payment = order?.payments.find((item) => item.method === "BOLETO");
  if (!order || !payment?.boletoLine || !payment.boletoDueDate) notFound();

  const rows: Array<[string, string]> = [
    ["Beneficiário", `${settings.legalName}, CNPJ ${settings.cnpj}`],
    [
      "Pagador",
      `${order.customerName}${order.customerCpf ? `, CPF ${formatCpf(order.customerCpf)}` : ""}`,
    ],
    ["Número do pedido", order.number],
    ["Vencimento", formatDateOnly(payment.boletoDueDate)],
    ["Valor", formatBRL(payment.amountCents)],
  ];

  return (
    <div className="container-store py-10">
      <div className="mx-auto max-w-2xl bg-white p-8 print:p-0">
        <p className="border-2 border-dashed border-wine-700 p-3 text-center type-body font-semibold text-wine-700">
          Documento de teste, sem valor
        </p>
        <h1 className="mt-6 type-h2 text-moss-900">Boleto do pedido {order.number}</h1>
        <dl className="mt-6 divide-y divide-line border-y border-line">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-6 py-3 type-small">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="text-right font-medium text-ink tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 type-small text-ink-muted">Linha digitável</p>
        <p className="mt-1 font-mono text-[15px] break-all text-ink">{payment.boletoLine}</p>
        {/* Código de barras ilustrativo */}
        <div aria-hidden="true" className="mt-6 flex h-16 items-stretch gap-[2px]">
          {payment.boletoLine
            .replace(/\D/g, "")
            .split("")
            .map((digit, index) => (
              <span
                key={index}
                className="bg-ink"
                style={{
                  width: `${1 + (Number(digit) % 4)}px`,
                  marginRight: `${1 + (Number(digit) % 3)}px`,
                }}
              />
            ))}
        </div>
        <PrintButton className="mt-8 print:hidden">Imprimir boleto</PrintButton>
      </div>
    </div>
  );
}
