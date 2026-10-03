import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { DataTable } from "@/components/admin/data-table";
import { FilterBar } from "@/components/admin/filter-bar";
import { Button } from "@/components/admin/ui/button";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { orderByOf, parseListParams } from "@/server/admin/list";

export const metadata: Metadata = { title: "Páginas não encontradas" };

export default async function NotFoundLogPage({
  searchParams,
}: PageProps<"/admin/nao-encontradas">) {
  await requireAdminPage("redirects.manage");
  const params = parseListParams(await searchParams, { sort: "hits", dir: "desc" });
  const order = orderByOf(params, ["hits", "lastHitAt", "path"] as const, "hits");
  const where = params.q ? { path: { contains: params.q.toLowerCase() } } : {};
  const [rows, total] = await Promise.all([
    db.notFoundLog.findMany({
      where,
      orderBy: { [order.field]: order.dir },
      skip: params.skip,
      take: params.pageSize,
    }),
    db.notFoundLog.count({ where }),
  ]);
  return (
    <>
      <PageHeader
        back={{ href: "/admin/redirecionamentos", label: "Redirecionamentos" }}
        title="Páginas não encontradas"
        description="Endereços que visitantes tentaram abrir e não existem. Os mais acessados costumam ser links antigos que merecem um redirecionamento."
      />
      <FilterBar searchPlaceholder="Endereço" />
      <DataTable
        label="Páginas não encontradas"
        columns={[
          { key: "path", header: "Endereço", sortable: true },
          { key: "hits", header: "Acessos", sortable: true, align: "right" },
          { key: "lastHitAt", header: "Último acesso", sortable: true },
          { key: "action", header: "Ação", align: "right" },
        ]}
        total={total}
        page={params.page}
        pageSize={params.pageSize}
        sort={order.field}
        dir={order.dir}
        emptyMessage="Nenhuma página não encontrada registrada."
        rows={rows.map((row) => ({
          id: row.path,
          cells: {
            path: <span className="break-all">{row.path}</span>,
            hits: row.hits,
            lastHitAt: (
              <span className="whitespace-nowrap text-muted-foreground">
                {formatDateTime(row.lastHitAt)}
              </span>
            ),
            action: (
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/redirecionamentos/novo?origem=${encodeURIComponent(row.path)}`}>
                  Criar redirecionamento
                </Link>
              </Button>
            ),
          },
        }))}
      />
    </>
  );
}
