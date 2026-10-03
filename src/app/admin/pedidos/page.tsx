import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { DataTable, type DataColumn } from "@/components/admin/data-table";
import { FilterBar, type FilterField } from "@/components/admin/filter-bar";
import { Button } from "@/components/admin/ui/button";
import { OrderStatusBadge } from "@/components/store/account/order-status-badge";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDateOnly, formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { can } from "@/lib/permissions";
import { bulkChangeOrderStatusAction } from "@/server/actions/admin/orders";
import { orderByOf, parseListParams } from "@/server/admin/list";
import { channelLabels, orderWhere, sourceLabel } from "@/server/admin/orders";
import {
  ORDER_STATUSES,
  orderStatusLabels,
  paymentMethodLabels,
  paymentStatusLabels,
  type OrderStatusCode,
} from "@/server/services/order-status";

export const metadata: Metadata = { title: "Pedidos" };

const columns: DataColumn[] = [
  { key: "number", header: "Número", sortable: true },
  { key: "createdAt", header: "Data", sortable: true },
  { key: "customer", header: "Cliente" },
  { key: "totalCents", header: "Total", sortable: true, align: "right" },
  { key: "payment", header: "Pagamento" },
  { key: "status", header: "Status" },
  { key: "delivery", header: "Entrega" },
  { key: "channel", header: "Canal e origem" },
];

const options = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

const filters: FilterField[] = [
  {
    type: "select",
    name: "status",
    label: "Status",
    options: ORDER_STATUSES.map((value) => ({ value, label: orderStatusLabels[value] })),
  },
  {
    type: "select",
    name: "pagamento",
    label: "Status do pagamento",
    options: options(paymentStatusLabels),
  },
  {
    type: "select",
    name: "metodo",
    label: "Método de pagamento",
    options: options(paymentMethodLabels),
  },
  {
    type: "select",
    name: "entrega",
    label: "Método de entrega",
    options: [
      { value: "entrega-hoje", label: "Entrega hoje" },
      { value: "agendada", label: "Entrega agendada" },
      { value: "economico", label: "Envio econômico" },
      { value: "expresso", label: "Envio expresso" },
      { value: "retirada", label: "Retirada" },
    ],
  },
  { type: "select", name: "canal", label: "Canal", options: options(channelLabels) },
  { type: "date", name: "de", label: "Criado de" },
  { type: "date", name: "ate", label: "Criado até" },
  { type: "date", name: "entrega-de", label: "Entrega de" },
  { type: "date", name: "entrega-ate", label: "Entrega até" },
  { type: "text", name: "cupom", label: "Cupom", placeholder: "Código" },
  { type: "text", name: "valor-min", label: "Valor mínimo", placeholder: "R$" },
  { type: "text", name: "valor-max", label: "Valor máximo", placeholder: "R$" },
  { type: "toggle", name: "hoje", label: "Entrega hoje" },
  { type: "toggle", name: "atrasados", label: "Atrasados" },
];

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/pedidos">) {
  const user = await requireAdminPage("orders.view");
  const params = parseListParams(await searchParams, { sort: "createdAt", dir: "desc" });
  const order = orderByOf(params, ["number", "createdAt", "totalCents"] as const, "createdAt");
  const where = orderWhere(params);

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { [order.field]: order.dir },
      skip: params.skip,
      take: params.pageSize,
    }),
    db.order.count({ where }),
  ]);

  const bulk = (toStatus: OrderStatusCode) => ({
    label: `Alterar para ${orderStatusLabels[toStatus].toLowerCase()}`,
    action: async (ids: string[]) => {
      "use server";
      return bulkChangeOrderStatusAction({ ids, toStatus });
    },
  });

  return (
    <>
      <PageHeader
        title="Pedidos"
        description="Clique no número para abrir o pedido. Os filtros ficam no endereço da página e podem ser compartilhados."
        actions={
          can(user, "orders.create_manual") ? (
            <Button asChild>
              <Link href="/admin/pedidos/novo">Criar pedido manual</Link>
            </Button>
          ) : null
        }
      />
      <FilterBar
        searchPlaceholder="Número, nome, e-mail, CPF ou telefone"
        fields={filters}
        exportHref={can(user, "orders.export") ? "/admin/exportar/pedidos" : undefined}
      />
      <DataTable
        label="Pedidos"
        columns={columns}
        total={total}
        page={params.page}
        pageSize={params.pageSize}
        sort={order.field}
        dir={order.dir}
        bulkActions={[
          bulk("PREPARING"),
          bulk("OUT_FOR_DELIVERY"),
          bulk("READY_FOR_PICKUP"),
          bulk("DELIVERED"),
        ]}
        rows={orders.map((item) => ({
          id: item.id,
          cells: {
            number: (
              <Link
                href={`/admin/pedidos/${item.number}`}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {item.number}
              </Link>
            ),
            createdAt: (
              <span className="whitespace-nowrap text-muted-foreground">
                {formatDateTime(item.createdAt)}
              </span>
            ),
            customer: (
              <>
                {item.customerName}
                {item.isSample ? (
                  <span className="ml-1.5 rounded-xs bg-secondary px-1 text-xs text-muted-foreground">
                    Teste
                  </span>
                ) : null}
              </>
            ),
            totalCents: formatBRL(item.totalCents),
            payment: (
              <>
                {item.manualPaymentLabel ?? paymentMethodLabels[item.paymentMethod]}
                <span className="block text-xs text-muted-foreground">
                  {paymentStatusLabels[item.paymentStatus]}
                </span>
              </>
            ),
            status: <OrderStatusBadge status={item.status as OrderStatusCode} />,
            delivery: (
              <>
                {item.shippingMethodName}
                {item.deliveryDate ? (
                  <span className="block text-xs text-muted-foreground">
                    {formatDateOnly(item.deliveryDate)}
                    {item.deliveryWindow ? `, ${item.deliveryWindow.toLowerCase()}` : ""}
                  </span>
                ) : null}
              </>
            ),
            channel: (
              <>
                {channelLabels[item.channel]}
                <span className="block text-xs text-muted-foreground">{sourceLabel(item)}</span>
              </>
            ),
          },
        }))}
      />
    </>
  );
}
