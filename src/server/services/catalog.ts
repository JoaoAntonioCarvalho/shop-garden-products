import "server-only";
import { unstable_cache } from "next/cache";
import type { BadgeKind } from "@/components/ui/badge";
import type { ProductCardData, ProductImageData } from "@/components/store/product-card";
import { categoryHref } from "@/config/category-tree";
import type { NavItem, StoreNavigation } from "@/config/navigation";
import type { StoreSettings } from "@/config/store.config";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { normalizeText } from "@/lib/slug";
import type { IndexRow } from "./catalog-filters";
import { largestVariantUrl } from "./media";
import { getPriceDisplay, isPromoActive, type PriceDisplay } from "./pricing";

/** Tags de cache do catálogo. As ações do admin invalidam a tag correspondente. */
export const CATALOG_TAG = "catalog";
export const CATEGORIES_TAG = "categories";
export const HOME_TAG = "home";
export const productTag = (slug: string) => `product:${slug}`;

/** O cache do catálogo também expira sozinho, para promoções com data entrarem e saírem. */
const CATALOG_REVALIDATE_SECONDS = 300;

const NEW_PRODUCT_DAYS = 45;

// ───────────────────────── Imagens ─────────────────────────

type MediaRow =
  { alt: string; blurDataUrl: string | null; variants: Prisma.JsonValue } | null | undefined;

export function toImage(media: MediaRow, fallbackAlt = ""): ProductImageData | null {
  if (!media) return null;
  const url = largestVariantUrl(media.variants);
  if (!url) return null;
  return { url, alt: media.alt || fallbackAlt, blurDataUrl: media.blurDataUrl };
}

const mediaSelect = { alt: true, blurDataUrl: true, variants: true } as const;

// ───────────────────────── Categorias ─────────────────────────

export type CategoryNodeData = {
  id: string;
  name: string;
  slug: string;
  path: string;
  parentId: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoContent: string | null;
  faq: Array<{ pergunta: string; resposta: string }>;
  image: ProductImageData | null;
  isSecondary: boolean;
  showInMenu: boolean;
  showOnHome: boolean;
  filtersConfig: string[];
  position: number;
};

const loadCategories = unstable_cache(
  async (): Promise<CategoryNodeData[]> => {
    const rows = await db.category.findMany({
      where: { isActive: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: { image: { select: mediaSelect } },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      path: row.path,
      parentId: row.parentId,
      description: row.description,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      seoContent: row.seoContent,
      faq: Array.isArray(row.faq) ? (row.faq as CategoryNodeData["faq"]) : [],
      image: toImage(row.image),
      isSecondary: row.isSecondary,
      showInMenu: row.showInMenu,
      showOnHome: row.showOnHome,
      filtersConfig: Array.isArray(row.filtersConfig) ? (row.filtersConfig as string[]) : [],
      position: row.position,
    }));
  },
  ["categories"],
  { tags: [CATEGORIES_TAG] },
);

export async function getCategories(): Promise<CategoryNodeData[]> {
  return loadCategories();
}

/** Menu principal montado a partir das categorias do banco (seção 8.1). */
export async function getNavigation(): Promise<StoreNavigation> {
  const categories = await getCategories();
  const roots = categories.filter((c) => !c.parentId && c.showInMenu);
  const main: NavItem[] = [];

  for (const root of roots) {
    const children = categories.filter((c) => c.parentId === root.id && c.showInMenu);
    main.push({
      label: root.name,
      href: categoryHref(root.path),
      isSecondary: root.isSecondary,
      children: children.map((child) => ({ label: child.name, href: categoryHref(child.path) })),
      image: root.image
        ? { url: root.image.url, alt: "", caption: root.description ?? undefined }
        : undefined,
    });
    // Orquídeas é o carro-chefe e ganha atalho direto no menu.
    const orchids = children.find((child) => child.path === "plantas-naturais/orquideas");
    if (orchids) main.push({ label: orchids.name, href: categoryHref(orchids.path) });
  }
  main.push({ label: "Presentes", href: "/presentes" });
  main.push({ label: "Novidades", href: "/colecao/novidades" });

  return {
    main,
    categories: roots.map((root) => ({ label: root.name, href: categoryHref(root.path) })),
  };
}

export async function getCategoryByPath(path: string) {
  const categories = await getCategories();
  const category = categories.find((c) => c.path === path);
  if (!category) return null;
  const parent = category.parentId
    ? (categories.find((c) => c.id === category.parentId) ?? null)
    : null;
  const children = categories.filter((c) => c.parentId === category.id);
  return { category, parent, children, ids: [category.id, ...children.map((c) => c.id)] };
}

