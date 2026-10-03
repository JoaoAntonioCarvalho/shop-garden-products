"use client";

import { SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Slider } from "radix-ui";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { formatBRLShort } from "@/lib/money";
import {
  buildListingSearch,
  countActiveFilters,
  filterLabels,
  type Facets,
  type Filters,
  type ListingQuery,
} from "@/server/services/catalog-filters";

type ArrayKey = { [K in keyof Filters]: Filters[K] extends string[] ? K : never }[keyof Filters];
type BooleanKey = { [K in keyof Filters]: Filters[K] extends boolean ? K : never }[keyof Filters];

type FilterPanelProps = {
  query: ListingQuery;
  facets: Facets;
  /** Grupos que a categoria exibe (Category.filtersConfig). */
  groups: string[];
  /** Parâmetros que precisam ser preservados na URL (por exemplo o termo da busca). */
  extraParams?: Record<string, string>;
  resultCount: number;
};

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-b border-line py-4">
      <legend className="float-left mb-2 w-full type-small font-semibold text-ink">{title}</legend>
      <div className="clear-both flex flex-col">{children}</div>
    </fieldset>
  );
}

function Option({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 type-small text-ink md:min-h-9">
      <input
        type="checkbox"
        className="control-check"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="flex-1">{label}</span>
      {count !== undefined ? (
        <span className="type-caption text-ink-muted tabular-nums">{count}</span>
      ) : null}
    </label>
  );
}

