import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatCentsPlain, parseBRLToCents } from "@/lib/money";
import { normalizeText } from "@/lib/slug";
import { publishIfReady } from "@/server/services/legacy-images";
import { AdminError, type AdminContext } from "./action";
import { invalidateProducts, refreshProductDerived, uniqueProductSlug } from "./products";

/**
 * Curadoria do catálogo importado: o dono decide, produto a produto, o que fica na loja.
 * Excluir manda para a lixeira (aba Excluídos), de onde tudo pode ser restaurado.
 */

export const CURATION_TABS = ["revisar", "mantidos", "destaques", "excluidos"] as const;
export type CurationTab = (typeof CURATION_TABS)[number];
export const CURATION_FLAGS = ["sem-foto", "sem-estoque", "duplicados"] as const;
export type CurationFlag = (typeof CURATION_FLAGS)[number];
export const CURATION_PAGE_SIZE = 48;

export type CurationParams = {
  tab: CurationTab;
  q: string;
  categoryId: string;
  flag: CurationFlag | "";
  page: number;
};

export type CurationItem = {
  id: string;
  name: string;
  sku: string;
  slug: string;
  published: boolean;
  featured: boolean;
  categoryId: string;
  categoryName: string | null;
  /** Preço para o campo de edição ("89,90"). Vazio quando o produto não tem variação. */
  price: string;
  priceCents: number;
  /** Com mais de uma variação o preço é editado no cadastro completo. */
  variantCount: number;
  available: number;
  /** Foto já na loja ou, enquanto não foi trazida, o endereço dela no site antigo. */
  image: string | null;
  imageIsLegacy: boolean;
  imageCount: number;
  description: string;
  deletedAt: string | null;
  deletedBy: string | null;
};

export type CurationCounts = Record<CurationTab, number> & {
  /** Fotos do site antigo ainda não trazidas, entre os produtos mantidos. */
  photosPending: number;
};

