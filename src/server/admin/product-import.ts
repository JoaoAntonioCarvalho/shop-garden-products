import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseBRLToCents } from "@/lib/money";
import { sanitizeRichText } from "@/lib/sanitize";
import { normalizeText } from "@/lib/slug";
import { adjustStock } from "@/server/services/inventory";
import type { AdminContext } from "./action";
import {
  invalidateProducts,
  productTypeLabels,
  refreshProductDerived,
  uniqueProductSlug,
} from "./products";

/** Campos de destino da importação, com o nome da coluna no formato próprio (o do modelo CSV). */
export const IMPORT_FIELDS = [
  { key: "sku", column: "sku_produto", label: "Código do produto (SKU)", required: true },
  { key: "name", column: "nome", label: "Nome", required: true },
  { key: "category", column: "categoria", label: "Categoria", required: false },
  { key: "type", column: "tipo", label: "Tipo", required: false },
  { key: "status", column: "status", label: "Status ou disponível", required: false },
  { key: "brand", column: "marca", label: "Marca", required: false },
  { key: "tags", column: "tags", label: "Tags", required: false },
  { key: "short", column: "descricao_curta", label: "Descrição curta", required: false },
  { key: "description", column: "descricao", label: "Descrição", required: false },
  { key: "parentSku", column: "sku_pai", label: "SKU do produto pai (variações)", required: false },
  { key: "variantSku", column: "sku_variante", label: "SKU da variação", required: false },
  { key: "variantName", column: "variante", label: "Nome da variação", required: false },
  { key: "price", column: "preco", label: "Preço", required: true },
  { key: "compareAt", column: "preco_de", label: "Preço de", required: false },
  { key: "promoPrice", column: "preco_promocional", label: "Preço promocional", required: false },
  { key: "promoStart", column: "promo_inicio", label: "Início da promoção", required: false },
  { key: "promoEnd", column: "promo_fim", label: "Fim da promoção", required: false },
  { key: "stock", column: "estoque", label: "Estoque", required: false },
  { key: "weight", column: "peso_gramas", label: "Peso", required: false },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];
export type ImportMapping = Partial<Record<ImportFieldKey, number>>;

/** Colunas do export do FastCommerce (site antigo) e o campo a que cada uma corresponde. */
const FASTCOMMERCE: Record<string, ImportFieldKey> = {
  nomecat: "category",
  codprod: "sku",
  nomeprod: "name",
  peso: "weight",
  descricao: "short",
  descrlonga: "description",
  preco: "price",
  precoprom: "promoPrice",
  dataprominicio: "promoStart",
  datapromfim: "promoEnd",
  estoque: "stock",
  disponivel: "status",
  idprodutopai: "parentSku",
};

const clean = (header: string) => header.trim().toLowerCase();

export function detectFormat(headers: string[]): {
  format: "fastcommerce" | "proprio" | "desconhecido";
  mapping: ImportMapping;
} {
  const names = headers.map(clean);
  const mapping: ImportMapping = {};
  if (names.includes("codprod") && names.includes("nomeprod")) {
    names.forEach((name, index) => {
      const key = FASTCOMMERCE[name];
      if (key && mapping[key] === undefined) mapping[key] = index;
    });
    return { format: "fastcommerce", mapping };
  }
  for (const field of IMPORT_FIELDS) {
    const index = names.indexOf(field.column);
    if (index >= 0) mapping[field.key] = index;
  }
  return {
    format: mapping.sku !== undefined && mapping.name !== undefined ? "proprio" : "desconhecido",
    mapping,
  };
}

export const importSchema = z.object({
  rows: z
    .array(z.array(z.string().max(30_000)).max(80))
    .min(1, "O arquivo não tem linhas de produto.")
    .max(5000, "Importe até 5.000 linhas por vez."),
  mapping: z.record(z.string(), z.number().int().min(0).max(79)),
  /** Categoria do arquivo → id da categoria da loja ("" = sem categoria). */
  categoryMap: z.record(z.string().max(200), z.string().max(40)),
  publish: z.boolean().default(false),
  /** No FastCommerce o peso vem em quilos. */
  weightInKg: z.boolean().default(false),
});
export type ImportInput = z.output<typeof importSchema>;

