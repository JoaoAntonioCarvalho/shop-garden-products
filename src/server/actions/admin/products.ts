"use server";

import { z } from "zod";
import { requirePermission } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { formatBRL, parseBRLToCents } from "@/lib/money";
import { can } from "@/lib/permissions";
import { normalizeText } from "@/lib/slug";
import { AdminError, runAdmin, type AdminResult } from "@/server/admin/action";
import { tagList } from "@/server/admin/fields";
import {
  duplicateProduct,
  invalidateProducts,
  LowQualityError,
  productSchema,
  refreshProductDerived,
  removeSampleData,
  replaceProductImages,
  saveProduct,
  type SampleRemovalReport,
} from "@/server/admin/products";
import { adjustStock } from "@/server/services/inventory";

type SaveData = { redirect?: string; needsConfirmation?: boolean; score?: number };

export async function saveProductAction(input: unknown): Promise<AdminResult<SaveData>> {
  return runAdmin<typeof productSchema, SaveData>(
    "products.edit",
    productSchema,
    input,
    async (data, context) => {
      try {
        const saved = await saveProduct(data, context);
        return {
          message: data.status === "ACTIVE" ? "Produto salvo e publicado" : "Produto salvo",
          data: {
            redirect: data.id ? undefined : `/admin/produtos/${saved.id}`,
            score: saved.qualityScore,
          },
        };
      } catch (error) {
        // Publicar com qualidade baixa pede confirmação; nada foi gravado.
        if (error instanceof LowQualityError)
          return { message: error.message, data: { needsConfirmation: true, score: error.score } };
        throw error;
      }
    },
  );
}

const imagesSchema = z.object({ id: z.string().max(40), images: productSchema.shape.images });

/** A equipe pode organizar as imagens sem alterar os demais dados do produto. */
export async function saveProductImagesAction(input: unknown) {
  return runAdmin("products.edit_images", imagesSchema, input, async (data, { audit }) => {
    const product = await db.product.findUnique({
      where: { id: data.id },
      select: { slug: true, status: true, variants: { select: { id: true, sku: true } } },
    });
    if (!product) throw new AdminError("Produto não encontrado.");
    if (
      product.status === "ACTIVE" &&
      (data.images.length === 0 || data.images.some((image) => !image.alt))
    ) {
      throw new AdminError(
        "Produto publicado precisa de pelo menos uma imagem, todas com texto alternativo.",
      );
    }
    await db.$transaction(async (tx) => {
      await replaceProductImages(
        tx,
        data.id,
        data.images,
        new Map(product.variants.map((variant) => [variant.sku, variant.id])),
      );
      await refreshProductDerived(tx, data.id);
    });
    await audit({
      action: "product.update_images",
      entityType: "Product",
      entityId: data.id,
      diff: { imagens: data.images.length },
    });
    invalidateProducts([product.slug]);
    return { message: "Imagens salvas" };
  });
}

const quickSchema = z.object({
  variantId: z.string().max(40),
  price: z.string().max(20).optional(),
  stock: z.string().max(10).optional(),
});

/** Edição rápida de preço e estoque da variação padrão, direto na lista. */
export async function quickEditVariantAction(input: z.input<typeof quickSchema>) {
  return runAdmin("products.view", quickSchema, input, async (data, { user, audit }) => {
    const variant = await db.productVariant.findUnique({
      where: { id: data.variantId },
      include: { product: { select: { id: true, slug: true, name: true } } },
    });
    if (!variant) throw new AdminError("Variação não encontrada.");
    const cents = data.price != null && data.price !== "" ? parseBRLToCents(data.price) : null;
    const stock = data.stock != null && data.stock !== "" ? Number(data.stock) : null;
    if (data.price && (cents === null || cents <= 0))
      throw new AdminError("Informe um preço válido.");
    if (stock !== null && (!Number.isInteger(stock) || stock < 0))
      throw new AdminError("O estoque precisa ser um número inteiro, zero ou maior.");
    const priceChanged = cents !== null && cents !== variant.priceCents;
    const stockChanged = stock !== null && stock !== variant.stockOnHand;
    if (priceChanged && !can(user, "products.edit_price"))
      throw new AdminError("Só administradores alteram preços.");
    if (stockChanged && !can(user, "inventory.adjust"))
      throw new AdminError("Você não tem permissão para ajustar o estoque.");
    if (!priceChanged && !stockChanged) return { message: "Nada foi alterado" };
    await db.$transaction(async (tx) => {
      if (priceChanged)
        await tx.productVariant.update({ where: { id: variant.id }, data: { priceCents: cents } });
      if (stockChanged)
        await adjustStock(tx, {
          kind: "ADJUSTMENT",
          variantId: variant.id,
          newCount: stock,
          reason: "Edição rápida na lista de produtos",
          userId: user.id,
        });
      await refreshProductDerived(tx, variant.product.id);
    });
    await audit({
      action: "product.quick_edit",
      entityType: "Product",
      entityId: variant.product.id,
      diff: {
        ...(priceChanged ? { preco: { antes: variant.priceCents, depois: cents } } : {}),
        ...(stockChanged ? { estoque: { antes: variant.stockOnHand, depois: stock } } : {}),
      },
    });
    invalidateProducts([variant.product.slug]);
    return { message: `${variant.product.name} atualizado` };
  });
}

