"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requirePermission } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { normalizeRedirectInput } from "@/lib/redirects";
import { normalizeCep } from "@/lib/validators/cep";
import { AdminError, runAdmin, type AdminResult } from "@/server/admin/action";
import { decodeCsvBuffer, parseCsv } from "@/server/admin/list";
import { moveCategory } from "@/server/admin/categories";
import { assertRedirectIsSafe } from "@/server/admin/redirect-rules";
import { invalidate } from "@/server/cache";
import type { ShippingOption } from "@/server/providers/shipping/types";
import { quoteShipping } from "@/server/services/shipping";

// ───────────── Categorias: ordem na árvore ─────────────

const orderSchema = z.object({ ids: z.array(z.string().max(40)).min(1).max(200) });

export async function reorderCategoriesAction(ids: string[]): Promise<AdminResult> {
  return runAdmin("categories.edit", orderSchema, { ids }, async (data, { audit }) => {
    await db.$transaction(
      data.ids.map((id, position) => db.category.update({ where: { id }, data: { position } })),
    );
    await audit({ action: "category.reorder", entityType: "Category", diff: { ordem: data.ids } });
    invalidate("categories", "home");
    return { message: "Ordem das categorias salva" };
  });
}

const moveSchema = z.object({
  id: z.string().max(40),
  parentId: z.string().max(40).nullable(),
});

/**
 * Muda a categoria de nível (arrastar na árvore): vira subcategoria de uma principal ou volta a ser
 * principal. O endereço muda, então o antigo passa a redirecionar. Entra no fim da nova lista.
 */
export async function moveCategoryAction(
  id: string,
  parentId: string | null,
): Promise<AdminResult> {
  return runAdmin("categories.edit", moveSchema, { id, parentId }, async (data, context) => {
    const message = await moveCategory(data, context);
    invalidate("categories", "catalog", "home");
    return { message };
  });
}

// ───────────── Coleções manuais: produtos ─────────────

const collectionSchema = z.object({
  collectionId: z.string().max(40),
  productIds: z.array(z.string().max(40)).max(500),
});

/** Grava a lista de produtos da coleção manual, na ordem recebida. */
export async function setCollectionProductsAction(
  collectionId: string,
  productIds: string[],
): Promise<AdminResult> {
  return runAdmin(
    "collections.edit",
    collectionSchema,
    { collectionId, productIds },
    async (data, { audit }) => {
      const collection = await db.collection.findUnique({
        where: { id: data.collectionId },
        select: { name: true, type: true },
      });
      if (!collection || collection.type !== "MANUAL")
        throw new AdminError("Coleção manual não encontrada.");
      const unique = [...new Set(data.productIds)];
      await db.$transaction([
        db.collectionProduct.deleteMany({ where: { collectionId: data.collectionId } }),
        db.collectionProduct.createMany({
          data: unique.map((productId, position) => ({
            collectionId: data.collectionId,
            productId,
            position,
          })),
        }),
      ]);
      await audit({
        action: "collection.set_products",
        entityType: "Collection",
        entityId: data.collectionId,
        diff: { produtos: unique.length },
      });
      invalidate("catalog", "home");
      return { message: `Produtos da coleção ${collection.name} salvos` };
    },
  );
}

// ───────────── Cupons: gerador em lote ─────────────

const batchSchema = z.object({
  baseId: z.string().min(1, "Escolha o cupom modelo.").max(40),
  prefix: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Informe um prefixo de pelo menos 2 letras.")
    .max(12)
    .regex(/^[A-Z0-9]+$/, "Use só letras e números no prefixo."),
  quantity: z.coerce
    .number()
    .int()
    .min(1, "Informe a quantidade.")
    .max(1000, "Gere até 1.000 cupons por vez."),
});

/** Gera cupons únicos (um uso cada) com as regras de um cupom modelo. */
export async function generateCouponBatchAction(
  input: z.input<typeof batchSchema>,
): Promise<AdminResult<{ batch: string }>> {
  return runAdmin<typeof batchSchema, { batch: string }>(
    "coupons.manage",
    batchSchema,
    input,
    async (data, { audit }) => {
      const base = await db.coupon.findUnique({
        where: { id: data.baseId },
        include: { categories: { select: { id: true } }, products: { select: { id: true } } },
      });
      if (!base) throw new AdminError("Cupom modelo não encontrado.");
      const batch = `${data.prefix}-${new Date().toISOString().slice(0, 10)}-${randomBytes(2).toString("hex")}`;
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const codes = new Set<string>();
      while (codes.size < data.quantity)
        codes.add(
          `${data.prefix}-${Array.from(randomBytes(6), (byte) => alphabet[byte % alphabet.length]).join("")}`,
        );
      const taken = await db.coupon.findMany({
        where: { code: { in: [...codes] } },
        select: { code: true },
      });
      for (const item of taken) codes.delete(item.code);
      await db.$transaction(
        async (tx) => {
          for (const code of codes) {
            await tx.coupon.create({
              data: {
                code,
                description: `Lote gerado a partir de ${base.code}`,
                type: base.type,
                value: base.value,
                minSubtotalCents: base.minSubtotalCents,
                maxDiscountCents: base.maxDiscountCents,
                usageLimit: 1,
                perCustomerLimit: 1,
                firstPurchaseOnly: base.firstPurchaseOnly,
                startsAt: base.startsAt,
                endsAt: base.endsAt,
                combinableWithPix: base.combinableWithPix,
                appliesToSameDay: base.appliesToSameDay,
                batch,
                categories: { connect: base.categories },
                products: { connect: base.products },
              },
            });
          }
        },
        { timeout: 60_000 },
      );
      await audit({
        action: "coupon.generate_batch",
        entityType: "Coupon",
        diff: { lote: batch, quantidade: codes.size, modelo: base.code },
      });
      return { message: `${codes.size} cupons gerados no lote ${batch}`, data: { batch } };
    },
  );
}

