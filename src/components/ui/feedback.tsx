import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Bloco cinza que ocupa o lugar do conteúdo enquanto carrega. Sem animação, por decisão de design. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("rounded-photo bg-cream-100", className)} />;
}

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Botões ou links que convidam a agir. */
  action?: ReactNode;
  headingLevel?: "h1" | "h2" | "h3";
  className?: string;
  /** Conteúdo extra abaixo das ações (sugestões de categorias, por exemplo). */
  children?: ReactNode;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  headingLevel = "h2",
  className,
  children,
}: EmptyStateProps) {
  const Heading = headingLevel;
  return (
    <div className={cn("flex flex-col items-center px-4 py-16 text-center", className)}>
      {icon ? <div className="mb-4 text-moss-500 [&_svg]:size-10">{icon}</div> : null}
      <Heading className="type-h3 text-moss-900">{title}</Heading>
      {description ? <p className="mt-2 max-w-md type-body text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div> : null}
      {children ? <div className="mt-8 w-full">{children}</div> : null}
    </div>
  );
}

type AlertTone = "info" | "success" | "warning" | "error";

const alertStyles: Record<AlertTone, { box: string; icon: ReactNode }> = {
  info: {
    box: "border-moss-500 bg-moss-100 text-ink",
    icon: <Info aria-hidden="true" strokeWidth={1.5} className="size-5 flex-none text-moss-700" />,
  },
  success: {
    box: "border-moss-700 bg-moss-100 text-ink",
    icon: (
      <CircleCheck aria-hidden="true" strokeWidth={1.5} className="size-5 flex-none text-success" />
    ),
  },
  warning: {
    box: "border-warning bg-white text-ink",
    icon: (
      <TriangleAlert
        aria-hidden="true"
        strokeWidth={1.5}
        className="size-5 flex-none text-warning"
      />
    ),
  },
  error: {
    box: "border-danger bg-wine-50 text-ink",
    icon: (
      <CircleAlert aria-hidden="true" strokeWidth={1.5} className="size-5 flex-none text-danger" />
    ),
  },
};

type AlertProps = {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  /** Anuncia o conteúdo a leitores de tela assim que aparece (erros de formulário, avisos de estoque). */
  live?: boolean;
  className?: string;
};

/** A informação nunca depende só da cor: todo alerta tem ícone e texto. */
export function Alert({ tone = "info", title, children, live, className }: AlertProps) {
  const style = alertStyles[tone];
  return (
    <div
      role={live ? (tone === "error" ? "alert" : "status") : undefined}
      className={cn("flex gap-3 rounded-control border p-4", style.box, className)}
    >
      <span className="mt-0.5">{style.icon}</span>
      <div className="min-w-0 flex-1 type-small">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn(title && "mt-1")}>{children}</div> : null}
      </div>
    </div>
  );
}
