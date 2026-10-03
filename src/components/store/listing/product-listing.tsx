import Link from "next/link";
import type { ReactNode } from "react";
import { ProductGrid, type ProductCardData } from "@/components/store/product-card";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import type { StoreSettings } from "@/config/store.config";
import type { AnalyticsItem } from "@/lib/analytics/events";
import { centsToReais } from "@/lib/money";
import { getCards } from "@/server/services/catalog";
import {
  applyFilters,
  buildFacets,
  buildListingSearch,
  countActiveFilters,
  paginate,
  sortRows,
  type IndexRow,
  type ListingQuery,
} from "@/server/services/catalog-filters";
import { FilterDrawer, FilterSidebar } from "./filter-panel";
import { ListingTracker } from "./listing-tracker";
import { SortSelect } from "./sort-select";

export function cardsToAnalytics(cards: ProductCardData[]): AnalyticsItem[] {
  return cards.map((card) => ({
    item_id: card.sku,
    item_name: card.name,
    item_category: card.categoryName,
    price: centsToReais(card.price.priceCents),
    quantity: 1,
  }));
}

type ProductListingProps = {
  /** Conjunto base (categoria, coleção ou resultado da busca), antes dos filtros. */
  rows: IndexRow[];
  query: ListingQuery;
  /** Caminho da página, sem query. */
  basePath: string;
  extraParams?: Record<string, string>;
  /** Grupos de filtro específicos (Category.filtersConfig). */
  filterGroups: string[];
  settings: StoreSettings;
  listName: string;
  searchTerm?: string;
  /** Quando o conjunto base tem ordem própria (coleção manual), a "relevância" a preserva. */
  keepBaseOrder?: boolean;
  /** Sugestões exibidas quando os filtros não devolvem nada. */
  emptySuggestions?: ReactNode;
};

/** Barra de ferramentas, filtros, grade e paginação. Usado por categoria, coleção, busca e presentes. */
export async function ProductListing({
  rows,
  query,
  basePath,
  extraParams,
  filterGroups,
  settings,
  listName,
  searchTerm,
  keepBaseOrder = false,
  emptySuggestions,
}: ProductListingProps) {
  const facets = buildFacets(rows);
  const filtered = applyFilters(rows, query.filters);
  const sorted =
    keepBaseOrder && query.sort === "relevancia" ? filtered : sortRows(filtered, query.sort);
  const page = paginate(sorted, query.page);
  const cards = await getCards(
    page.items.map((row) => row.id),
    settings,
  );
  const activeFilters = countActiveFilters(query.filters);
  const panelProps = { query, facets, groups: filterGroups, extraParams, resultCount: page.total };

  return (
    <div className="grid gap-x-10 lg:grid-cols-[240px_1fr]">
      <FilterSidebar {...panelProps} />

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <p aria-live="polite" className="type-small text-ink-muted">
            {page.total} {page.total === 1 ? "produto" : "produtos"}
          </p>
          <div className="flex items-center gap-2">
            <FilterDrawer {...panelProps} />
            <SortSelect query={query} extraParams={extraParams} />
          </div>
        </div>

        {activeFilters > 0 ? (
          <p className="mt-3 type-small">
            <Link
              href={`${basePath}${buildListingSearch({ filters: { ...query.filters, ...clearedFilters }, sort: query.sort, page: 1 }, extraParams)}`}
              className="py-2 text-moss-700 underline underline-offset-3 hover:text-moss-900"
            >
              Limpar filtros ({activeFilters})
            </Link>
          </p>
        ) : null}

        {cards.length > 0 ? (
          <>
            <ProductGrid
              products={cards}
              listName={listName}
              priorityCount={query.page === 1 ? 4 : 0}
              className="mt-6 lg:grid-cols-3 xl:grid-cols-4"
            />
            <Pagination
              className="mt-12"
              page={page.page}
              totalPages={page.totalPages}
              hrefFor={(target) =>
                `${basePath}${buildListingSearch({ ...query, page: target }, extraParams)}`
              }
            />
            <ListingTracker
              listName={listName}
              items={cardsToAnalytics(cards)}
              searchTerm={searchTerm}
            />
          </>
        ) : (
          <EmptyState
            title="Nenhum produto com esses filtros"
            description="Tente remover algum filtro para ver mais opções."
            action={
              <Link
                href={`${basePath}${buildListingSearch({ filters: { ...query.filters, ...clearedFilters }, sort: "relevancia", page: 1 }, extraParams)}`}
                className={buttonClasses("secondary")}
              >
                Limpar filtros
              </Link>
            }
          >
            {emptySuggestions}
          </EmptyState>
        )}
      </div>
    </div>
  );
}

const clearedFilters = {
  priceMin: null,
  priceMax: null,
  inStock: false,
  sameDay: false,
  onSale: false,
  minRating: null,
  luz: [],
  ambiente: [],
  pet: false,
  cuidado: [],
  porte: [],
  material: [],
  cor: [],
  altura: [],
  boca: [],
  furo: false,
  uso: [],
  tipo: [],
  vaso: [],
  marca: [],
};
