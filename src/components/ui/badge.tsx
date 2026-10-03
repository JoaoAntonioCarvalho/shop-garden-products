import { BadgeCheck, Clock, Truck } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeKind = "soldOut" | "sale" | "sameDay" | "new" | "lowStock" | "verified";

/** Ordem de prioridade dos selos no card de produto (seção 10.4). No máximo dois aparecem. */
export const badgePriority: BadgeKind[] = ["soldOut", "sale", "sameDay", "new", "lowStock"];

const styles: Record<BadgeKind, string> = {
  soldOut: "bg-cream-100 text-ink border border-line",
  sale: "bg-wine-50 text-wine-700",
  sameDay: "bg-moss-700 text-white",
  new: "bg-white text-moss-700 border border-moss-700",
  lowStock: "bg-white text-warning border border-warning",
  verified: "bg-moss-100 text-moss-700",
};

const icons: Partial<Record<BadgeKind, ReactNode>> = {
  sameDay: <Truck aria-hidden="true" strokeWidth={1.5} className="size-3.5" />,
  lowStock: <Clock aria-hidden="true" strokeWidth={1.5} className="size-3.5" />,
  verified: <BadgeCheck aria-hidden="true" strokeWidth={1.5} className="size-3.5" />,
};

type BadgeProps = {
  kind: BadgeKind;
  /** Percentual de desconto, para o selo de promoção. */
  percent?: number | null;
  className?: string;
  children?: ReactNode;
};

export function badgeLabel(kind: BadgeKind, percent?: number | null): string {
  switch (kind) {
    case "soldOut":
      return "Esgotado";
    case "sale":
      return percent ? `-${percent}%` : "Promoção";
    case "sameDay":
      return "Entrega hoje";
    case "new":
      return "Novo";
    case "lowStock":
      return "Últimas unidades";
    case "verified":
      return "Compra verificada";
  }
}

export function Badge({ kind, percent, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-photo px-2 py-0.5 text-[12px] leading-5 font-medium",
        styles[kind],
        className,
      )}
    >
      {icons[kind]}
      {kind === "sale" && percent ? <span className="sr-only">Promoção: </span> : null}
      {children ?? badgeLabel(kind, percent)}
    </span>
  );
}
