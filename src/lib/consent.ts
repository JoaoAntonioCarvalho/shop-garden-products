/** Consentimento de cookies (LGPD). Os necessários não dependem de escolha; análise e marketing, sim. */
export const CONSENT_COOKIE = "nsg_consent";
export const CONSENT_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
export const CONSENT_EVENT = "nsg:consent";
export const OPEN_PREFERENCES_EVENT = "nsg:cookie-preferences";

export type Consent = { analytics: boolean; marketing: boolean };

/** Lê o cookie de consentimento. Null quando a pessoa ainda não escolheu. */
export function parseConsent(raw: string | undefined | null): Consent | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Partial<Consent>;
    if (typeof value.analytics !== "boolean" || typeof value.marketing !== "boolean") return null;
    return { analytics: value.analytics, marketing: value.marketing };
  } catch {
    return null;
  }
}

export const serializeConsent = (consent: Consent) =>
  encodeURIComponent(JSON.stringify({ ...consent, at: new Date().toISOString().slice(0, 10) }));

/** No navegador: lê o cookie direto de document.cookie. */
export function readConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${CONSENT_COOKIE}=`));
  return parseConsent(match?.slice(CONSENT_COOKIE.length + 1));
}