type ParsedVariant = {
  sku: string;
  name: string;
  priceCents: number;
  compareAtCents: number | null;
  promoCents: number | null;
  promoStart: Date | null;
  promoEnd: Date | null;
  stock: number;
  weightGrams: number;
};
type ParsedProduct = {
  line: number;
  sku: string;
  name: string;
  categoryId: string | null;
  type: string;
  active: boolean | null;
  brand: string | null;
  tags: string[];
  short: string | null;
  description: string | null;
  variants: ParsedVariant[];
};
export type ImportLineResult = { line: number; sku: string; name: string; errors: string[] };

function parseDate(value: string): Date | null | "invalid" {
  if (!value) return null;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const key = br
    ? `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`
    : iso
      ? `${iso[1]}-${iso[2]}-${iso[3]}`
      : null;
  if (!key) return "invalid";
  const date = new Date(`${key}T00:00:00-03:00`);
  return Number.isNaN(date.getTime()) ? "invalid" : date;
}

const typeByLabel = new Map(
  Object.entries(productTypeLabels).flatMap(([value, label]) => [
    [value.toLowerCase(), value],
    [label.toLowerCase(), value],
  ]),
);

/** Tipo do produto a partir do caminho da categoria, quando o arquivo não informa. */
export function inferProductType(categoryPath: string): string {
  // Sem acentos: o arquivo traz "Orquídeas", o caminho da loja traz "orquideas".
  const path = normalizeText(categoryPath);
  if (path.includes("orquidea")) return "ORCHID";
  if (path.includes("artificia") || path.includes("buque")) return "ARTIFICIAL";
  if (path.includes("arranjo")) return "ARRANGEMENT";
  if (path.includes("cachepot")) return "CACHEPOT";
  if (path.includes("vaso")) return "POT";
  if (path.includes("aroma")) return "AROMA";
  if (path.includes("ferramenta")) return "GARDEN_TOOL";
  if (path.includes("jardinagem")) return "GARDEN_SUPPLY";
  if (
    path.includes("planta") ||
    path.includes("flores") ||
    path.includes("cacto") ||
    path.includes("erva")
  )
    return "NATURAL_PLANT";
  return "DECOR";
}

