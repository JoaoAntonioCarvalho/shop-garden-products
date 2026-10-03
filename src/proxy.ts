import { NextResponse, type NextRequest } from "next/server";
import { UTM_COOKIE, UTM_MAX_AGE_SECONDS, utmFromUrl } from "@/lib/analytics/utm";
import { auth } from "@/lib/auth";

/**
 * Proxy da aplicação (o antigo middleware do Next). Faz três coisas antes de a página renderizar:
 * protege /conta e /admin, grava a origem da visita (UTM) e, na fase 7, aplica os
 * redirecionamentos das URLs antigas.
 *
 * A proteção aqui é a primeira barreira. O papel do usuário é conferido de novo, no banco,
 * dentro de cada página, server action e route handler.
 */
export const proxy = auth((request) => {
  const { nextUrl } = request;
  const path = nextUrl.pathname;
  const session = request.auth;

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

  return withUtm(request, NextResponse.next());
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