// ───────────────────────── Índice para listagens ─────────────────────────

const indexSelect = {
  id: true,
  primaryCategoryId: true,
  tags: true,
  minPriceCents: true,
  totalAvailable: true,
  sameDayEligible: true,
  ratingAverage: true,
  ratingCount: true,
  salesCount30d: true,
  publishedAt: true,
  isFeatured: true,
  isNew: true,
  isGiftable: true,
  productType: true,
  light: true,
  environment: true,
  petSafety: true,
  careLevel: true,
  heightCm: true,
  material: true,
  color: true,
  mouthDiameterCm: true,
  hasDrainageHole: true,
  indoorOutdoor: true,
  subtype: true,
  includesPot: true,
  brand: true,
  additionalCategories: { select: { id: true } },
  variants: {
    where: { isActive: true },
    select: {
      priceCents: true,
      compareAtPriceCents: true,
      promoPriceCents: true,
      promoStartsAt: true,
      promoEndsAt: true,
    },
  },
} satisfies Prisma.ProductSelect;

export type CatalogRow = IndexRow & {
  categoryIds: string[];
  tags: string[];
  isGiftable: boolean;
  productType: string;
};

/**
 * Índice leve de todos os produtos ativos. Uma consulta, em cache, serve todas as listagens:
 * categoria, coleção, busca e vitrines filtram e ordenam em memória (ver catalog-filters.ts).
 */
const loadCatalogIndex = unstable_cache(
  async (): Promise<CatalogRow[]> => {
    const now = new Date();
    const rows = await db.product.findMany({ where: { status: "ACTIVE" }, select: indexSelect });
    return rows.map((row) => ({
      id: row.id,
      categoryIds: [row.primaryCategoryId, ...row.additionalCategories.map((c) => c.id)].filter(
        (id): id is string => Boolean(id),
      ),
      tags: row.tags,
      isGiftable: row.isGiftable,
      productType: row.productType,
      minPriceCents: row.minPriceCents,
      totalAvailable: row.totalAvailable,
      sameDayEligible: row.sameDayEligible,
      ratingAverage: row.ratingAverage,
      ratingCount: row.ratingCount,
      salesCount30d: row.salesCount30d,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      isFeatured: row.isFeatured,
      isNew: row.isNew,
      onSale: row.variants.some(
        (v) => isPromoActive(v, now) || (v.compareAtPriceCents ?? 0) > v.priceCents,
      ),
      light: row.light,
      environment: row.environment,
      petSafety: row.petSafety,
      careLevel: row.careLevel,
      heightCm: row.heightCm,
      material: row.material,
      color: row.color,
      mouthDiameterCm: row.mouthDiameterCm,
      hasDrainageHole: row.hasDrainageHole,
      indoorOutdoor: row.indoorOutdoor,
      subtype: row.subtype,
      includesPot: row.includesPot,
      brand: row.brand,
    }));
  },
  ["catalog-index"],
  { tags: [CATALOG_TAG], revalidate: CATALOG_REVALIDATE_SECONDS },
);

export async function getCatalogIndex(): Promise<CatalogRow[]> {
  return loadCatalogIndex();
}

export function isRecent(
  publishedAt: string | Date | null,
  days: number,
  now: Date = new Date(),
): boolean {
  if (!publishedAt) return false;
  const time = typeof publishedAt === "string" ? Date.parse(publishedAt) : publishedAt.getTime();
  return now.getTime() - time <= days * 86_400_000;
}

export type CollectionRule =
  | { kind: "new"; days?: number }
  | { kind: "bestsellers" }
  | { kind: "category"; path: string }
  | { kind: "tag"; tag: string }
  | { kind: "sale" };

/** Aplica a regra de uma coleção ao índice. A ordem devolvida é a ordem padrão da coleção. */
export async function resolveCollectionRows(
  rule: CollectionRule,
  index: CatalogRow[],
  limit = 200,
): Promise<CatalogRow[]> {
  switch (rule.kind) {
    case "new":
      return index
        .filter((row) => row.isNew || isRecent(row.publishedAt, rule.days ?? NEW_PRODUCT_DAYS))
        .sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""))
        .slice(0, limit);
    case "bestsellers": {
      const sold = index.filter((row) => row.salesCount30d > 0 && row.totalAvailable > 0);
      // Sem vendas suficientes, completa com os destaques.
      const pool =
        sold.length >= 8
          ? sold
          : [...sold, ...index.filter((row) => row.isFeatured && !sold.includes(row))];
      return pool.sort((a, b) => b.salesCount30d - a.salesCount30d).slice(0, Math.min(limit, 48));
    }
    case "category": {
      const found = await getCategoryByPath(rule.path);
      return found
        ? index
            .filter((row) => row.categoryIds.some((id) => found.ids.includes(id)))
            .slice(0, limit)
        : [];
    }
    case "tag":
      return index.filter((row) => row.tags.includes(rule.tag)).slice(0, limit);
    case "sale":
      return index.filter((row) => row.onSale).slice(0, limit);
  }
}