const idsSchema = z.object({
  ids: z.array(z.string().max(40)).min(1, "Selecione pelo menos um produto.").max(500),
  value: z.string().max(200).optional(),
});
type BulkKind =
  | "publish"
  | "archive"
  | "category"
  | "collection"
  | "tags"
  | "sameDayOn"
  | "sameDayOff"
  | "delete"
  | "price";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function percentOfInput(value: string | undefined): number {
  const percent = Number(
    String(value ?? "")
      .replace(",", ".")
      .replace("%", ""),
  );
  if (!Number.isFinite(percent) || percent === 0 || percent < -90 || percent > 500)
    throw new AdminError(
      "Informe o reajuste em porcentagem, entre -90 e 500. Use sinal de menos para reduzir.",
    );
  return percent;
}

const adjusted = (cents: number, percent: number) =>
  Math.max(1, Math.round((cents * (100 + percent)) / 100));

/** Prévia do reajuste em porcentagem: produto, preço atual e preço novo. */
export async function previewPriceAdjustmentAction(
  ids: string[],
  value?: string,
): Promise<string[]> {
  await requirePermission("products.edit_price");
  const parsed = idsSchema.safeParse({ ids, value });
  if (!parsed.success) return ["Selecione produtos e informe a porcentagem."];
  let percent: number;
  try {
    percent = percentOfInput(value);
  } catch (error) {
    return [(error as Error).message];
  }
  const variants = await db.productVariant.findMany({
    where: { productId: { in: parsed.data.ids } },
    orderBy: [{ product: { name: "asc" } }, { position: "asc" }],
    take: 40,
    include: { product: { select: { name: true } } },
  });
  return variants.map(
    (variant) =>
      `${variant.product.name}${variant.name !== "Padrão" ? ` (${variant.name})` : ""}: de ${formatBRL(variant.priceCents)} para ${formatBRL(adjusted(variant.priceCents, percent))}`,
  );
}

