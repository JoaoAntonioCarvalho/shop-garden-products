"use client";

import { Download, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { cn } from "@/lib/cn";

export type FilterField =
  | {
      type: "select";
      name: string;
      label: string;
      options: Array<{ value: string; label: string }>;
    }
  | { type: "date"; name: string; label: string }
  | { type: "toggle"; name: string; label: string }
  | { type: "text"; name: string; label: string; placeholder?: string };

type FilterBarProps = {
  searchPlaceholder?: string;
  fields?: FilterField[];
  /** Endereço da exportação CSV do resultado filtrado (só aparece para quem pode exportar). */
  exportHref?: string;
};

const controlClass =
  "h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground";

/** Busca e filtros das listas. Tudo vai para a URL, então a lista filtrada pode ser compartilhada. */
export function FilterBar({ searchPlaceholder, fields = [], exportHref }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("busca") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function update(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    params.delete("pagina");
    const text = params.toString();
    startTransition(() =>
      router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false }),
    );
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const activeCount =
    fields.filter((field) => searchParams.get(field.name)).length +
    (searchParams.get("busca") ? 1 : 0);
  const exportQuery = searchParams.toString();

  return (
    <div
      className={cn("mb-4 flex flex-wrap items-end gap-2", pending && "opacity-70")}
      aria-busy={pending || undefined}
    >
      {searchPlaceholder ? (
        <div className="relative min-w-[220px] flex-1 md:max-w-sm">
          <label htmlFor="lista-busca" className="sr-only">
            {searchPlaceholder}
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground"
          />
          <Input
            id="lista-busca"
            type="search"
            value={query}
            placeholder={searchPlaceholder}
            className="pl-8"
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => update({ busca: value.trim() || null }), 350);
            }}
          />
        </div>
      ) : null}

      {fields.map((field) => {
        const value = searchParams.get(field.name) ?? "";
        const id = `filtro-${field.name}`;
        if (field.type === "toggle") {
          return (
            <label
              key={field.name}
              className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm"
            >
              <input
                type="checkbox"
                className="control-check size-4"
                checked={value === "1"}
                onChange={(event) => update({ [field.name]: event.target.checked ? "1" : null })}
              />
              {field.label}
            </label>
          );
        }
        return (
          <div key={field.name} className="flex flex-col gap-1">
            <label htmlFor={id} className="text-xs text-muted-foreground">
              {field.label}
            </label>
            {field.type === "select" ? (
              <select
                id={id}
                value={value}
                onChange={(event) => update({ [field.name]: event.target.value || null })}
                className={controlClass}
              >
                <option value="">Todos</option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                type={field.type === "date" ? "date" : "text"}
                defaultValue={value}
                placeholder={field.type === "text" ? field.placeholder : undefined}
                onChange={(event) => {
                  if (field.type === "date") update({ [field.name]: event.target.value || null });
                }}
                onBlur={(event) => {
                  if (field.type === "text")
                    update({ [field.name]: event.target.value.trim() || null });
                }}
                onKeyDown={(event) => {
                  if (field.type === "text" && event.key === "Enter")
                    update({ [field.name]: event.currentTarget.value.trim() || null });
                }}
                className={cn(controlClass, field.type === "text" && "w-36")}
              />
            )}
          </div>
        );
      })}

      {activeCount > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={() => {
            setQuery("");
            const sort = searchParams.get("ordem");
            const dir = searchParams.get("dir");
            const params = new URLSearchParams();
            if (sort) params.set("ordem", sort);
            if (dir) params.set("dir", dir);
            const text = params.toString();
            startTransition(() =>
              router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false }),
            );
          }}
        >
          <X aria-hidden="true" className="size-4" />
          Limpar filtros
        </Button>
      ) : null}

      {exportHref ? (
        <Button asChild variant="outline" size="sm" className="ml-auto h-9">
          {/* Download de arquivo, não navegação. */}
          <a href={`${exportHref}${exportQuery ? `?${exportQuery}` : ""}`} download>
            <Download aria-hidden="true" className="size-4" />
            Exportar CSV
          </a>
        </Button>
      ) : null}
    </div>
  );
}
