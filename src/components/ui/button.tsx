import { Slot } from "radix-ui";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "whatsapp";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap transition-colors select-none disabled:opacity-50 aria-disabled:opacity-50 aria-disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-wine-700 text-white hover:bg-wine-800 active:bg-wine-800",
  secondary:
    "border border-moss-700 bg-transparent text-moss-700 hover:bg-moss-100 active:bg-moss-100",
  ghost: "bg-transparent text-moss-700 hover:bg-moss-100 active:bg-moss-100",
  whatsapp: "bg-moss-700 text-white hover:bg-moss-900 active:bg-moss-900",
};

// Altura mínima de 44px no mobile em todos os tamanhos (área de toque).
const sizes: Record<Size, string> = {
  sm: "min-h-11 px-4 text-[14px] md:min-h-9 md:px-3",
  md: "min-h-11 px-5 text-[15px]",
  lg: "min-h-13 px-7 text-[16px]",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Mostra o spinner e bloqueia o clique. O texto continua na tela e para leitores de tela. */
  loading?: boolean;
  /** Renderiza o filho (por exemplo um Link) com a aparência de botão. */
  asChild?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  asChild = false,
  icon,
  className,
  children,
  disabled,
  type,
  ...props
}: ButtonProps) {
  const classes = buttonClasses(variant, size, className);

  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}
