import { Gift } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotanicalSheet } from "@/components/store/botanical-sheet";
import { ProductGrid } from "@/components/store/product-card";
import {
  ProductView,
  type ViewImage,
  type ViewVariant,
} from "@/components/store/product/product-view";
import { RecentlyViewed } from "@/components/store/product/recently-viewed";
import { ProductReviews } from "@/components/store/product/reviews";
import { SameDayCountdown } from "@/components/store/product/same-day-countdown";
import { RichText } from "@/components/store/rich-text";
import { WhatsAppButton } from "@/components/store/whatsapp-button";
import { Accordion } from "@/components/ui/accordion";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Rating } from "@/components/ui/rating";
import { categoryHref } from "@/config/category-tree";
import { buildProductSheet } from "@/lib/product-sheet";
import { stripHtml } from "@/lib/sanitize";
import { breadcrumbJsonLd, JsonLd, productJsonLd } from "@/lib/seo/jsonld";
import { absoluteUrl, pageMetadata } from "@/lib/seo/metadata";
import { withWhatsAppUtm } from "@/lib/whatsapp";
import { requestBackInStock } from "@/server/actions/leads";
import {
  availableOf,
  getProductBySlug,
  getProductReviews,
  getRelatedCards,
  getSimilarCards,
  toImage,
} from "@/server/services/catalog";
import { getPriceDisplay } from "@/server/services/pricing";
import { getStoreSettings } from "@/server/services/settings";

type Props = PageProps<"/produto/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || product.status === "DRAFT") return {};
  const cover = toImage(product.images[0]?.media);
  return pageMetadata({
    title: product.seoTitle || product.name,
    description:
      product.seoDescription || product.shortDescription || stripHtml(product.description),
    path: `/produto/${product.slug}`,
    image: cover?.url,
    noindex: product.status === "ARCHIVED",
  });
}