// ───────────────────────── Cards ─────────────────────────

const cardSelect = {
  id: true,
  slug: true,
  name: true,
  sku: true,
  scientificName: true,
  isNew: true,
  publishedAt: true,
  sameDayEligible: true,
  ratingAverage: true,
  ratingCount: true,
  primaryCategory: { select: { name: true } },
  images: {
    orderBy: [{ isCover: "desc" }, { position: "asc" }],
    take: 2,
    select: { media: { select: mediaSelect } },
  },
  variants: {
    where: { isActive: true },
    orderBy: { position: "asc" },
    select: {
      id: true,
      priceCents: true,
      compareAtPriceCents: true,
      promoPriceCents: true,
      promoStartsAt: true,
      promoEndsAt: true,
      stockOnHand: true,
      stockReserved: true,
      lowStockThreshold: true,
    },
  },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

export const availableOf = (variant: { stockOnHand: number; stockReserved: number }) =>
  Math.max(0, variant.stockOnHand - variant.stockReserved);

/** Variante usada para exibir preço: a mais barata entre as disponíveis (ou entre todas, se esgotado). */
export function pickDisplayVariant<
  T extends { priceCents: number; stockOnHand: number; stockReserved: number },
>(variants: T[], priceOf: (variant: T) => number): T | undefined {
  const inStock = variants.filter((variant) => availableOf(variant) > 0);
  const pool = inStock.length ? inStock : variants;
  return [...pool].sort((a, b) => priceOf(a) - priceOf(b))[0];
}

const emptyPrice: PriceDisplay = {
  priceCents: 0,
  compareAtCents: null,
  discountPercent: null,
  onPromotion: false,
  promoEndsAt: null,
  pixCents: 0,
  pixDiscountPercent: 0,
  installments: null,
};

export function toCard(
  row: CardRow,
  settings: StoreSettings,
  now: Date = new Date(),
): ProductCardData {
  const priced = row.variants.map((variant) => ({
    variant,
    price: getPriceDisplay(variant, settings, now),
  }));
  const display = pickDisplayVariant(
    row.variants,
    (variant) => priced.find((item) => item.variant === variant)!.price.priceCents,
  );
  const price = priced.find((item) => item.variant === display)?.price ?? emptyPrice;
  const totalAvailable = row.variants.reduce((sum, variant) => sum + availableOf(variant), 0);
  const soldOut = totalAvailable <= 0;
  const available = row.variants.filter((variant) => availableOf(variant) > 0);

  const badges: BadgeKind[] = [];
  if (soldOut) badges.push("soldOut");
  if (price.discountPercent) badges.push("sale");
  if (!soldOut && row.sameDayEligible && settings.sameDay.enabled) badges.push("sameDay");
  if (row.isNew || isRecent(row.publishedAt, NEW_PRODUCT_DAYS, now)) badges.push("new");
  if (!soldOut && display && totalAvailable <= display.lowStockThreshold) badges.push("lowStock");

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    sku: row.sku,
    categoryName: row.primaryCategory?.name,
    scientificName: row.scientificName,
    image: toImage(row.images[0]?.media, row.name),
    hoverImage: toImage(row.images[1]?.media),
    price,
    ratingAverage: row.ratingAverage,
    ratingCount: row.ratingCount,
    badges,
    quickAddVariantId: row.variants.length === 1 && available.length === 1 ? available[0].id : null,
    hasOptions: row.variants.length > 1,
    soldOut,
  };
}

/** Cards na ordem dos ids recebidos. Uma consulta, sem cache, para o estoque estar sempre certo. */
export async function getCards(ids: string[], settings: StoreSettings): Promise<ProductCardData[]> {
  if (ids.length === 0) return [];
  const rows = await db.product.findMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    select: cardSelect,
  });
  const now = new Date();
  const byId = new Map(rows.map((row) => [row.id, toCard(row, settings, now)]));
  return ids.map((id) => byId.get(id)).filter((card): card is ProductCardData => Boolean(card));
}

