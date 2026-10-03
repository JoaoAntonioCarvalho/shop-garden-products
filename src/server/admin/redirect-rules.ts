import "server-only";
import { db } from "@/lib/db";
import { normalizeRedirectInput } from "@/lib/redirects";
import { AdminError } from "./action";

/** Sem loops nem cadeias: o destino não pode ser a própria origem nem a origem de outro redirecionamento. */
export async function assertRedirectIsSafe(
  fromPath: string,
  toPath: string,
  ignoreId?: string,
): Promise<void> {
  const target = toPath.startsWith("/") ? normalizeRedirectInput(toPath) : toPath;
  if (target === fromPath)
    throw new AdminError("O destino é igual à origem: isso criaria um loop.");
  const chained = await db.redirect.findFirst({
    where: { fromPath: target, isActive: true, id: ignoreId ? { not: ignoreId } : undefined },
  });
  if (chained)
    throw new AdminError(
      `O destino ${target} já redireciona para ${chained.toPath}. Use ${chained.toPath} como destino, para não criar uma cadeia.`,
    );
  const pointing = await db.redirect.findFirst({
    where: { toPath: fromPath, isActive: true, id: ignoreId ? { not: ignoreId } : undefined },
  });
  if (pointing)
    throw new AdminError(
      `${pointing.fromPath} já redireciona para ${fromPath}. Altere aquele redirecionamento para apontar direto ao novo destino.`,
    );
}