export default async function ProductPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [product, settings] = await Promise.all([getProductBySlug(slug), getStoreSettings()]);

  // Rascunho não existe para o público. A pré-visualização do admin fica em /admin/produtos.
  if (!product || product.status === "DRAFT") notFound();

  if (product.status === "ARCHIVED") {
    const similar = await getSimilarCards(product.primaryCategoryId, product.id, settings);
    return (
      <div className="container-store py-12">
        <EmptyState
          headingLevel="h1"
          title="Este produto não está mais disponível"
          description={`${product.name} saiu do catálogo. Veja opções parecidas abaixo.`}
          action={
            product.primaryCategory ? (
              <Link
                href={categoryHref(product.primaryCategory.path)}
                className={buttonClasses("secondary")}
              >
                Ver {product.primaryCategory.name.toLowerCase()}
              </Link>
            ) : null
          }
        />
        {similar.length > 0 ? (
          <ProductGrid products={similar} listName="Produtos parecidos" />
        ) : null}
      </div>
    );
  }

  const now = new Date();
  const variants: ViewVariant[] = product.variants.map((variant) => ({
    id: variant.id,
    name: variant.name,
    sku: variant.sku,
    options: (variant.options ?? {}) as Record<string, string>,
    available: availableOf(variant),
    lowStockThreshold: variant.lowStockThreshold,
    price: getPriceDisplay(variant, settings, now),
  }));
  if (variants.length === 0) notFound();

  const images: ViewImage[] = product.images.flatMap((image) => {
    const data = toImage(image.media, product.name);
    return data
      ? [
          {
            id: image.id,
            url: data.url,
            alt: data.alt,
            blurDataUrl: data.blurDataUrl ?? null,
            variantId: image.variantId,
          },
        ]
      : [];
  });

  const reviewsPage = Math.max(
    1,
    Number(Array.isArray(query.avaliacoes) ? query.avaliacoes[0] : query.avaliacoes) || 1,
  );
  const [related, reviewData] = await Promise.all([
    getRelatedCards(product, settings),
    product.ratingCount > 0 ? getProductReviews(product.id, 1) : null,
  ]);

  const category = product.primaryCategory;
  const breadcrumb: BreadcrumbItem[] = [
    { label: "Início", href: "/" },
    ...(category?.parent
      ? [{ label: category.parent.name, href: categoryHref(category.parent.path) }]
      : []),
    ...(category ? [{ label: category.name, href: categoryHref(category.path) }] : []),
    { label: product.name, href: `/produto/${product.slug}` },
  ];

  const sheet = buildProductSheet({ ...product, weightGrams: product.variants[0]?.weightGrams });
  const cheapest = [...variants].sort((a, b) => a.price.priceCents - b.price.priceCents)[0];
  const inStock = variants.some((variant) => variant.available > 0);
  const sameDayPossible = settings.sameDay.enabled && product.sameDayEligible && inStock;
  const productUrl = absoluteUrl(`/produto/${product.slug}`);
  const localOnly = product.deliveryScope === "LOCAL_ONLY";

  const accordion = [
    product.description
      ? { id: "descricao", title: "Descrição", content: <RichText html={product.description} /> }
      : null,
    product.careInstructions
      ? { id: "cuidados", title: "Cuidados", content: <RichText html={product.careInstructions} /> }
      : null,
    {
      id: "entrega",
      title: "Entrega e embalagem",
      content: (
        <div className="measure type-body text-ink">
          <p>{settings.packagingText}</p>
          <p className="mt-3">
            {localOnly
              ? "Este produto é entregue apenas na Grande São Paulo, por equipe própria."
              : "Este produto é enviado para todo o Brasil."}{" "}
            <Link href="/entrega" className="text-moss-700 underline underline-offset-3">
              Ver entrega e prazos
            </Link>
          </p>
        </div>
      ),
    },
    {
      id: "trocas",
      title: "Trocas e devoluções",
      content: (
        <p className="measure type-body text-ink">
          Você pode desistir da compra em até 7 dias depois de receber. Se o produto chegar com
          avaria, envie fotos em até 48 horas e fazemos a troca.{" "}
          <Link href="/trocas-e-devolucoes" className="text-moss-700 underline underline-offset-3">
            Ver política de trocas
          </Link>
        </p>
      ),
    },
  ].filter((item) => item !== null);

  return (
    <div className="container-store pt-6 pb-16">
      <JsonLd
        data={[
          breadcrumbJsonLd(breadcrumb),
          productJsonLd(
            {
              name: product.name,
              slug: product.slug,
              sku: product.sku,
              description: product.shortDescription || stripHtml(product.description).slice(0, 300),
              brand: product.brand,
              images: images.map((image) => image.url),
              priceCents: cheapest.price.priceCents,
              inStock,
              priceValidUntil: cheapest.price.promoEndsAt,
              ratingAverage: product.ratingAverage,
              ratingCount: product.ratingCount,
              reviews: reviewData?.reviews ?? [],
            },
            settings,
          ),
        ]}
      />
      <Breadcrumb items={breadcrumb} className="mb-6" />

      <ProductView
        product={{
          id: product.id,
          name: product.name,
          sku: product.sku,
          slug: product.slug,
          categoryName: category?.name,
        }}
        images={images}
        variants={variants}
        notifyBackInStock={requestBackInStock}
        header={
          <>
            <h1 className="type-h1 text-moss-900">{product.name}</h1>
            {product.scientificName ? (
              <p className="mt-1 type-scientific text-[22px] leading-snug text-moss-700">
                {product.scientificName}
              </p>
            ) : null}
            {product.ratingCount > 0 ? (
              <a
                href="#avaliacoes"
                className="mt-3 inline-flex min-h-11 items-center gap-2 underline-offset-3 hover:underline"
              >
                <Rating value={product.ratingAverage} count={product.ratingCount} showValue />
                <span className="sr-only">Ver avaliações</span>
              </a>
            ) : null}
          </>
        }
      >
        <div className="mt-6 flex flex-col gap-5">
          {sameDayPossible ? (
            <SameDayCountdown sameDay={settings.sameDay} holidays={settings.holidays} />
          ) : null}
          {product.isGiftable ? (
            <p className="flex items-start gap-3 type-small text-ink">
              <Gift
                aria-hidden="true"
                strokeWidth={1.5}
                className="mt-0.5 size-5 flex-none text-moss-700"
              />
              Vai presentear? Inclua um cartão com sua mensagem no carrinho, sem custo.
            </p>
          ) : null}
          <WhatsAppButton
            number={settings.whatsapp}
            message={`Olá! Tenho uma dúvida sobre ${product.name} (${withWhatsAppUtm(productUrl, "produto")}).`}
            position="produto"
            variant="ghost"
            className="-ml-5 self-start"
          >
            Tirar dúvida pelo WhatsApp
          </WhatsAppButton>
        </div>
      </ProductView>

      <div className="mt-16 grid gap-12 lg:grid-cols-2">
        {sheet ? (
          <BotanicalSheet
            heading={sheet.heading}
            title={sheet.title}
            scientificName={sheet.scientificName}
            rows={sheet.rows}
            sku={product.sku}
            className="self-start"
          />
        ) : null}
        <Accordion
          items={accordion}
          defaultOpen={["descricao"]}
          headingLevel="h2"
          className={sheet ? "" : "lg:col-span-2"}
        />
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="combina-com" className="mt-20">
          <h2 id="combina-com" className="mb-6 type-h2 text-moss-900">
            Combina com
          </h2>
          <ProductGrid products={related} listName="Combina com" layout="scroll" />
        </section>
      ) : null}

      <ProductReviews
        productId={product.id}
        productSlug={product.slug}
        ratingAverage={product.ratingAverage}
        page={reviewsPage}
      />

      <RecentlyViewed currentSlug={product.slug} />
    </div>
  );
}
