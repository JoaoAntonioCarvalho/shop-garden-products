import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { diffFields } from "@/lib/audit";
import { db } from "@/lib/db";
import { productQuality, QUALITY_PUBLISH_MINIMUM, type QualityInput } from "@/lib/product-quality";
import { sanitizeRichText, stripHtml } from "@/lib/sanitize";
import { normalizeText, slugify } from "@/lib/slug";
import { invalidate } from "@/server/cache";
import { adjustStock, refreshProductAvailability } from "@/server/services/inventory";
import { getEffectivePriceCents } from "@/server/services/pricing";
import { AdminError, type AdminContext } from "./action";
import {
  bool,
  idList,
  int,
  optionalDateTime,
  optionalFloat,
  optionalId,
  optionalMoney,
  optionalText,
  money,
  requiredText,
  slugField,
  tagList,
} from "./fields";

type Tx = Prisma.TransactionClient;

export const productTypeLabels: Record<string, string> = {
  NATURAL_PLANT: "Planta natural",
  ORCHID: "Orquídea",
  ARRANGEMENT: "Arranjo",
  ARTIFICIAL: "Artificial",
  POT: "Vaso",
  CACHEPOT: "Cachepot",
  DECOR: "Decoração",
  AROMA: "Aroma",
  GARDEN_TOOL: "Ferramenta de jardinagem",
  GARDEN_SUPPLY: "Insumo de jardinagem",
};
export const productStatusLabels: Record<string, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Publicado",
  ARCHIVED: "Arquivado",
};
const PRODUCT_TYPES = Object.keys(productTypeLabels) as [string, ...string[]];

const qualitySelect = {
  productType: true,
  primaryCategoryId: true,
  shortDescription: true,
  description: true,
  seoTitle: true,
  seoDescription: true,
  heightCm: true,
  widthCm: true,
  light: true,
  watering: true,
  environment: true,
  petSafety: true,
  careLevel: true,
  material: true,
  color: true,
  images: { select: { media: { select: { alt: true } } } },
  variants: { where: { isActive: true }, select: { weightGrams: true } },
} satisfies Prisma.ProductSelect;

type QualitySource = Prisma.ProductGetPayload<{ select: typeof qualitySelect }>;

export function toQualityInput(product: QualitySource): QualityInput {
  return {
    ...product,
    descriptionText: stripHtml(product.description),
    images: product.images.map((image) => ({ alt: image.media.alt })),
    variantWeights: product.variants.map((variant) => variant.weightGrams),
  };
}

/**
 * Recalcula o que é desnormalizado no produto: menor preço efetivo, disponível, texto de busca e
 * nota de qualidade. Chamado depois de qualquer alteração de produto, variação ou imagem.
 */
export async function refreshProductDerived(
  tx: Tx,
  productId: string,
): Promise<{ qualityScore: number }> {
  const product = await tx.product.findUniqueOrThrow({
    where: { id: productId },
    select: {
      ...qualitySelect,
      name: true,
      sku: true,
      scientificName: true,
      commonName: true,
      tags: true,
      brand: true,
      primaryCategory: { select: { name: true } },
      variants: {
        where: { isActive: true },
        select: {
          weightGrams: true,
          sku: true,
          priceCents: true,
          promoPriceCents: true,
          promoStartsAt: true,
          promoEndsAt: true,
        },
      },
    },
  });
  const prices = product.variants.map((variant) => getEffectivePriceCents(variant));
  const qualityScore = productQuality(toQualityInput(product)).score;
  await tx.product.update({
    where: { id: productId },
    data: {
      minPriceCents: prices.length ? Math.min(...prices) : 0,
      qualityScore,
      searchText: normalizeText(
        [
          product.name,
          product.scientificName,
          product.commonName,
          product.tags.join(" "),
          product.sku,
          ...product.variants.map((variant) => variant.sku),
          product.primaryCategory?.name,
          product.material,
          product.brand,
        ]
          .filter(Boolean)
          .join(" "),
      ),
    },
  });
  await refreshProductAvailability(tx, [productId]);
  return { qualityScore };
}

