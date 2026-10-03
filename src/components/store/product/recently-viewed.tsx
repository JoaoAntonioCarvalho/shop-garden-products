"use client";

import { useEffect, useState } from "react";
import { ProductGrid, type ProductCardData } from "@/components/store/product-card";

const STORAGE_KEY = "nsg:vistos";
const MAX_ITEMS = 7;

function readSlugs(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    // localStorage indisponível (modo privado, bloqueado) ou conteúdo inválido.
    return [];
  }
}

/** Guarda o produto atual e mostra até 6 vistos antes dele. */
export function RecentlyViewed({ currentSlug }: { currentSlug: string }) {
  const [cards, setCards] = useState<ProductCardData[]>([]);

  useEffect(() => {
    const previous = readSlugs().filter((slug) => slug !== currentSlug);
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([currentSlug, ...previous].slice(0, MAX_ITEMS)),
      );
    } catch {
      // Sem armazenamento, a seção apenas não aparece.
    }
    if (previous.length === 0) return;

    const controller = new AbortController();
    fetch(`/api/produtos/vistos?slugs=${previous.slice(0, 6).join(",")}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : { cards: [] }))
      .then((data: { cards: ProductCardData[] }) => setCards(data.cards))
      .catch(() => undefined);
    return () => controller.abort();
  }, [currentSlug]);

  if (cards.length === 0) return null;

  return (
    <section aria-labelledby="vistos-recentemente" className="mt-20">
      <h2 id="vistos-recentemente" className="mb-6 type-h2 text-moss-900">
        Vistos recentemente
      </h2>
      <ProductGrid
        products={cards}
        listName="Vistos recentemente"
        layout="scroll"
        className="lg:grid-cols-6"
      />
    </section>
  );
}
