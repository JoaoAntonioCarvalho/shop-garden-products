"use server";

import { AuthError } from "next-auth";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { verifyCredentials } from "@/lib/credentials";
import { db } from "@/lib/db";
import { clientIpHash } from "@/lib/ip";
import { safeReturnPath } from "@/lib/session";
import { loginSchema, passwordSchema, signupSchema } from "@/lib/validators/account";
import { emailSchema } from "@/lib/validators/checkout";
import {
  createAccount,
  mergeCartOnLogin,
  requestPasswordReset,
  resetPassword,
} from "@/server/services/accounts";
import { CART_COOKIE } from "@/server/services/cart";
import { rateLimit, rateLimitMessage } from "@/server/services/rate-limit";
import { getStoreSettings } from "@/server/services/settings";

export type AuthResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const fieldErrorsOf = (issues: Array<{ path: PropertyKey[]; message: string }>) =>
  Object.fromEntries(issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]));

async function completeLogin(email: string, password: string, userId: string) {
  // O token do carrinho anônimo é lido antes de entrar, para mesclar com o carrinho da conta.
  const anonymousToken = (await cookies()).get(CART_COOKIE)?.value ?? null;
  await signIn("credentials", { email, password, redirect: false });
  await mergeCartOnLogin(userId, anonymousToken, await getStoreSettings());
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
}

export async function loginAction(input: {
  email: string;
  password: string;
  returnTo?: string;
}): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "Confira o e-mail e a senha.",
      fieldErrors: fieldErrorsOf(parsed.error.issues),
    };

  // 5 tentativas por e-mail e IP a cada 15 minutos.
  const ipHash = clientIpHash(await headers());
  const limit = await rateLimit("login", `${ipHash}:${parsed.data.email}`);
  if (!limit.allowed) return { ok: false, error: rateLimitMessage(limit) };

  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  // A mesma mensagem para e-mail inexistente e senha errada.
  if (!user)
    return {
      ok: false,
      error: "E-mail ou senha incorretos. Confira os dados ou redefina a senha.",
    };

  try {
    await completeLogin(parsed.data.email, parsed.data.password, user.id);
  } catch (error) {
    if (error instanceof AuthError)
      return { ok: false, error: "Não foi possível entrar. Tente de novo." };
    throw error;
  }
  redirect(safeReturnPath(input.returnTo, user.role === "CUSTOMER" ? "/conta" : "/admin"));
}

export async function signupAction(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  marketingOptIn?: boolean;
  returnTo?: string;
}): Promise<AuthResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "Confira os campos destacados.",
      fieldErrors: fieldErrorsOf(parsed.error.issues),
    };

  const limit = await rateLimit("signup", clientIpHash(await headers()));
  if (!limit.allowed) return { ok: false, error: rateLimitMessage(limit) };

  const user = await createAccount(parsed.data);
  if (!user) {
    return {
      ok: false,
      error:
        "Não foi possível criar a conta com este e-mail. Se você já tem cadastro, entre ou redefina a senha.",
    };
  }
  try {
    await completeLogin(parsed.data.email, parsed.data.password, user.id);
  } catch (error) {
    if (error instanceof AuthError)
      return { ok: true, message: "Conta criada. Entre com o seu e-mail e a sua senha." };
    throw error;
  }
  redirect(safeReturnPath(input.returnTo, "/conta?boas-vindas=1"));
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false });
  // O carrinho da conta não fica no navegador depois de sair.
  (await cookies()).delete(CART_COOKIE);
  redirect("/");
}

export async function forgotPasswordAction(emailInput: string): Promise<AuthResult> {
  const email = emailSchema.safeParse(emailInput);
  if (!email.success)
    return { ok: false, error: "Digite um e-mail válido, como nome@exemplo.com." };
  const limit = await rateLimit("passwordReset", clientIpHash(await headers()));
  if (!limit.allowed) return { ok: false, error: rateLimitMessage(limit) };
  await requestPasswordReset(email.data);
  // A mesma resposta exista ou não a conta.
  return {
    ok: true,
    message:
      "Se houver uma conta com este e-mail, enviamos um link para criar uma nova senha. Ele vale por 1 hora.",
  };
}

export async function resetPasswordAction(token: string, password: string): Promise<AuthResult> {
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const limit = await rateLimit("passwordReset", clientIpHash(await headers()));
  if (!limit.allowed) return { ok: false, error: rateLimitMessage(limit) };
  const result = await resetPassword(String(token).slice(0, 128), parsed.data);
  if (!result.ok)
    return { ok: false, error: "Este link não vale mais. Peça um novo em Esqueci a senha." };
  return { ok: true, message: "Senha alterada. Entre com a nova senha." };
}
