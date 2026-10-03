import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Hero } from "@/components/store/home/hero";
import {
  AboutSection,
  BenefitsStrip,
  FeaturedCategories,
  HeritageSection,
  NewsletterSection,
  OccasionsSection,
  ProductShelf,
  SecondaryCategorySection,
  TestimonialsSection,
} from "@/components/store/home/sections";
import { categoryHref } from "@/config/category-tree";
import { db } from "@/lib/db";
import { pageMetadata } from "@/lib/seo/metadata";
import { renderTokens } from "@/lib/template";
import {
  getCards,
  getCatalogIndex,
  getCategories,
  getOccasions,
  getStoreRating,
  resolveCollectionRows,
  type CollectionRule,
} from "@/server/services/catalog";
import {
  getBanners,
  getHomeSections,
  getMediaImage,
  getTestimonials,
} from "@/server/services/content";
import { getStoreSettings } from "@/server/services/settings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  return pageMetadata({
    title: `${settings.name}: ${settings.tagline.charAt(0).toLowerCase()}${settings.tagline.slice(1)}`,
    description: `${settings.partnerClaim}. Orquídeas, plantas naturais, arranjos, vasos e cachepots com entrega no mesmo dia em São Paulo.`,
    path: "/",
    absoluteTitle: true,
  });
}

/** Cookie gravado quando o visitante se cadastra na newsletter (fase 7). */
const LEAD_COOKIE = "nsg_lead";

export default async function HomePage() {
  const [settings, sections, index, categories, cookieStore] = await Promise.all([
    getStoreSettings(),
    getHomeSections(),
    getCatalogIndex(),
    getCategories(),
    cookies(),
  ]);
  const banners = await getBanners("HOME_HERO", settings);
  const alreadySubscribed = cookieStore.has(LEAD_COOKIE);

  const rendered = await Promise.all(
    sections.map(async (section) => {
      const title = renderTokens(section.title ?? "", settings);
      switch (section.type) {
        case "BENEFITS":
          return <BenefitsStrip key={section.id} settings={settings} title={title} />;

        case "FEATURED_CATEGORIES": {
          const featured = categories
            .filter((category) => category.showOnHome)
            // Orquídeas primeiro: é o tile maior da grade.
            .sort(
              (a, b) =>
                Number(b.path.endsWith("/orquideas")) - Number(a.path.endsWith("/orquideas")),
            )
            .slice(0, section.limit);
          return <FeaturedCategories key={section.id} title={title} categories={featured} />;
        }

        case "BESTSELLERS": {
          const rows = await resolveCollectionRows({ kind: "bestsellers" }, index);
          const cards = await getCards(
            rows.slice(0, section.limit).map((row) => row.id),
            settings,
          );
          return (
            <ProductShelf
              key={section.id}
              id={`home-${section.key}`}
              title={title}
              subtitle={section.subtitle}
              cards={cards}
              tone="cream"
              link={{ href: "/colecao/mais-vendidos", label: "Ver todos" }}
            />
          );
        }

        case "NEW_ARRIVALS":
        case "COLLECTION": {
          const collection = section.sourceId
            ? await db.collection.findUnique({
                where: { id: section.sourceId },
                select: {
                  slug: true,
                  type: true,
                  rule: true,
                  products: { orderBy: { position: "asc" }, select: { productId: true } },
                },
              })
            : null;
          const ids =
            collection?.type === "RULE" && collection.rule
              ? (await resolveCollectionRows(collection.rule as CollectionRule, index))
                  .filter((row) => row.totalAvailable > 0)
                  .map((row) => row.id)
              : (collection?.products.map((item) => item.productId) ??
                (await resolveCollectionRows({ kind: "new" }, index)).map((row) => row.id));
          const cards = await getCards(ids.slice(0, section.limit), settings);
          return (
            <ProductShelf
              key={section.id}
              id={`home-${section.key}`}
              title={title}
              subtitle={section.subtitle}
              cards={cards}
              link={
                collection ? { href: `/colecao/${collection.slug}`, label: "Ver todos" } : undefined
              }
            />
          );
        }

        case "CATEGORY": {
          const category = categories.find((item) => item.id === section.sourceId);
          if (!category) return null;
          const childIds = categories
            .filter((item) => item.parentId === category.id)
            .map((item) => item.id);
          const ids = index
            .filter(
              (row) =>
                row.totalAvailable > 0 &&
                row.categoryIds.some((id) => id === category.id || childIds.includes(id)),
            )
            .sort((a, b) => b.salesCount30d - a.salesCount30d)
            .slice(0, section.limit)
            .map((row) => row.id);
          return (
            <ProductShelf
              key={section.id}
              id={`home-${section.key}`}
              title={title || category.name}
              subtitle={section.subtitle}
              cards={await getCards(ids, settings)}
              link={{ href: categoryHref(category.path), label: "Ver todos" }}
            />
          );
        }

        case "MANUAL":
          return (
            <ProductShelf
              key={section.id}
              id={`home-${section.key}`}
              title={title}
              subtitle={section.subtitle}
              cards={await getCards(section.productIds.slice(0, section.limit), settings)}
            />
          );

        case "OCCASIONS":
          return (
            <OccasionsSection
              key={section.id}
              title={title}
              subtitle={section.subtitle}
              occasions={await getOccasions()}
            />
          );

        case "HERITAGE":
          return (
            <HeritageSection
              key={section.id}
              title={title}
              body={section.body}
              image={section.sourceId ? await getMediaImage(section.sourceId) : null}
            />
          );

        case "TESTIMONIALS": {
          const [testimonials, rating] = await Promise.all([getTestimonials(), getStoreRating()]);
          return (
            <TestimonialsSection
              key={section.id}
              title={title}
              testimonials={testimonials.slice(0, section.limit)}
              rating={rating}
            />
          );
        }

        case "SECONDARY_CATEGORY": {
          const category = categories.find((item) => item.id === section.sourceId);
          if (!category) return null;
          return (
            <SecondaryCategorySection key={section.id} title={title} category={category}>
              {categories.filter((item) => item.parentId === category.id)}
            </SecondaryCategorySection>
          );
        }

        case "NEWSLETTER":
          if (alreadySubscribed) return null;
          return (
            <NewsletterSection
              key={section.id}
              title={title}
              image={section.sourceId ? await getMediaImage(section.sourceId) : null}
              settings={settings}
            />
          );

        case "ABOUT":
          return <AboutSection key={section.id} title={title} body={section.body} />;

        default:
          return null;
      }
    }),
  );

  return (
    <>
      <Hero banners={banners} whatsapp={settings.whatsapp} />
      {rendered}
    </>
  );
}
