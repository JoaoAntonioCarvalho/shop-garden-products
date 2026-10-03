import type { InventoryMovementType, Prisma } from "@/generated/prisma/client";
import { Prisma as PrismaNamespace } from "@/generated/prisma/client";

/**
 * Estoque (seção 9.3). Todas as funções recebem a transação em andamento e bloqueiam as linhas
 * das variantes com SELECT ... FOR UPDATE antes de ler ou alterar, para que duas operações
 * simultâneas nunca vendam a mesma unidade.
 *
 * disponível = stockOnHand - stockReserved
 */

type Tx = Prisma.TransactionClient;

type LockedVariant = { id: string; productId: string; stockOnHand: number; stockReserved: number };

export type StockLine = { variantId: string; quantity: number; name?: string };

export type StockShortage = {
  variantId: string;
  name: string;
  requested: number;
  available: number;
};

export class InsufficientStockError extends Error {
  constructor(public readonly shortages: StockShortage[]) {
    super(shortages.map(stockShortageMessage).join(" "));
    this.name = "InsufficientStockError";
  }
}

/** Mensagem clara para o cliente, com o item e a quantidade disponível. */
export function stockShortageMessage(shortage: StockShortage): string {
  if (shortage.available <= 0) return `${shortage.name} acabou de esgotar.`;
  const units = shortage.available === 1 ? "1 unidade" : `${shortage.available} unidades`;
  return `${shortage.name}: temos só ${units} em estoque, e você pediu ${shortage.requested}.`;
}

/** Bloqueia as variantes, sempre na mesma ordem (por id), para evitar deadlock. */
async function lockVariants(tx: Tx, variantIds: string[]): Promise<Map<string, LockedVariant>> {
  const ids = [...new Set(variantIds)].sort();
  if (ids.length === 0) return new Map();
  const rows = await tx.$queryRaw<LockedVariant[]>`
    SELECT id, "productId", "stockOnHand", "stockReserved"
    FROM "ProductVariant"
    WHERE id IN (${PrismaNamespace.join(ids)})
    ORDER BY id
    FOR UPDATE`;
  return new Map(rows.map((row) => [row.id, row]));
}

/** Junta linhas repetidas da mesma variante. */
function mergeLines(lines: StockLine[]): StockLine[] {
  const merged = new Map<string, StockLine>();
  for (const line of lines) {
    const current = merged.get(line.variantId);
    if (current) current.quantity += line.quantity;
    else merged.set(line.variantId, { ...line });
  }
  return [...merged.values()];
}

type MovementContext = { orderId?: string | null; userId?: string | null; reason?: string | null };

async function applyMovement(
  tx: Tx,
  variant: LockedVariant,
  type: InventoryMovementType,
  /** Variação do estoque físico. */
  onHandDelta: number,
  /** Variação do reservado. */
  reservedDelta: number,
  /** Quantidade registrada no movimento (positiva ou negativa). */
  quantity: number,
  context: MovementContext,
) {
  variant.stockOnHand += onHandDelta;
  variant.stockReserved += reservedDelta;
  await tx.productVariant.update({
    where: { id: variant.id },
    data: { stockOnHand: variant.stockOnHand, stockReserved: variant.stockReserved },
  });
  await tx.inventoryMovement.create({
    data: {
      variantId: variant.id,
      type,
      quantity,
      stockOnHandAfter: variant.stockOnHand,
      stockReservedAfter: variant.stockReserved,
      orderId: context.orderId ?? null,
      userId: context.userId ?? null,
      reason: context.reason ?? null,
    },
  });
}

/** Atualiza o disponível desnormalizado dos produtos (usado nas listagens). */
export async function refreshProductAvailability(tx: Tx, productIds: string[]): Promise<void> {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return;
  await tx.$executeRaw`
    UPDATE "Product" p SET "totalAvailable" = COALESCE(v.available, 0)
    FROM (SELECT "productId", SUM(GREATEST("stockOnHand" - "stockReserved", 0))::int AS available
          FROM "ProductVariant" WHERE "isActive" AND "productId" IN (${PrismaNamespace.join(ids)})
          GROUP BY "productId") v
    WHERE v."productId" = p.id`;
}

/**
 * Reserva na criação do pedido. Se qualquer item não tiver estoque, nada é reservado e o erro
 * diz qual item e quanto há disponível.
 */
export async function reserveStock(tx: Tx, lines: StockLine[], orderId: string): Promise<void> {
  const merged = mergeLines(lines);
  const locked = await lockVariants(
    tx,
    merged.map((line) => line.variantId),
  );

  const shortages: StockShortage[] = [];
  for (const line of merged) {
    const variant = locked.get(line.variantId);
    const available = variant ? variant.stockOnHand - variant.stockReserved : 0;
    if (line.quantity > available) {
      shortages.push({
        variantId: line.variantId,
        name: line.name ?? "Este produto",
        requested: line.quantity,
        available: Math.max(0, available),
      });
    }
  }
  if (shortages.length > 0) throw new InsufficientStockError(shortages);

  for (const line of merged) {
    await applyMovement(
      tx,
      locked.get(line.variantId)!,
      "RESERVE",
      0,
      line.quantity,
      line.quantity,
      { orderId },
    );
  }
  await refreshProductAvailability(
    tx,
    [...locked.values()].map((variant) => variant.productId),
  );
}

