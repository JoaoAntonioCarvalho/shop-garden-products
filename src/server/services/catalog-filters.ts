import { slugify } from "@/lib/slug";

/**
 * Filtros, ordenação e facetas das listagens (categoria, coleção, busca). Tudo aqui é função pura
 * sobre linhas leves de produto: a listagem carrega o índice da categoria (em cache), filtra e
 * ordena em memória e só então busca os cards da página pedida.
 */

/** Linha leve de produto, com o necessário para filtrar e ordenar. Datas em ISO (vem do cache). */
export type IndexRow = {
  id: string;
  minPriceCents: number;
  totalAvailable: number;
  sameDayEligible: boolean;
  ratingAverage: number;
  ratingCount: number;
  salesCount30d: number;
  publishedAt: string | null;
  isFeatured: boolean;
  isNew: boolean;
  onSale: boolean;
  light: string | null;
  environment: string | null;
  petSafety: string | null;
  careLevel: string | null;
  heightCm: number | null;
  material: string | null;
  color: string | null;
  mouthDiameterCm: number | null;
  hasDrainageHole: boolean | null;
  indoorOutdoor: string | null;
  subtype: string | null;
  includesPot: boolean | null;
  brand: string | null;
  /** Só na busca: quanto o produto combina com o termo. */
  score?: number;
};

