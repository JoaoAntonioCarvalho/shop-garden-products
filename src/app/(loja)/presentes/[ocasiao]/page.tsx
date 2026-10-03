import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryLinks } from "@/components/store/category-links";
import { ProductListing } from "@/components/store/listing/product-listing";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { breadcrumbJsonLd, JsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { getCatalogIndex, getOccasions } from "@/server/services/catalog";
import { countActiveFilters, parseListingQuery } from "@/server/services/catalog-filters";
import { getStoreSettings } from "@/server/services/settings";

type Props = PageProps<"/presentes/[ocasiao]">;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { ocasiao } = await params;
  const occasion = (await getOccasions()).find((item) => item.slug === ocasiao);
  if (!occasion) return {};
  const query = parseListingQuery(await searchParams);
  const filtered = countActiveFilters(query.filters) > 0 || query.sort !== "relevancia";
  return pageMetadata({
    title: `Presentes para ${occasion.name.toLowerCase()}`,
    description: occasion.description,
    path: `/presentes/${occasion.slug}${!filtered && query.page > 1 ? `?pagina=${query.page}` : ""}`,
    noindex: filtered,
  });
}

export default async function OccasionPage({ params, searchParams }: Props) {
  const { ocasiao } = await params;
  const [occasions, settings, index, query] = await Promise.all([
    getOccasions(),
    getStoreSettings(),
    getCatalogIndex(),
    searchParams.then(parseListingQuery),
  ]);
  const occasion = occasions.find((item) => item.slug === ocasiao);
  if (!occasion) notFound();

  const rows = index.filter((row) => row.isGiftable && row.tags.includes(occasion.tag));
  const breadcrumb = [
    { label: "Início", href: "/" },
    { label: "Presentes", href: "/presentes" },
    { label: occasion.name, href: `/presentes/${occasion.slug}` },
  ];

  return (
    <div className="container-store pt-6 pb-16">
      <JsonLd data={breadcrumbJsonLd(breadcrumb)} />
      <Breadcrumb items={breadcrumb} />
      <header className="mt-6 mb-8">
        <h1 className="type-h1 text-moss-900">{occasion.name}</h1>
        {occasion.description ? (
          <p className="mt-3 measure type-body-lg text-ink-muted">{occasion.description}</p>
        ) : null}
        <p className="mt-2 type-body text-ink-muted">
          Incluímos um cartão com a sua mensagem, sem custo.
        </p>
      </header>
      <ProductListing
        rows={rows}
        query={query}
        basePath={`/presentes/${occasion.slug}`}
        filterGroups={[]}
        settings={settings}
        listName={`Presentes: ${occasion.name}`}
        emptySuggestions={
          <CategoryLinks
            links={occasions
              .filter((item) => item.id !== occasion.id)
              .map((item) => ({ label: item.name, href: `/presentes/${item.slug}` }))}
          />
        }
      />
    </div>
  );
}