/** Recalcula a nota de qualidade de todos os produtos (seed e tarefa agendada). */
export async function refreshAllQualityScores(): Promise<number> {
  const products = await db.product.findMany({
    select: { id: true, qualityScore: true, ...qualitySelect },
  });
  let changed = 0;
  for (const product of products) {
    const score = productQuality(toQualityInput(product)).score;
    if (score !== product.qualityScore) {
      await db.product.update({ where: { id: product.id }, data: { qualityScore: score } });
      changed++;
    }
  }
  return changed;
}

/** Invalida o cache da loja para os produtos alterados. */
export function invalidateProducts(slugs: string[] = []): void {
  invalidate("catalog", "home", ...slugs.map((slug) => `product:${slug}`));
}

// ───────────────────────── Formulário ─────────────────────────

const variantSchema = z.object({
  id: optionalId(),
  name: requiredText("o nome da variação", 120),
  sku: z
    .string()
    .trim()
    .min(1, "Informe o SKU.")
    .max(60)
    .transform((value) => value.toUpperCase()),
  options: z.record(z.string().max(40), z.string().max(60)).default({}),
  priceCents: money("o preço"),
  compareAtPriceCents: optionalMoney(),
  costCents: optionalMoney(),
  promoPriceCents: optionalMoney(),
  promoStartsAt: optionalDateTime(),
  promoEndsAt: optionalDateTime(),
  weightGrams: int("o peso", 0, 500_000),
  stockOnHand: int("o estoque", 0, 1_000_000),
  lowStockThreshold: int("o alerta de estoque", 0, 100_000),
  barcode: optionalText(60),
  isActive: bool(),
});

const imageSchema = z.object({
  mediaId: z.string().min(1).max(40),
  alt: z.string().trim().max(200),
  isCover: bool(),
  /** SKU da variação a que a imagem pertence, se houver. */
  variantSku: optionalText(60),
});

const optionalEnum = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z.enum(values).nullable(),
  );
const optionalBool = () =>
  z.preprocess(
    (value) => (value === "" || value == null ? null : value === true || value === "true"),
    z.boolean().nullable(),
  );

export const productSchema = z.object({
  id: optionalId(),
  name: requiredText("o nome do produto", 160),
  slug: slugField(),
  sku: z
    .string()
    .trim()
    .min(1, "Informe o código do produto.")
    .max(60)
    .transform((value) => value.toUpperCase()),
  productType: z.enum(PRODUCT_TYPES, { error: "Escolha o tipo do produto." }),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  primaryCategoryId: optionalId(),
  additionalCategoryIds: idList(40),
  collectionIds: idList(40),
  brand: optionalText(80),
  tags: tagList(),
  shortDescription: optionalText(160),
  description: optionalText(20_000),
  careInstructions: optionalText(20_000),
  isFeatured: bool(),
  isNew: bool(),
  isGiftable: bool(),
  // Ficha
  commonName: optionalText(120),
  scientificName: optionalText(120),
  light: optionalEnum(["FULL_SUN", "PARTIAL_SHADE", "SHADE", "INDIRECT_LIGHT"]),
  watering: optionalText(160),
  environment: optionalEnum(["INDOOR", "OUTDOOR", "BOTH"]),
  petSafety: optionalEnum(["SAFE", "NOT_SAFE", "TOXIC"]),
  careLevel: optionalEnum(["EASY", "MODERATE", "DEMANDING"]),
  heightCm: optionalFloat(0, 1000),
  material: optionalText(80),
  color: optionalText(60),
  widthCm: optionalFloat(0, 1000),
  depthCm: optionalFloat(0, 1000),
  mouthDiameterCm: optionalFloat(0, 1000),
  baseDiameterCm: optionalFloat(0, 1000),
  capacityLiters: optionalFloat(0, 10_000),
  hasDrainageHole: optionalBool(),
  indoorOutdoor: optionalEnum(["INDOOR", "OUTDOOR", "BOTH"]),
  includesPot: optionalBool(),
  cleaningCare: optionalText(300),
  subtype: optionalText(60),
  // Entrega
  sameDayEligible: bool(),
  deliveryScope: z.enum(["LOCAL_ONLY", "NATIONAL"]),
  fragile: bool(),
  perishable: bool(),
  // SEO
  seoTitle: optionalText(70),
  seoDescription: optionalText(170),
  relatedProductIds: idList(12),
  variants: z.array(variantSchema).min(1, "O produto precisa de pelo menos uma variação.").max(100),
  images: z.array(imageSchema).max(30).default([]),
  /** Confirmação de publicar com qualidade abaixo do mínimo. */
  confirmLowQuality: z.boolean().default(false),
});

