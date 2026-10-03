"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { AdminError, runAdmin, type AdminResult } from "@/server/admin/action";
import { invalidateProducts } from "@/server/admin/products";
import { adjustStock, StockAdjustmentError } from "@/server/services/inventory";
import { notifyBackInStock } from "@/server/admin/back-in-stock";

const adjustSchema = z.object({
  variantId: z.string().max(40),
  kind: z.enum(["IN", "OUT", "ADJUSTMENT", "LOSS"]),
  quantity: z.coerce
    .number({ error: "Informe a quantidade." })
    .int("Use um número inteiro.")
    .min(0)
    .max(1_000_000),
  reason: z.string().trim().min(3, "Informe o motivo do ajuste.").max(200),
});

const kindLabels = {
  IN: "Entrada",
  OUT: "Saída",
  ADJUSTMENT: "Ajuste de inventário",
  LOSS: "Perda ou quebra",
} as const;

/** Ajuste rápido: entrada, saída, ajuste de inventário (define a contagem) ou perda. Motivo obrigatório. */
export async function adjustStockAction(input: z.input<typeof adjustSchema>): Promise<AdminResult> {
  return runAdmin("inventory.adjust", adjustSchema, input, async (data, { user, audit }) => {
    const variant = await db.productVariant.findUnique({
      where: { id: data.variantId },
      include: { product: { select: { id: true, name: true, slug: true } } },
    });
    if (!variant) throw new AdminError("Variação não encontrada.");
    const wasAvailable = variant.stockOnHand - variant.stockReserved;
    const after = await db.$transaction((tx) =>
      adjustStock(
        tx,
        data.kind === "ADJUSTMENT"
          ? {
              kind: "ADJUSTMENT",
              variantId: data.variantId,
              newCount: data.quantity,
              reason: data.reason,
              userId: user.id,
            }
          : {
              kind: data.kind,
              variantId: data.variantId,
              quantity: data.quantity,
              reason: data.reason,
              userId: user.id,
            },
      ),
    );
    await audit({
      action: "inventory.adjust",
      entityType: "Product",
      entityId: variant.product.id,
      diff: {
        sku: variant.sku,
        tipo: kindLabels[data.kind],
        estoque: { antes: variant.stockOnHand, depois: after.stockOnHand },
        motivo: data.reason,
      },
    });
    invalidateProducts([variant.product.slug]);
    // Voltou a ter estoque: avisa quem pediu "Avise-me".
    if (wasAvailable <= 0 && after.stockOnHand - after.stockReserved > 0)
      await notifyBackInStock(variant.product.id);
    return {
      message: `${kindLabels[data.kind]} registrada: ${variant.product.name} agora tem ${after.stockOnHand} em estoque`,
    };
  });
}

type BatchLine = {
  line: number;
  sku: string;
  quantity: number;
  reason: string;
  name?: string;
  current?: number;
  error?: string;
  variantId?: string;
  productId?: string;
  slug?: string;
};

/** Lê as linhas "SKU;quantidade;motivo" e confere cada uma. */
async function parseBatch(text: string): Promise<BatchLine[]> {
  const rows = text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .slice(0, 1000);
  const parsed = rows.map((row, index) => {
    const [sku = "", quantity = "", ...reason] = row.split(/[;\t]/).map((cell) => cell.trim());
    return {
      line: index + 1,
      sku: sku.toUpperCase(),
      quantity: Number(quantity),
      reason: reason.join(" ") || "Entrada em lote",
    };
  });
  const variants = await db.productVariant.findMany({
    where: { sku: { in: parsed.map((row) => row.sku) } },
    include: { product: { select: { id: true, name: true, slug: true } } },
  });
  const bySku = new Map(variants.map((variant) => [variant.sku, variant]));
  return parsed.map((row) => {
    const variant = bySku.get(row.sku);
    if (!variant) return { ...row, error: "SKU não encontrado." };
    if (!Number.isInteger(row.quantity) || row.quantity <= 0)
      return { ...row, error: "Quantidade inválida." };
    return {
      ...row,
      name: `${variant.product.name}${variant.name !== "Padrão" ? ` (${variant.name})` : ""}`,
      current: variant.stockOnHand,
      variantId: variant.id,
      productId: variant.product.id,
      slug: variant.product.slug,
    };
  });
}

const batchSchema = z.object({
  text: z.string().min(1, "Cole as linhas no formato SKU;quantidade;motivo.").max(100_000),
  apply: z.boolean(),
});
export type BatchPreview = Array<
  Pick<BatchLine, "line" | "sku" | "quantity" | "reason" | "name" | "current" | "error">
