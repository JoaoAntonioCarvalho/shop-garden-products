"use client";

import { useEffect } from "react";
import { track, type AnalyticsItem } from "@/lib/analytics/events";

/** Dispara view_item_list uma vez por vitrine exibida (e search, quando houver termo). */
export function ListingTracker({
  listName,
  items,
  searchTerm,
}: {
  listName: string;
  items: AnalyticsItem[];
  searchTerm?: string;
}) {
  const key = items.map((item) => item.item_id).join(",");
  useEffect(() => {
    if (searchTerm) track("search", { search_term: searchTerm });
    if (items.length) track("view_item_list", { item_list_name: listName, items });
    // A chave representa o conteúdo da lista; os objetos mudam de identidade a cada renderização.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listName, key, searchTerm]);
  return null;
}
