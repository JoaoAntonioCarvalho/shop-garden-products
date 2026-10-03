import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export type UserRole = "CUSTOMER" | "STAFF" | "ADMIN";

export const BCRYPT_COST = 12;

// Hash usado quando o e-mail não existe, para o tempo de resposta não revelar quais e-mails têm conta.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hash("senha-que-nao-existe", BCRYPT_COST));

/**
 * Confere e-mail e senha. Devolve o usuário ou null, sem dizer qual dos dois estava errado.
 * Contas desativadas ou anonimizadas não entram.
 */
export async function verifyCredentials(email: string, password: string) {
  const user = await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      passwordHash: true,
      isActive: true,
      anonymizedAt: true,
    },
  });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !user.passwordHash || !valid || !user.isActive || user.anonymizedAt) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role as UserRole };
}