export const SORT_OPTIONS = [
  { value: "relevancia", label: "Relevância" },
  { value: "mais-vendidos", label: "Mais vendidos" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
  { value: "novidades", label: "Novidades" },
  { value: "melhor-avaliados", label: "Melhor avaliados" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export const PAGE_SIZE = 24;

export type Filters = {
  priceMin: number | null;
  priceMax: number | null;
  inStock: boolean;
  sameDay: boolean;
  onSale: boolean;
  minRating: number | null;
  luz: string[];
  ambiente: string[];
  pet: boolean;
  cuidado: string[];
  porte: string[];
  material: string[];
  cor: string[];
  altura: string[];
  boca: string[];
  furo: boolean;
  uso: string[];
  tipo: string[];
  vaso: string[];
  marca: string[];
};

export type ListingQuery = { filters: Filters; sort: SortValue; page: number };

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const list = (value: string | string[] | undefined) =>
  (first(value) ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const lightValues: Record<string, string> = {
  "sol-pleno": "FULL_SUN",
  "meia-sombra": "PARTIAL_SHADE",
  sombra: "SHADE",
  "luz-indireta": "INDIRECT_LIGHT",
};
const environmentValues: Record<string, string> = { interno: "INDOOR", externo: "OUTDOOR" };
const careValues: Record<string, string> = {
  facil: "EASY",
  moderado: "MODERATE",
  "exige-atencao": "DEMANDING",
};

export const filterLabels = {
  luz: {
    "sol-pleno": "Sol pleno",
    "meia-sombra": "Meia-sombra",
    sombra: "Sombra",
    "luz-indireta": "Luz indireta",
  },
  ambiente: { interno: "Interno", externo: "Externo" },
  cuidado: { facil: "Fácil", moderado: "Moderado", "exige-atencao": "Exige atenção" },
  porte: {
    pequeno: "Pequeno, até 30 cm",
    medio: "Médio, de 30 a 70 cm",
    grande: "Grande, acima de 70 cm",
  },
  altura: { "ate-20": "Até 20 cm", "20-40": "De 20 a 40 cm", "acima-40": "Acima de 40 cm" },
  boca: { "ate-15": "Até 15 cm", "15-25": "De 15 a 25 cm", "acima-25": "Acima de 25 cm" },
  uso: { interno: "Interno", externo: "Externo" },
  vaso: { "com-vaso": "Com vaso", "sem-vaso": "Sem vaso" },
} as const;

const ranges: Record<string, Record<string, [number, number]>> = {
  porte: { pequeno: [0, 30], medio: [30, 70], grande: [70, Infinity] },
  altura: { "ate-20": [0, 20], "20-40": [20, 40], "acima-40": [40, Infinity] },
  boca: { "ate-15": [0, 15], "15-25": [15, 25], "acima-25": [25, Infinity] },
};

export function parseListingQuery(params: RawParams): ListingQuery {
  const [min, max] = (first(params.preco) ?? "").split("-").map((part) => Number(part));
  const sort = first(params.ordem);
  const page = Number(first(params.pagina));
  const rating = Number(first(params.nota));

  return {
    filters: {
      priceMin: Number.isFinite(min) && min > 0 ? Math.round(min * 100) : null,
      priceMax: Number.isFinite(max) && max > 0 ? Math.round(max * 100) : null,
      inStock: first(params.estoque) === "1",
      sameDay: first(params.hoje) === "1",
      onSale: first(params.promo) === "1",
      minRating: rating >= 1 && rating <= 5 ? rating : null,
      luz: list(params.luz).filter((value) => value in lightValues),
      ambiente: list(params.ambiente).filter((value) => value in environmentValues),
      pet: first(params.pet) === "1",
      cuidado: list(params.cuidado).filter((value) => value in careValues),
      porte: list(params.porte).filter((value) => value in ranges.porte),
      material: list(params.material),
      cor: list(params.cor),
      altura: list(params.altura).filter((value) => value in ranges.altura),
      boca: list(params.boca).filter((value) => value in ranges.boca),
      furo: first(params.furo) === "1",
      uso: list(params.uso).filter((value) => value in environmentValues),
      tipo: list(params.tipo),
      vaso: list(params.vaso).filter((value) => value === "com-vaso" || value === "sem-vaso"),
      marca: list(params.marca),
    },
    sort: SORT_OPTIONS.some((option) => option.value === sort) ? (sort as SortValue) : "relevancia",
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** Quantos filtros estão ativos (para o botão "Filtrar" e para decidir o noindex). */
export function countActiveFilters(filters: Filters): number {
  let count = 0;
  for (const value of Object.values(filters)) {
    if (Array.isArray(value)) count += value.length;
    else if (typeof value === "boolean") count += value ? 1 : 0;
    else if (value !== null) count += 1;
  }
  // Preço mínimo e máximo contam como um filtro só.
  if (filters.priceMin !== null && filters.priceMax !== null) count -= 1;
  return count;
}

/** Monta a query string a partir do estado, omitindo o que está no padrão. */
export function buildListingSearch(
  query: ListingQuery,
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams(extra);
  const { filters } = query;
  if (filters.priceMin !== null || filters.priceMax !== null) {
    params.set(
      "preco",
      `${filters.priceMin !== null ? filters.priceMin / 100 : 0}-${filters.priceMax !== null ? filters.priceMax / 100 : ""}`,
    );
  }
  if (filters.inStock) params.set("estoque", "1");
  if (filters.sameDay) params.set("hoje", "1");
  if (filters.onSale) params.set("promo", "1");
  if (filters.minRating) params.set("nota", String(filters.minRating));
  if (filters.pet) params.set("pet", "1");
  if (filters.furo) params.set("furo", "1");
  for (const key of [
    "luz",
    "ambiente",
    "cuidado",
    "porte",
    "material",
    "cor",
    "altura",
    "boca",
    "uso",
    "tipo",
    "vaso",
    "marca",
  ] as const) {
    if (filters[key].length) params.set(key, filters[key].join(","));
  }
  if (query.sort !== "relevancia") params.set("ordem", query.sort);
  if (query.page > 1) params.set("pagina", String(query.page));
  const text = params.toString();
  return text ? `?${text}` : "";
}

const inRanges = (value: number | null, keys: string[], group: string) =>
  value !== null &&
  keys.some(
    (key) =>
      value >= ranges[group][key][0] &&
      (value < ranges[group][key][1] || ranges[group][key][1] === Infinity),
  );

const matchesSlug = (value: string | null, slugs: string[]) =>
  value !== null && slugs.includes(slugify(value));

/** Interno e externo também aceitam o valor "ambos". */
const matchesPlace = (value: string | null, keys: string[]) =>
  value !== null && keys.some((key) => value === environmentValues[key] || value === "BOTH");

export function applyFilters(rows: IndexRow[], filters: Filters): IndexRow[] {
  return rows.filter((row) => {
    if (filters.priceMin !== null && row.minPriceCents < filters.priceMin) return false;
    if (filters.priceMax !== null && row.minPriceCents > filters.priceMax) return false;
    if (filters.inStock && row.totalAvailable <= 0) return false;
    if (filters.sameDay && !(row.sameDayEligible && row.totalAvailable > 0)) return false;
    if (filters.onSale && !row.onSale) return false;
    if (
      filters.minRating !== null &&
      !(row.ratingCount > 0 && row.ratingAverage >= filters.minRating)
    )
      return false;
    if (filters.luz.length && !filters.luz.some((key) => row.light === lightValues[key]))
      return false;
    if (filters.ambiente.length && !matchesPlace(row.environment, filters.ambiente)) return false;
    if (filters.pet && row.petSafety !== "SAFE") return false;
    if (filters.cuidado.length && !filters.cuidado.some((key) => row.careLevel === careValues[key]))
      return false;
    if (filters.porte.length && !inRanges(row.heightCm, filters.porte, "porte")) return false;
    if (filters.material.length && !matchesSlug(row.material, filters.material)) return false;
    if (filters.cor.length && !matchesSlug(row.color, filters.cor)) return false;
    if (filters.altura.length && !inRanges(row.heightCm, filters.altura, "altura")) return false;
    if (filters.boca.length && !inRanges(row.mouthDiameterCm, filters.boca, "boca")) return false;
    if (filters.furo && row.hasDrainageHole !== true) return false;
    if (filters.uso.length && !matchesPlace(row.indoorOutdoor, filters.uso)) return false;
    if (filters.tipo.length && !matchesSlug(row.subtype, filters.tipo)) return false;
    if (filters.vaso.length) {
      const wanted = filters.vaso.map((key) => key === "com-vaso");
      if (row.includesPot === null || !wanted.includes(row.includesPot)) return false;
    }
    if (filters.marca.length && !matchesSlug(row.brand, filters.marca)) return false;
    return true;
  });
}

export function sortRows(rows: IndexRow[], sort: SortValue): IndexRow[] {
  const published = (row: IndexRow) => (row.publishedAt ? Date.parse(row.publishedAt) : 0);
  // Esgotados sempre vão para o fim, em qualquer ordenação.
  const soldOutLast = (a: IndexRow, b: IndexRow) =>
    Number(a.totalAvailable <= 0) - Number(b.totalAvailable <= 0);
  const comparators: Record<SortValue, (a: IndexRow, b: IndexRow) => number> = {
    relevancia: (a, b) =>
      (b.score ?? 0) - (a.score ?? 0) ||
      Number(b.isFeatured) - Number(a.isFeatured) ||
      b.salesCount30d - a.salesCount30d ||
      published(b) - published(a),
    "mais-vendidos": (a, b) => b.salesCount30d - a.salesCount30d || b.ratingCount - a.ratingCount,
    "menor-preco": (a, b) => a.minPriceCents - b.minPriceCents,
    "maior-preco": (a, b) => b.minPriceCents - a.minPriceCents,
    novidades: (a, b) => published(b) - published(a),
    "melhor-avaliados": (a, b) =>
      b.ratingAverage - a.ratingAverage || b.ratingCount - a.ratingCount,
  };
  return [...rows].sort(
    (a, b) => soldOutLast(a, b) || comparators[sort](a, b) || a.id.localeCompare(b.id),
  );
}

export type FacetOption = { value: string; label: string; count: number };

export type Facets = {
  priceMinCents: number;
  priceMaxCents: number;
  material: FacetOption[];
  cor: FacetOption[];
  tipo: FacetOption[];
  marca: FacetOption[];
};

function countBy(rows: IndexRow[], pick: (row: IndexRow) => string | null): FacetOption[] {
  const counts = new Map<string, FacetOption>();
  for (const row of rows) {
    const label = pick(row);
    if (!label) continue;
    const value = slugify(label);
    const current = counts.get(value);
    if (current) current.count += 1;
    else
      counts.set(value, { value, label: label.charAt(0).toUpperCase() + label.slice(1), count: 1 });
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"),
  );
}

/** Opções de filtro que existem no conjunto (antes de filtrar), com contagem. */
export function buildFacets(rows: IndexRow[]): Facets {
  const prices = rows.map((row) => row.minPriceCents).filter((price) => price > 0);
  return {
    priceMinCents: prices.length ? Math.min(...prices) : 0,
    priceMaxCents: prices.length ? Math.max(...prices) : 0,
    material: countBy(rows, (row) => row.material),
    cor: countBy(rows, (row) => row.color),
    tipo: countBy(rows, (row) => row.subtype),
    marca: countBy(rows, (row) => row.brand),
  };
}

export function paginate<T>(items: T[], page: number, pageSize: number = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, totalPages);
  return {
    items: items.slice((current - 1) * pageSize, current * pageSize),
    page: current,
    totalPages,
    total: items.length,
  };
}