// ───────────────────────── Busca ─────────────────────────

const SEARCH_LIMIT = 300;

/**
 * Busca sem acento e tolerante a erros leves de digitação (unaccent + pg_trgm). Cada palavra do
 * termo precisa aparecer no texto de busca do produto, por trecho exato ou por similaridade.
 */
export async function searchProductScores(term: string): Promise<Map<string, number>> {
  const tokens = normalizeText(term)
    .split(" ")
    .filter((token) => token.length >= 2)
    .slice(0, 6);
  if (tokens.length === 0) return new Map();

  const rows = await db.$queryRaw<Array<{ id: string; score: number }>>`
    SELECT p.id,
      (SELECT SUM(GREATEST(word_similarity(t, p."searchText"), CASE WHEN p."searchText" LIKE '%' || t || '%' THEN 1 ELSE 0 END))
         FROM unnest(${tokens}::text[]) AS t)::float AS score
    FROM "Product" p
    WHERE p.status = 'ACTIVE'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(${tokens}::text[]) AS t
        WHERE NOT (p."searchText" LIKE '%' || t || '%' OR word_similarity(t, p."searchText") >= 0.45)
      )
    ORDER BY score DESC
    LIMIT ${SEARCH_LIMIT}`;
  return new Map(rows.map((row) => [row.id, row.score]));
}

/** Termos parecidos já buscados com resultado, para sugerir quando a busca não encontra nada. */
export async function suggestSearchTerms(term: string): Promise<string[]> {
  const normalized = normalizeText(term);
  if (normalized.length < 3) return [];
  const rows = await db.$queryRaw<Array<{ term: string }>>`
    SELECT term FROM "SearchLog"
    WHERE "resultsCount" > 0 AND term <> ${normalized} AND similarity(term, ${normalized}) > 0.25
    ORDER BY similarity(term, ${normalized}) DESC, count DESC
    LIMIT 4`;
  return rows.map((row) => row.term);
}

/** Registra o termo buscado, para os relatórios de buscas e de buscas sem resultado. */
export async function logSearch(term: string, resultsCount: number): Promise<void> {
  const normalized = normalizeText(term).slice(0, 80);
  if (normalized.length < 2) return;
  await db.searchLog.upsert({
    where: { term: normalized },
    create: { term: normalized, resultsCount },
    update: { resultsCount, count: { increment: 1 }, lastSearchedAt: new Date() },
  });
}

/** Categorias cujo nome combina com o termo (para as sugestões da busca). */
export async function searchCategories(term: string, limit = 3) {
  const normalized = normalizeText(term);
  const categories = await getCategories();
  return categories
    .filter((category) => normalizeText(category.name).includes(normalized))
    .slice(0, limit)
    .map((category) => ({ name: category.name, href: categoryHref(category.path) }));
}

// ───────────────────────── Produto ─────────────────────────

const productDetailInclude = {
  primaryCategory: {
    select: { id: true, name: true, path: true, parent: { select: { name: true, path: true } } },
  },
  images: {
    orderBy: [{ isCover: "desc" }, { position: "asc" }],
    select: {
      id: true,
      variantId: true,
      media: { select: { ...mediaSelect, width: true, height: true } },
    },
  },
  deliveryArea: { select: { name: true } },
  variants: { where: { isActive: true }, orderBy: { position: "asc" } },
} satisfies Prisma.ProductInclude;

export type ProductDetail = Prisma.ProductGetPayload<{ include: typeof productDetailInclude }>;

/** Produto completo pelo slug, em qualquer status. Quem chama decide o que fazer com rascunho e arquivado. */
export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  return db.product.findUnique({ where: { slug }, include: productDetailInclude });
}

export const REVIEWS_PAGE_SIZE = 6;

export async function getProductReviews(productId: string, page: number) {
  const where = { productId, status: "APPROVED" } as const;
  const [reviews, distribution] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * REVIEWS_PAGE_SIZE,
      take: REVIEWS_PAGE_SIZE,
      select: {
        id: true,
        authorName: true,
        authorCity: true,
        rating: true,
        title: true,
        body: true,
        isVerifiedPurchase: true,
        adminReply: true,
        repliedAt: true,
        createdAt: true,
      },
    }),
    db.review.groupBy({ by: ["rating"], where, _count: { _all: true } }),
  ]);
  const counts = new Map(distribution.map((item) => [item.rating, item._count._all]));
  const total = distribution.reduce((sum, item) => sum + item._count._all, 0);
  return {
    reviews,
    total,
    totalPages: Math.max(1, Math.ceil(total / REVIEWS_PAGE_SIZE)),
    distribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: counts.get(rating) ?? 0 })),
  };
}

