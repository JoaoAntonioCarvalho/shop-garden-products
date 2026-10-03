"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";

type SearchPickerProps<T> = {
  id: string;
  label: string;
  placeholder: string;
  search: (query: string) => Promise<T[]>;
  render: (hit: T) => string;
  onPick: (hit: T) => void;
};

/** Busca com resultados em lista: clientes, produtos, variações. */
export function SearchPicker<T>({
  id,
  label,
  placeholder,
  search,
  render,
  onPick,
}: SearchPickerProps<T>) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<T[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          clearTimeout(timer.current);
          timer.current = setTimeout(
            async () => setHits(value.trim().length >= 2 ? await search(value) : []),
            300,
          );
        }}
      />
      {hits.length > 0 ? (
        <ul className="max-h-56 overflow-y-auto rounded-md border border-border bg-background">
          {hits.map((hit, index) => (
            <li key={index}>
              <button
                type="button"
                className="flex min-h-9 w-full items-center px-3 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onPick(hit);
                  setHits([]);
                  setQuery("");
                }}
              >
                {render(hit)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
