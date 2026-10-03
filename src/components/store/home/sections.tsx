import {
  BadgePercent,
  Droplets,
  Leaf,
  Package,
  PackageOpen,
  Shovel,
  Sprout,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CategoryTile } from "@/components/store/category-tile";
import { ListingTracker } from "@/components/store/listing/listing-tracker";
import { cardsToAnalytics } from "@/components/store/listing/product-listing";
import {
  NewsletterForm,
  type LeadFormInput,
  type LeadFormResult,
} from "@/components/store/newsletter-form";
import {
  ProductGrid,
  type ProductCardData,
  type ProductImageData,
} from "@/components/store/product-card";
import { RichText } from "@/components/store/rich-text";
import { buttonClasses } from "@/components/ui/button";
import { Rating } from "@/components/ui/rating";
import { categoryHref } from "@/config/category-tree";
import type { StoreSettings } from "@/config/store.config";
import { cn } from "@/lib/cn";
import { sanitizeRichText } from "@/lib/sanitize";
import { formatCutoff } from "@/lib/template";
import type { CategoryNodeData } from "@/server/services/catalog";

function SectionHeading({
  id,
  title,
  subtitle,
  link,
}: {
  id: string;
  title: string;
  subtitle?: string | null;
  link?: { href: string; label: string };
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div>
        <h2 id={id} className="type-h2 text-moss-900">
          {title}
        </h2>
        {subtitle ? <p className="mt-2 measure type-body text-ink-muted">{subtitle}</p> : null}
      </div>
      {link ? (
        <Link
          href={link.href}
          className="flex min-h-11 items-center type-small font-medium text-moss-700 underline underline-offset-3 hover:text-moss-900"
        >
          {link.label}
        </Link>
      ) : null}
    </div>
  );
}

