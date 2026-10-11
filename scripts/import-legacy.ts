/**
 * Carga inicial do catálogo do site antigo, direto no banco, para a curadoria.
 * Os produtos entram como rascunho, fora da loja, à espera da decisão do dono em /admin/curadoria.
 *
 * Uso: pnpm import:legacy data-privada/produtos.xml [--base=https://site-antigo/imagens/] [--previa]
 * Aceita o XML de produtos da FastCommerce (xml-products.ehc, formato padrão) ou um CSV.
 *   --base    completa os endereços de foto que vierem sem o domínio
 *   --previa  só valida o arquivo e mostra o que seria importado
 *   --faltantes  ignora os produtos que já estão no banco (para retomar uma carga interrompida)
 *   --parte=2/4  importa só uma fatia do arquivo, para rodar várias cargas ao mesmo tempo
 *   --redirecionamentos  não importa nada: cria os redirecionamentos do endereço antigo dos produtos
 *                        que estão na loja (rodar depois da curadoria; com --previa só mostra)
 *
 * O banco é o de DATABASE_URL. O arquivo fica em data-privada/, que nunca vai para o repositório.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { normalizeText } from "@/lib/slug";
import type { AdminContext } from "@/server/admin/action";
import {
  LEGACY_CATEGORY_ALIASES,
  legacyProductRedirects,
  parseLegacyFeed,
} from "@/server/admin/legacy-feed";
import { decodeCsvBuffer, parseCsv } from "@/server/admin/list";
import { detectFormat, parseImport, runImport } from "@/server/admin/product-import";

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--"));
const imageBaseUrl = args.find((arg) => arg.startsWith("--base="))?.slice(7) ?? "";
const preview = args.includes("--previa");
const onlyMissing = args.includes("--faltantes");
const redirectsOnly = args.includes("--redirecionamentos");
const part = /^--parte=(\d+)\/(\d+)$/.exec(args.find((arg) => arg.startsWith("--parte=")) ?? "");

const REDIRECT_NOTE = "Produto do site antigo";

/** Endereço antigo → página nova, para os produtos que a curadoria deixou na loja. */
async function syncProductRedirects(oldPaths: Record<string, string>) {
  const products = await db.product.findMany({
    where: { sku: { in: Object.keys(oldPaths) }, status: "ACTIVE", deletedAt: null },
    select: { sku: true, slug: true },
  });
  const wanted = legacyProductRedirects(oldPaths, products);
  const existing = new Map(
    (
      await db.redirect.findMany({
        where: { fromPath: { in: wanted.map((item) => item.fromPath) } },
        select: { fromPath: true, toPath: true, note: true },
      })
    ).map((item) => [item.fromPath, item]),
  );
  const toCreate = wanted.filter((item) => !existing.has(item.fromPath));
  // Só corrige o destino do que este script criou; o que foi cadastrado no painel fica como está.
  const toUpdate = wanted.filter((item) => {
    const current = existing.get(item.fromPath);
    return current && current.note === REDIRECT_NOTE && current.toPath !== item.toPath;
  });
  console.log(
    `Produtos na loja com endereço antigo: ${products.length}. A criar: ${toCreate.length}. A corrigir: ${toUpdate.length}. Já certos: ${wanted.length - toCreate.length - toUpdate.length}.`,
  );
  if (preview) {
    for (const item of toCreate.slice(0, 10)) console.log(`  ${item.fromPath} → ${item.toPath}`);
    return;
  }
  await db.redirect.createMany({
    data: toCreate.map((item) => ({ ...item, note: REDIRECT_NOTE })),
    skipDuplicates: true,
  });
  for (const item of toUpdate)
    await db.redirect.update({ where: { fromPath: item.fromPath }, data: { toPath: item.toPath } });
  const admin = await db.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });
  await logAudit({
    userId: admin?.id,
    action: "redirect.import",
    entityType: "Redirect",
    diff: { criados: toCreate.length, corrigidos: toUpdate.length },
    userAgent: "scripts/import-legacy",
  });
  console.log("Redirecionamentos gravados.");
}