export type ProductInput = z.output<typeof productSchema>;

const scalarOf = (data: ProductInput) => ({
  name: data.name,
  slug: data.slug,
  sku: data.sku,
  productType: data.productType as never,
  status: data.status,
  primaryCategoryId: data.primaryCategoryId,
  brand: data.brand,
  tags: data.tags,
  shortDescription: data.shortDescription,
  description: data.description ? sanitizeRichText(data.description) : null,
  careInstructions: data.careInstructions ? sanitizeRichText(data.careInstructions) : null,
  isFeatured: data.isFeatured,
  isNew: data.isNew,
  isGiftable: data.isGiftable,
  commonName: data.commonName,
  scientificName: data.scientificName,
  light: data.light,
  watering: data.watering,
  environment: data.environment,
  petSafety: data.petSafety,
  careLevel: data.careLevel,
  heightCm: data.heightCm,
  material: data.material,
  color: data.color,
  widthCm: data.widthCm,
  depthCm: data.depthCm,
  mouthDiameterCm: data.mouthDiameterCm,
  baseDiameterCm: data.baseDiameterCm,
  capacityLiters: data.capacityLiters,
  hasDrainageHole: data.hasDrainageHole,
  indoorOutdoor: data.indoorOutdoor,
  includesPot: data.includesPot,
  cleaningCare: data.cleaningCare,
  subtype: data.subtype,
  sameDayEligible: data.sameDayEligible,
  deliveryScope: data.deliveryScope,
  fragile: data.fragile,
  perishable: data.perishable,
  seoTitle: data.seoTitle,
  seoDescription: data.seoDescription,
  relatedProductIds: data.relatedProductIds,
});

/**
 * Quando o endereço de algo publicado muda, o antigo passa a redirecionar para o novo. Os
 * redirecionamentos que apontavam para o antigo são atualizados (sem cadeias) e um eventual
 * redirecionamento saindo do novo endereço é removido (sem loops).
 */
export async function redirectOldPath(
  tx: Tx,
  fromPath: string,
  toPath: string,
  note: string,
): Promise<void> {
  if (fromPath === toPath) return;
  await tx.redirect.deleteMany({ where: { fromPath: toPath } });
  await tx.redirect.updateMany({ where: { toPath: fromPath }, data: { toPath } });
  await tx.redirect.upsert({
    where: { fromPath },
    update: { toPath, isActive: true, statusCode: 301, note },
    create: { fromPath, toPath, statusCode: 301, note },
  });
}

export class LowQualityError extends AdminError {
  constructor(public readonly score: number) {
    super(
      `A qualidade do cadastro está em ${score} de 100, abaixo de ${QUALITY_PUBLISH_MINIMUM}. Confirme para publicar mesmo assim.`,
    );
  }
}

