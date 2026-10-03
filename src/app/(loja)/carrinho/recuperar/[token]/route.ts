import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { setCartCookie } from "@/server/services/cart";

/** Link do e-mail de recuperação: devolve a sacola abandonada ao navegador de quem clicou. */
export async function GET(request: Request, context: RouteContext<"/carrinho/recuperar/[token]">) {
  const { token } = await context.params;
  const cart = /^[A-Za-z0-9_-]{16,80}$/.test(token)
    ? await db.cart.findUnique({
        where: { token },
        select: { token: true, status: true, expiresAt: true },
      })
    : null;
  const target = new URL("/carrinho", getEnv().APP_URL);
  for (const [key, value] of new URL(request.url).searchParams)
    if (key.startsWith("utm_")) target.searchParams.set(key, value);
  if (cart && cart.status !== "CONVERTED" && cart.expiresAt > new Date()) {
    await db.cart.update({
      where: { token },
      data: { status: "ACTIVE", lastActivityAt: new Date() },
    });
    await setCartCookie(cart.token, cart.expiresAt);
  }
  return NextResponse.redirect(target);
}
