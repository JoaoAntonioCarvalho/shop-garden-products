import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ActionButton } from "@/components/admin/action-button";
import { PageHeader } from "@/components/admin/admin-shell";
import { RevenueLineChart, SimpleBarChart } from "@/components/admin/charts";
import { PeriodSelect } from "@/components/admin/period-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { OrderStatusBadge } from "@/components/store/account/order-status-badge";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatBRL } from "@/lib/money";
import { can } from "@/lib/permissions";
import { getDashboard } from "@/server/admin/dashboard";
import { percentChange, resolvePeriod } from "@/server/admin/periods";
import { changeOrderStatusAction } from "@/server/actions/admin/orders";
import { shippingKindOf } from "@/server/services/checkout-rules";
import {
  orderStatusLabels,
  paymentMethodLabels,
  type OrderStatusCode,
} from "@/server/services/order-status";

export const metadata: Metadata = { title: "Dashboard" };

const channelLabels: Record<string, string> = {
  SITE: "Site",
  WHATSAPP: "WhatsApp",
  STORE: "Loja",
  PHONE: "Telefone",
};

function Change({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null)
    return <span className="text-xs text-muted-foreground">sem base de comparação</span>;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  const good = invert ? value < 0 : value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${value === 0 ? "text-muted-foreground" : good ? "text-primary" : "text-destructive"}`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {Math.abs(value).toLocaleString("pt-BR")}%
      <span className="sr-only">
        {value > 0 ? " de aumento" : value < 0 ? " de queda" : ""} em relação ao período anterior
      </span>
    </span>
  );
}

function Kpi({
  label,
  value,
  change,
  hint,
  invert,
}: {
  label: string;
  value: string;
  change?: number | null;
  hint?: string;
  invert?: boolean;
}) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
        <p className="mt-1 min-h-4">
          {change !== undefined ? (
            <Change value={change} invert={invert} />
          ) : hint ? (
            <span className="text-xs text-muted-foreground">{hint}</span>
          ) : null}
        </p>
      </CardContent>
    </Card>
  );
}

function Panel({
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
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Próximo passo operacional de um pedido com entrega hoje. */
function nextDeliveryStatus(
  status: OrderStatusCode,
  kind: "transport" | "local" | "pickup",
): OrderStatusCode | null {
  if (status === "PAID") return "PREPARING";
  if (status === "PREPARING") return kind === "pickup" ? "READY_FOR_PICKUP" : "OUT_FOR_DELIVERY";
  if (status === "OUT_FOR_DELIVERY" || status === "READY_FOR_PICKUP") return "DELIVERED";
  return null;
}

const advanceLabels: Partial<Record<OrderStatusCode, string>> = {
  PREPARING: "Iniciar preparação",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  READY_FOR_PICKUP: "Pronto para retirada",
  DELIVERED: "Marcar como entregue",
};

export default async function DashboardPage({ searchParams }: PageProps<"/admin">) {
  const user = await requireAdminPage("dashboard.view");
  const query = await searchParams;
  const one = (key: string) =>
    Array.isArray(query[key]) ? query[key]?.[0] : (query[key] as string | undefined);
  const period = resolvePeriod({ periodo: one("periodo"), de: one("de"), ate: one("ate") });
  const data = await getDashboard(period);
  const { now, before, attention } = data;
  const showMargin = can(user, "dashboard.margin");

  const attentionItems = [
    {
      count: attention.pixExpiring,
      label: "Pix perto de expirar",
      href: "/admin/pedidos?status=PENDING_PAYMENT",
    },
    {
      count: attention.paidWaiting,
      label: "pagos há mais de 24h sem preparo",
      href: "/admin/pedidos?status=PAID",
    },
    {
      count: attention.zeroStock,
      label: "variações com estoque zerado",
      href: "/admin/estoque?situacao=zerado",
    },
    {
      count: attention.lowStock,
      label: "variações com estoque baixo",
      href: "/admin/estoque?situacao=baixo",
    },
    {
      count: attention.pendingReviews,
      label: "avaliações pendentes",
      href: "/admin/avaliacoes?status=PENDING",
    },
    {
      count: attention.newRequests,
      label: "solicitações de produto novas",
      href: "/admin/solicitacoes?status=NEW",
    },
    {
      count: attention.unreadContacts,
      label: "mensagens de contato não lidas",
      href: "/admin/contatos?status=NEW",
    },
    { count: attention.dataRequests, label: "pedidos LGPD abertos", href: "/admin/dados-pessoais" },
  ].filter((item) => item.count > 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${period.label}, comparado com os ${period.days} ${period.days === 1 ? "dia anterior" : "dias anteriores"}.`}
        actions={<PeriodSelect preset={period.preset} from={period.fromKey} to={period.toKey} />}
      />

      <section
        aria-label="Indicadores"
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
      >
        <Kpi
          label="Faturamento (pedidos pagos)"
          value={formatBRL(now.revenueCents)}
          change={percentChange(now.revenueCents, before.revenueCents)}
        />
        <Kpi
          label="Pedidos pagos"
          value={String(now.paidOrders)}
          change={percentChange(now.paidOrders, before.paidOrders)}
        />
        <Kpi
          label="Ticket médio"
          value={formatBRL(now.averageTicketCents)}
          change={percentChange(now.averageTicketCents, before.averageTicketCents)}
        />
        <Kpi
          label="Itens vendidos"
          value={String(now.itemsSold)}
          change={percentChange(now.itemsSold, before.itemsSold)}
        />
        <Kpi
          label="Aguardando pagamento"
          value={String(now.pendingOrders)}
          hint={formatBRL(now.pendingCents)}
        />
        <Kpi
          label="Aprovação de pagamento"
          value={
            now.approvalRate === null ? "sem dados" : `${now.approvalRate.toLocaleString("pt-BR")}%`
          }
          change={
            now.approvalRate !== null && before.approvalRate !== null
              ? Math.round((now.approvalRate - before.approvalRate) * 10) / 10
              : undefined
          }
        />
        <Kpi
          label="Novos clientes"
          value={String(now.newCustomers)}
          change={percentChange(now.newCustomers, before.newCustomers)}
        />
        <Kpi
          label="Novos leads"
          value={String(now.newLeads)}
          change={percentChange(now.newLeads, before.newLeads)}
        />
        <Kpi
          label="Carrinhos abandonados"
          value={String(now.abandonedCarts)}
          hint={formatBRL(now.abandonedCents)}
        />
        {showMargin ? (
          <Kpi
            label="Margem bruta estimada"
            value={now.marginCents === null ? "sem custo cadastrado" : formatBRL(now.marginCents)}
            change={
              now.marginCents !== null && before.marginCents !== null
                ? percentChange(now.marginCents, before.marginCents)
                : undefined
            }
          />
        ) : null}
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title="Entregas de hoje" className="xl:col-span-2">
          {data.deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma entrega para hoje.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.deliveries.map((order) => {
                const status = order.status as OrderStatusCode;
                const next = nextDeliveryStatus(status, shippingKindOf(order.shippingMethodCode));
                const address = order.shippingAddress as {
                  street?: string;
                  number?: string;
                  district?: string;
                };
                return (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        <Link
                          href={`/admin/pedidos/${order.number}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {order.number}
                        </Link>{" "}
                        <span className="font-normal text-muted-foreground">
                          {order.recipientName ?? order.customerName}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          address.street && `${address.street}, ${address.number ?? ""}`,
                          address.district,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                        {order.deliveryWindow ? `. ${order.deliveryWindow}` : ""}
                        {order.giftMessage ? ". Com cartão de presente" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <OrderStatusBadge status={status} />
                      {next ? (
                        <ActionButton
                          size="sm"
                          variant="outline"
                          action={changeOrderStatusAction.bind(null, {
                            orderId: order.id,
                            toStatus: next,
                          })}
                        >
                          {advanceLabels[next] ?? orderStatusLabels[next]}
                        </ActionButton>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Atenção agora">
          {attentionItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada pendente no momento.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {attentionItems.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="flex min-h-9 items-center gap-2 rounded-md px-2 hover:bg-accent"
                  >
                    <span className="min-w-7 rounded-full bg-destructive px-1.5 text-center text-xs font-semibold text-white tabular-nums">
                      {item.count}
                    </span>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Faturamento por dia" className="xl:col-span-2">
          <RevenueLineChart data={data.series} />
        </Panel>
        <Panel title="Pedidos por método de pagamento">
          <SimpleBarChart
            data={data.byMethod.map((row) => ({
              ...row,
              name: paymentMethodLabels[row.name] ?? row.name,
            }))}
            dataKey="pedidos"
            caption="Pedidos por método de pagamento"
          />
        </Panel>
        <Panel title="Vendas por canal">
          <SimpleBarChart
            data={data.byChannel.map((row) => ({
              ...row,
              name: channelLabels[row.name] ?? row.name,
            }))}
            dataKey="faturamento"
            caption="Vendas por canal"
            money
          />
        </Panel>
        <Panel title="Vendas por origem">
          <SimpleBarChart
            data={data.bySource}
            dataKey="faturamento"
            caption="Vendas por origem (UTM)"
            horizontal
            money
          />
        </Panel>
        <Panel title="Faturamento por categoria">
          <SimpleBarChart
            data={data.byCategory}
            dataKey="faturamento"
            caption="Faturamento por categoria principal"
            horizontal
            money
          />
        </Panel>

        <Panel title="Produtos mais vendidos">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="pb-2 font-medium">
                  Produto
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Quantidade
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Faturamento
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.topProducts.map((product) => (
                <tr key={product.name}>
                  <td className="py-1.5 pr-2">{product.name}</td>
                  <td className="py-1.5 text-right tabular-nums">{product.quantity}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatBRL(product.revenueCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem vendas no período.</p>
          ) : null}
        </Panel>
        <Panel title="Melhores clientes do período">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="pb-2 font-medium">
                  Cliente
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Pedidos
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.topCustomers.map((customer) => (
                <tr key={customer.email}>
                  <td className="py-1.5 pr-2">
                    {customer.id ? (
                      <Link
                        href={`/admin/clientes/${customer.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {customer.name}
                      </Link>
                    ) : (
                      customer.name
                    )}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{customer.orders}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatBRL(customer.revenueCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.topCustomers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem vendas no período.</p>
          ) : null}
        </Panel>
      </div>
    </>
  );
}
