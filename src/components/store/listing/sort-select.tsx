"use client";

import { usePathname, useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { controlClasses } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import {
  buildListingSearch,
  SORT_OPTIONS,
  type ListingQuery,
  type SortValue,
} from "@/server/services/catalog-filters";

export function SortSelect({
  query,
  extraParams,
}: {
  query: ListingQuery;
  extraParams?: Record<string, string>;
}) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="type-small text-ink-muted max-sm:sr-only">
        Ordenar por
      </label>
      <select
        id={id}
        value={query.sort}
        aria-busy={pending || undefined}
        onChange={(event) => {
          const search = buildListingSearch(
            { ...query, sort: event.target.value as SortValue, page: 1 },
            extraParams,
          );
          startTransition(() => router.replace(`${pathname}${search}`, { scroll: false }));
        }}
        className={cn(controlClasses, "h-11 w-auto pr-8 text-[15px] md:h-9")}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