async function main() {
  if (!file) {
    console.error("Uso: pnpm import:legacy <arquivo.csv> [--base=URL] [--previa]");
    process.exit(1);
  }
  const buffer = readFileSync(file);
  const isXml = file.toLowerCase().endsWith(".xml");
  const feed = isXml ? parseLegacyFeed(new TextDecoder("windows-1252").decode(buffer)) : null;
  const [headers, ...rows] = feed
    ? [feed.headers, ...feed.rows]
    : parseCsv(
        decodeCsvBuffer(
          buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
        ),
      );
  if (redirectsOnly) {
    if (!feed) throw new Error("Os redirecionamentos dependem do XML do site antigo.");
    await syncProductRedirects(feed.oldPaths);
    return;
  }
  const { format, mapping } = detectFormat(headers ?? []);
  if (mapping.sku !== undefined && (onlyMissing || part)) {
    const column = mapping.sku;
    const existing = onlyMissing
      ? new Set((await db.product.findMany({ select: { sku: true } })).map((item) => item.sku))
      : new Set<string>();
    const [index, total] = part ? [Number(part[1]) - 1, Number(part[2])] : [0, 1];
    const kept = rows.filter(
      (row, position) =>
        position % total === index && !existing.has((row[column] ?? "").trim().toUpperCase()),
    );
    rows.length = 0;
    rows.push(...kept);
  }
  if (mapping.sku === undefined || mapping.name === undefined || mapping.price === undefined) {
    console.error(`Não reconheci as colunas de código, nome e preço. Cabeçalho: ${headers}`);
    process.exit(1);
  }
  console.log(`Formato: ${format}. Linhas: ${rows.length}.`);
  console.log(`Colunas reconhecidas: ${Object.keys(mapping).join(", ")}`);

  // Categoria do arquivo → categoria da loja, pelo caminho inteiro ("Vasos > Plástico"). Só o último
  // nível não serve: "Cerâmica" existe em Vasos e em Cachepots.
  const categories = await db.category.findMany({
    select: { id: true, name: true, parent: { select: { name: true } } },
  });
  const byPath = new Map(
    categories.map((category) => [
      normalizeText(category.parent ? `${category.parent.name} > ${category.name}` : category.name),
      category.id,
    ]),
  );
  // No XML os níveis vêm separados por vírgula; em CSV, por ">", "/" ou "|".
  const key = (text: string) =>
    normalizeText(
      text
        .split(isXml ? "," : /[>|]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" > "),
    );
  const categoryMap: Record<string, string> = {};
  const unmatched = new Map<string, number>();
  if (mapping.category !== undefined)
    for (const row of rows) {
      const name = (row[mapping.category] ?? "").trim();
      if (!name) continue;
      if (!(name in categoryMap))
        categoryMap[name] = byPath.get(LEGACY_CATEGORY_ALIASES[key(name)] ?? key(name)) ?? "";
      if (!categoryMap[name]) unmatched.set(name, (unmatched.get(name) ?? 0) + 1);
    }

  const input = {
    rows,
    mapping: mapping as Record<string, number>,
    categoryMap,
    publish: false,
    forCuration: true,
    imageBaseUrl,
    weightInKg: format === "fastcommerce",
  };
  if (feed)
    console.log(
      `Só entrega em São Paulo: ${feed.localOnlySkus.length}. Com endereço antigo: ${Object.keys(feed.oldPaths).length}.`,
    );

  const { products, lines } = await parseImport(input);
  const invalid = lines.filter((line) => line.errors.length);
  console.log(`Produtos: ${products.length}. Linhas com erro: ${invalid.length}.`);
  console.log(`Com foto: ${products.filter((product) => product.imageUrls.length).length}.`);
  if (unmatched.size) {
    console.log("Categorias do arquivo sem correspondência (entram sem categoria):");
    for (const [name, count] of [...unmatched].sort((a, b) => b[1] - a[1]))
      console.log(`  ${count}\t${name}`);
  }
  for (const line of invalid.slice(0, 30))
    console.log(`  linha ${line.line} (${line.sku || "sem código"}): ${line.errors.join(" ")}`);
  if (preview) return;

  const admin = await db.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) throw new Error("Não há usuário administrador no banco.");
  const context = {
    user: admin,
    ipHash: "",
    userAgent: "scripts/import-legacy",
    audit: (entry) => logAudit({ ...entry, userId: admin.id, userAgent: "scripts/import-legacy" }),
  } as AdminContext;
  const report = await runImport(input, context, 20);
  console.log(
    `Criados: ${report.created}. Atualizados: ${report.updated}. Variações: ${report.variants}. Ignorados: ${report.skipped}.`,
  );
  for (const line of report.errors.slice(invalid.length, invalid.length + 30))
    console.log(`  ${line.name}: ${line.errors.join(" ")}`);

  if (feed) {
    // O que o site antigo só entregava na cidade de São Paulo continua assim na loja nova.
    const local = await db.product.updateMany({
      where: { sku: { in: feed.localOnlySkus }, curation: "PENDING" },
      data: { deliveryScope: "LOCAL_ONLY" },
    });
    console.log(`Marcados como entrega só local: ${local.count}.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