/** Faixa de diferenciais: quatro itens em linha, sem cards. Rolagem horizontal no mobile. */
export function BenefitsStrip({
  settings,
  title,
}: {
  settings: StoreSettings;
  title?: string | null;
}) {
  const items: Array<{ icon: LucideIcon; text: string }> = [
    ...(settings.sameDay.enabled
      ? [
          {
            icon: Truck,
            text: `Entrega hoje em São Paulo para pedidos até ${formatCutoff(settings.sameDay.cutoffTime)}`,
          },
        ]
      : []),
    { icon: Package, text: "Embalagem própria para plantas e peças frágeis" },
    ...(settings.pixDiscountPercent > 0
      ? [{ icon: BadgePercent, text: `${settings.pixDiscountPercent}% de desconto no Pix` }]
      : []),
    { icon: ShieldCheck, text: "Curadoria Shopping Garden" },
  ];
  return (
    <section aria-label={title ?? "Diferenciais da loja"} className="border-b border-line">
      <ul className="container-store flex gap-8 overflow-x-auto py-5 lg:justify-between">
        {items.map(({ icon: Icon, text }) => (
          <li key={text} className="flex flex-none items-center gap-3 type-small text-ink">
            <Icon aria-hidden="true" strokeWidth={1.5} className="size-6 flex-none text-moss-700" />
            {text}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Grade assimétrica: a primeira categoria (orquídeas) é maior e ocupa duas linhas. */
export function FeaturedCategories({
  title,
  categories,
}: {
  title: string;
  categories: CategoryNodeData[];
}) {
  if (categories.length === 0) return null;
  return (
    <section aria-labelledby="home-categorias" className="container-store section-y">
      <SectionHeading id="home-categorias" title={title} />
      {/* 12 colunas: orquídeas ocupa metade e duas linhas; ao lado, duas categorias em cima e três embaixo. */}
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-12 md:grid-rows-[280px_280px]">
        {categories.map((category, index) => (
          <li
            key={category.id}
            className={cn(
              index === 0 && "col-span-2 md:col-span-6 md:row-span-2",
              (index === 1 || index === 2) && "md:col-span-3",
              index >= 3 && "md:col-span-2",
              index === 5 && "max-md:col-span-2",
            )}
          >
            <CategoryTile
              name={category.name}
              href={categoryHref(category.path)}
              image={category.image}
              sizes={
                index === 0 ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw"
              }
              className={cn(
                "md:aspect-auto md:h-full",
                (index === 0 || index === 5) && "max-md:aspect-16/10",
              )}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProductShelf({
  id,
  title,
  subtitle,
  cards,
  link,
  tone = "plain",
}: {
  id: string;
  title: string;
  subtitle?: string | null;
  cards: ProductCardData[];
  link?: { href: string; label: string };
  tone?: "plain" | "cream";
}) {
  if (cards.length === 0) return null;
  return (
    <section aria-labelledby={id} className={cn(tone === "cream" && "bg-cream-100")}>
      <div className="container-store section-y">
        <SectionHeading id={id} title={title} subtitle={subtitle} link={link} />
        <ProductGrid products={cards} listName={title} layout="scroll" />
        <ListingTracker listName={title} items={cardsToAnalytics(cards)} />
      </div>
    </section>
  );
}

type OccasionData = { id: string; name: string; slug: string; image: ProductImageData | null };

export function OccasionsSection({
  title,
  subtitle,
  occasions,
}: {
  title: string;
  subtitle?: string | null;
  occasions: OccasionData[];
}) {
  if (occasions.length === 0) return null;
  return (
    <section aria-labelledby="home-presentes" className="container-store section-y">
      <SectionHeading
        id="home-presentes"
        title={title}
        subtitle={subtitle}
        link={{ href: "/presentes", label: "Ver todos os presentes" }}
      />
      <ul className="-mx-6 flex snap-x gap-4 overflow-x-auto px-6 pb-2 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0">
        {occasions.map((occasion) => (
          <li
            key={occasion.id}
            className="w-[44vw] max-w-[220px] flex-none snap-start md:w-auto md:max-w-none"
          >
            <CategoryTile
              name={occasion.name}
              href={`/presentes/${occasion.slug}`}
              image={occasion.image}
              sizes="(min-width: 768px) 20vw, 44vw"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Bloco editorial da herança Shopping Garden: foto grande de um lado, texto em prosa do outro. */
export function HeritageSection({
  title,
  body,
  image,
}: {
  title: string;
  body: string | null;
  image: ProductImageData | null;
}) {
  return (
    <section aria-labelledby="home-heranca" className="bg-cream-100">
      <div className="container-store grid items-center gap-10 section-y lg:grid-cols-2 lg:gap-20">
        <div className="relative aspect-4/5 overflow-hidden rounded-photo bg-white lg:aspect-4/5">
          {image ? (
            <Image
              src={image.url}
              alt={image.alt}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          ) : null}
        </div>
        <div>
          <h2 id="home-heranca" className="type-h1 text-moss-900">
            {title}
          </h2>
          {body ? <p className="mt-6 measure type-body-lg text-ink">{body}</p> : null}
          <Link href="/sobre" className={buttonClasses("secondary", "lg", "mt-8")}>
            Conheça a nossa história
          </Link>
        </div>
      </div>
    </section>
  );
}

type TestimonialData = {
  id: string;
  authorName: string;
  authorCity: string | null;
  rating: number;
  body: string;
};

export function TestimonialsSection({
  title,
  testimonials,
  rating,
}: {
  title: string;
  testimonials: TestimonialData[];
  rating: { average: number; count: number };
}) {
  if (testimonials.length === 0) return null;
  return (
    <section aria-labelledby="home-avaliacoes" className="container-store section-y">
      <SectionHeading
        id="home-avaliacoes"
        title={title}
        link={{ href: "/avaliacoes", label: "Ver todas as avaliações" }}
      />
      {rating.count > 0 ? (
        <p className="mb-8 flex flex-wrap items-center gap-3 type-body text-ink">
          <Rating value={rating.average} size="md" showValue />
          <span className="text-ink-muted">
            média de {rating.count} {rating.count === 1 ? "avaliação" : "avaliações"} de produtos
          </span>
        </p>
      ) : null}
      <ul className="grid gap-8 md:grid-cols-3 md:gap-10">
        {testimonials.map((item) => (
          <li key={item.id} className="border-t border-moss-700 pt-5">
            <Rating value={item.rating} />
            <blockquote className="mt-3 font-serif text-[22px] leading-snug text-moss-900">
              {item.body}
            </blockquote>
            <p className="mt-4 type-small text-ink-muted">
              {item.authorName}
              {item.authorCity ? `, ${item.authorCity}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const gardenIcons: Record<string, LucideIcon> = {
  "ferramentas-e-acessorios": Shovel,
  "adubos-e-fertilizantes": Sprout,
  substratos: PackageOpen,
  "produtos-para-plantio": Leaf,
  defensivos: ShieldCheck,
  irrigacao: Droplets,
};

/** Categoria secundária (jardinagem): faixa compacta, em lista com ícones, sem fotos grandes. */
export function SecondaryCategorySection({
  title,
  category,
  children,
}: {
  title: string;
  category: CategoryNodeData;
  children: CategoryNodeData[];
}) {
  return (
    <section aria-labelledby="home-jardinagem" className="border-y border-line">
      <div className="container-store py-10">
        <SectionHeading
          id="home-jardinagem"
          title={title}
          link={{
            href: categoryHref(category.path),
            label: `Ver tudo em ${category.name.toLowerCase()}`,
          }}
        />
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 md:grid-cols-3 lg:grid-cols-6">
          {children.map((child) => {
            const Icon = gardenIcons[child.slug] ?? Leaf;
            return (
              <li key={child.id}>
                <Link
                  href={categoryHref(child.path)}
                  className="flex min-h-11 items-center gap-3 type-small text-ink underline-offset-3 hover:text-moss-700 hover:underline"
                >
                  <Icon
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className="size-5 flex-none text-moss-700"
                  />
                  {child.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function NewsletterSection({
  title,
  image,
  settings,
  subscribe,
}: {
  title: string;
  image: ProductImageData | null;
  settings: StoreSettings;
  subscribe?: (input: LeadFormInput) => Promise<LeadFormResult>;
}) {
  return (
    <section aria-labelledby="home-newsletter" className="container-store section-y">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <div className="relative hidden aspect-4/5 overflow-hidden rounded-photo bg-white lg:block">
          {image ? (
            <Image src={image.url} alt="" fill sizes="35vw" className="object-cover" />
          ) : null}
        </div>
        <div>
          <h2 id="home-newsletter" className="type-h2 text-moss-900">
            {title}
          </h2>
          <p className="mt-3 mb-6 measure type-body text-ink-muted">
            Cadastre seu e-mail e receba o cupom {settings.welcomeCoupon} na hora, além de
            lançamentos e dicas de cuidado.
          </p>
          <NewsletterForm
            submit={subscribe}
            source="FOOTER"
            storeName={settings.name}
            discountPercent={settings.welcomeCouponPercent}
          />
        </div>
      </div>
    </section>
  );
}

const VISIBLE_WORDS = 150;

/** Texto de SEO da home: no máximo 150 palavras visíveis; o restante abre em "Ler mais". */
export function AboutSection({ title, body }: { title: string; body: string | null }) {
  const html = sanitizeRichText(body);
  if (!html) return null;
  const paragraphs = html.match(/<(p|h2|h3|ul|ol)[\s\S]*?<\/\1>/g) ?? [html];
  const visible: string[] = [];
  let words = 0;
  for (const paragraph of paragraphs) {
    const count = paragraph
      .replace(/<[^>]+>/g, " ")
      .trim()
      .split(/\s+/).length;
    if (visible.length > 0 && words + count > VISIBLE_WORDS) break;
    visible.push(paragraph);
    words += count;
  }
  const rest = paragraphs.slice(visible.length);

  return (
    <section aria-labelledby="home-sobre" className="bg-cream-100">
      <div className="container-store py-14">
        <h2 id="home-sobre" className="mb-4 type-h3 text-moss-900">
          {title}
        </h2>
        <RichText html={visible.join("")} className="type-small text-ink-muted" />
        {rest.length > 0 ? (
          <details className="group mt-3">
            <summary className="flex min-h-11 w-fit list-none items-center type-small font-medium text-moss-700 underline underline-offset-3 [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Ler mais</span>
              <span className="hidden group-open:inline">Ler menos</span>
            </summary>
            <RichText html={rest.join("")} className="mt-2 type-small text-ink-muted" />
          </details>
        ) : null}
      </div>
    </section>
  );
}
