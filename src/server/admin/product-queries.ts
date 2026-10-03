import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatCentsPlain } from "@/lib/money";
import { normalizeText } from "@/lib/slug";
import type { ImageRow, ProductFormData, VariantRow } from "@/components/admin/product-form";
import { toDateTimeInput } from "./fields";
import type { ListParams } from "./list";
import { toMediaItem } from "./media";

/** Categorias como opções de formulário, com o caminho completo no rótulo. */
export async function categoryOptions(): Promise<Array<{ value: string; label: string }>> {
  const categories = await db.category.findMany({
    orderBy: { path: "asc" },
    select: { id: true, name: true, parentId: true },
  });
  const byId = new Map(categories.map((category) => [category.id, category]));
  return categories.map((category) => {
    const parent = category.parentId ? byId.get(category.parentId) : null;
    return {
      value: category.id,
      label: parent ? `${parent.name} › ${category.name}` : category.name,
    };
  });
}

export async function deliveryAreaOptions(): Promise<Array<{ value: string; label: string }>> {
  const areas = await db.deliveryArea.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return areas.map((area) => ({ value: area.id, label: area.name }));
}

export async function collectionOptions(
  onlyManual = true,
): Promise<Array<{ value: string; label: string }>> {
  const collections = await db.collection.findMany({
    where: onlyManual ? { type: "MANUAL" } : {},
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return collections.map((collection) => ({ value: collection.id, label: collection.name }));
}

/** Filtros da lista de produtos (seção 12.5). */
export async function productWhere(params: ListParams): Promise<Prisma.ProductWhereInput> {
  const f = params.filters;
  const and: Prisma.ProductWhereInput[] = [];
  if (params.q)
    and.push({
      OR: [
        { searchText: { contains: normalizeText(params.q) } },
        { variants: { some: { sku: { contains: params.q.toUpperCase() } } } },
      ],
    });
  if (["DRAFT", "ACTIVE", "ARCHIVED"].includes(f.status)) and.push({ status: f.status as never });
  if (f.categoria)
    and.push({
      OR: [
        { primaryCategoryId: f.categoria },
        { primaryCategory: { parentId: f.categoria } },
        { additionalCategories: { some: { id: f.categoria } } },
      ],
    });
  if (f.tipo) and.push({ productType: f.tipo as never });
  if (f.estoque === "sem") and.push({ totalAvailable: 0 });
  if (f.estoque === "ok") and.push({ totalAvailable: { gt: 0 } });
  if (f.estoque === "baixo") {
    const rows = await db.$queryRaw<Array<{ productId: string }>>`
      SELECT DISTINCT "productId" FROM "ProductVariant"
      WHERE "isActive" AND "stockOnHand" - "stockReserved" > 0 AND "stockOnHand" - "stockReserved" <= "lowStockThreshold"`;
    and.push({ id: { in: rows.map((row) => row.productId) } });
  }
  if (f["sem-imagem"] === "1") and.push({ images: { none: {} } });
  if (f["sem-descricao"] === "1") and.push({ OR: [{ description: null }, { description: "" }] });
  const quality = Number(f.qualidade);
  if (Number.isFinite(quality) && quality > 0) and.push({ qualityScore: { lt: quality } });
  if (f.teste === "1") and.push({ isSample: true });
  if (f.teste === "0") and.push({ isSample: false });
  if (f.promocao === "1") {
    const now = new Date();
    and.push({
      variants: {
        some: {
          promoPriceCents: { not: null },
          AND: [
            { OR: [{ promoStartsAt: null }, { promoStartsAt: { lte: now } }] },
            { OR: [{ promoEndsAt: null }, { promoEndsAt: { gte: now } }] },
          ],
        },
      },
    });
  }
  return and.length ? { AND: and } : {};
}

const money = (cents: number | null | undefined) => (cents == null ? "" : formatCentsPlain(cents));
const text = (value: unknown) => (value == null ? "" : String(value));
const triState = (value: boolean | null) => (value == null ? "" : String(value));

/** Produto no formato do formulário (tudo como texto de campo). */
export async function loadProductForm(id: string): Promise<ProductFormData | null> {
  const product = await db.product.findUnique({
    where: { id },
    include: {
      variants: { orderBy: { position: "asc" } },
      images: {
        orderBy: { position: "asc" },
        include: { media: true, variant: { select: { sku: true } } },
      },
      additionalCategories: { select: { id: true } },
      collections: { select: { collectionId: true } },
    },
  });
  if (!product) return null;
  const related = product.relatedProductIds.length
    ? await db.product.findMany({
        where: { id: { in: product.relatedProductIds } },
        select: { id: true, name: true },
      })
    : [];
  const variants: VariantRow[] = product.variants.map((variant) => ({
    key: variant.id,
    id: variant.id,
    name: variant.name,
    sku: variant.sku,
    options: (variant.options ?? {}) as Record<string, string>,
    priceCents: money(variant.priceCents),
    compareAtPriceCents: money(variant.compareAtPriceCents),
    costCents: money(variant.costCents),
    promoPriceCents: money(variant.promoPriceCents),
    promoStartsAt: toDateTimeInput(variant.promoStartsAt),
    promoEndsAt: toDateTimeInput(variant.promoEndsAt),
    weightGrams: String(variant.weightGrams),
    stockOnHand: String(variant.stockOnHand),
    lowStockThreshold: String(variant.lowStockThreshold),
    barcode: variant.barcode ?? "",
    isActive: variant.isActive,
  }));
  const images: ImageRow[] = product.images.map((image) => ({
    mediaId: image.mediaId,
    url: toMediaItem(image.media).thumb,
    alt: image.media.alt,
    isCover: image.isCover,
    variantSku: image.variant?.sku ?? "",
  }));
  return {
    id: product.id,
    wasPublished: Boolean(product.publishedAt),
    variants,
    images,
    related: product.relatedProductIds
      .map((relatedId) => related.find((item) => item.id === relatedId))
      .filter((item) => item != null),
    values: {
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      productType: product.productType,
      status: product.status,
      primaryCategoryId: product.primaryCategoryId ?? "",
      additionalCategoryIds: product.additionalCategories.map((category) => category.id),
      collectionIds: product.collections.map((item) => item.collectionId),
      brand: text(product.brand),
      tags: product.tags.join(", "),
      shortDescription: text(product.shortDescription),
      description: text(product.description),
      careInstructions: text(product.careInstructions),
      isFeatured: product.isFeatured,
      isNew: product.isNew,
      isGiftable: product.isGiftable,
      commonName: text(product.commonName),
      scientificName: text(product.scientificName),
      light: text(product.light),
      watering: text(product.watering),
      environment: text(product.environment),
      petSafety: text(product.petSafety),
      careLevel: text(product.careLevel),
      heightCm: text(product.heightCm),
      material: text(product.material),
      color: text(product.color),
      widthCm: text(product.widthCm),
      depthCm: text(product.depthCm),
      mouthDiameterCm: text(product.mouthDiameterCm),
      baseDiameterCm: text(product.baseDiameterCm),
      capacityLiters: text(product.capacityLiters),
      hasDrainageHole: triState(product.hasDrainageHole),
      indoorOutdoor: text(product.indoorOutdoor),
      includesPot: triState(product.includesPot),
      cleaningCare: text(product.cleaningCare),
      subtype: text(product.subtype),
      sameDayEligible: product.sameDayEligible,
      deliveryScope: product.deliveryScope,
      carrierRestriction: product.carrierRestriction,
      deliveryAreaId: product.deliveryAreaId ?? "",
      fragile: product.fragile,
      perishable: product.perishable,
      seoTitle: text(product.seoTitle),
      seoDescription: text(product.seoDescription),
    },
  };
}

export function emptyProductForm(): ProductFormData {
  return {
    id: null,
    wasPublished: false,
    images: [],
    related: [],
    variants: [
      {
        key: "nova-0",
        id: null,
        name: "Padrão",
        sku: "",
        options: {},
        priceCents: "",
        compareAtPriceCents: "",
        costCents: "",
        promoPriceCents: "",
        promoStartsAt: "",
        promoEndsAt: "",
        weightGrams: "0",
        stockOnHand: "0",
        lowStockThreshold: "3",
        barcode: "",
        isActive: true,
      },
    ],
    values: {
      name: "",
      slug: "",
      sku: "",
      productType: "NATURAL_PLANT",
      status: "DRAFT",
      primaryCategoryId: "",
      additionalCategoryIds: [],
      collectionIds: [],
      brand: "",
      tags: "",
      shortDescription: "",
      description: "",
      careInstructions: "",
      isFeatured: false,
      isNew: true,
      isGiftable: false,
      commonName: "",
      scientificName: "",
      light: "",
      watering: "",
      environment: "",
      petSafety: "",
      careLevel: "",
      heightCm: "",
      material: "",
      color: "",
      widthCm: "",
      depthCm: "",
      mouthDiameterCm: "",
      baseDiameterCm: "",
      capacityLiters: "",
      hasDrainageHole: "",
      indoorOutdoor: "",
      includesPot: "",
      cleaningCare: "",
      subtype: "",
      sameDayEligible: false,
      deliveryScope: "NATIONAL",
      carrierRestriction: "ANY",
      deliveryAreaId: "",
      fragile: false,
      perishable: false,
      seoTitle: "",
      seoDescription: "",
    },
  };
}
