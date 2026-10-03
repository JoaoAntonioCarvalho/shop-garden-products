import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { DataTable, type BulkAction, type DataColumn } from "@/components/admin/data-table";
import { FilterBar, type FilterField } from "@/components/admin/filter-bar";
import { QuickEdit, RemoveSamplesButton } from "@/components/admin/product-list-tools";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { requireAdminPage } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { formatBRL, formatCentsPlain } from "@/lib/money";
import { can } from "@/lib/permissions";
import { bulkProductAction, previewPriceAdjustmentAction } from "@/server/actions/admin/products";
import { orderByOf, parseListParams } from "@/server/admin/list";
import { toMediaItem } from "@/server/admin/media";
import { categoryOptions, collectionOptions, productWhere } from "@/server/admin/product-queries";
import { productStatusLabels, productTypeLabels } from "@/server/admin/products";
import { availableOf } from "@/server/services/catalog";

export const metadata: Metadata = { title: "Produtos" };

const columns: DataColumn[] = [
  { key: "photo", header: "Foto", className: "w-14" },
  { key: "name", header: "Nome", sortable: true, className: "min-w-44 whitespace-normal" },
  { key: "category", header: "Categoria" },
  { key: "minPriceCents", header: "Preço", sortable: true, align: "right" },
  { key: "totalAvailable", header: "Estoque", sortable: true, align: "right" },
  { key: "status", header: "Status" },
  { key: "qualityScore", header: "Qualidade", sortable: true, align: "right" },
  { key: "actions", header: "Ações", align: "right" },
];

