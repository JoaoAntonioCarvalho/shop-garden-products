import { NextResponse, type NextRequest } from "next/server";
import { UTM_COOKIE, UTM_MAX_AGE_SECONDS, utmFromUrl } from "@/lib/analytics/utm";
import { auth } from "@/lib/auth";
import { resolveLegacyRedirect } from "@/server/services/legacy-redirects";

/**
 * Proxy da aplicação (o antigo middleware do Next). Faz três coisas antes de a página renderizar:
 * aplica os redirecionamentos das URLs antigas, protege /conta e /admin e grava a origem da visita (UTM).
 *
 * A proteção aqui é a primeira barreira. O papel do usuário é conferido de novo, no banco,
 * dentro de cada página, server action e route handler.
 */
export const PATH_HEADER = "x-nsg-path";

export const proxy = auth(async (request) => {
  const { nextUrl } = request;
  const path = nextUrl.pathname;
  const session = request.auth;

  // URLs do site antigo, parâmetros de sessão e endereços fora do padrão: 301 para o endereço certo.
  if (request.method === "GET" || request.method === "HEAD") {
    const legacy = await resolveLegacyRedirect(path, nextUrl.searchParams);
    if (legacy) {
      const target = legacy.location.startsWith("http")
        ? legacy.location
        : new URL(legacy.location, nextUrl);
      return NextResponse.redirect(target, legacy.status);
    }
  }

  // A página de avaliação aceita o link do e-mail, sem login.
  const needsLogin =
    (path === "/conta" || path.startsWith("/conta/")) && !path.startsWith("/conta/avaliar/");
  const isAdmin = path === "/admin" || path.startsWith("/admin/");

  if ((needsLogin || isAdmin) && !session?.user) {
    const login = new URL("/entrar", nextUrl);
    login.searchParams.set("voltar", `${path}${nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  if (isAdmin && session?.user.role === "CUSTOMER") {
    return NextResponse.redirect(new URL("/conta", nextUrl));
  }

  // A página 404 lê o caminho pedido por este cabeçalho, para registrar o endereço.
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, path);
  return withUtm(request, NextResponse.next({ request: { headers } }));
});

/** Grava a origem da visita por 30 dias. Visita direta não apaga a origem anterior (último clique não direto). */
function withUtm(request: NextRequest, response: NextResponse): NextResponse {
  const utm = utmFromUrl(request.nextUrl.searchParams, request.headers.get("referer"));
  if (utm) {
    response.cookies.set(UTM_COOKIE, JSON.stringify(utm), {
      maxAge: UTM_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
}

export const config = {
  // Tudo, menos arquivos estáticos, imagens, mídia e rotas internas do Next.
  matcher: [
    "/((?!_next/static|_next/image|media/|brand/|api/auth|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)",
  ],
};
