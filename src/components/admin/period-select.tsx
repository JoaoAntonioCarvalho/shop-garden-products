"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { PERIOD_PRESETS } from "@/server/admin/periods";

const controlClass = "h-9 rounded-md border border-input bg-background px-2 text-sm";

/** Seletor de período do dashboard e dos relatórios. O período fica na URL. */
export function PeriodSelect({ preset, from, to }: { preset: string; from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  return (
    <div className="flex flex-wrap items-end gap-2" aria-busy={pending || undefined}>
      <div className="flex flex-col gap-1">
        <label htmlFor="periodo" className="text-xs text-muted-foreground">
          Período
        </label>
        <select
          id="periodo"
          value={preset}
          className={controlClass}
          onChange={(event) =>
            update({
              periodo: event.target.value,
              ...(event.target.value === "personalizado"
                ? { de: from, ate: to }
                : { de: null, ate: null }),
            })
          }
        >
          {PERIOD_PRESETS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {preset === "personalizado" ? (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor="periodo-de" className="text-xs text-muted-foreground">
              De
            </label>
            <input
              id="periodo-de"
              type="date"
              defaultValue={from}
              max={to}
              className={controlClass}
              onChange={(event) => event.target.value && update({ de: event.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="periodo-ate" className="text-xs text-muted-foreground">
              Até
            </label>
            <input
              id="periodo-ate"
              type="date"
              defaultValue={to}
              min={from}
              className={controlClass}
              onChange={(event) => event.target.value && update({ ate: event.target.value })}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
