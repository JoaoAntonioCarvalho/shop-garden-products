import Image from "next/image";
import Link from "next/link";
import { Badge, badgePriority, type BadgeKind } from "@/components/ui/badge";
import { Price } from "@/components/ui/price";
import { Rating } from "@/components/ui/rating";
import { cn } from "@/lib/cn";
import type { PriceDisplay } from "@/server/services/pricing";
import { CardAddButton, WishlistToggle } from "./product-card-actions";

export type ProductImageData = { url: string; alt: string; blurDataUrl?: string | null };

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  sku: string;
  categoryName?: string;
  /** Para plantas: aparece em itálico abaixo do nome. */
  scientificName?: string | null;
  image: ProductImageData | null;
  /** Segunda foto, mostrada ao passar o mouse no desktop. */
  hoverImage?: ProductImageData | null;
  price: PriceDisplay;
  ratingAverage: number;
  ratingCount: number;
  badges: BadgeKind[];
  /** Variante a adicionar direto do card. Nula quando há várias opções ou está esgotado. */
  quickAddVariantId: string | null;
  hasOptions: boolean;
  soldOut: boolean;
  wishlisted?: boolean;
};

const PLACEHOLDER = "/brand/placeholder.svg";

/** No máximo dois selos, pela prioridade: Esgotado, Promoção, Entrega hoje, Novo, Últimas unidades. */
export function pickBadges(badges: BadgeKind[]): BadgeKind[] {
  return badgePriority.filter((kind) => badges.includes(kind)).slice(0, 2);
}

type ProductCardProps = {
  product: ProductCardData;
  /** Atributo sizes do next/image, conforme a grade em que o card está. */
  sizes?: string;
  /** Carrega a imagem com prioridade (só para o que está acima da dobra). */
  priority?: boolean;
  /** Nome da vitrine, para os eventos de analytics. */
  listName?: string;
  className?: string;
};

export function ProductCard({
  product,
  sizes = "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw",
  priority = false,
  className,
}: ProductCardProps) {
  const image = product.image ?? { url: PLACEHOLDER, alt: "" };
  const href = `/produto/${product.slug}`;
  const badges = pickBadges(product.badges);

  return (
    <article className={cn("group relative flex flex-col", className)}>
      <div className="relative aspect-4/5 overflow-hidden rounded-photo bg-white">
        <Image
          src={image.url}
          alt={image.alt}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized={image.url.endsWith(".svg")}
          placeholder={image.blurDataUrl ? "blur" : "empty"}
          blurDataURL={image.blurDataUrl ?? undefined}
          className={cn(
            "object-cover",
            product.hoverImage && "transition-opacity duration-200 md:group-hover:opacity-0",
            product.soldOut && "opacity-60",
          )}
        />
        {product.hoverImage ? (
          <Image
            src={product.hoverImage.url}
            alt=""
            fill
            sizes={sizes}
            loading="lazy"
            unoptimized={product.hoverImage.url.endsWith(".svg")}
            className="hidden object-cover opacity-0 transition-opacity duration-200 md:block md:group-hover:opacity-100"
          />
        ) : null}
        {badges.length > 0 ? (
          <div className="pointer-events-none absolute top-2 left-2 flex flex-col items-start gap-1">
            {badges.map((kind) => (
              <Badge key={kind} kind={kind} percent={product.price.discountPercent} />
            ))}
          </div>
        ) : null}
      </div>

      {/* Fica acima do link que cobre o card, para continuar clicável. */}
      <WishlistToggle
        productId={product.id}
        productName={product.name}
        className="absolute top-1 right-1 z-10"
      />

      <div className="flex flex-1 flex-col gap-1 pt-3">
        <h3 className="line-clamp-2 text-[15px] leading-snug font-medium text-ink">
          {/* O pseudo-elemento cobre o card inteiro, tornando-o todo clicável. */}
          <Link
            href={href}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-moss-700"
          >
            {product.name}
          </Link>
        </h3>
        {product.scientificName ? (
          <p className="line-clamp-1 type-caption text-ink-muted italic">
            {product.scientificName}
          </p>
        ) : null}
        {product.ratingCount > 0 ? (
          <Rating value={product.ratingAverage} count={product.ratingCount} />
        ) : null}
        <Price price={product.price} size="card" className="mt-1" />
        <div className="relative z-10 mt-auto pt-2">
          <CardAddButton
            productSlug={product.slug}
            productName={product.name}
            variantId={product.quickAddVariantId}
            hasOptions={product.hasOptions}
            soldOut={product.soldOut}
          />
        </div>
      </div>
    </article>
  );
}

type ProductGridProps = {
  products: ProductCardData[];
  listName?: string;
  /** Quantos cards do início carregam a imagem com prioridade. */
  priorityCount?: number;
  /** scroll: rolagem horizontal no mobile e grade no desktop (vitrines da home). */
  layout?: "grid" | "scroll";
  className?: string;
};

/** Grade padrão: 2 colunas no mobile, 3 no tablet, 4 no desktop. */
export function ProductGrid({
  products,
  listName,
  priorityCount = 0,
  layout = "grid",
  className,
}: ProductGridProps) {
  return (
    <ul
      className={cn(
        layout === "grid"
          ? "grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 md:gap-y-10 lg:grid-cols-4"
          : "-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-x-6 md:gap-y-10 md:overflow-visible md:px-0 lg:grid-cols-4",
        className,
      )}
    >
      {products.map((product, index) => (
        <li
          key={product.id}
          className={cn(
            "flex",
            layout === "scroll" &&
              "w-[62vw] max-w-[260px] flex-none snap-start md:w-auto md:max-w-none",
          )}
        >
          <ProductCard
            product={product}
            listName={listName}
            priority={index < priorityCount}
            className="w-full"
          />
        </li>
      ))}
    </ul>
  );
}