/**
 * "Combina com": primeiro os relacionados escolhidos no admin; depois a regra automática
 * (planta → cachepots e substratos; vaso ou cachepot → plantas; arranjo → arranjos de preço parecido;
 * demais → mesma categoria).
 */
export async function getRelatedCards(
  product: {
    id: string;
    productType: string;
    primaryCategoryId: string | null;
    relatedProductIds: string[];
    minPriceCents: number;
  },
  settings: StoreSettings,
  limit = 4,
): Promise<ProductCardData[]> {
  const index = await getCatalogIndex();
  const candidates = index.filter((row) => row.id !== product.id && row.totalAvailable > 0);
  const bySales = (a: CatalogRow, b: CatalogRow) =>
    b.salesCount30d - a.salesCount30d || b.ratingCount - a.ratingCount;
  const ofType = (...types: string[]) =>
    candidates.filter((row) => types.includes(row.productType)).sort(bySales);

  let automatic: CatalogRow[];
  switch (product.productType) {
    case "NATURAL_PLANT":
    case "ORCHID":
      automatic = [...ofType("CACHEPOT").slice(0, 3), ...ofType("GARDEN_SUPPLY").slice(0, 2)];
      break;
    case "POT":
    case "CACHEPOT":
      automatic = ofType("NATURAL_PLANT", "ORCHID");
      break;
    case "ARRANGEMENT":
      automatic = ofType("ARRANGEMENT", "ARTIFICIAL").sort(
        (a, b) =>
          Math.abs(a.minPriceCents - product.minPriceCents) -
          Math.abs(b.minPriceCents - product.minPriceCents),
      );
      break;
    default:
      automatic = candidates
        .filter(
          (row) => product.primaryCategoryId && row.categoryIds.includes(product.primaryCategoryId),
        )
        .sort(bySales);
  }

  const ids = [...new Set([...product.relatedProductIds, ...automatic.map((row) => row.id)])]
    .filter((id) => id !== product.id)
    .slice(0, limit + 2);
  return (await getCards(ids, settings)).filter((card) => !card.soldOut).slice(0, limit);
}

/** Produtos da mesma categoria, para a página de produto arquivado. */
export async function getSimilarCards(
  categoryId: string | null,
  excludeId: string,
  settings: StoreSettings,
  limit = 4,
) {
  const index = await getCatalogIndex();
  const ids = index
    .filter(
      (row) =>
        row.id !== excludeId &&
        row.totalAvailable > 0 &&
        (!categoryId || row.categoryIds.includes(categoryId)),
    )
    .sort((a, b) => b.salesCount30d - a.salesCount30d)
    .slice(0, limit)
    .map((row) => row.id);
  return getCards(ids, settings);
}

/** Cards por slug, na ordem pedida (vistos recentemente). */
export async function getCardsBySlugs(
  slugs: string[],
  settings: StoreSettings,
): Promise<ProductCardData[]> {
  if (slugs.length === 0) return [];
  const rows = await db.product.findMany({
    where: { slug: { in: slugs }, status: "ACTIVE" },
    select: cardSelect,
  });
  const now = new Date();
  const bySlug = new Map(rows.map((row) => [row.slug, toCard(row, settings, now)]));
  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((card): card is ProductCardData => Boolean(card));
}

// ───────────────────────── Coleções e ocasiões ─────────────────────────

export async function getCollectionBySlug(slug: string) {
  return db.collection.findFirst({
    where: { slug, isActive: true },
    include: {
      image: { select: mediaSelect },
      products: { orderBy: { position: "asc" }, select: { productId: true } },
    },
  });
}

const loadOccasions = unstable_cache(
  async () => {
    const rows = await db.occasion.findMany({
      where: { isActive: true },
      orderBy: { position: "asc" },
      include: { image: { select: mediaSelect } },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      tag: row.tag,
      image: toImage(row.image),
    }));
  },
  ["occasions"],
  { tags: [HOME_TAG] },
);

export async function getOccasions() {
  return loadOccasions();
}

/** Nota média e total de avaliações aprovadas de toda a loja. */
export const getStoreRating = unstable_cache(
  async () => {
    const result = await db.review.aggregate({
      where: { status: "APPROVED" },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return { average: result._avg.rating ?? 0, count: result._count._all };
  },
  ["store-rating"],
  { tags: [HOME_TAG], revalidate: 600 },
);
