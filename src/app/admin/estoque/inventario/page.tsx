import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/admin-shell";
import { FilterBar } from "@/components/admin/filter-bar";
import { InventoryCount } from "@/components/admin/stock-tools";
import { requireAdminPage } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { parseListParams } from "@/server/admin/list";
import { categoryOptions } from "@/server/admin/product-queries";

export const metadata: Metadata = { title: "Contagem de inventário" };

export default async function InventoryCountPage({
  searchParams,
}: PageProps<"/admin/estoque/inventario">) {
  await requireAdminPage("inventory.adjust");
  const params = parseListParams(await searchParams);
  const categoryId = params.filters.categoria;
  const [categories, variants] = await Promise.all([
    categoryOptions(),
    categoryId
      ? db.productVariant.findMany({
          where: {
            isActive: true,
            product: {
              status: { not: "ARCHIVED" },
              OR: [
                { primaryCategoryId: categoryId },
                { primaryCategory: { parentId: categoryId } },
              ],
            },
          },
          orderBy: [{ product: { name: "asc" } }, { position: "asc" }],
          take: 1000,
          include: { product: { select: { name: true } } },
        })
      : [],
  ]);
  return (
    <>
      <PageHeader
        back={{ href: "/admin/estoque", label: "Estoque" }}
        title="Contagem de inventário"
        description="Escolha a categoria, digite o que foi contado na prateleira e confira as diferenças antes de aplicar. Só os itens com diferença são ajustados."
      />
      <FilterBar
        fields={[{ type: "select", name: "categoria", label: "Categoria", options: categories }]}
      />
      {categoryId ? (
        variants.length ? (
          <InventoryCount
            key={categoryId}
            items={variants.map((variant) => ({
              variantId: variant.id,
              name: `${variant.product.name}${variant.name !== "Padrão" ? ` (${variant.name})` : ""}`,
              sku: variant.sku,
              onHand: variant.stockOnHand,
              reserved: variant.stockReserved,
            }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum produto nesta categoria.</p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          Escolha uma categoria para começar a contagem.
        </p>
      )}
    </>
  );
}
