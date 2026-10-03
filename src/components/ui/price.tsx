import { cn } from "@/lib/cn";
import { formatBRL } from "@/lib/money";
import type { PriceDisplay } from "@/server/services/pricing";

type PriceProps = {
  /** Resultado de getPriceDisplay(). Este componente só formata, nunca calcula. */
  price: PriceDisplay;
  /** card: compacto, para vitrines. product: página de produto. line: uma linha, para sacola. */
  size?: "card" | "product" | "line";
  className?: string;
};

export function Price({ price, size = "card", className }: PriceProps) {
  const {
    priceCents,
    compareAtCents,
    discountPercent,
    pixCents,
    pixDiscountPercent,
    installments,
  } = price;

  if (size === "line") {
    return (
      <span className={cn("inline-flex items-baseline gap-2 tabular-nums", className)}>
        {compareAtCents ? (
          <s className="type-caption text-ink-muted">
            <span className="sr-only">De </span>
            {formatBRL(compareAtCents)}
          </s>
        ) : null}
        <span className={cn("font-medium", compareAtCents ? "text-wine-700" : "text-ink")}>
          {compareAtCents ? <span className="sr-only">por </span> : null}
          {formatBRL(priceCents)}
        </span>
      </span>
    );
  }

  const isProduct = size === "product";

  return (
    <div className={cn("flex flex-col tabular-nums", isProduct ? "gap-1.5" : "gap-0.5", className)}>
      {compareAtCents ? (
        <p className={cn("text-ink-muted", isProduct ? "type-small" : "type-caption")}>
          <s>
            <span className="sr-only">De </span>
            {formatBRL(compareAtCents)}
          </s>
          {isProduct && discountPercent ? (
            <span className="ml-2 rounded-photo bg-wine-50 px-1.5 py-0.5 font-medium text-wine-700">
              {discountPercent}% de desconto
            </span>
          ) : null}
        </p>
      ) : null}
      <p
        className={cn(
          "font-semibold",
          isProduct ? "text-[30px] leading-tight" : "text-[16px]",
          compareAtCents ? "text-wine-700" : "text-ink",
        )}
      >
        {compareAtCents ? <span className="sr-only">Por </span> : null}
        {formatBRL(priceCents)}
      </p>
      {pixDiscountPercent > 0 ? (
        <p className={cn("text-moss-700", isProduct ? "type-body font-medium" : "type-caption")}>
          {formatBRL(pixCents)} no Pix
          {isProduct ? ` (${pixDiscountPercent}% de desconto)` : null}
        </p>
      ) : null}
      {installments && isProduct ? (
        <p className="type-small text-ink-muted">
          ou {installments.count}x de {formatBRL(installments.valueCents)} sem juros
        </p>
      ) : null}
    </div>
  );
}
