import { getCardsBySlugs } from "@/server/services/catalog";
import { getStoreSettings } from "@/server/services/settings";

/** Cards dos produtos vistos recentemente (os slugs ficam no localStorage do visitante). */
export async function GET(request: Request) {
  const slugs = (new URL(request.url).searchParams.get("slugs") ?? "")
    .split(",")
    .map((slug) => slug.trim())
    .filter((slug) => /^[a-z0-9-]{1,120}$/.test(slug))
    .slice(0, 8);
  const cards = await getCardsBySlugs(slugs, await getStoreSettings());
  return Response.json({ cards }, { headers: { "Cache-Control": "private, max-age=60" } });
}