async function orderLines(tx: Tx, orderId: string): Promise<StockLine[]> {
  const items = await tx.orderItem.findMany({
    where: { orderId, variantId: { not: null } },
    select: { variantId: true, quantity: true },
  });
  return mergeLines(items.map((item) => ({ variantId: item.variantId!, quantity: item.quantity })));
}

/** Pagamento confirmado: a reserva vira venda. */
export async function commitSale(tx: Tx, orderId: string): Promise<void> {
  const lines = await orderLines(tx, orderId);
  const locked = await lockVariants(
    tx,
    lines.map((line) => line.variantId),
  );
  for (const line of lines) {
    const variant = locked.get(line.variantId);
    if (!variant) continue;
    await applyMovement(tx, variant, "SALE", -line.quantity, -line.quantity, -line.quantity, {
      orderId,
    });
  }
  await refreshProductAvailability(
    tx,
    [...locked.values()].map((variant) => variant.productId),
  );
}

/** Pedido cancelado ou expirado antes do pagamento: a reserva é liberada. */
export async function releaseReservation(
  tx: Tx,
  orderId: string,
  userId?: string | null,
): Promise<void> {
  const lines = await orderLines(tx, orderId);
  const locked = await lockVariants(
    tx,
    lines.map((line) => line.variantId),
  );
  for (const line of lines) {
    const variant = locked.get(line.variantId);
    if (!variant) continue;
    // Nunca libera mais do que está reservado.
    const quantity = Math.min(line.quantity, variant.stockReserved);
    if (quantity > 0)
      await applyMovement(tx, variant, "RELEASE", 0, -quantity, -quantity, { orderId, userId });
  }
  await refreshProductAvailability(
    tx,
    [...locked.values()].map((variant) => variant.productId),
  );
}

/** Cancelamento ou devolução após o pagamento, com devolução ao estoque marcada pelo admin. */
export async function returnToStock(
  tx: Tx,
  orderId: string,
  userId?: string | null,
  reason?: string,
): Promise<void> {
  const lines = await orderLines(tx, orderId);
  const locked = await lockVariants(
    tx,
    lines.map((line) => line.variantId),
  );
  for (const line of lines) {
    const variant = locked.get(line.variantId);
    if (!variant) continue;
    await applyMovement(tx, variant, "RETURN", line.quantity, 0, line.quantity, {
      orderId,
      userId,
      reason,
    });
  }
  await refreshProductAvailability(
    tx,
    [...locked.values()].map((variant) => variant.productId),
  );
}

export type ManualAdjustment =
  | {
      kind: "IN" | "OUT" | "LOSS";
      variantId: string;
      quantity: number;
      reason: string;
      userId: string | null;
    }
  | {
      kind: "ADJUSTMENT";
      variantId: string;
      newCount: number;
      reason: string;
      userId: string | null;
    };

export class StockAdjustmentError extends Error {}

/**
 * Ajuste manual do admin: entrada, saída, perda/quebra ou ajuste de inventário (define a contagem
 * real). O motivo é obrigatório.
 */
export async function adjustStock(
  tx: Tx,
  adjustment: ManualAdjustment,
): Promise<{ stockOnHand: number; stockReserved: number }> {
  if (!adjustment.reason.trim()) throw new StockAdjustmentError("Informe o motivo do ajuste.");
  const locked = await lockVariants(tx, [adjustment.variantId]);
  const variant = locked.get(adjustment.variantId);
  if (!variant) throw new StockAdjustmentError("Variação não encontrada.");

  let delta: number;
  if (adjustment.kind === "ADJUSTMENT") {
    if (!Number.isInteger(adjustment.newCount) || adjustment.newCount < 0) {
      throw new StockAdjustmentError("A contagem precisa ser um número inteiro, zero ou maior.");
    }
    delta = adjustment.newCount - variant.stockOnHand;
  } else {
    if (!Number.isInteger(adjustment.quantity) || adjustment.quantity <= 0) {
      throw new StockAdjustmentError("A quantidade precisa ser um número inteiro maior que zero.");
    }
    delta = adjustment.kind === "IN" ? adjustment.quantity : -adjustment.quantity;
  }

  if (variant.stockOnHand + delta < variant.stockReserved) {
    throw new StockAdjustmentError(
      `Não é possível deixar o estoque abaixo do que está reservado para pedidos (${variant.stockReserved}).`,
    );
  }

  await applyMovement(tx, variant, adjustment.kind, delta, 0, delta, {
    userId: adjustment.userId,
    reason: adjustment.reason.trim(),
  });
  await refreshProductAvailability(tx, [variant.productId]);
  return { stockOnHand: variant.stockOnHand, stockReserved: variant.stockReserved };
}
