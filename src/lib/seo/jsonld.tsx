import type { StoreSettings } from "@/config/store.config";
import { absoluteUrl, appUrl } from "./metadata";

type Json = Record<string, unknown>;

/** Insere um bloco JSON-LD. O "<" é escapado para o conteúdo não fechar a tag script. */
export function JsonLd({ data }: { data: Json | Json[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export function organizationJsonLd(settings: StoreSettings): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.name,
    url: appUrl(),
    logo: absoluteUrl("/brand/logo.svg"),
    email: settings.email,
    sameAs: [settings.instagram].filter(Boolean),
    contactPoint: {
      "@type": "ContactPoint",
      telephone: `+${settings.whatsapp}`,
      contactType: "customer service",
      availableLanguage: "Portuguese",
    },
  };
}

export function websiteJsonLd(settings: StoreSettings): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.name,
    url: appUrl(),
    inLanguage: "pt-BR",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${appUrl()}/busca?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function storeJsonLd(settings: StoreSettings): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: settings.name,
    description: settings.partnerClaim,
    url: appUrl(),
    telephone: `+${settings.whatsapp}`,
    email: settings.email,
    address: { "@type": "PostalAddress", streetAddress: settings.address, addressCountry: "BR" },
    openingHours: settings.businessHours,
    parentOrganization: { "@type": "Organization", name: "Shopping Garden" },
  };
}

export function breadcrumbJsonLd(items: Array<{ label: string; href?: string }>): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };
}

export function faqJsonLd(items: Array<{ question: string; answer: string }>): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

type ProductJsonLdInput = {
  name: string;
  slug: string;
  sku: string;
  description: string;
  brand?: string | null;
  images: string[];
  priceCents: number;
  inStock: boolean;
  priceValidUntil?: Date | null;
  ratingAverage: number;
  ratingCount: number;
  reviews: Array<{ authorName: string; rating: number; body: string; createdAt: Date }>;
};

export function productJsonLd(product: ProductJsonLdInput, settings: StoreSettings): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.description,
    image: product.images.map(absoluteUrl),
    brand: { "@type": "Brand", name: product.brand || settings.name },
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/produto/${product.slug}`),
      priceCurrency: "BRL",
      price: (product.priceCents / 100).toFixed(2),
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: settings.name },
      ...(product.priceValidUntil
        ? { priceValidUntil: product.priceValidUntil.toISOString().slice(0, 10) }
        : {}),
    },
    ...(product.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.ratingAverage.toFixed(1),
            reviewCount: product.ratingCount,
          },
          review: product.reviews.slice(0, 5).map((review) => ({
            "@type": "Review",
            author: { "@type": "Person", name: review.authorName },
            datePublished: review.createdAt.toISOString().slice(0, 10),
            reviewBody: review.body,
            reviewRating: { "@type": "Rating", ratingValue: review.rating, bestRating: 5 },
          })),
        }
      : {}),
  };
}
