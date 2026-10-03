import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { ProductImageData } from "./product-card";

type CategoryTileProps = {
  name: string;
  href: string;
  image: ProductImageData | null;
  sizes?: string;
  /** Define a proporção pelo contêiner (grade assimétrica da home). Sem isso usa 4:5. */
  fill?: boolean;
  className?: string;
};

/** Foto com o nome da categoria em Cormorant sobre uma faixa creme na base. */
export function CategoryTile({
  name,
  href,
  image,
  sizes = "(min-width: 1024px) 25vw, 50vw",
  fill = false,
  className,
}: CategoryTileProps) {
  const src = image?.url ?? "/brand/placeholder.svg";
  return (
    <Link
      href={href}
      className={cn(
        "group relative block overflow-hidden rounded-photo bg-white",
        fill ? "h-full min-h-[220px]" : "aspect-4/5",
        className,
      )}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        unoptimized={src.endsWith(".svg")}
        placeholder={image?.blurDataUrl ? "blur" : "empty"}
        blurDataURL={image?.blurDataUrl ?? undefined}
        className="object-cover"
      />
      <span className="absolute inset-x-0 bottom-0 bg-cream-50 px-3 py-2.5 font-serif text-[20px] leading-tight font-medium text-moss-900 underline-offset-4 group-hover:underline md:px-4 md:py-3 md:text-[24px]">
        {name}
      </span>
    </Link>
  );
}
