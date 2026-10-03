import "server-only";
import { cache } from "react";
import { auth, type UserRole } from "@/lib/auth";
import { db } from "@/lib/db";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  emailVerifiedAt: Date | null;
};

/**
 * Usuário logado, conferido no banco a cada requisição: o papel e a situação da conta valem pelo
 * que está no banco agora, não pelo que estava no token quando a pessoa entrou.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerifiedAt: true,
      isActive: true,
      anonymizedAt: true,
    },
  });
  if (!user || !user.isActive || user.anonymizedAt) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt,
  };
});

export class UnauthorizedError extends Error {
  constructor(message = "Entre na sua conta para continuar.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Para server actions da área do cliente. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Caminho interno seguro para redirecionar depois do login (nunca um endereço externo). */
export function safeReturnPath(
  value: string | string[] | undefined | null,
  fallback = "/conta",
): string {
  const path = Array.isArray(value) ? value[0] : value;
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\"))
    return fallback;
  return path;
}
