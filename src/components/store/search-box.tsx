"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

type Suggestions = {
  products: Array<{ slug: string; name: string; price: string; image: string | null }>;
  categories: Array<{ name: string; href: string }>;
};

const empty: Suggestions = { products: [], categories: [] };

/** Campo de busca com sugestões: a partir de 2 caracteres, com espera de 250ms entre as teclas. */
export function SearchBox({ className }: { className?: string }) {
  const id = useId();
  const router = useRouter();
  const containerRef = useRef<HTMLFormElement>(null);
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestions>(empty);
  const [active, setActive] = useState(-1);

  const options = [
    ...suggestions.categories.map((category) => ({ href: category.href, label: category.name })),
    ...suggestions.products.map((product) => ({
      href: `/produto/${product.slug}`,
      label: product.name,
    })),
  ];
  const hasSuggestions = options.length > 0;
  const expanded = open && hasSuggestions;

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/busca?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (response.ok) {
          setSuggestions(await response.json());
          setActive(-1);
        }
      } catch {
        // Requisição cancelada ou falha de rede: a busca continua funcionando pelo Enter.
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [term]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const query = term.trim();
    if (active >= 0 && options[active]) {
      router.push(options[active].href);
    } else if (query.length >= 2) {
      router.push(`/busca?q=${encodeURIComponent(query)}`);
    } else {
      return;
    }
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
    } else if (expanded && event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (current + 1) % options.length);
    } else if (expanded && event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current <= 0 ? options.length - 1 : current - 1));
    }
  }

  const optionProps = (optionIndex: number) => ({
    id: `${id}-option-${optionIndex}`,
    role: "option" as const,
    "aria-selected": optionIndex === active,
    className: cn(
      "flex min-h-11 items-center gap-3 px-4 py-1.5 text-[15px] text-ink hover:bg-moss-100",
      optionIndex === active && "bg-moss-100",
    ),
    onClick: () => setOpen(false),
  });

  return (
    <form
      ref={containerRef}
      action="/busca"
      role="search"
      onSubmit={handleSubmit}
      className={cn("relative", className)}
    >
      <label htmlFor={id} className="sr-only">
        Buscar produtos
      </label>
      <input
        id={id}
        type="search"
        name="q"
        value={term}
        autoComplete="off"
        placeholder="Buscar orquídeas, vasos, arranjos..."
        role="combobox"
        aria-expanded={expanded}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined}
        onChange={(event) => {
          const value = event.target.value;
          setTerm(value);
          setOpen(true);
          if (value.trim().length < 2) setSuggestions(empty);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="h-11 w-full rounded-control border border-moss-500 bg-white pr-12 pl-4 text-[16px] text-ink placeholder:text-ink-muted hover:border-moss-700 focus-visible:border-moss-700"
      />
      <button
        type="submit"
        aria-label="Buscar"
        className="absolute top-0 right-0 flex size-11 items-center justify-center text-moss-700"
      >
        <Search aria-hidden="true" strokeWidth={1.5} className="size-5" />
      </button>

      <div
        id={`${id}-list`}
        role="listbox"
        aria-label="Sugestões de busca"
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-control border border-line bg-white py-2 shadow-overlay"
      >
        {suggestions.categories.length > 0 ? (
          <div role="group" aria-label="Categorias">
            <p className="px-4 py-1 type-caption text-ink-muted">Categorias</p>
            {suggestions.categories.map((category, i) => (
              <Link key={category.href} href={category.href} {...optionProps(i)}>
                {category.name}
              </Link>
            ))}
          </div>
        ) : null}
        {suggestions.products.length > 0 ? (
          <div role="group" aria-label="Produtos">
            <p className="px-4 py-1 type-caption text-ink-muted">Produtos</p>
            {suggestions.products.map((product, i) => (
              <Link
                key={product.slug}
                href={`/produto/${product.slug}`}
                {...optionProps(suggestions.categories.length + i)}
              >
                {product.image ? (
                  // Miniatura de 40px: a versão de 400px já gerada basta, sem passar pelo otimizador.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.image}
                    alt=""
                    width={40}
                    height={50}
                    loading="lazy"
                    className="h-[50px] w-10 flex-none rounded-photo bg-white object-cover"
                  />
                ) : null}
                <span className="line-clamp-2 flex-1">{product.name}</span>
                <span className="type-small font-medium whitespace-nowrap tabular-nums">
                  {product.price}
                </span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </form>
  );
}
