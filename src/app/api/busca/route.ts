import { clientIpHash } from "@/lib/ip";
import { formatBRL } from "@/lib/money";
import {
  getCards,
  getCatalogIndex,
  searchCategories,
  searchProductScores,
} from "@/server/services/catalog";
import { rateLimit } from "@/server/services/rate-limit";
import { getStoreSettings } from "@/server/services/settings";

/** Sugestões da busca: até 6 produtos e até 3 categorias. */
export async function GET(request: Request) {
  const term = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (term.length < 2) return Response.json({ products: [], categories: [] });
  // 60 buscas por minuto por visitante: sobra para quem digita e freia a raspagem.
  const limit = await rateLimit("search", clientIpHash(request.headers));
  if (!limit.allowed)
    return Response.json(
      { products: [], categories: [] },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );

  const [scores, index, settings, categories] = await Promise.all([
    searchProductScores(term),
    getCatalogIndex(),
    getStoreSettings(),
    searchCategories(term),
  ]);
  const ids = index
    .filter((row) => scores.has(row.id))
    .sort(
      (a, b) =>
        (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || b.salesCount30d - a.salesCount30d,
    )
    .slice(0, 6)
    .map((row) => row.id);
  const cards = await getCards(ids, settings);

  return Response.json(
    {
      products: cards.map((card) => ({
        slug: card.slug,
        name: card.name,
        price: formatBRL(card.price.priceCents),
        image: card.image?.url.replace(/-1600\.webp$/, "-400.webp") ?? null,
      })),
      categories,
    },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