/** Ações em massa da lista de produtos. */
export async function bulkProductAction(kind: BulkKind, ids: string[], value?: string) {
  const permission =
    kind === "delete"
      ? "products.delete"
      : kind === "price"
        ? "products.edit_price"
        : "products.edit";
  return runAdmin(permission, idsSchema, { ids, value }, async (data, { audit }) => {
    const products = await db.product.findMany({
      where: { id: { in: data.ids } },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        tags: true,
        publishedAt: true,
        _count: { select: { orderItems: true } },
        images: { select: { media: { select: { alt: true } } } },
        variants: { select: { id: true, isActive: true, priceCents: true, stockReserved: true } },
      },
    });
    const all = products.map((product) => product.id);
    let message: string;
    const skipped: string[] = [];

    if (kind === "publish") {
      const ready = products.filter(
        (product) =>
          product.images.length > 0 &&
          product.images.every((image) => image.media.alt) &&
          product.variants.some((variant) => variant.isActive),
      );
      skipped.push(
        ...products.filter((product) => !ready.includes(product)).map((product) => product.name),
      );
      for (const product of ready)
        await db.product.update({
          where: { id: product.id },
          data: { status: "ACTIVE", publishedAt: product.publishedAt ?? new Date() },
        });
      message = `${plural(ready.length, "produto publicado", "produtos publicados")}${skipped.length ? `. Sem imagem, texto alternativo ou variação ativa: ${skipped.slice(0, 5).join(", ")}` : ""}`;
    } else if (kind === "archive") {
      await db.product.updateMany({ where: { id: { in: all } }, data: { status: "ARCHIVED" } });
      message = plural(all.length, "produto arquivado", "produtos arquivados");
    } else if (kind === "category") {
      const category = await db.category.findUnique({
        where: { id: data.value ?? "" },
        select: { id: true, name: true },
      });
      if (!category) throw new AdminError("Escolha a categoria.");
      await db.product.updateMany({
        where: { id: { in: all } },
        data: { primaryCategoryId: category.id },
      });
      await db.$transaction(async (tx) => {
        for (const id of all) await refreshProductDerived(tx, id);
      });
      message = `${plural(all.length, "produto movido", "produtos movidos")} para ${category.name}`;
    } else if (kind === "collection") {
      const collection = await db.collection.findUnique({
        where: { id: data.value ?? "" },
        select: { id: true, name: true, type: true },
      });
      if (!collection || collection.type !== "MANUAL")
        throw new AdminError("Escolha uma coleção manual.");
      await db.collectionProduct.createMany({
        data: all.map((productId) => ({ collectionId: collection.id, productId, position: 999 })),
        skipDuplicates: true,
      });
      message = `${plural(all.length, "produto adicionado", "produtos adicionados")} à coleção ${collection.name}`;
    } else if (kind === "tags") {
      const tags = tagList().parse(data.value ?? "");
      if (tags.length === 0) throw new AdminError("Informe as tags, separadas por vírgula.");
      await db.$transaction(async (tx) => {
        for (const product of products) {
          await tx.product.update({
            where: { id: product.id },
            data: { tags: [...new Set([...product.tags, ...tags])] },
          });
          await refreshProductDerived(tx, product.id);
        }
      });
      message = `Tags adicionadas a ${plural(all.length, "produto", "produtos")}`;
    } else if (kind === "sameDayOn" || kind === "sameDayOff") {
      await db.product.updateMany({
        where: { id: { in: all } },
        data: { sameDayEligible: kind === "sameDayOn" },
      });
      message = `Entrega hoje ${kind === "sameDayOn" ? "ligada" : "desligada"} em ${plural(all.length, "produto", "produtos")}`;
    } else if (kind === "price") {
      const percent = percentOfInput(data.value);
      await db.$transaction(async (tx) => {
        for (const product of products) {
          for (const variant of product.variants)
            await tx.productVariant.update({
              where: { id: variant.id },
              data: { priceCents: adjusted(variant.priceCents, percent) },
            });
          await refreshProductDerived(tx, product.id);
        }
      });
      message = `Preços reajustados em ${percent}% em ${plural(all.length, "produto", "produtos")}`;
    } else {
      // Excluir: só o que nunca foi vendido. O restante é arquivado, para o histórico dos pedidos continuar íntegro.
      const removable = products.filter(
        (product) =>
          product._count.orderItems === 0 &&
          product.variants.every((variant) => variant.stockReserved === 0),
      );
      const kept = products.filter((product) => !removable.includes(product));
      await db.product.deleteMany({
        where: { id: { in: removable.map((product) => product.id) } },
      });
      await db.product.updateMany({
        where: { id: { in: kept.map((product) => product.id) } },
        data: { status: "ARCHIVED" },
      });
      message = `${plural(removable.length, "produto excluído", "produtos excluídos")}${kept.length ? `; ${plural(kept.length, "com pedidos foi arquivado", "com pedidos foram arquivados")}` : ""}`;
    }

    await audit({
      action: `product.bulk_${kind}`,
      entityType: "Product",
      diff: {
        produtos: products.map((product) => product.name).slice(0, 50),
        valor: data.value ?? null,
        ignorados: skipped,
      },
    });
    invalidateProducts(products.map((product) => product.slug));
    return { message };
  });
}

const idSchema = z.object({ id: z.string().max(40) });

export async function duplicateProductAction(
  input: z.input<typeof idSchema>,
): Promise<AdminResult<{ redirect?: string }>> {
  return runAdmin<typeof idSchema, { redirect?: string }>(
    "products.edit",
    idSchema,
    input,
    async (data, context) => {
      const copy = await duplicateProduct(data.id, context);
      return {
        message: "Produto duplicado como rascunho",
        data: { redirect: `/admin/produtos/${copy.id}` },
      };
    },
  );
}

const removeSchema = z.object({ confirmation: z.string() });

export async function removeSampleDataAction(
  input: z.input<typeof removeSchema>,
): Promise<AdminResult<SampleRemovalReport>> {
  return runAdmin<typeof removeSchema, SampleRemovalReport>(
    "products.remove_samples",
    removeSchema,
    input,
    async (data, context) => {
      if (data.confirmation.trim() !== "REMOVER TESTES")
        throw new AdminError('Digite "REMOVER TESTES" para confirmar.');
      const report = await removeSampleData(context);
      return { message: "Dados de teste removidos", data: report };
    },
  );
}

/** Busca de produtos para "Combina com", coleções manuais e cupons. */
export async function searchProductsAction(
  query: string,
): Promise<Array<{ id: string; name: string; sku: string }>> {
  await requirePermission("products.view");
  const q = normalizeText(String(query)).slice(0, 60);
  if (q.length < 2) return [];
  return db.product.findMany({
    where: { status: { not: "ARCHIVED" }, searchText: { contains: q } },
    take: 10,
    orderBy: { name: "asc" },
    select: { id: true, name: true, sku: true },
  });
}
