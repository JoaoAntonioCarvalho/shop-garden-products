/** Cookie com a origem da visita (UTM), gravado pelo proxy na primeira página e válido por 30 dias. */
export const UTM_COOKIE = "nsg_utm";
export const UTM_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
] as const;

export type UtmData = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  gclid?: string;
  fbclid?: string;
  referrer?: string;
};

const clean = (value: string | null) => (value ? value.trim().slice(0, 120) : undefined);

/**
 * Lê a origem da visita a partir da URL. Devolve null para visita direta (sem parâmetros de
 * campanha): nesse caso o cookie anterior é mantido (último clique não direto).
 */
export function utmFromUrl(search: URLSearchParams, referrer?: string | null): UtmData | null {
  const data: UtmData = {
    source: clean(search.get("utm_source")),
    medium: clean(search.get("utm_medium")),
    campaign: clean(search.get("utm_campaign")),
    content: clean(search.get("utm_content")),
    term: clean(search.get("utm_term")),
    gclid: clean(search.get("gclid")),
    fbclid: clean(search.get("fbclid")),
  };
  // Cliques de anúncio sem UTM ainda identificam a origem.
  if (!data.source && data.gclid) Object.assign(data, { source: "google", medium: "cpc" });
  if (!data.source && data.fbclid)
    Object.assign(data, { source: "facebook", medium: "paid_social" });
  if (!data.source) return null;
  if (referrer) data.referrer = referrer.slice(0, 200);
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value)) as UtmData;
}

export function parseUtmCookie(raw: string | undefined): UtmData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: UtmData = {};
    for (const key of [
      "source",
      "medium",
      "campaign",
      "content",
      "term",
      "gclid",
      "fbclid",
      "referrer",
    ] as const) {
      const value = parsed[key];
      if (typeof value === "string" && value) result[key] = value.slice(0, 200);
    }
    return result.source ? result : null;
  } catch {
    return null;
  }
}
