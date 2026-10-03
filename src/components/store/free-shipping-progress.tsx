import { Truck } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatBRL } from "@/lib/money";

type FreeShippingProgressProps = {
  subtotalCents: number;
  /** Vem de freeShippingThresholdCents na configuração. */
  thresholdCents: number;
  className?: string;
};

export function FreeShippingProgress({
  subtotalCents,
  thresholdCents,
  className,
}: FreeShippingProgressProps) {
  if (thresholdCents <= 0) return null;
  const remaining = Math.max(0, thresholdCents - subtotalCents);
  const percent = Math.min(100, Math.round((subtotalCents / thresholdCents) * 100));
  const text =
    remaining > 0
      ? `Faltam ${formatBRL(remaining)} para frete grátis na Grande SP`
      : "Você ganhou frete grátis na Grande SP";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="flex items-center gap-2 type-small text-ink">
        <Truck aria-hidden="true" strokeWidth={1.5} className="size-4 flex-none text-moss-700" />
        {text}
      </p>
      <div
        role="progressbar"
        aria-label="Progresso para frete grátis"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={text}
        className="h-1.5 overflow-hidden rounded-full bg-moss-100"
      >
        <div className="h-full bg-moss-700 transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
