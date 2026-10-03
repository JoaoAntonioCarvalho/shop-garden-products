import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { DataTable } from "@/components/admin/data-table";
import { FilterBar } from "@/components/admin/filter-bar";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { actionLabel, userNames } from "@/server/admin/audit";
import { dateRangeOf, parseListParams } from "@/server/admin/list";

export const metadata: Metadata = { title: "Auditoria" };

const entityLabels: Record<string, string> = {
  Product: "Produto",
  Order: "Pedido",
  User: "Cliente ou usuário",
  Coupon: "Cupom",
  Category: "Categoria",
  Collection: "Coleção",
  Banner: "Banner",
  Page: "Página",
  StoreSetting: "Configurações",
  MediaAsset: "Imagem",
  Review: "Avaliação",
  Redirect: "Redirecionamento",
  ShippingRule: "Regra de frete",
  Cart: "Carrinho",
  DataRequest: "Pedido LGPD",
  EmailLog: "E-mail",
  JobRun: "Tarefa",
};

/** Link para a entidade, quando ela tem página no painel. */
function entityHref(
  type: string | null,
  id: string | null,
  orderNumbers: Map<string, string>,
): string | null {
  if (!type || !id) return null;
  if (type === "Product") return `/admin/produtos/${id}`;
  if (type === "Order")
    return orderNumbers.has(id) ? `/admin/pedidos/${orderNumbers.get(id)}` : null;
  if (type === "User") return `/admin/clientes/${id}`;
  const resource: Record<string, string> = {
    Coupon: "cupons",
    Category: "categorias",
    Collection: "colecoes",
    Banner: "banners",
    Page: "paginas",
    Redirect: "redirecionamentos",
    ShippingRule: "frete",
  };
  if (type === "EmailLog") return `/admin/emails/${id}`;
  return resource[type] ? `/admin/${resource[type]}/${id}` : null;
}

function diffText(diff: unknown): string {
  if (!diff || typeof diff !== "object") return "";
  return Object.entries(diff as Record<string, unknown>)
    .slice(0, 8)
    .map(([key, value]) => {
      if (value && typeof value === "object" && "antes" in value && "depois" in value) {
        const short = (item: unknown) =>
          (typeof item === "string" ? item : (JSON.stringify(item) ?? "")).slice(0, 60);
        return `${key}: ${short(value.antes)} → ${short(value.depois)}`;
      }
      return `${key}: ${(typeof value === "string" ? value : (JSON.stringify(value) ?? "")).slice(0, 80)}`;
    })
    .join("; ");
}

export default async function AuditPage({ searchParams }: PageProps<"/admin/auditoria">) {
  await requireAdminPage("audit.view");
  const params = parseListParams(await searchParams, { pageSize: 50 });
  const f = params.filters;
  const and: Prisma.AuditLogWhereInput[] = [];
  if (f.usuario) and.push({ userId: f.usuario === "sistema" ? null : f.usuario });
  if (f.entidade) and.push({ entityType: f.entidade });
  if (params.q)
    and.push({ OR: [{ action: { contains: params.q.toLowerCase() } }, { entityId: params.q }] });
  const range = dateRangeOf(f.de, f.ate);
  if (range) and.push({ createdAt: range });
  const where = { AND: and };
  const [entries, total, team] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.pageSize,
    }),
    db.auditLog.count({ where }),
    db.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const [names, orders] = await Promise.all([
    userNames(entries.map((entry) => entry.userId)),
    db.order.findMany({
      where: {
        id: {
          in: entries
            .filter((entry) => entry.entityType === "Order" && entry.entityId)
            .map((entry) => entry.entityId as string),
        },
      },
      select: { id: true, number: true },
    }),
  ]);
  const orderNumbers = new Map(orders.map((order) => [order.id, order.number]));
  return (
    <>
      <PageHeader
        title="Auditoria"
        description="Tudo o que a equipe alterou no painel, com quem fez, quando e o que mudou. O endereço IP é guardado só como código (hash)."
      />
      <FilterBar
        searchPlaceholder="Ação (por exemplo: product.update)"
        fields={[
          {
            type: "select",
            name: "usuario",
            label: "Usuário",
            options: [
              ...team.map((member) => ({ value: member.id, label: member.name })),
              { value: "sistema", label: "Sistema" },
            ],
          },
          {
            type: "select",
            name: "entidade",
            label: "Entidade",
            options: Object.entries(entityLabels).map(([value, label]) => ({ value, label })),
          },
          { type: "date", name: "de", label: "De" },
          { type: "date", name: "ate", label: "Até" },
        ]}
      />
      <DataTable
        label="Registros de auditoria"
        columns={[
          { key: "date", header: "Data" },
          { key: "user", header: "Usuário" },
          { key: "action", header: "Ação" },
          { key: "entity", header: "Entidade" },
          { key: "diff", header: "O que mudou" },
          { key: "ip", header: "IP (hash)" },
        ]}
        total={total}
        page={params.page}
        pageSize={params.pageSize}
        sort={null}
        dir="desc"
        rows={entries.map((entry) => {
          const href = entityHref(entry.entityType, entry.entityId, orderNumbers);
          const label = entry.entityType
            ? (entityLabels[entry.entityType] ?? entry.entityType)
            : "";
          return {
            id: entry.id,
            cells: {
              date: (
                <span className="whitespace-nowrap text-muted-foreground">
                  {formatDateTime(entry.createdAt)}
                </span>
              ),
              user: (entry.userId && names.get(entry.userId)) || (
                <span className="text-muted-foreground">Sistema</span>
              ),
              action: (
                <>
                  {actionLabel(entry.action)}
                  <span className="block text-xs text-muted-foreground">{entry.action}</span>
                </>
              ),
              entity: href ? (
                <Link href={href} className="text-primary underline-offset-2 hover:underline">
                  {entry.entityType === "Order" && entry.entityId
                    ? orderNumbers.get(entry.entityId)
                    : label}
                </Link>
              ) : (
                label
              ),
              diff: (
                <span className="block max-w-md text-xs break-words text-muted-foreground">
                  {diffText(entry.diff)}
                </span>
              ),
              ip: (
                <span className="text-xs text-muted-foreground">
                  {entry.ipHash?.slice(0, 10) ?? ""}
                </span>
              ),
            },
          };
        })}
      />
    </>
  );
}