/** Controles de filtro. O estado vive na URL: cada mudança navega, e a página é compartilhável. */
function FilterControls({ query, facets, groups, extraParams }: FilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const { filters } = query;
  const has = (group: string) => groups.includes(group);

  const priceFloor = Math.floor(facets.priceMinCents / 100);
  const priceCeil = Math.max(priceFloor + 1, Math.ceil(facets.priceMaxCents / 100));
  const [price, setPrice] = useState<[number, number]>([
    filters.priceMin !== null ? filters.priceMin / 100 : priceFloor,
    filters.priceMax !== null ? filters.priceMax / 100 : priceCeil,
  ]);

  function navigate(next: Filters) {
    const search = buildListingSearch({ filters: next, sort: query.sort, page: 1 }, extraParams);
    startTransition(() => router.replace(`${pathname}${search}`, { scroll: false }));
  }

  const toggleArray = (key: ArrayKey, value: string, checked: boolean) =>
    navigate({
      ...filters,
      [key]: checked ? [...filters[key], value] : filters[key].filter((item) => item !== value),
    });
  const toggleBoolean = (key: BooleanKey, checked: boolean) =>
    navigate({ ...filters, [key]: checked });

  function commitPrice([min, max]: [number, number]) {
    navigate({
      ...filters,
      priceMin: min > priceFloor ? Math.round(min * 100) : null,
      priceMax: max < priceCeil ? Math.round(max * 100) : null,
    });
  }

  const fixedGroup = (
    key: "luz" | "ambiente" | "cuidado" | "porte" | "altura" | "boca" | "uso" | "vaso",
    title: string,
  ) =>
    has(key) ? (
      <Group title={title}>
        {Object.entries(filterLabels[key]).map(([value, label]) => (
          <Option
            key={value}
            label={label}
            checked={filters[key].includes(value)}
            onChange={(checked) => toggleArray(key, value, checked)}
          />
        ))}
      </Group>
    ) : null;

  const facetGroup = (key: "material" | "cor" | "tipo" | "marca", title: string) =>
    has(key) && facets[key].length > 1 ? (
      <Group title={title}>
        {facets[key].map((option) => (
          <Option
            key={option.value}
            label={option.label}
            count={option.count}
            checked={filters[key].includes(option.value)}
            onChange={(checked) => toggleArray(key, option.value, checked)}
          />
        ))}
      </Group>
    ) : null;

  return (
    <div
      aria-busy={pending || undefined}
      className={cn("transition-opacity", pending && "opacity-60")}
    >
      {priceCeil - priceFloor > 1 ? (
        <Group title="Preço">
          <Slider.Root
            min={priceFloor}
            max={priceCeil}
            step={1}
            minStepsBetweenThumbs={1}
            value={price}
            onValueChange={(value) => setPrice(value as [number, number])}
            onValueCommit={(value) => commitPrice(value as [number, number])}
            className="relative mt-2 flex h-11 touch-none items-center select-none"
          >
            <Slider.Track className="relative h-1 flex-1 rounded-full bg-moss-100">
              <Slider.Range className="absolute h-full rounded-full bg-moss-700" />
            </Slider.Track>
            <Slider.Thumb
              aria-label="Preço mínimo"
              className="block size-5 rounded-full border-2 border-moss-700 bg-white"
            />
            <Slider.Thumb
              aria-label="Preço máximo"
              className="block size-5 rounded-full border-2 border-moss-700 bg-white"
            />
          </Slider.Root>
          <div className="flex items-end gap-2">
            {(["Mínimo", "Máximo"] as const).map((label, index) => (
              <label key={label} className="flex-1 type-caption text-ink-muted">
                {label}
                <span className="mt-1 flex items-center gap-1">
                  <span aria-hidden="true">R$</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={priceFloor}
                    max={priceCeil}
                    value={price[index]}
                    onChange={(event) => {
                      const next: [number, number] = [...price];
                      next[index] = Number(event.target.value);
                      setPrice(next);
                    }}
                    onBlur={() =>
                      commitPrice([Math.min(price[0], price[1]), Math.max(price[0], price[1])])
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter")
                        commitPrice([Math.min(price[0], price[1]), Math.max(price[0], price[1])]);
                    }}
                    className="h-11 w-full rounded-control border border-moss-500 bg-white px-2 text-[16px] text-ink tabular-nums md:h-9 md:text-[14px]"
                  />
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 type-caption text-ink-muted">
            De {formatBRLShort(facets.priceMinCents)} a {formatBRLShort(facets.priceMaxCents)} nesta
            lista.
          </p>
        </Group>
      ) : null}

      <Group title="Disponibilidade">
        <Option
          label="Disponível em estoque"
          checked={filters.inStock}
          onChange={(c) => toggleBoolean("inStock", c)}
        />
        <Option
          label="Entrega hoje"
          checked={filters.sameDay}
          onChange={(c) => toggleBoolean("sameDay", c)}
        />
        <Option
          label="Em promoção"
          checked={filters.onSale}
          onChange={(c) => toggleBoolean("onSale", c)}
        />
      </Group>

      {fixedGroup("luz", "Luminosidade")}
      {fixedGroup("ambiente", "Ambiente")}
      {has("pet") ? (
        <Group title="Pets">
          <Option
            label="Pet friendly"
            checked={filters.pet}
            onChange={(c) => toggleBoolean("pet", c)}
          />
        </Group>
      ) : null}
      {fixedGroup("cuidado", "Nível de cuidado")}
      {fixedGroup("porte", "Porte")}
      {facetGroup("tipo", "Tipo")}
      {facetGroup("material", "Material")}
      {facetGroup("cor", "Cor")}
      {fixedGroup("altura", "Altura")}
      {fixedGroup("boca", "Diâmetro da boca")}
      {has("furo") ? (
        <Group title="Drenagem">
          <Option
            label="Com furo de drenagem"
            checked={filters.furo}
            onChange={(c) => toggleBoolean("furo", c)}
          />
        </Group>
      ) : null}
      {fixedGroup("uso", "Uso")}
      {fixedGroup("vaso", "Vaso")}
      {facetGroup("marca", "Marca")}

      <Group title="Avaliação">
        {[4, 3].map((rating) => (
          <Option
            key={rating}
            label={`${rating} estrelas ou mais`}
            checked={filters.minRating === rating}
            onChange={(checked) => navigate({ ...filters, minRating: checked ? rating : null })}
          />
        ))}
      </Group>
    </div>
  );
}

/** Coluna lateral no desktop. */
export function FilterSidebar(props: FilterPanelProps) {
  return (
    <aside aria-label="Filtros" className="hidden lg:block">
      <h2 className="border-b border-line pb-3 type-small font-semibold text-ink">Filtrar</h2>
      <FilterControls {...props} />
    </aside>
  );
}

/** Botão "Filtrar" e gaveta no mobile. */
export function FilterDrawer(props: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const active = countActiveFilters(props.query.filters);
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title="Filtrar"
      trigger={
        <Button
          variant="secondary"
          size="sm"
          className="lg:hidden"
          icon={<SlidersHorizontal aria-hidden="true" strokeWidth={1.5} className="size-4" />}
        >
          Filtrar{active > 0 ? ` (${active})` : ""}
        </Button>
      }
      footer={
        <Button className="w-full" onClick={() => setOpen(false)}>
          Ver {props.resultCount} {props.resultCount === 1 ? "produto" : "produtos"}
        </Button>
      }
    >
      <FilterControls {...props} />
    </Drawer>
  );
}