export function parseCurationParams(
  raw: Record<string, string | string[] | undefined>,
): CurationParams {
  const one = (key: string) => {
    const value = raw[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  };
  const tab = one("aba") as CurationTab;
  const flag = one("filtro") as CurationFlag;
  return {
    tab: CURATION_TABS.includes(tab) ? tab : "revisar",
    q: one("busca").slice(0, 100),
    categoryId: one("categoria").slice(0, 40),
    flag: CURATION_FLAGS.includes(flag) ? flag : "",
    page: Math.max(1, Math.min(500, Number(one("pagina")) || 1)),
  };
}

const tabWhere: Record<CurationTab, Prisma.ProductWhereInput> = {
  revisar: { curation: "PENDING", deletedAt: null },
  mantidos: { curation: "KEPT", deletedAt: null },
  destaques: { curation: "KEPT", isFeatured: true, deletedAt: null },
  excluidos: { deletedAt: { not: null } },
};

/** Produtos com o mesmo nome (sem acentos nem caixa) que outro produto da curadoria. */
async function duplicateIds(): Promise<string[]> {
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT p.id FROM "Product" p
    WHERE p."deletedAt" IS NULL AND p."curation" IS NOT NULL
      AND lower(unaccent(btrim(p.name))) IN (
        SELECT lower(unaccent(btrim(name))) FROM "Product"
        WHERE "deletedAt" IS NULL AND "curation" IS NOT NULL
        GROUP BY 1 HAVING count(*) > 1
      )`;
  return rows.map((row) => row.id);
}

export async function curationCounts(): Promise<CurationCounts> {
  const [revisar, mantidos, destaques, excluidos, photosPending] = await Promise.all([
    db.product.count({ where: tabWhere.revisar }),
    db.product.count({ where: tabWhere.mantidos }),
    db.product.count({ where: tabWhere.destaques }),
    db.product.count({ where: tabWhere.excluidos }),
    db.product.count({
      where: { ...tabWhere.mantidos, legacyImageUrls: { isEmpty: false } },
    }),
  ]);
  return { revisar, mantidos, destaques, excluidos, photosPending };
}

const stripTags = (html: string | null) =>
  (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export async function listCuration(
  params: CurationParams,
): Promise<{ items: CurationItem[]; total: number }> {
  const and: Prisma.ProductWhereInput[] = [tabWhere[params.tab]];
  if (params.q)
    and.push({
      OR: [
        { searchText: { contains: normalizeText(params.q) } },
        { sku: { contains: params.q.toUpperCase() } },
      ],
    });
  if (params.categoryId === "sem") and.push({ primaryCategoryId: null });
  else if (params.categoryId)
    and.push({
      OR: [
        { primaryCategoryId: params.categoryId },
        { primaryCategory: { parentId: params.categoryId } },
      ],
    });
  if (params.flag === "sem-foto")
    and.push({ images: { none: {} }, legacyImageUrls: { isEmpty: true } });
  if (params.flag === "sem-estoque") and.push({ totalAvailable: 0 });
  if (params.flag === "duplicados") and.push({ id: { in: await duplicateIds() } });
  const where: Prisma.ProductWhereInput = { AND: and };

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    params.tab === "excluidos"
      ? [{ deletedAt: "desc" }, { id: "asc" }]
      : params.flag === "duplicados"
        ? [{ name: "asc" }, { id: "asc" }]
        : [{ primaryCategory: { path: "asc" } }, { name: "asc" }, { id: "asc" }];

  const [rows, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy,
      skip: (params.page - 1) * CURATION_PAGE_SIZE,
      take: CURATION_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        sku: true,
        slug: true,
        status: true,
        isFeatured: true,
        primaryCategoryId: true,
        primaryCategory: { select: { name: true } },
        minPriceCents: true,
        totalAvailable: true,
        legacyImageUrls: true,
        shortDescription: true,
        description: true,
        deletedAt: true,
        deletedById: true,
        images: {
          orderBy: [{ isCover: "desc" }, { position: "asc" }],
          take: 1,
          select: { media: { select: { variants: true } } },
        },
        variants: {
          where: { isActive: true },
          orderBy: { position: "asc" },
          select: { priceCents: true },
        },
        _count: { select: { images: true } },
      },
    }),
    db.product.count({ where }),
  ]);

  const userIds = [...new Set(rows.map((row) => row.deletedById).filter((id) => id !== null))];
  const users = userIds.length
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const userName = new Map(users.map((user) => [user.id, user.name]));

  const items = rows.map((row): CurationItem => {
    const variants = (row.images[0]?.media.variants ?? {}) as Record<string, string>;
    const stored = variants["800"] ?? variants["400"] ?? variants["1600"] ?? null;
    const price = row.variants[0]?.priceCents ?? 0;
    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      slug: row.slug,
      published: row.status === "ACTIVE",
      featured: row.isFeatured,
      categoryId: row.primaryCategoryId ?? "",
      categoryName: row.primaryCategory?.name ?? null,
      price: row.variants.length ? formatCentsPlain(price) : "",
      priceCents: row.variants.length > 1 ? row.minPriceCents : price,
      variantCount: row.variants.length,
      available: row.totalAvailable,
      image: stored ?? row.legacyImageUrls[0] ?? null,
      imageIsLegacy: !stored && row.legacyImageUrls.length > 0,
      imageCount: row._count.images + row.legacyImageUrls.length,
      description: (row.shortDescription || stripTags(row.description)).slice(0, 320),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      deletedBy: row.deletedById ? (userName.get(row.deletedById) ?? null) : null,
    };
  });
  return { items, total };
}

const ids = z.array(z.string().min(1).max(40)).min(1).max(500);

export const decideSchema = z.object({
  ids,
  /** keep: fica na loja. feature: fica e ganha destaque. pending: volta para a fila de revisão. */
  decision: z.enum(["keep", "feature", "unfeature", "pending"]),
});
export const idsSchema = z.object({ ids });
export const renameSchema = z.object({
  id: z.string().max(40),
  name: z.string().trim().min(2, "Informe o nome do produto.").max(160),
});
export const priceSchema = z.object({ id: z.string().max(40), price: z.string().trim().max(20) });
export const categorySchema = z.object({ ids, categoryId: z.string().min(1).max(40) });

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

async function loadTargets(productIds: string[]) {
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, slug: true, status: true, deletedAt: true },
  });
  if (products.length === 0) throw new AdminError("Produto não encontrado.");
  return products;
}

export async function decideProducts(
  input: z.output<typeof decideSchema>,
  { audit }: AdminContext,
): Promise<{ message: string; published: number; ids: string[] }> {
  const products = (await loadTargets(input.ids)).filter((product) => !product.deletedAt);
  if (products.length === 0) throw new AdminError("Estes produtos estão na lixeira.");
  const targetIds = products.map((product) => product.id);
  let published = 0;

  await db.$transaction(
    async (tx) => {
      if (input.decision === "pending") {
        await tx.product.updateMany({
          where: { id: { in: targetIds } },
          data: { curation: "PENDING", isFeatured: false, status: "DRAFT" },
        });
        return;
      }
      if (input.decision === "unfeature") {
        await tx.product.updateMany({
          where: { id: { in: targetIds } },
          data: { isFeatured: false },
        });
        return;
      }
      await tx.product.updateMany({
        where: { id: { in: targetIds } },
        data: { curation: "KEPT", ...(input.decision === "feature" ? { isFeatured: true } : {}) },
      });
      for (const id of targetIds) if (await publishIfReady(tx, id)) published++;
    },
    { timeout: 60_000 },
  );

  const count = products.length;
  const message = {
    keep: plural(count, "produto mantido", "produtos mantidos"),
    feature: plural(count, "produto em destaque", "produtos em destaque"),
    unfeature: plural(count, "produto saiu dos destaques", "produtos saíram dos destaques"),
    pending: plural(count, "produto voltou para a revisão", "produtos voltaram para a revisão"),
  }[input.decision];
  await audit({
    action: `product.curation_${input.decision}`,
    entityType: "Product",
    ...(count === 1 ? { entityId: products[0].id } : {}),
    diff: { produtos: products.map((product) => product.name).slice(0, 50), total: count },
  });
  invalidateProducts(products.map((product) => product.slug).slice(0, 200));
  return { message, published, ids: targetIds };
}

/** Manda para a lixeira: sai da loja e das listas, mas fica guardado para ser restaurado. */
export async function trashProducts(
  productIds: string[],
  { user, audit }: AdminContext,
): Promise<{ message: string; ids: string[] }> {
  const products = (await loadTargets(productIds)).filter((product) => !product.deletedAt);
  if (products.length === 0) throw new AdminError("Estes produtos já estão na lixeira.");
  const deletedAt = new Date();
  await db.$transaction(
    products.map((product) =>
      db.product.update({
        where: { id: product.id },
        data: {
          deletedAt,
          deletedById: user.id,
          statusBeforeDelete: product.status,
          status: "ARCHIVED",
        },
      }),
    ),
  );
  await audit({
    action: "product.trash",
    entityType: "Product",
    ...(products.length === 1 ? { entityId: products[0].id } : {}),
    diff: {
      produtos: products.map((product) => product.name).slice(0, 50),
      total: products.length,
    },
  });
  invalidateProducts(products.map((product) => product.slug).slice(0, 200));
  return {
    message: plural(products.length, "produto excluído", "produtos excluídos"),
    ids: products.map((product) => product.id),
  };
}

/** Tira da lixeira e devolve o produto ao estado em que estava. */
export async function restoreProducts(
  productIds: string[],
  { audit }: AdminContext,
): Promise<{ message: string; ids: string[] }> {
  const products = await db.product.findMany({
    where: { id: { in: productIds }, deletedAt: { not: null } },
    select: { id: true, name: true, slug: true, statusBeforeDelete: true },
  });
  if (products.length === 0) throw new AdminError("Estes produtos não estão na lixeira.");
  await db.$transaction(
    products.map((product) =>
      db.product.update({
        where: { id: product.id },
        data: {
          deletedAt: null,
          deletedById: null,
          statusBeforeDelete: null,
          status: product.statusBeforeDelete ?? "DRAFT",
        },
      }),
    ),
  );
  await audit({
    action: "product.restore",
    entityType: "Product",
    ...(products.length === 1 ? { entityId: products[0].id } : {}),
    diff: {
      produtos: products.map((product) => product.name).slice(0, 50),
      total: products.length,
    },
  });
  invalidateProducts(products.map((product) => product.slug).slice(0, 200));
  return {
    message: plural(products.length, "produto restaurado", "produtos restaurados"),
    ids: products.map((product) => product.id),
  };
}

export async function renameProduct(
  input: z.output<typeof renameSchema>,
  { audit }: AdminContext,
): Promise<{ message: string }> {
  const product = await db.product.findUnique({
    where: { id: input.id },
    select: { id: true, name: true, slug: true, publishedAt: true },
  });
  if (!product) throw new AdminError("Produto não encontrado.");
  if (product.name === input.name) return { message: "Nada foi alterado" };
  await db.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: product.id },
      data: {
        name: input.name,
        // Quem nunca foi publicado ainda não tem endereço conhecido: ele acompanha o nome novo.
        ...(product.publishedAt ? {} : { slug: await uniqueProductSlug(input.name, tx) }),
      },
    });
    // O texto alternativo das fotos trazidas do site antigo é o nome do produto.
    await tx.mediaAsset.updateMany({
      where: { alt: product.name, productImages: { some: { productId: product.id } } },
      data: { alt: input.name.slice(0, 200) },
    });
    await refreshProductDerived(tx, product.id);
  });
  await audit({
    action: "product.rename",
    entityType: "Product",
    entityId: product.id,
    diff: { nome: { antes: product.name, depois: input.name } },
  });
  invalidateProducts([product.slug]);
  return { message: "Nome alterado" };
}

export async function setProductPrice(
  input: z.output<typeof priceSchema>,
  { audit }: AdminContext,
): Promise<{ message: string }> {
  const cents = parseBRLToCents(input.price);
  if (cents === null || cents <= 0) throw new AdminError("Informe um preço válido, como 89,90.");
  const product = await db.product.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      name: true,
      slug: true,
      variants: { where: { isActive: true }, select: { id: true, priceCents: true } },
    },
  });
  if (!product) throw new AdminError("Produto não encontrado.");
  if (product.variants.length !== 1)
    throw new AdminError(
      "Este produto tem mais de um tamanho ou modelo. Altere os preços no cadastro completo.",
    );
  const [variant] = product.variants;
  if (variant.priceCents === cents) return { message: "Nada foi alterado" };
  await db.$transaction(async (tx) => {
    await tx.productVariant.update({ where: { id: variant.id }, data: { priceCents: cents } });
    await refreshProductDerived(tx, product.id);
    await publishIfReady(tx, product.id);
  });
  await audit({
    action: "product.set_price",
    entityType: "Product",
    entityId: product.id,
    diff: { preco: { antes: variant.priceCents, depois: cents } },
  });
  invalidateProducts([product.slug]);
  return { message: "Preço alterado" };
}

export async function setProductsCategory(
  input: z.output<typeof categorySchema>,
  { audit }: AdminContext,
): Promise<{ message: string }> {
  const category = await db.category.findUnique({
    where: { id: input.categoryId },
    select: { id: true, name: true },
  });
  if (!category) throw new AdminError("Escolha a categoria.");
  const products = await loadTargets(input.ids);
  await db.$transaction(
    async (tx) => {
      await tx.product.updateMany({
        where: { id: { in: products.map((product) => product.id) } },
        data: { primaryCategoryId: category.id },
      });
      for (const product of products) await refreshProductDerived(tx, product.id);
    },
    { timeout: 60_000 },
  );
  await audit({
    action: "product.set_category",
    entityType: "Product",
    ...(products.length === 1 ? { entityId: products[0].id } : {}),
    diff: {
      categoria: category.name,
      produtos: products.map((product) => product.name).slice(0, 50),
      total: products.length,
    },
  });
  invalidateProducts(products.map((product) => product.slug).slice(0, 200));
  return {
    message:
      products.length === 1
        ? `Categoria alterada para ${category.name}`
        : `${plural(products.length, "produto movido", "produtos movidos")} para ${category.name}`,
  };
}

/** Próximos produtos mantidos que ainda têm fotos no site antigo, a partir de um cursor. */
export async function nextLegacyPhotoBatch(afterId: string, take: number): Promise<string[]> {
  const rows = await db.product.findMany({
    where: {
      ...tabWhere.mantidos,
      legacyImageUrls: { isEmpty: false },
      ...(afterId ? { id: { gt: afterId } } : {}),
    },
    orderBy: { id: "asc" },
    take,
    select: { id: true },
  });
  return rows.map((row) => row.id);
}
