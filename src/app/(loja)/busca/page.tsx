import type { Metadata } from "next";
import Link from "next/link";
import { CategoryLinks } from "@/components/store/category-links";
import { ProductListing } from "@/components/store/listing/product-listing";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { pageMetadata } from "@/lib/seo/metadata";
import {
  getCatalogIndex,
  getNavigation,
  logSearch,
  searchProductScores,
  suggestSearchTerms,
} from "@/server/services/catalog";
import { parseListingQuery } from "@/server/services/catalog-filters";
import { getStoreSettings } from "@/server/services/settings";

type Props = PageProps<"/busca">;

const termOf = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : (value ?? "")).trim().slice(0, 80);

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const term = termOf((await searchParams).q);
  return pageMetadata({
    title: term ? `Resultados para "${term}"` : "Busca",
    path: "/busca",
    noindex: true,
  });
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const term = termOf(params.q);
  const [settings, navigation] = await Promise.all([getStoreSettings(), getNavigation()]);

  if (term.length < 2) {
    return (
      <div className="container-store py-12">
        <EmptyState
          headingLevel="h1"
          title="O que você procura?"
          description="Digite ao menos duas letras no campo de busca, ou navegue pelas categorias."
        >
          <CategoryLinks links={navigation.categories} />
        </EmptyState>
      </div>
    );
  }

  const [scores, index] = await Promise.all([searchProductScores(term), getCatalogIndex()]);
  const rows = index
    .filter((row) => scores.has(row.id))
    .map((row) => ({ ...row, score: scores.get(row.id) }));
  const query = parseListingQuery(params);
  // Só a primeira página, sem filtros, conta como uma busca nova.
  if (query.page === 1) await logSearch(term, rows.length);

  if (rows.length === 0) {
    const suggestions = await suggestSearchTerms(term);
    return (
      <div className="container-store py-12">
        <EmptyState
          headingLevel="h1"
          title={`Não encontramos "${term}"`}
          description="Confira a grafia, tente um termo mais simples ou veja as sugestões abaixo."
          action={
            <Link href="/solicitar-produto" className={buttonClasses("primary")}>
              Pedir que a gente procure para você
            </Link>
          }
        >
          {suggestions.length > 0 ? (
            <div className="mb-8">
              <h2 className="mb-3 type-small font-medium text-ink">Você quis dizer</h2>
              <CategoryLinks
                links={suggestions.map((suggestion) => ({
                  label: suggestion,
                  href: `/busca?q=${encodeURIComponent(suggestion)}`,
                }))}
              />
            </div>
          ) : null}
          <h2 className="mb-3 type-small font-medium text-ink">Categorias mais procuradas</h2>
          <CategoryLinks links={navigation.categories} />
          <p className="mx-auto mt-8 max-w-md type-small text-ink-muted">
            Não encontrou o que procura? Conte para a gente que buscamos para você nas lojas do
            Shopping Garden.
          </p>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="container-store pt-8 pb-16">
      <header className="mb-8">
        <h1 className="type-h2 text-moss-900">Resultados para &ldquo;{term}&rdquo;</h1>
      </header>
      <ProductListing
        rows={rows}
        query={query}
        basePath="/busca"
        extraParams={{ q: term }}
        filterGroups={["material", "cor", "tipo", "marca"]}
        settings={settings}
        listName="Resultados da busca"
        searchTerm={query.page === 1 ? term : undefined}
      />
    </div>
  );
}
