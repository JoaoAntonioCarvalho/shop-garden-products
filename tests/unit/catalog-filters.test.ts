import { describe, expect, it } from "vitest";
import {
  applyFilters,
  buildFacets,
  buildListingSearch,
  countActiveFilters,
  paginate,
  parseListingQuery,
  sortRows,
  type IndexRow,
} from "@/server/services/catalog-filters";

const base: IndexRow = {
  id: "a",
  minPriceCents: 10000,
  totalAvailable: 5,
  sameDayEligible: true,
  ratingAverage: 4.5,
  ratingCount: 10,
  salesCount30d: 3,
  publishedAt: "2026-09-01T00:00:00.000Z",
  isFeatured: false,
  isNew: false,
  onSale: false,
  light: "INDIRECT_LIGHT",
  environment: "INDOOR",
  petSafety: "SAFE",
  careLevel: "EASY",
  heightCm: 40,
  material: "Cerâmica",
  color: "Branco",
  mouthDiameterCm: 20,
  hasDrainageHole: true,
  indoorOutdoor: "BOTH",
  subtype: null,
  includesPot: null,
  brand: null,
};
const row = (overrides: Partial<IndexRow>): IndexRow => ({ ...base, ...overrides });
const noFilters = parseListingQuery({}).filters;

describe("leitura dos filtros da URL", () => {
  it("lê o formato da especificação", () => {
    const query = parseListingQuery({
      preco: "50-150",
      material: "ceramica",
      ordem: "menor-preco",
      pagina: "2",
    });
    expect(query.filters.priceMin).toBe(5000);
    expect(query.filters.priceMax).toBe(15000);
    expect(query.filters.material).toEqual(["ceramica"]);
    expect(query.sort).toBe("menor-preco");
    expect(query.page).toBe(2);
  });

  it("ignora valores inválidos", () => {
    const query = parseListingQuery({ ordem: "xyz", pagina: "-3", luz: "lua-cheia", nota: "9" });
    expect(query.sort).toBe("relevancia");
    expect(query.page).toBe(1);
    expect(query.filters.luz).toEqual([]);
    expect(query.filters.minRating).toBeNull();
  });

  it("vai e volta sem perder nada", () => {
    const params = {
      preco: "50-150",
      material: "ceramica,vidro",
      hoje: "1",
      ordem: "novidades",
      pagina: "3",
    };
    const search = buildListingSearch(parseListingQuery(params), { q: "vaso" });
    const again = parseListingQuery(Object.fromEntries(new URLSearchParams(search)));
    expect(again).toEqual(parseListingQuery(params));
    expect(search).toContain("q=vaso");
  });

  it("sem filtros não gera query string", () => {
    expect(buildListingSearch(parseListingQuery({}))).toBe("");
    expect(countActiveFilters(noFilters)).toBe(0);
    expect(
      countActiveFilters(
        parseListingQuery({ preco: "50-150", pet: "1", cor: "branco,azul" }).filters,
      ),
    ).toBe(4);
  });
});

describe("aplicação dos filtros", () => {
  const rows = [
    row({ id: "barato", minPriceCents: 3000 }),
    row({ id: "caro", minPriceCents: 40000, onSale: true }),
    row({ id: "esgotado", totalAvailable: 0 }),
    row({ id: "sol", light: "FULL_SUN", petSafety: "TOXIC", environment: "OUTDOOR", heightCm: 90 }),
    row({
      id: "vidro",
      material: "Vidro",
      color: "Transparente",
      hasDrainageHole: false,
      indoorOutdoor: "INDOOR",
    }),
  ];
  const ids = (params: Record<string, string>) =>
    applyFilters(rows, parseListingQuery(params).filters).map((r) => r.id);

  it("faixa de preço", () => {
    expect(ids({ preco: "50-150" })).toEqual(["esgotado", "sol", "vidro"]);
  });

  it("estoque, entrega hoje e promoção", () => {
    expect(ids({ estoque: "1" })).not.toContain("esgotado");
    expect(ids({ hoje: "1" })).not.toContain("esgotado");
    expect(ids({ promo: "1" })).toEqual(["caro"]);
  });

  it("filtros de plantas", () => {
    expect(ids({ luz: "sol-pleno" })).toEqual(["sol"]);
    expect(ids({ pet: "1" })).not.toContain("sol");
    expect(ids({ ambiente: "externo" })).toEqual(["sol"]);
    expect(ids({ porte: "grande" })).toEqual(["sol"]);
  });

  it("filtros de vasos: material sem acento, furo e uso (ambos vale para interno e externo)", () => {
    expect(ids({ material: "vidro" })).toEqual(["vidro"]);
    expect(ids({ material: "ceramica,vidro" })).toHaveLength(5);
    expect(ids({ furo: "1" })).not.toContain("vidro");
    expect(ids({ uso: "externo" })).not.toContain("vidro");
    expect(ids({ uso: "interno" })).toHaveLength(5);
  });

  it("combina filtros com E", () => {
    expect(ids({ material: "ceramica", promo: "1" })).toEqual(["caro"]);
  });
});

describe("ordenação, facetas e paginação", () => {
  const rows = [
    row({ id: "a", minPriceCents: 300, salesCount30d: 1, ratingAverage: 3 }),
    row({ id: "b", minPriceCents: 100, salesCount30d: 9, ratingAverage: 5, totalAvailable: 0 }),
    row({ id: "c", minPriceCents: 200, salesCount30d: 5, ratingAverage: 4, material: "Vidro" }),
  ];

  it("esgotados vão para o fim em qualquer ordenação", () => {
    expect(sortRows(rows, "menor-preco").map((r) => r.id)).toEqual(["c", "a", "b"]);
    expect(sortRows(rows, "maior-preco").map((r) => r.id)).toEqual(["a", "c", "b"]);
    expect(sortRows(rows, "mais-vendidos").map((r) => r.id)).toEqual(["c", "a", "b"]);
    expect(sortRows(rows, "melhor-avaliados").map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("na busca, relevância segue a pontuação", () => {
    const scored = [row({ id: "x", score: 0.4 }), row({ id: "y", score: 1.9 })];
    expect(sortRows(scored, "relevancia").map((r) => r.id)).toEqual(["y", "x"]);
  });

  it("facetas contam por valor e informam a faixa de preço", () => {
    const facets = buildFacets(rows);
    expect(facets.material).toEqual([
      { value: "ceramica", label: "Cerâmica", count: 2 },
      { value: "vidro", label: "Vidro", count: 1 },
    ]);
    expect(facets.priceMinCents).toBe(100);
    expect(facets.priceMaxCents).toBe(300);
  });

  it("paginação limita a página ao total", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    expect(paginate(items, 1).items).toHaveLength(24);
    expect(paginate(items, 3)).toMatchObject({ page: 3, totalPages: 3, total: 50 });
    expect(paginate(items, 3).items).toHaveLength(2);
    expect(paginate(items, 99).page).toBe(3);
  });
});
