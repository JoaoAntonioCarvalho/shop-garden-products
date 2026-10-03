import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { clientIpHash } from "@/lib/ip";
import { can, isStaff, type Permission } from "@/lib/permissions";
import { getCurrentUser, type CurrentUser } from "@/lib/session";

export class ForbiddenError extends Error {
  constructor(message = "Você não tem permissão para fazer isso.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Para páginas do admin: sem login vai para /entrar; sem permissão, a página não existe para o usuário. */
export async function requireAdminPage(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?voltar=/admin");
  if (!isStaff(user)) redirect("/conta");
  if (!can(user, permission)) notFound();
  return user;
}

/** Para server actions e route handlers do admin. Nunca confia só no proxy. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !can(user, permission)) throw new ForbiddenError();
  return user;
}

/** Dados da requisição que entram em todo registro de auditoria. */
export async function auditContext(): Promise<{ ipHash: string; userAgent: string | null }> {
  const list = await headers();
  return { ipHash: clientIpHash(list), userAgent: list.get("user-agent") };
}
