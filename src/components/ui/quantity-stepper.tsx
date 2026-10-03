"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

type QuantityStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  /** Normalmente o estoque disponível. */
  max?: number;
  disabled?: boolean;
  /** Nome do produto, para o rótulo acessível. */
  label?: string;
  size?: "sm" | "md";
  className?: string;
};

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled,
  label,
  size = "md",
  className,
}: QuantityStepperProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const buttonClass = cn(
    "flex items-center justify-center text-moss-700 transition-colors hover:bg-moss-100 disabled:text-ink-muted disabled:opacity-40 disabled:hover:bg-transparent",
    size === "md" ? "size-11" : "size-11 md:size-9",
  );
  const suffix = label ? ` de ${label}` : "";

  return (
    <div
      role="group"
      aria-label={`Quantidade${suffix}`}
      className={cn(
        "inline-flex items-center overflow-hidden rounded-control border border-moss-500 bg-white",
        disabled && "opacity-60",
        className,
      )}
    >
      <button
        type="button"
        className={buttonClass}
        aria-label={`Diminuir quantidade${suffix}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        <Minus aria-hidden="true" strokeWidth={1.5} className="size-4" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={`Quantidade${suffix}`}
        className={cn(
          "w-10 bg-transparent text-center text-[15px] font-medium tabular-nums",
          size === "md" ? "h-11" : "h-11 md:h-9",
        )}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const parsed = Number(event.target.value.replace(/\D/g, ""));
          if (parsed) onChange(clamp(parsed));
        }}
      />
      <button
        type="button"
        className={buttonClass}
        aria-label={`Aumentar quantidade${suffix}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        <Plus aria-hidden="true" strokeWidth={1.5} className="size-4" />
      </button>
    </div>
  );
}
