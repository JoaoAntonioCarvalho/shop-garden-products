import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotanicalCaption } from "@/components/store/botanical-sheet";
import { CategoryLinks } from "@/components/store/category-links";
import { ProductListing } from "@/components/store/listing/product-listing";
import { RichText } from "@/components/store/rich-text";
import { Accordion } from "@/components/ui/accordion";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";
import { categoryHref } from "@/config/category-tree";
import { breadcrumbJsonLd, faqJsonLd, JsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { getCatalogIndex, getCategoryByPath, getNavigation } from "@/server/services/catalog";
import { countActiveFilters, parseListingQuery } from "@/server/services/catalog-filters";
import { getBanners } from "@/server/services/content";
import { getStoreSettings } from "@/server/services/settings";

type Props = PageProps<"/categoria/[...path]">;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { path } = await params;
  const found = await getCategoryByPath(path.join("/"));
  if (!found) return {};
  const { category } = found;
  const query = parseListingQuery(await searchParams);
  const filtered = countActiveFilters(query.filters) > 0 || query.sort !== "relevancia";
  const pageSuffix = query.page > 1 ? `?pagina=${query.page}` : "";

  return pageMetadata({
    title: (category.seoTitle ?? category.name) + (query.page > 1 ? `, página ${query.page}` : ""),
    description: category.seoDescription ?? category.description,
    // Com filtros: noindex e canonical para a categoria. Paginação tem canonical próprio.
    path: `${categoryHref(category.path)}${filtered ? "" : pageSuffix}`,
    noindex: filtered,
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { path } = await params;
  const fullPath = path.join("/");
  const found = await getCategoryByPath(fullPath);
  if (!found) notFound();
  const { category, parent, children, ids } = found;

  const [settings, index, navigation, query] = await Promise.all([
    getStoreSettings(),
    getCatalogIndex(),
    getNavigation(),
    searchParams.then(parseListingQuery),
  ]);
  const [banner] = await getBanners("CATEGORY_TOP", settings, category.id);

  const rows = index.filter((row) => row.categoryIds.some((id) => ids.includes(id)));
  const countFor = (categoryId: string) =>
    index.filter((row) => row.categoryIds.includes(categoryId)).length;

  const breadcrumb: BreadcrumbItem[] = [
    { label: "Início", href: "/" },
    ...(parent ? [{ label: parent.name, href: categoryHref(parent.path) }] : []),
    { label: category.name, href: categoryHref(category.path) },
  ];
  const faq = category.faq.map((item) => ({ question: item.pergunta, answer: item.resposta }));
  const basePath = categoryHref(category.path);

  return (
    <div className="container-store pt-6 pb-16">
      <JsonLd data={breadcrumbJsonLd(breadcrumb)} />
      <Breadcrumb items={breadcrumb} />

      <header className="mt-6 mb-8">
        <h1 className="type-h1 text-moss-900">{category.name}</h1>
        {category.description ? (
          <p className="mt-3 measure type-body-lg text-ink-muted">{category.description}</p>
        ) : null}

        {children.length > 0 ? (
          <nav aria-label={`Subcategorias de ${category.name}`} className="mt-6">
            <ul className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 md:mx-0 md:flex-wrap md:px-0">
              {children.map((child) => (
                <li key={child.id} className="flex-none">
                  <Link
                    href={categoryHref(child.path)}
                    className="flex min-h-11 items-center gap-2 rounded-control border border-moss-700 px-4 text-[15px] whitespace-nowrap text-moss-700 transition-colors hover:bg-moss-100 md:min-h-10"
                  >
                    {child.name}
                    <span className="type-caption text-ink-muted tabular-nums">
                      {countFor(child.id)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      {banner && query.page === 1 ? (
        <section
          aria-label={banner.title}
          className="mb-10 grid overflow-hidden rounded-photo bg-cream-100 md:grid-cols-2"
        >
          <div className="flex flex-col justify-center p-6 md:p-10">
            <h2 className="type-h2 text-moss-900">{banner.title}</h2>
            {banner.subtitle ? (
              <p className="mt-2 type-body text-ink-muted">{banner.subtitle}</p>
            ) : null}
          </div>
          {banner.imageDesktop ? (
            <div className="relative aspect-16/7 md:aspect-auto md:min-h-[220px]">
              <Image
                src={banner.imageDesktop.url}
                alt={banner.imageDesktop.alt}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
              {banner.imageCaption ? (
                <BotanicalCaption
                  commonName={banner.imageCaption}
                  scientificName={banner.imageCaptionScientific}
                  className="absolute right-3 bottom-3"
                />
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <ProductListing
        rows={rows}
        query={query}
        basePath={basePath}
        filterGroups={category.filtersConfig}
        settings={settings}
        listName={`Categoria: ${category.name}`}
        emptySuggestions={<CategoryLinks links={navigation.categories} />}
      />

      {query.page === 1 && (category.seoContent || faq.length > 0) ? (
        <div className="mt-20 grid gap-12 border-t border-line pt-12 lg:grid-cols-2">
          {category.seoContent ? <RichText html={category.seoContent} settings={settings} /> : null}
          {faq.length > 0 ? (
            <section aria-labelledby="perguntas-categoria">
              <JsonLd data={faqJsonLd(faq)} />
              <h2 id="perguntas-categoria" className="mb-4 type-h3 text-moss-900">
                Perguntas frequentes sobre {category.name.toLowerCase()}
              </h2>
              <Accordion
                items={faq.map((item, i) => ({
                  id: `faq-${i}`,
                  title: item.question,
                  content: <p className="measure type-body text-ink">{item.answer}</p>,
                }))}
              />
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