/** Lê as linhas com o mapeamento escolhido, agrupa variações no produto pai e valida linha a linha. */
export async function parseImport(
  input: ImportInput,
): Promise<{ products: ParsedProduct[]; lines: ImportLineResult[] }> {
  const categories = await db.category.findMany({ select: { id: true, path: true } });
  const pathById = new Map(categories.map((category) => [category.id, category.path]));
  const cell = (row: string[], key: ImportFieldKey) => {
    const index = input.mapping[key];
    return index === undefined ? "" : (row[index] ?? "").trim();
  };
  const products = new Map<string, ParsedProduct>();
  const lines: ImportLineResult[] = [];
  const seenVariantSkus = new Set<string>();

  input.rows.forEach((row, index) => {
    const line = index + 2; // a linha 1 é o cabeçalho
    const errors: string[] = [];
    const ownSku = cell(row, "sku").toUpperCase();
    const parentSku = cell(row, "parentSku").toUpperCase();
    const productSku = parentSku && parentSku !== "0" ? parentSku : ownSku;
    const name = cell(row, "name");
    if (!ownSku) errors.push("Sem código (SKU).");
    if (!name) errors.push("Sem nome.");

    const priceCents = parseBRLToCents(cell(row, "price"));
    if (priceCents === null || priceCents <= 0) errors.push("Preço inválido.");
    const optionalMoney = (key: ImportFieldKey, label: string) => {
      const text = cell(row, key);
      if (!text || text === "0" || text === "0,00") return null;
      const cents = parseBRLToCents(text);
      if (cents === null || cents < 0) errors.push(`${label} inválido.`);
      return cents;
    };
    const promoCents = optionalMoney("promoPrice", "Preço promocional");
    const compareAtCents = optionalMoney("compareAt", "Preço de");
    if (promoCents !== null && priceCents !== null && promoCents >= priceCents)
      errors.push("Preço promocional maior ou igual ao preço.");
    const promoStart = parseDate(cell(row, "promoStart"));
    const promoEnd = parseDate(cell(row, "promoEnd"));
    if (promoStart === "invalid" || promoEnd === "invalid")
      errors.push("Data de promoção inválida (use DD/MM/AAAA).");
    const stockText = cell(row, "stock");
    const stock = stockText ? Number(stockText.replace(",", ".")) : 0;
    if (!Number.isInteger(stock) || stock < 0) errors.push("Estoque inválido.");
    const weightText = cell(row, "weight");
    const weightNumber = weightText ? Number(weightText.replace(",", ".")) : 0;
    if (!Number.isFinite(weightNumber) || weightNumber < 0) errors.push("Peso inválido.");

    const categoryName = cell(row, "category");
    const categoryId = input.categoryMap[categoryName] || null;
    const typeText = cell(row, "type").toLowerCase();
    const type =
      typeByLabel.get(typeText) ??
      inferProductType(categoryId ? (pathById.get(categoryId) ?? "") : categoryName);
    const statusText = cell(row, "status").toLowerCase();
    const active = !statusText
      ? null
      : ["1", "s", "sim", "true", "ativo", "publicado", "active"].includes(statusText)
        ? true
        : ["0", "n", "nao", "não", "false", "inativo", "rascunho", "draft"].includes(statusText)
          ? false
          : null;

    const variantSku = (cell(row, "variantSku") || ownSku).toUpperCase();
    if (variantSku && seenVariantSkus.has(variantSku))
      errors.push(`SKU ${variantSku} repetido no arquivo.`);
    seenVariantSkus.add(variantSku);

    lines.push({ line, sku: ownSku, name, errors });
    if (errors.length > 0 || !productSku) return;

    const variant: ParsedVariant = {
      sku: variantSku,
      name: cell(row, "variantName") || (parentSku && parentSku !== "0" ? name : "Padrão"),
      priceCents: priceCents as number,
      compareAtCents,
      promoCents,
      promoStart: promoStart as Date | null,
      promoEnd: promoEnd as Date | null,
      stock,
      weightGrams: Math.round(input.weightInKg ? weightNumber * 1000 : weightNumber),
    };
    const isChild = Boolean(parentSku && parentSku !== "0" && parentSku !== ownSku);
    const existing = products.get(productSku);
    if (existing) {
      // Produto com variações: a linha do pai deixa de ser uma variação vendável.
      if (isChild && existing.variants.length === 1 && existing.variants[0].sku === existing.sku)
        existing.variants = [];
      existing.variants.push(variant);
    } else {
      products.set(productSku, {
        line,
        sku: productSku,
        name,
        categoryId,
        type,
        active,
        brand: cell(row, "brand") || null,
        tags: cell(row, "tags")
          .split(",")
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
        short: cell(row, "short").slice(0, 160) || null,
        description: cell(row, "description") || null,
        variants: [variant],
      });
    }
  });
  return { products: [...products.values()], lines };
}

export type ImportReport = {
  created: number;
  updated: number;
  variants: number;
  skipped: number;
  errors: ImportLineResult[];
};

