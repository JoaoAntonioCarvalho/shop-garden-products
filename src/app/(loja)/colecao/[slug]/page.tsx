import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryLinks } from "@/components/store/category-links";
import { ProductListing } from "@/components/store/listing/product-listing";
import { RichText } from "@/components/store/rich-text";
import { WhatsAppButton } from "@/components/store/whatsapp-button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { breadcrumbJsonLd, JsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import {
  getCatalogIndex,
  getCollectionBySlug,
  getNavigation,
  resolveCollectionRows,
  type CatalogRow,
  type CollectionRule,
} from "@/server/services/catalog";
import { countActiveFilters, parseListingQuery } from "@/server/services/catalog-filters";
import { getStoreSettings } from "@/server/services/settings";

type Props = PageProps<"/colecao/[slug]">;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) return {};
  const query = parseListingQuery(await searchParams);
  const filtered = countActiveFilters(query.filters) > 0 || query.sort !== "relevancia";
  return pageMetadata({
    title: collection.name + (query.page > 1 ? `, página ${query.page}` : ""),
    description: collection.description,
    path: `/colecao/${collection.slug}${!filtered && query.page > 1 ? `?pagina=${query.page}` : ""}`,
    noindex: filtered,
  });
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();

  const [settings, index, navigation, query] = await Promise.all([
    getStoreSettings(),
    getCatalogIndex(),
    getNavigation(),
    searchParams.then(parseListingQuery),
  ]);

  let rows: CatalogRow[];
  if (collection.type === "RULE" && collection.rule) {
    rows = await resolveCollectionRows(collection.rule as CollectionRule, index);
  } else {
    const byId = new Map(index.map((row) => [row.id, row]));
    rows = collection.products
      .map((item) => byId.get(item.productId))
      .filter((row): row is CatalogRow => Boolean(row));
  }

  const breadcrumb = [
    { label: "Início", href: "/" },
    { label: collection.name, href: `/colecao/${collection.slug}` },
  ];
  const isCustom = collection.slug === "sob-medida";

  return (
    <div className="container-store pt-6 pb-16">
      <JsonLd data={breadcrumbJsonLd(breadcrumb)} />
      <Breadcrumb items={breadcrumb} />

      <header className="mt-6 mb-8">
        <h1 className="type-h1 text-moss-900">{collection.name}</h1>
        {collection.description ? (
          <p className="mt-3 measure type-body-lg text-ink-muted">{collection.description}</p>
        ) : null}
        {collection.content ? (
          <RichText html={collection.content} settings={settings} className="mt-6" />
        ) : null}
        {isCustom ? (
          <WhatsAppButton
            number={settings.whatsapp}
            message="Olá! Vim pelo site e quero pedir um arranjo sob medida."
            position="pagina"
            size="lg"
            className="mt-6"
          >
            Pedir arranjo sob medida
          </WhatsAppButton>
        ) : null}
      </header>

      <ProductListing
        rows={rows}
        query={query}
        basePath={`/colecao/${collection.slug}`}
        filterGroups={[]}
        settings={settings}
        listName={`Coleção: ${collection.name}`}
        keepBaseOrder
        emptySuggestions={<CategoryLinks links={navigation.categories} />}
      />
    </div>
  );
}
