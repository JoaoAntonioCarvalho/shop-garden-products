import { db } from "@/lib/db";
import {
  normalizeRedirectPath,
  searchTermsFromLegacyPath,
  stripLegacyParams,
} from "@/lib/redirects";

/**
 * Redirecionamentos das URLs do site antigo (seção 8.3), consultados pelo proxy. A tabela
 * Redirect fica em memória e é recarregada a cada poucos minutos, então um redirecionamento
 * novo criado no painel começa a valer em até 3 minutos, sem consulta ao banco por requisição.
 */

type Entry = { id: string; toPath: string; statusCode: number };
const TTL_MS = 3 * 60 * 1000;
let cache: { loadedAt: number; map: Map<string, Entry> } | null = null;
let loading: Promise<Map<string, Entry>> | null = null;

async function loadRedirects(): Promise<Map<string, Entry>> {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache.map;
  loading ??= db.redirect
    .findMany({
      where: { isActive: true },
      select: { id: true, fromPath: true, toPath: true, statusCode: true },
    })
    .then((rows) => {
      const map = new Map(
        rows.map((row) => [
          row.fromPath,
          { id: row.id, toPath: row.toPath, statusCode: row.statusCode },
        ]),
      );
      cache = { loadedAt: Date.now(), map };
      return map;
    })
    // Com o banco fora do ar, a loja continua respondendo: só não redireciona.
    .catch(() => cache?.map ?? new Map<string, Entry>())
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Usado pelos testes e pelo painel no mesmo processo. */
export function clearRedirectCache(): void {
  cache = null;
}

export type LegacyRedirect = { location: string; status: 301 | 302 };

/** Caminhos que são do site novo e nunca passam pelas regras de URL antiga. */
const APP_PREFIX = /^\/(api|admin|_next|media|brand|conta|checkout|pedido|carrinho|dev)(\/|$)/;
const LEGACY_FILE = /\.(asp|html?|php)$/i;
/** Produto do site antigo: termina com o código numérico, como "/decoracao/vaso-ceramica-azul-86355227". */
const LEGACY_PRODUCT = /-\d{6,}$/;

export async function resolveLegacyRedirect(
  pathname: string,
  search: URLSearchParams,
): Promise<LegacyRedirect | null> {
  if (APP_PREFIX.test(pathname)) return null;
  const key = normalizeRedirectPath(pathname, search);
  const pathKey = normalizeRedirectPath(pathname);
  const redirects = await loadRedirects();
  const hit = redirects.get(key) ?? redirects.get(pathKey);
  if (hit) {
    // Conta o acesso sem atrasar a resposta.
    void db.redirect
      .update({ where: { id: hit.id }, data: { hits: { increment: 1 }, lastHitAt: new Date() } })
      .catch(() => undefined);
    return { location: hit.toPath, status: hit.statusCode === 302 ? 302 : 301 };
  }

  const lower = pathKey;
  const param = (name: string) =>
    [...search].find(([key]) => key.toLowerCase() === name)?.[1]?.trim() ?? "";
  if (lower === "/listaprodutos.asp") {
    const text = param("texto");
    if (text) return { location: `/busca?q=${encodeURIComponent(text)}`, status: 301 };
    return { location: "/colecao/novidades", status: 301 };
  }
  if (lower.startsWith("/track.asp")) return { location: "/rastreio", status: 301 };
  if (lower.startsWith("/cadastro.asp")) return { location: "/conta", status: 301 };
  if (LEGACY_FILE.test(lower) || LEGACY_PRODUCT.test(lower)) {
    const terms = searchTermsFromLegacyPath(lower);
    return { location: terms ? `/busca?q=${encodeURIComponent(terms)}` : "/", status: 301 };
  }

  // Parâmetros de sessão do site antigo (?IDLoja=...&mob=true): mesma página, sem eles.
  const cleaned = stripLegacyParams(search);
  // URL canônica: minúsculas e sem barra final.
  const canonicalPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const needsLowercase =
    canonicalPath !== canonicalPath.toLowerCase() &&
    !canonicalPath.startsWith("/redefinir-senha") &&
    !canonicalPath.startsWith("/verificar-email") &&
    !canonicalPath.startsWith("/newsletter") &&
    !canonicalPath.startsWith("/descadastrar");
  const finalPath = needsLowercase ? canonicalPath.toLowerCase() : canonicalPath;
  if (cleaned || finalPath !== pathname) {
    const query = (cleaned ?? search).toString();
    return { location: `${finalPath || "/"}${query ? `?${query}` : ""}`, status: 301 };
  }
  return null;
}

/** Registra um endereço que não existe, para o painel mostrar os mais acessados. */
export async function logNotFound(path: string): Promise<void> {
  const clean = path.slice(0, 300);
  if (
    !clean.startsWith("/") ||
    APP_PREFIX.test(clean) ||
    /\.(png|jpe?g|gif|svg|webp|ico|css|js|map|txt|xml|json|woff2?)$/i.test(clean)
  )
    return;
  await db.notFoundLog
    .upsert({
      where: { path: clean },
      update: { hits: { increment: 1 }, lastHitAt: new Date() },
      create: { path: clean },
    })
    .catch(() => undefined);
}