/** Cria ou atualiza o produto com variações e imagens, em uma transação. */
export async function saveProduct(
  data: ProductInput,
  context: AdminContext,
): Promise<{ id: string; slug: string; qualityScore: number }> {
  const existing = data.id
    ? await db.product.findUnique({
        where: { id: data.id },
        include: { variants: { include: { _count: { select: { orderItems: true } } } } },
      })
    : null;
  if (data.id && !existing) throw new AdminError("Produto não encontrado.");

  // Unicidade de endereço e de SKUs, com mensagem clara.
  const slugOwner = await db.product.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });
  if (slugOwner && slugOwner.id !== existing?.id)
    throw new AdminError("Já existe um produto com este endereço (slug).");
  const skuOwner = await db.product.findUnique({ where: { sku: data.sku }, select: { id: true } });
  if (skuOwner && skuOwner.id !== existing?.id)
    throw new AdminError(`O código ${data.sku} já é de outro produto.`);
  const skus = data.variants.map((variant) => variant.sku);
  if (new Set(skus).size !== skus.length) throw new AdminError("Há variações com o mesmo SKU.");
  const takenSkus = await db.productVariant.findMany({
    where: { sku: { in: skus }, productId: { not: existing?.id ?? "" } },
    select: { sku: true },
  });
  if (takenSkus.length) throw new AdminError(`O SKU ${takenSkus[0].sku} já é de outro produto.`);

  for (const variant of data.variants) {
    if (variant.promoPriceCents != null && variant.promoPriceCents >= variant.priceCents)
      throw new AdminError(`${variant.name}: o preço promocional precisa ser menor que o preço.`);
    if (variant.compareAtPriceCents != null && variant.compareAtPriceCents <= variant.priceCents)
      throw new AdminError(`${variant.name}: o preço "de" precisa ser maior que o preço.`);
  }

  if (data.status === "ACTIVE") {
    if (!data.variants.some((variant) => variant.isActive))
      throw new AdminError("Para publicar, o produto precisa de uma variação ativa.");
    if (data.images.length === 0)
      throw new AdminError("Para publicar, envie pelo menos uma imagem.");
    if (data.images.some((image) => !image.alt))
      throw new AdminError("Para publicar, todas as imagens precisam de texto alternativo.");
  }

  const result = await db.$transaction(async (tx) => {
    const scalars = scalarOf(data);
    const publishedAt =
      data.status === "ACTIVE"
        ? (existing?.publishedAt ?? new Date())
        : (existing?.publishedAt ?? null);
    const relations = {
      additionalCategories: {
        set: data.additionalCategoryIds
          .filter((id) => id !== data.primaryCategoryId)
          .map((id) => ({ id })),
      },
    };
    const product = existing
      ? await tx.product.update({
          where: { id: existing.id },
          data: { ...scalars, publishedAt, ...relations },
        })
      : await tx.product.create({
          data: {
            ...scalars,
            publishedAt,
            additionalCategories: { connect: relations.additionalCategories.set },
          },
        });

    // Coleções manuais.
    await tx.collectionProduct.deleteMany({
      where: { productId: product.id, collectionId: { notIn: data.collectionIds } },
    });
    for (const collectionId of data.collectionIds) {
      await tx.collectionProduct.upsert({
        where: { collectionId_productId: { collectionId, productId: product.id } },
        update: {},
        create: { collectionId, productId: product.id, position: 999 },
      });
    }

    // Variações: atualiza as existentes, cria as novas e remove (ou desativa, se já vendidas) as retiradas.
    const keptIds = new Set(data.variants.map((variant) => variant.id).filter(Boolean));
    for (const old of existing?.variants ?? []) {
      if (keptIds.has(old.id)) continue;
      if (old._count.orderItems > 0 || old.stockReserved > 0)
        await tx.productVariant.update({ where: { id: old.id }, data: { isActive: false } });
      else await tx.productVariant.delete({ where: { id: old.id } });
    }
    const variantIdBySku = new Map<string, string>();
    for (const [position, variant] of data.variants.entries()) {
      const fields = {
        name: variant.name,
        sku: variant.sku,
        options: variant.options,
        priceCents: variant.priceCents,
        compareAtPriceCents: variant.compareAtPriceCents,
        costCents: variant.costCents,
        promoPriceCents: variant.promoPriceCents,
        promoStartsAt: variant.promoStartsAt,
        promoEndsAt: variant.promoEndsAt,
        weightGrams: variant.weightGrams,
        lowStockThreshold: variant.lowStockThreshold,
        barcode: variant.barcode,
        isActive: variant.isActive,
        position,
      };
      const old = existing?.variants.find((item) => item.id === variant.id);
      if (old) {
        await tx.productVariant.update({ where: { id: old.id }, data: fields });
        if (old.stockOnHand !== variant.stockOnHand) {
          await adjustStock(tx, {
            kind: "ADJUSTMENT",
            variantId: old.id,
            newCount: variant.stockOnHand,
            reason: "Ajuste pelo cadastro do produto",
            userId: context.user.id,
          });
        }
        variantIdBySku.set(variant.sku, old.id);
      } else {
        const created = await tx.productVariant.create({
          data: { ...fields, productId: product.id },
        });
        if (variant.stockOnHand > 0) {
          await adjustStock(tx, {
            kind: "IN",
            variantId: created.id,
            quantity: variant.stockOnHand,
            reason: "Estoque inicial",
            userId: context.user.id,
          });
        }
        variantIdBySku.set(variant.sku, created.id);
      }
    }

    await replaceProductImages(tx, product.id, data.images, variantIdBySku);

    if (existing && existing.slug !== data.slug && existing.publishedAt) {
      await redirectOldPath(
        tx,
        `/produto/${existing.slug}`,
        `/produto/${data.slug}`,
        "Endereço do produto alterado no painel",
      );
    }

    const { qualityScore } = await refreshProductDerived(tx, product.id);
    const becamePublic = data.status === "ACTIVE" && existing?.status !== "ACTIVE";
    if (becamePublic && qualityScore < QUALITY_PUBLISH_MINIMUM && !data.confirmLowQuality)
      throw new LowQualityError(qualityScore);

    const before = existing ? (existing as unknown as Record<string, unknown>) : {};
    await context.audit({
      action: existing ? "product.update" : "product.create",
      entityType: "Product",
      entityId: product.id,
      diff: existing
        ? (diffFields(before, scalars as Record<string, unknown>) as Prisma.InputJsonValue)
        : { nome: data.name, sku: data.sku },
    });
    return { id: product.id, slug: product.slug, qualityScore };
  });

  invalidateProducts([result.slug, ...(existing ? [existing.slug] : [])]);
  return result;
}

