/**
 * Normalização das URLs do site antigo, usada na tabela Redirect, no proxy e no admin.
 * O site legado misturava maiúsculas, barra final e parâmetros de sessão; tudo isso é ignorado.
 */

/** Parâmetros do site antigo que não mudam o conteúdo e devem ser descartados. */
const IGNORED_PARAMS = new Set(["idloja", "mob", "avancada"]);

/** Parâmetros que identificam o conteúdo em páginas .asp e entram na chave do redirecionamento. */
const KEY_PARAMS = ["adicional1"];

/**
 * Chave de busca na tabela Redirect: caminho em minúsculas, sem barra final e, para as páginas
 * .asp do site antigo, com o parâmetro que identifica o conteúdo.
 * "/Decoracao/Vasos/" → "/decoracao/vasos"
 * "/listaprodutos.asp?avancada=true&Adicional1=238944" → "/listaprodutos.asp?adicional1=238944"
 */
export function normalizeRedirectPath(
  pathname: string,
  search: string | URLSearchParams = "",
): string {
  let path = pathname.trim();
  try {
    path = decodeURIComponent(path);
  } catch {
    // mantém o caminho como veio
  }
  path = path.toLowerCase().replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  if (!path.startsWith("/")) path = `/${path}`;

  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const kept: string[] = [];
  for (const key of KEY_PARAMS) {
    for (const [name, value] of params) {
      if (name.toLowerCase() === key && value) kept.push(`${key}=${value.toLowerCase()}`);
    }
  }
  return kept.length ? `${path}?${kept.join("&")}` : path;
}

/** Aceita uma URL ou caminho digitado no admin e devolve a chave normalizada. */
export function normalizeRedirectInput(input: string): string {
  const trimmed = input.trim();
  const withoutOrigin = trimmed.replace(/^https?:\/\/[^/]+/i, "");
  const [pathname, search = ""] = withoutOrigin.split("?");
  return normalizeRedirectPath(pathname || "/", search);
}

/** Remove da URL os parâmetros de sessão do site antigo (?IDLoja=...&mob=true). Null se não havia nenhum. */
export function stripLegacyParams(search: URLSearchParams): URLSearchParams | null {
  let removed = false;
  const cleaned = new URLSearchParams();
  for (const [name, value] of search) {
    if (IGNORED_PARAMS.has(name.toLowerCase())) removed = true;
    else cleaned.append(name, value);
  }
  return removed ? cleaned : null;
}

/** Termos de busca extraídos de uma URL antiga de produto: "/decoracao/vaso-ceramica-azul-123456" → "vaso ceramica azul". */
export function searchTermsFromLegacyPath(pathname: string): string {
  const last = pathname.split("/").filter(Boolean).pop() ?? "";
  return last
    .replace(/\.(html?|asp)$/i, "")
    .replace(/^(landing|mobile|linktop)-?/i, "")
    .split(/[-_]+/)
    .filter((part) => part && !/^\d+$/.test(part))
    .join(" ")
    .trim();
}

/** Segue a cadeia de destinos para detectar loop ou cadeia de redirecionamentos. */
export function findRedirectProblem(
  fromPath: string,
  toPath: string,
  existing: Map<string, string>,
): "loop" | "chain" | null {
  const target = normalizeRedirectInput(toPath);
  if (target === fromPath) return "loop";
  const seen = new Set([fromPath]);
  let current = target;
  let hops = 0;
  while (existing.has(current)) {
    if (seen.has(current)) return "loop";
    seen.add(current);
    current = normalizeRedirectInput(existing.get(current)!);
    hops++;
    if (current === fromPath) return "loop";
  }
  return hops > 0 ? "chain" : null;
}
