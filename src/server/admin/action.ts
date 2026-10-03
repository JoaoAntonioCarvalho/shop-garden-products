import "server-only";
import type { z } from "zod";
import { ForbiddenError, auditContext, requirePermission } from "@/lib/admin-guard";
import { logAudit, type AuditEntry } from "@/lib/audit";
import type { Permission } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/session";
import { StockAdjustmentError } from "@/server/services/inventory";
import { InvalidTransitionError } from "@/server/services/order-status";

export type AdminResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Erro de regra de negócio com mensagem pronta para o usuário do painel. */
export class AdminError extends Error {}

export type AdminContext = {
  user: CurrentUser;
  /** Registra a ação na auditoria, já com usuário, IP (hash) e navegador. */
  audit: (entry: Omit<AuditEntry, "userId" | "ipHash" | "userAgent">) => Promise<void>;
  ipHash: string;
  userAgent: string | null;
};

/**
 * Toda server action do admin passa por aqui: confere a permissão no servidor, valida a entrada
 * com Zod, executa e devolve um resultado com mensagem. Erros de regra viram mensagem; os demais sobem.
 */
export async function runAdmin<Schema extends z.ZodType, T = undefined>(
  permission: Permission,
  schema: Schema,
  input: unknown,
  handler: (
    data: z.output<Schema>,
    context: AdminContext,
  ) => Promise<{ message: string; data?: T }>,
): Promise<AdminResult<T>> {
  try {
    const user = await requirePermission(permission);
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Confira os campos destacados.",
        fieldErrors: Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
        ),
      };
    }
    const request = await auditContext();
    const context: AdminContext = {
      user,
      ...request,
      audit: (entry) => logAudit({ ...entry, userId: user.id, ...request }),
    };
    const result = await handler(parsed.data, context);
    return { ok: true, ...result };
  } catch (error) {
    if (
      error instanceof ForbiddenError ||
      error instanceof AdminError ||
      error instanceof InvalidTransitionError ||
      error instanceof StockAdjustmentError
    ) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