/** Substitui as imagens do produto na ordem recebida e grava o texto alternativo na biblioteca. */
export async function replaceProductImages(
  tx: Tx,
  productId: string,
  images: ProductInput["images"],
  variantIdBySku: Map<string, string>,
): Promise<void> {
  await tx.productImage.deleteMany({ where: { productId } });
  const coverIndex = Math.max(
    0,
    images.findIndex((image) => image.isCover),
  );
  for (const [position, image] of images.entries()) {
    await tx.mediaAsset.update({ where: { id: image.mediaId }, data: { alt: image.alt } });
    await tx.productImage.create({
      data: {
        productId,
        mediaId: image.mediaId,
        position,
        isCover: position === coverIndex,
        variantId: image.variantSku
          ? (variantIdBySku.get(image.variantSku.toUpperCase()) ?? null)
          : null,
      },
    });
  }
}

/** Endereço livre a partir de um nome: "nome", "nome-2", "nome-3"... */
export async function uniqueProductSlug(base: string, tx: Tx | typeof db = db): Promise<string> {
  const root = slugify(base).slice(0, 100) || "produto";
  for (let attempt = 1; attempt < 500; attempt++) {
    const slug = attempt === 1 ? root : `${root}-${attempt}`;
    if (!(await tx.product.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  return `${root}-${Date.now()}`;
}

export async function uniqueSku(base: string, tx: Tx | typeof db = db): Promise<string> {
  const root = base.toUpperCase().slice(0, 50);
  for (let attempt = 1; attempt < 500; attempt++) {
    const sku = attempt === 1 ? root : `${root}-${attempt}`;
    const [product, variant] = await Promise.all([
      tx.product.findUnique({ where: { sku }, select: { id: true } }),
      tx.productVariant.findUnique({ where: { sku }, select: { id: true } }),
    ]);
    if (!product && !variant) return sku;
  }
  return `${root}-${Date.now()}`;
}

/** Duplica o produto como rascunho, com "(cópia)" no nome e estoque zerado. */
export async function duplicateProduct(id: string, context: AdminContext): Promise<{ id: string }> {
  const source = await db.product.findUnique({
    where: { id },
    include: {
      variants: { orderBy: { position: "asc" } },
      images: { orderBy: { position: "asc" } },
      additionalCategories: { select: { id: true } },
    },
  });
  if (!source) throw new AdminError("Produto não encontrado.");
  const copy = await db.$transaction(async (tx) => {
    const { variants, images, additionalCategories, ...rest } = source;
    const fields = { ...rest, id: undefined, createdAt: undefined, updatedAt: undefined };
    const sku = await uniqueSku(`${source.sku}-COPIA`, tx);
    const product = await tx.product.create({
      data: {
        ...fields,
        name: `${source.name} (cópia)`,
        slug: await uniqueProductSlug(`${source.slug}-copia`, tx),
        sku,
        status: "DRAFT",
        publishedAt: null,
        isSample: false,
        ratingAverage: 0,
        ratingCount: 0,
        salesCount30d: 0,
        additionalCategories: { connect: additionalCategories },
      },
    });
    const variantMap = new Map<string, string>();
    for (const [index, variant] of variants.entries()) {
      const created = await tx.productVariant.create({
        data: {
          productId: product.id,
          name: variant.name,
          sku: await uniqueSku(`${sku}-${String(index + 1).padStart(2, "0")}`, tx),
          options: variant.options as Prisma.InputJsonValue,
          priceCents: variant.priceCents,
          compareAtPriceCents: variant.compareAtPriceCents,
          costCents: variant.costCents,
          weightGrams: variant.weightGrams,
          lowStockThreshold: variant.lowStockThreshold,
          isActive: variant.isActive,
          position: variant.position,
        },
      });
      variantMap.set(variant.id, created.id);
    }
    await tx.productImage.createMany({
      data: images.map((image) => ({
        productId: product.id,
        mediaId: image.mediaId,
        position: image.position,
        isCover: image.isCover,
        variantId: image.variantId ? (variantMap.get(image.variantId) ?? null) : null,
      })),
    });
    await refreshProductDerived(tx, product.id);
    await context.audit({
      action: "product.duplicate",
      entityType: "Product",
      entityId: product.id,
      diff: { origem: source.name },
    });
    return product;
  });
  return { id: copy.id };
}

// ───────────────────────── Remover dados de teste ─────────────────────────

export type SampleRemovalReport = Record<string, number>;

/**
 * "Remover todos os produtos de teste": apaga, em uma transação, tudo o que está marcado com
 * isSample (produtos, variações, imagens, avaliações, pedidos, clientes, leads, carrinhos,
 * depoimentos, solicitações e contatos). Dados reais não são tocados.
 */
export async function removeSampleData(context: AdminContext): Promise<SampleRemovalReport> {
  const report = await db.$transaction(
    async (tx) => {
      const sampleOrders = { where: { isSample: true } };
      const counts: SampleRemovalReport = {};
      counts["Avaliações"] = (
        await tx.review.deleteMany({
          where: { OR: [{ isSample: true }, { product: { isSample: true } }] },
        })
      ).count;
      counts["Depoimentos"] = (
        await tx.testimonial.deleteMany({ where: { isSample: true } })
      ).count;
      await tx.couponRedemption.deleteMany({ where: { order: { isSample: true } } });
      await tx.inventoryMovement.deleteMany({
        where: {
          OR: [{ order: { isSample: true } }, { variant: { product: { isSample: true } } }],
        },
      });
      counts["Pedidos"] = (await tx.order.deleteMany(sampleOrders)).count;
      counts["Carrinhos"] = (
        await tx.cart.deleteMany({
          where: { OR: [{ isSample: true }, { user: { isSample: true } }] },
        })
      ).count;
      counts["Leads"] = (
        await tx.lead.deleteMany({
          where: { OR: [{ isSample: true }, { product: { isSample: true } }] },
        })
      ).count;
      counts["Solicitações de produto"] = (
        await tx.productRequest.deleteMany({ where: { isSample: true } })
      ).count;
      counts["Mensagens de contato"] = (
        await tx.contactMessage.deleteMany({ where: { isSample: true } })
      ).count;
      await tx.cartItem.deleteMany({ where: { variant: { product: { isSample: true } } } });
      counts["Variações"] = await tx.productVariant.count({
        where: { product: { isSample: true } },
      });
      counts["Produtos"] = (await tx.product.deleteMany({ where: { isSample: true } })).count;
      // Imagens de teste que ainda ilustram categorias, coleções, banners ou ocasiões ficam até serem trocadas.
      counts["Imagens"] = (
        await tx.mediaAsset.deleteMany({
          where: {
            isSample: true,
            productImages: { none: {} },
            categories: { none: {} },
            collections: { none: {} },
            occasions: { none: {} },
            bannersDesktop: { none: {} },
            bannersMobile: { none: {} },
            productRequests: { none: {} },
          },
        })
      ).count;
      // Clientes de teste: só quem não é da equipe e não tem pedido real.
      counts["Clientes"] = (
        await tx.user.deleteMany({
          where: { isSample: true, role: "CUSTOMER", orders: { none: {} } },
        })
      ).count;
      await context.audit({ action: "samples.remove", entityType: "Product", diff: counts });
      return counts;
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
  invalidate("catalog", "home", "categories");
  return report;
}