/** Importa em lotes de 50 produtos. Cada lote é uma transação; um lote com erro não derruba os demais. */
export async function runImport(input: ImportInput, context: AdminContext): Promise<ImportReport> {
  const { products, lines } = await parseImport(input);
  const report: ImportReport = {
    created: 0,
    updated: 0,
    variants: 0,
    skipped: lines.filter((line) => line.errors.length).length,
    errors: lines.filter((line) => line.errors.length).slice(0, 200),
  };
  const slugs: string[] = [];

  for (let start = 0; start < products.length; start += 50) {
    const batch = products.slice(start, start + 50);
    try {
      await db.$transaction(
        async (tx) => {
          for (const item of batch) {
            const description = item.description
              ? sanitizeRichText(
                  /<\w+/.test(item.description)
                    ? item.description
                    : `<p>${item.description.replace(/\r?\n+/g, "</p><p>")}</p>`,
                )
              : null;
            const status = input.publish && item.active !== false ? "ACTIVE" : "DRAFT";
            const existing = await tx.product.findUnique({
              where: { sku: item.sku },
              include: { variants: true },
            });
            const product = existing
              ? await tx.product.update({
                  where: { id: existing.id },
                  data: {
                    name: item.name,
                    ...(item.categoryId ? { primaryCategoryId: item.categoryId } : {}),
                    ...(item.brand ? { brand: item.brand } : {}),
                    ...(item.tags.length ? { tags: item.tags } : {}),
                    ...(item.short ? { shortDescription: item.short } : {}),
                    ...(description ? { description } : {}),
                  },
                })
              : await tx.product.create({
                  data: {
                    name: item.name,
                    slug: await uniqueProductSlug(item.name, tx),
                    sku: item.sku,
                    productType: item.type as never,
                    status,
                    publishedAt: status === "ACTIVE" ? new Date() : null,
                    primaryCategoryId: item.categoryId,
                    brand: item.brand,
                    tags: item.tags,
                    shortDescription: item.short,
                    description,
                  },
                });
            for (const [position, variant] of item.variants.entries()) {
              const fields = {
                name: variant.name,
                priceCents: variant.priceCents,
                compareAtPriceCents: variant.compareAtCents,
                promoPriceCents: variant.promoCents,
                promoStartsAt: variant.promoStart,
                promoEndsAt: variant.promoEnd,
                weightGrams: variant.weightGrams,
                position,
              };
              const old = await tx.productVariant.findUnique({ where: { sku: variant.sku } });
              if (old && old.productId !== product.id)
                throw new Error(`O SKU ${variant.sku} já pertence a outro produto.`);
              if (old) {
                await tx.productVariant.update({ where: { id: old.id }, data: fields });
                if (old.stockOnHand !== variant.stock && variant.stock >= old.stockReserved)
                  await adjustStock(tx, {
                    kind: "ADJUSTMENT",
                    variantId: old.id,
                    newCount: variant.stock,
                    reason: "Importação de produtos",
                    userId: context.user.id,
                  });
              } else {
                const created = await tx.productVariant.create({
                  data: { ...fields, productId: product.id, sku: variant.sku },
                });
                if (variant.stock > 0)
                  await adjustStock(tx, {
                    kind: "IN",
                    variantId: created.id,
                    quantity: variant.stock,
                    reason: "Importação de produtos",
                    userId: context.user.id,
                  });
              }
              report.variants++;
            }
            await refreshProductDerived(tx, product.id);
            slugs.push(product.slug);
            if (existing) report.updated++;
            else report.created++;
          }
        },
        { timeout: 120_000, maxWait: 10_000 },
      );
    } catch (error) {
      // O lote inteiro foi desfeito: nada dele entra na conta.
      report.errors.push({
        line: batch[0].line,
        sku: batch[0].sku,
        name: `Lote de ${batch.length} produtos a partir da linha ${batch[0].line}`,
        errors: [
          error instanceof Error
            ? (error.message.split("\n").pop() ?? "Erro ao gravar.")
            : "Erro ao gravar.",
        ],
      });
      report.skipped += batch.length;
    }
  }
  await context.audit({
    action: "product.import",
    entityType: "Product",
    diff: {
      criados: report.created,
      atualizados: report.updated,
      variacoes: report.variants,
      ignorados: report.skipped,
      publicado: input.publish,
    },
  });
  invalidateProducts(slugs.slice(0, 200));
  return report;
}

/** Modelo CSV do formato próprio, com uma linha de exemplo. */
export function importTemplate(): { headers: string[]; rows: string[][] } {
  return {
    headers: IMPORT_FIELDS.map((field) => field.column),
    rows: [
      [
        "VASO-001",
        "Vaso de cerâmica esmaltado",
        "Vasos > Cerâmica e barro",
        "Vaso",
        "rascunho",
        "",
        "sala, presente",
        "Vaso de cerâmica esmaltada para ambientes internos.",
        "Descrição completa do produto.",
        "",
        "VASO-001-P",
        "Pequeno",
        "89,90",
        "109,90",
        "",
        "",
        "",
        "12",
        "900",
      ],
      [
        "VASO-001",
        "Vaso de cerâmica esmaltado",
        "Vasos > Cerâmica e barro",
        "Vaso",
        "rascunho",
        "",
        "",
        "",
        "",
        "",
        "VASO-001-M",
        "Médio",
        "129,90",
        "",
        "",
        "",
        "",
        "8",
        "1500",
      ],
    ],
  };
}
