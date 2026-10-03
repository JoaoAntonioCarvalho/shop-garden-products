import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

type Client = Prisma.TransactionClient | typeof db;

export type AuditEntry = {
  /** Quem fez. Nulo quando foi o sistema (webhook, tarefa agendada). */
  userId?: string | null;
  /** Ex.: "product.update", "order.status_change", "customers.export". */
  action: string;
  entityType?: string;
  entityId?: string;
  /** Antes e depois dos campos alterados. */
  diff?: Prisma.InputJsonValue;
  ipHash?: string | null;
  userAgent?: string | null;
};

/** Toda ação administrativa que altera dados passa por aqui. */
export async function logAudit(entry: AuditEntry, client: Client = db): Promise<void> {
  await client.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      diff: entry.diff,
      ipHash: entry.ipHash ?? null,
      userAgent: entry.userAgent?.slice(0, 300) ?? null,
    },
  });
}

/** Compara dois objetos e devolve só os campos que mudaram: { campo: { antes, depois } }. */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { antes: unknown; depois: unknown }> {
  const changes: Record<string, { antes: unknown; depois: unknown }> = {};
  for (const key of Object.keys(after)) {
    const previous = before[key];
    const next = after[key];
    const same =
      previous instanceof Date && next instanceof Date
        ? previous.getTime() === next.getTime()
        : JSON.stringify(previous ?? null) === JSON.stringify(next ?? null);
    if (!same) changes[key] = { antes: previous ?? null, depois: next ?? null };
  }
  return changes;
}
