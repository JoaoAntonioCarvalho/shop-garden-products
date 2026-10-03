import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { DataTable } from "@/components/admin/data-table";
import { FilterBar } from "@/components/admin/filter-bar";
import { StockAdjust } from "@/components/admin/stock-tools";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import {
  movementLabels,
  stockStatusLabels,
  stockStatusOf,
  variantWhere,
} from "@/server/admin/inventory";
import { orderByOf, parseListParams } from "@/server/admin/list";
import { toMediaItem } from "@/server/admin/media";
import { categoryOptions } from "@/server/admin/product-queries";

export const metadata: Metadata = { title: "Estoque" };

export default async function AdminInventoryPage({ searchParams }: PageProps<"/admin/estoque">) {
  const user = await requireAdminPage("inventory.view");
  const params = parseListParams(await searchParams, { sort: "stockOnHand", dir: "asc" });
  const order = orderByOf(params, ["stockOnHand", "stockReserved", "sku"] as const, "stockOnHand");
  const where = await variantWhere(params);
  const [variants, total, categories] = await Promise.all([
    db.productVariant.findMany({
      where,
      orderBy: { [order.field]: order.dir },
      skip: params.skip,
      take: params.pageSize,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            isSample: true,
            images: {
              orderBy: [{ isCover: "desc" }, { position: "asc" }],
              take: 1,
              include: { media: true },
            },
          },
        },
        movements: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    db.productVariant.count({ where }),
    categoryOptions(),
  ]);
  const canAdjust = can(user, "inventory.adjust");

  return (
    <>
      <PageHeader
        title="Estoque"
        description="Disponível é o que está em estoque menos o reservado para pedidos aguardando pagamento."
        actions={
          <>
            {canAdjust ? (
              <>
                <Button asChild variant="outline">
                  <Link href="/admin/estoque/lote">Entrada em lote</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/admin/estoque/inventario">Contagem de inventário</Link>
                </Button>
              </>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/admin/estoque/historico">Histórico</Link>
            </Button>
            {can(user, "inventory.value_report") ? (
              <Button asChild variant="outline">
                <Link href="/admin/estoque/valor">Valor em estoque</Link>
              </Button>
            ) : null}
          </>
        }
      />
      <FilterBar
        searchPlaceholder="Produto ou SKU"
        fields={[
          {
            type: "select",
            name: "status",
            label: "Situação",
            options: [
              { value: "zero", label: "Sem estoque" },
              { value: "low", label: "Estoque baixo" },
              { value: "ok", label: "Em estoque" },
            ],
          },
          { type: "select", name: "categoria", label: "Categoria", options: categories },
          {
            type: "select",
            name: "teste",
            label: "Dados de teste",
            options: [
              { value: "1", label: "Só de teste" },
              { value: "0", label: "Só reais" },
            ],
          },
          { type: "toggle", name: "reserva", label: "Com reserva" },
        ]}
      />
      <DataTable
        label="Estoque por variação"
        columns={[
          { key: "product", header: "Produto", className: "min-w-44 whitespace-normal" },
          { key: "available", header: "Disponível", align: "right" },
          { key: "stockOnHand", header: "Em estoque", sortable: true, align: "right" },
          ...(canAdjust ? [{ key: "action", header: "Ação" }] : []),
          { key: "stockReserved", header: "Reservado", sortable: true, align: "right" },
          { key: "threshold", header: "Alerta", align: "right" },
          { key: "status", header: "Situação" },
          { key: "sku", header: "SKU", sortable: true },
          { key: "last", header: "Última movimentação" },
        ]}
        total={total}
        page={params.page}
        pageSize={params.pageSize}
        sort={order.field}
        dir={order.dir}
        rows={variants.map((variant) => {
          const status = stockStatusOf(variant);
          const cover = variant.product.images[0]
            ? toMediaItem(variant.product.images[0].media)
            : null;
          const last = variant.movements[0];
          const name = `${variant.product.name}${variant.name !== "Padrão" ? ` (${variant.name})` : ""}`;
          return {
            id: variant.id,
            cells: {
              product: (
                <span className="flex items-center gap-2">
                  {cover ? (
                    <Image
                      src={cover.thumb}
                      alt=""
                      width={32}
                      height={40}
                      unoptimized
                      className="h-10 w-8 rounded-sm object-cover"
                    />
                  ) : null}
                  <span>
                    <Link
                      href={`/admin/produtos/${variant.product.id}`}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {name}
                    </Link>
                    {variant.product.isSample ? (
                      <span className="ml-1.5 rounded-xs bg-secondary px-1 text-xs text-muted-foreground">
                        Teste
                      </span>
                    ) : null}
                  </span>
                </span>
              ),
              sku: <span className="text-muted-foreground">{variant.sku}</span>,
              stockOnHand: variant.stockOnHand,
              stockReserved: variant.stockReserved,
              available: variant.stockOnHand - variant.stockReserved,
              threshold: variant.lowStockThreshold,
              status: (
                <Badge
                  variant={
                    status === "ok" ? "secondary" : status === "low" ? "outline" : "destructive"
                  }
                >
                  {stockStatusLabels[status]}
                </Badge>
              ),
              last: last ? (
                <span className="text-xs text-muted-foreground">
                  {movementLabels[last.type]} (
                  {last.quantity > 0 ? `+${last.quantity}` : last.quantity}),{" "}
                  {formatDateTime(last.createdAt)}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Sem movimento</span>
              ),
              action: (
                <StockAdjust variantId={variant.id} name={name} onHand={variant.stockOnHand} />
              ),
            },
          };
        })}
      />
    </>
  );
}