const options = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/produtos">) {
  const user = await requireAdminPage("products.view");
  const params = parseListParams(await searchParams, { sort: "updatedAt", dir: "desc" });
  const order = orderByOf(
    params,
    ["name", "minPriceCents", "totalAvailable", "qualityScore", "updatedAt"] as const,
    "updatedAt",
  );
  const where = await productWhere(params);

  const [products, total, categories, collections, sampleCount] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { [order.field]: order.dir },
      skip: params.skip,
      take: params.pageSize,
      include: {
        primaryCategory: { select: { name: true } },
        images: {
          orderBy: [{ isCover: "desc" }, { position: "asc" }],
          take: 1,
          include: { media: true },
        },
        variants: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            sku: true,
            priceCents: true,
            stockOnHand: true,
            stockReserved: true,
            isActive: true,
          },
        },
      },
    }),
    db.product.count({ where }),
    categoryOptions(),
    collectionOptions(),
    db.product.count({ where: { isSample: true } }),
  ]);

  const filters: FilterField[] = [
    { type: "select", name: "status", label: "Status", options: options(productStatusLabels) },
    { type: "select", name: "categoria", label: "Categoria", options: categories },
    { type: "select", name: "tipo", label: "Tipo", options: options(productTypeLabels) },
    {
      type: "select",
      name: "estoque",
      label: "Estoque",
      options: [
        { value: "sem", label: "Sem estoque" },
        { value: "baixo", label: "Estoque baixo" },
        { value: "ok", label: "Com estoque" },
      ],
    },
    {
      type: "select",
      name: "qualidade",
      label: "Qualidade abaixo de",
      options: [
        { value: "40", label: "40" },
        { value: "60", label: "60" },
        { value: "80", label: "80" },
        { value: "100", label: "100" },
      ],
    },
    {
      type: "select",
      name: "teste",
      label: "Dados de teste",
      options: [
        { value: "1", label: "Só de teste" },
        { value: "0", label: "Só reais" },
      ],
    },
    { type: "toggle", name: "sem-imagem", label: "Sem imagem" },
    { type: "toggle", name: "sem-descricao", label: "Sem descrição" },
    { type: "toggle", name: "promocao", label: "Em promoção" },
  ];

  const bulk = (
    kind: Parameters<typeof bulkProductAction>[0],
    label: string,
    extra: Partial<BulkAction> = {},
  ): BulkAction => ({
    label,
    action: async (ids: string[], value?: string) => {
      "use server";
      return bulkProductAction(kind, ids, value);
    },
    ...extra,
  });
  const bulkActions: BulkAction[] = [
    ...(can(user, "products.edit")
      ? [
          bulk("publish", "Publicar"),
          bulk("archive", "Arquivar", {
            confirm: "Os produtos saem da loja, mas continuam no painel.",
          }),
          bulk("category", "Mover de categoria", {
            input: { label: "Nova categoria principal", type: "select", options: categories },
          }),
          ...(collections.length
            ? [
                bulk("collection", "Adicionar a coleção", {
                  input: { label: "Coleção", type: "select", options: collections },
                }),
              ]
            : []),
          bulk("tags", "Adicionar tags", {
            input: {
              label: "Tags, separadas por vírgula",
              type: "text",
              placeholder: "presente, sala",
            },
          }),
          bulk("sameDayOn", "Ligar entrega hoje"),
          bulk("sameDayOff", "Desligar entrega hoje"),
        ]
      : []),
    ...(can(user, "products.edit_price")
      ? [
          bulk("price", "Reajustar preços", {
            confirm: "O reajuste vale para todas as variações dos produtos selecionados.",
            input: {
              label: "Reajuste em % (use sinal de menos para reduzir)",
              type: "text",
              placeholder: "10",
            },
            preview: async (ids: string[], value?: string) => {
              "use server";
              return previewPriceAdjustmentAction(ids, value);
            },
          }),
        ]
      : []),
    ...(can(user, "products.delete")
      ? [
          bulk("delete", "Excluir", {
            destructive: true,
            confirm:
              "Produtos que já foram vendidos não são excluídos: são arquivados. Os demais são apagados de vez.",
          }),
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Produtos"
        description="A nota de qualidade mostra o quanto o cadastro está completo: fotos, descrição, ficha, peso e SEO."
        actions={
          <>
            {can(user, "products.remove_samples") && sampleCount > 0 ? (
              <RemoveSamplesButton sampleCount={sampleCount} />
            ) : null}
            {can(user, "products.import") ? (
              <Button asChild variant="outline">
                <Link href="/admin/produtos/importar">Importar CSV</Link>
              </Button>
            ) : null}
            {can(user, "products.edit") ? (
              <Button asChild>
                <Link href="/admin/produtos/novo">Novo produto</Link>
              </Button>
            ) : null}
          </>
        }
      />
      <FilterBar
        searchPlaceholder="Nome, SKU, marca ou tag"
        fields={filters}
        exportHref={can(user, "products.export") ? "/admin/exportar/produtos" : undefined}
      />
      <DataTable
        label="Produtos"
        columns={columns}
        total={total}
        page={params.page}
        pageSize={params.pageSize}
        sort={order.field}
        dir={order.dir}
        bulkActions={bulkActions}
        rows={products.map((product) => {
          const cover = product.images[0] ? toMediaItem(product.images[0].media) : null;
          const prices = product.variants
            .filter((variant) => variant.isActive)
            .map((variant) => variant.priceCents);
          const first = product.variants[0];
          const low = Math.min(...prices);
          const high = Math.max(...prices);
          return {
            id: product.id,
            cells: {
              photo: cover ? (
                <Image
                  src={cover.thumb}
                  alt=""
                  width={40}
                  height={50}
                  unoptimized
                  className="h-12 w-10 rounded-sm object-cover"
                />
              ) : (
                <span className="text-xs text-muted-foreground">Sem foto</span>
              ),
              name: (
                <>
                  <Link
                    href={`/admin/produtos/${product.id}`}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {product.name}
                  </Link>
                  {product.isSample ? (
                    <span className="ml-1.5 rounded-xs bg-secondary px-1 text-xs text-muted-foreground">
                      Teste
                    </span>
                  ) : null}
                  <span className="block text-xs text-muted-foreground">
                    {product.sku}
                    {product.variants.length > 1 ? `, ${product.variants.length} variações` : ""}
                  </span>
                </>
              ),
              category: product.primaryCategory?.name ?? (
                <span className="text-muted-foreground">Sem categoria</span>
              ),
              minPriceCents:
                prices.length === 0
                  ? ""
                  : low === high
                    ? formatBRL(low)
                    : `${formatBRL(low)} a ${formatBRL(high)}`,
              totalAvailable: (
                <span className={product.totalAvailable === 0 ? "text-destructive" : undefined}>
                  {product.totalAvailable}
                </span>
              ),
              status: (
                <Badge variant={product.status === "ACTIVE" ? "default" : "secondary"}>
                  {productStatusLabels[product.status]}
                </Badge>
              ),
              qualityScore: (
                <span className={product.qualityScore < 60 ? "text-warning" : undefined}>
                  {product.qualityScore}
                </span>
              ),
              actions: first ? (
                <QuickEdit
                  variantId={first.id}
                  name={product.name}
                  price={formatCentsPlain(first.priceCents)}
                  stock={first.stockOnHand}
                  canPrice={can(user, "products.edit_price")}
                  canStock={can(user, "inventory.adjust") && availableOf(first) >= 0}
                />
              ) : null,
            },
          };
        })}
      />
    </>
  );
}