// ───────────── Redirecionamentos: testar e importar ─────────────

export type RedirectTest = {
  normalized: string;
  match: { toPath: string; statusCode: number; isActive: boolean } | null;
};

export async function testRedirectAction(url: string): Promise<RedirectTest> {
  await requirePermission("redirects.manage");
  const normalized = normalizeRedirectInput(String(url).slice(0, 500));
  const match = await db.redirect.findUnique({
    where: { fromPath: normalized },
    select: { toPath: true, statusCode: true, isActive: true },
  });
  return { normalized, match };
}

const fileSchema = z.object({
  rows: z.array(z.array(z.string())).min(1, "O arquivo está vazio.").max(5000),
});

/** Importa redirecionamentos de um CSV com as colunas origem e destino (e código, opcional). */
export async function importRedirectsAction(
  form: FormData,
): Promise<AdminResult<{ errors: string[] }>> {
  const file = form.get("file");
  const rows =
    file instanceof File && file.size > 0 && file.size < 5 * 1024 * 1024
      ? parseCsv(decodeCsvBuffer(await file.arrayBuffer()))
      : [];
  return runAdmin<typeof fileSchema, { errors: string[] }>(
    "redirects.manage",
    fileSchema,
    { rows },
    async (data, { audit }) => {
      const body = /origem|from/i.test(data.rows[0]?.[0] ?? "") ? data.rows.slice(1) : data.rows;
      const errors: string[] = [];
      let saved = 0;
      for (const [index, row] of body.entries()) {
        const [from = "", to = "", code = "301"] = row;
        try {
          if (!from || !/^(\/|https:\/\/)/.test(to))
            throw new AdminError("origem ou destino inválido.");
          const fromPath = normalizeRedirectInput(from);
          const existing = await db.redirect.findUnique({
            where: { fromPath },
            select: { id: true },
          });
          await assertRedirectIsSafe(fromPath, to, existing?.id);
          const statusCode = code.trim() === "302" ? 302 : 301;
          await db.redirect.upsert({
            where: { fromPath },
            update: { toPath: to, statusCode, isActive: true },
            create: { fromPath, toPath: to, statusCode, note: "Importado por CSV" },
          });
          saved++;
        } catch (error) {
          errors.push(
            `Linha ${index + 1} (${from || "sem origem"}): ${error instanceof Error ? error.message : "erro"}`,
          );
        }
      }
      await audit({
        action: "redirect.import",
        entityType: "Redirect",
        diff: { gravados: saved, erros: errors.length },
      });
      return {
        message: `${saved} redirecionamentos gravados${errors.length ? `, ${errors.length} com erro` : ""}`,
        data: { errors: errors.slice(0, 50) },
      };
    },
  );
}

// ───────────── Frete: simulador ─────────────

const simulatorSchema = z.object({
  cep: z.string().max(12),
  subtotal: z.coerce.number().min(0).max(1_000_000),
  weightGrams: z.coerce.number().int().min(0).max(500_000),
  localOnly: z.boolean(),
  sameDayEligible: z.boolean(),
});

export type ShippingSimulation =
  | { ok: true; options: ShippingOption[]; notice: string | null; blockedByLocalOnly: boolean }
  | { ok: false; error: string };

/** Simulador do painel: CEP e um carrinho de exemplo, com as mesmas regras que o checkout usa. */
export async function simulateShippingAction(
  input: z.input<typeof simulatorSchema>,
): Promise<ShippingSimulation> {
  await requirePermission("shipping.manage");
  const parsed = simulatorSchema.safeParse(input);
  const cep = parsed.success ? normalizeCep(parsed.data.cep) : null;
  if (!parsed.success || !cep)
    return { ok: false, error: "Informe um CEP válido, o valor e o peso do carrinho." };
  const quote = await quoteShipping({
    cep,
    items: [
      {
        variantId: "simulador",
        quantity: 1,
        weightGrams: parsed.data.weightGrams,
        sameDayEligible: parsed.data.sameDayEligible,
        deliveryScope: parsed.data.localOnly ? "LOCAL_ONLY" : "NATIONAL",
      },
    ],
    subtotalCents: Math.round(parsed.data.subtotal * 100),
    freeShippingCoupon: null,
    now: new Date(),
  });
  return {
    ok: true,
    options: quote.options,
    notice: quote.notice,
    blockedByLocalOnly: quote.blockedByLocalOnly,
  };
}
