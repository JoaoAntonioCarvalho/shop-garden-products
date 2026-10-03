import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { normalizeText } from "@/lib/slug";
import type { ListParams } from "./list";
import { dateRangeOf } from "./list";

export const movementLabels: Record<string, string> = {
  IN: "Entrada",
  OUT: "Saída",
  ADJUSTMENT: "Ajuste de inventário",
  SALE: "Venda",
  RESERVE: "Reserva",
  RELEASE: "Reserva liberada",
  RETURN: "Devolução",
  LOSS: "Perda ou quebra",
};

export type StockStatus = "zero" | "low" | "ok";

export function stockStatusOf(variant: {
  stockOnHand: number;
  stockReserved: number;
  lowStockThreshold: number;
}): StockStatus {
  const available = variant.stockOnHand - variant.stockReserved;
  return available <= 0 ? "zero" : available <= variant.lowStockThreshold ? "low" : "ok";
}

export const stockStatusLabels: Record<StockStatus, string> = {
  zero: "Sem estoque",
  low: "Estoque baixo",
  ok: "Em estoque",
};

/** Filtros da tabela de estoque. Os que comparam colunas entre si usam SQL para achar os ids. */
export async function variantWhere(params: ListParams): Promise<Prisma.ProductVariantWhereInput> {
  const f = params.filters;
  const and: Prisma.ProductVariantWhereInput[] = [{ product: { status: { not: "ARCHIVED" } } }];
  if (params.q)
    and.push({
      OR: [
        { sku: { contains: params.q.toUpperCase() } },
        { product: { searchText: { contains: normalizeText(params.q) } } },
      ],
    });
  if (f.categoria)
    and.push({
      product: {
        OR: [{ primaryCategoryId: f.categoria }, { primaryCategory: { parentId: f.categoria } }],
      },
    });
  if (f.reserva === "1") and.push({ stockReserved: { gt: 0 } });
  if (f.teste === "1") and.push({ product: { isSample: true } });
  if (f.teste === "0") and.push({ product: { isSample: false } });
  if (f.status === "zero" || f.status === "low" || f.status === "ok") {
    const rows =
      f.status === "zero"
        ? await db.$queryRaw<
            Array<{ id: string }>
          >`SELECT id FROM "ProductVariant" WHERE "stockOnHand" - "stockReserved" <= 0`
        : f.status === "low"
          ? await db.$queryRaw<
              Array<{ id: string }>
            >`SELECT id FROM "ProductVariant" WHERE "stockOnHand" - "stockReserved" > 0 AND "stockOnHand" - "stockReserved" <= "lowStockThreshold"`
          : await db.$queryRaw<
              Array<{ id: string }>
            >`SELECT id FROM "ProductVariant" WHERE "stockOnHand" - "stockReserved" > "lowStockThreshold"`;
    and.push({ id: { in: rows.map((row) => row.id) } });
  }
  return { AND: and };
}

export function movementWhere(params: ListParams): Prisma.InventoryMovementWhereInput {
  const f = params.filters;
  const and: Prisma.InventoryMovementWhereInput[] = [];
  if (params.q)
    and.push({
      OR: [
        { variant: { sku: { contains: params.q.toUpperCase() } } },
        { variant: { product: { searchText: { contains: normalizeText(params.q) } } } },
        { reason: { contains: params.q, mode: "insensitive" } },
      ],
    });
  if (f.tipo && f.tipo in movementLabels) and.push({ type: f.tipo as never });
  const range = dateRangeOf(f.de, f.ate);
  if (range) and.push({ createdAt: range });
  if (f.variante) and.push({ variantId: f.variante });
  return and.length ? { AND: and } : {};
}

/** Valor do estoque a preço de custo e a preço de venda, por categoria principal. */
export async function stockValueReport(): Promise<{
  rows: Array<{
    category: string;
    units: number;
    costCents: number;
    saleCents: number;
    withoutCost: number;
  }>;
  total: { units: number; costCents: number; saleCents: number; withoutCost: number };
}> {
  const rows = await db.$queryRaw<
    Array<{ category: string | null; units: bigint; cost: bigint; sale: bigint; missing: bigint }>
  >`
    SELECT COALESCE(root.name, c.name, 'Sem categoria') AS category,
           SUM(v."stockOnHand")::bigint AS units,
           SUM(v."stockOnHand" * COALESCE(v."costCents", 0))::bigint AS cost,
           SUM(v."stockOnHand" * v."priceCents")::bigint AS sale,
           COUNT(*) FILTER (WHERE v."costCents" IS NULL AND v."stockOnHand" > 0)::bigint AS missing
    FROM "ProductVariant" v
    JOIN "Product" p ON p.id = v."productId"
    LEFT JOIN "Category" c ON c.id = p."primaryCategoryId"
    LEFT JOIN "Category" root ON root.id = c."parentId"
    WHERE p.status <> 'ARCHIVED'
    GROUP BY 1 ORDER BY sale DESC`;
  const mapped = rows.map((row) => ({
    category: row.category ?? "Sem categoria",
    units: Number(row.units),
    costCents: Number(row.cost),
    saleCents: Number(row.sale),
    withoutCost: Number(row.missing),
  }));
  const total = mapped.reduce(
    (sum, row) => ({
      units: sum.units + row.units,
      costCents: sum.costCents + row.costCents,
      saleCents: sum.saleCents + row.saleCents,
      withoutCost: sum.withoutCost + row.withoutCost,
    }),
    { units: 0, costCents: 0, saleCents: 0, withoutCost: 0 },
  );
  return { rows: mapped, total };
}
