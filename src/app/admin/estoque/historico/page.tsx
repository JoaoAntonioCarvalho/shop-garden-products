import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { DataTable } from "@/components/admin/data-table";
import { FilterBar } from "@/components/admin/filter-bar";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { userNames } from "@/server/admin/audit";
import { movementLabels, movementWhere } from "@/server/admin/inventory";
import { parseListParams } from "@/server/admin/list";

export const metadata: Metadata = { title: "Histórico de estoque" };

export default async function StockHistoryPage({
  searchParams,
}: PageProps<"/admin/estoque/historico">) {
  await requireAdminPage("inventory.view");
  const params = parseListParams(await searchParams);
  const where = movementWhere(params);
  const [movements, total] = await Promise.all([
    db.inventoryMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.pageSize,
      include: {
        variant: {
          select: { sku: true, name: true, product: { select: { id: true, name: true } } },
        },
        order: { select: { number: true } },
      },
    }),
    db.inventoryMovement.count({ where }),
  ]);
  const names = await userNames(movements.map((movement) => movement.userId));
  return (
    <>
      <PageHeader
        back={{ href: "/admin/estoque", label: "Estoque" }}
        title="Histórico de estoque"
        description="Toda entrada, saída, reserva, venda e ajuste, com quem fez e por quê."
      />
      <FilterBar
        searchPlaceholder="Produto, SKU ou motivo"
        exportHref="/admin/exportar/estoque"
        fields={[
          {
            type: "select",
            name: "tipo",
            label: "Tipo",
            options: Object.entries(movementLabels).map(([value, label]) => ({ value, label })),
          },
          { type: "date", name: "de", label: "De" },
          { type: "date", name: "ate", label: "Até" },
        ]}
      />
      <DataTable
        label="Movimentos de estoque"
        columns={[
          { key: "date", header: "Data" },
          { key: "product", header: "Produto" },
          { key: "type", header: "Tipo" },
          { key: "quantity", header: "Quantidade", align: "right" },
          { key: "after", header: "Em estoque depois", align: "right" },
          { key: "reason", header: "Motivo e origem" },
        ]}
        total={total}
        page={params.page}
        pageSize={params.pageSize}
        sort={null}
        dir="desc"
        rows={movements.map((movement) => ({
          id: movement.id,
          cells: {
            date: (
              <span className="whitespace-nowrap text-muted-foreground">
                {formatDateTime(movement.createdAt)}
              </span>
            ),
            product: (
              <>
                <Link
                  href={`/admin/produtos/${movement.variant.product.id}`}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {movement.variant.product.name}
                </Link>
                <span className="block text-xs text-muted-foreground">{movement.variant.sku}</span>
              </>
            ),
            type: movementLabels[movement.type],
            quantity: movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity,
            after: `${movement.stockOnHandAfter} (${movement.stockReservedAfter} reservados)`,
            reason: (
              <>
                {movement.reason ?? ""}
                {movement.order ? (
                  <Link
                    href={`/admin/pedidos/${movement.order.number}`}
                    className="ml-1 text-primary underline-offset-2 hover:underline"
                  >
                    {movement.order.number}
                  </Link>
                ) : null}
                {movement.userId ? (
                  <span className="block text-xs text-muted-foreground">
                    por {names.get(movement.userId) ?? "usuário removido"}
                  </span>
                ) : null}
              </>
            ),
          },
        }))}
      />
    </>
  );
}
