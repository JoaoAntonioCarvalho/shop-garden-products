import Link from "next/link";
import { cn } from "@/lib/cn";

type PaginationProps = {
  page: number;
  totalPages: number;
  /** Monta a URL de cada página, preservando filtros e ordenação. */
  hrefFor: (page: number) => string;
  className?: string;
};

/** Páginas a exibir: primeira, última, vizinhas da atual e reticências entre os blocos. */
export function getPageWindow(page: number, totalPages: number): Array<number | "gap"> {
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const result: Array<number | "gap"> = [];
  sorted.forEach((p, index) => {
    if (index > 0 && p - sorted[index - 1] > 1) result.push("gap");
    result.push(p);
  });
  return result;
}

const itemClass =
  "flex min-h-11 min-w-11 items-center justify-center rounded-control px-3 text-[15px] tabular-nums transition-colors";

export function Pagination({ page, totalPages, hrefFor, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Paginação"
      className={cn("flex flex-wrap items-center justify-center gap-1", className)}
    >
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          rel="prev"
          className={cn(itemClass, "text-moss-700 hover:bg-moss-100")}
        >
          Anterior
        </Link>
      ) : null}
      <ol className="flex items-center gap-1">
        {getPageWindow(page, totalPages).map((item, index) =>
          item === "gap" ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-ink-muted">
              …
            </li>
          ) : (
            <li key={item}>
              {item === page ? (
                <span
                  aria-current="page"
                  className={cn(itemClass, "bg-moss-700 font-medium text-white")}
                >
                  <span className="sr-only">Página </span>
                  {item}
                </span>
              ) : (
                <Link
                  href={hrefFor(item)}
                  className={cn(itemClass, "text-moss-700 hover:bg-moss-100")}
                >
                  <span className="sr-only">Página </span>
                  {item}
                </Link>
              )}
            </li>
          ),
        )}
      </ol>
      {page < totalPages ? (
        <Link
          href={hrefFor(page + 1)}
          rel="next"
          className={cn(itemClass, "text-moss-700 hover:bg-moss-100")}
        >
          Próxima
        </Link>
      ) : null}
    </nav>
  );
}