>;

/** Entrada em lote: prévia e aplicação. Linhas com erro são ignoradas e listadas. */
export async function batchStockInAction(
  input: z.input<typeof batchSchema>,
): Promise<AdminResult<{ lines: BatchPreview; applied: number }>> {
  return runAdmin<typeof batchSchema, { lines: BatchPreview; applied: number }>(
    "inventory.adjust",
    batchSchema,
    input,
    async (data, { user, audit }) => {
      const lines = await parseBatch(data.text);
      const valid = lines.filter((line) => !line.error && line.variantId);
      const preview = lines.map(({ line, sku, quantity, reason, name, current, error }) => ({
        line,
        sku,
        quantity,
        reason,
        name,
        current,
        error,
      }));
      if (!data.apply) return { message: "Prévia pronta", data: { lines: preview, applied: 0 } };
      if (valid.length === 0) throw new AdminError("Nenhuma linha válida para aplicar.");
      const restocked: string[] = [];
      await db.$transaction(
        async (tx) => {
          for (const line of valid) {
            const before = await tx.productVariant.findUniqueOrThrow({
              where: { id: line.variantId },
              select: { stockOnHand: true, stockReserved: true },
            });
            await adjustStock(tx, {
              kind: "IN",
              variantId: line.variantId as string,
              quantity: line.quantity,
              reason: line.reason,
              userId: user.id,
            });
            if (before.stockOnHand - before.stockReserved <= 0)
              restocked.push(line.productId as string);
          }
        },
        { timeout: 60_000 },
      );
      await audit({
        action: "inventory.batch_in",
        entityType: "Product",
        diff: {
          linhas: valid.length,
          unidades: valid.reduce((sum, line) => sum + line.quantity, 0),
          ignoradas: lines.length - valid.length,
        },
      });
      invalidateProducts(valid.map((line) => line.slug as string).slice(0, 200));
      for (const productId of new Set(restocked)) await notifyBackInStock(productId);
      return {
        message: `Entrada registrada em ${valid.length} ${valid.length === 1 ? "item" : "itens"}`,
        data: { lines: preview, applied: valid.length },
      };
    },
  );
}

const countSchema = z.object({
  counts: z
    .array(
      z.object({
        variantId: z.string().max(40),
        counted: z.coerce.number().int().min(0).max(1_000_000),
      }),
    )
    .min(1, "Informe a contagem de pelo menos um item.")
    .max(2000),
  reason: z.string().trim().max(200).default(""),
});

/** Aplica a contagem de inventário: só as variações com diferença geram ajuste. */
export async function applyInventoryCountAction(
  input: z.input<typeof countSchema>,
): Promise<AdminResult> {
  return runAdmin("inventory.adjust", countSchema, input, async (data, { user, audit }) => {
    const variants = await db.productVariant.findMany({
      where: { id: { in: data.counts.map((item) => item.variantId) } },
      include: { product: { select: { slug: true, name: true } } },
    });
    const differences = data.counts.flatMap((item) => {
      const variant = variants.find((entry) => entry.id === item.variantId);
      return variant && variant.stockOnHand !== item.counted
        ? [{ variant, counted: item.counted }]
        : [];
    });
    if (differences.length === 0)
      return { message: "A contagem bate com o estoque: nada a ajustar" };
    const blocked = differences.find((item) => item.counted < item.variant.stockReserved);
    if (blocked)
      throw new StockAdjustmentError(
        `${blocked.variant.product.name} (${blocked.variant.sku}) tem ${blocked.variant.stockReserved} unidades reservadas para pedidos. A contagem não pode ficar abaixo disso.`,
      );
    const reason = data.reason || "Contagem de inventário";
    await db.$transaction(
      async (tx) => {
        for (const item of differences)
          await adjustStock(tx, {
            kind: "ADJUSTMENT",
            variantId: item.variant.id,
            newCount: item.counted,
            reason,
            userId: user.id,
          });
      },
      { timeout: 60_000 },
    );
    await audit({
      action: "inventory.count",
      entityType: "Product",
      diff: {
        ajustes: differences
          .map((item) => ({
            sku: item.variant.sku,
            antes: item.variant.stockOnHand,
            depois: item.counted,
          }))
          .slice(0, 200),
      },
    });
    invalidateProducts(differences.map((item) => item.variant.product.slug).slice(0, 200));
    return {
      message: `Contagem aplicada: ${differences.length} ${differences.length === 1 ? "ajuste" : "ajustes"}`,
    };
  });
}
