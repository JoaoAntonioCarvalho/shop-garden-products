import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

type RatingProps = {
  /** Nota de 0 a 5. Estrelas são preenchidas de meia em meia. */
  value: number;
  count?: number;
  /** Mostra a nota numérica ao lado das estrelas. */
  showValue?: boolean;
  size?: "sm" | "md";
  className?: string;
};

export function Rating({ value, count, showValue = false, size = "sm", className }: RatingProps) {
  const rounded = Math.round(value * 2) / 2;
  const formatted = value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const starSize = size === "sm" ? "size-3.5" : "size-5";
  const label =
    count === undefined
      ? `Nota ${formatted} de 5`
      : `Nota ${formatted} de 5, ${count} ${count === 1 ? "avaliação" : "avaliações"}`;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span role="img" aria-label={label} className="inline-flex gap-0.5 text-moss-700">
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = rounded >= star ? 100 : rounded >= star - 0.5 ? 50 : 0;
          return (
            <span key={star} className={cn("relative inline-block", starSize)}>
              <Star
                aria-hidden="true"
                strokeWidth={1.5}
                className={cn("absolute inset-0", starSize)}
              />
              {fill > 0 ? (
                <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill}%` }}>
                  <Star
                    aria-hidden="true"
                    strokeWidth={1.5}
                    fill="currentColor"
                    className={starSize}
                  />
                </span>
              ) : null}
            </span>
          );
        })}
      </span>
      {showValue ? (
        <span aria-hidden="true" className="type-small font-medium text-ink tabular-nums">
          {formatted}
        </span>
      ) : null}
      {count !== undefined ? (
        <span aria-hidden="true" className="type-caption text-ink-muted tabular-nums">
          ({count})
        </span>
      ) : null}
    </span>
  );
}
