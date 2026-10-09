/**
 * Carga inicial do catálogo do site antigo, direto no banco, para a curadoria.
 * Os produtos entram como rascunho, fora da loja, à espera da decisão do dono em /admin/curadoria.
 *
 * Uso: pnpm import:legacy data-privada/produtos.csv [--base=https://site-antigo/imagens/] [--previa]
 *   --base    completa os endereços de foto que vierem sem o domínio
 *   --previa  só valida o arquivo e mostra o que seria importado
 *
 * O banco é o de DATABASE_URL. O arquivo fica em data-privada/, que nunca vai para o repositório.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { normalizeText } from "@/lib/slug";
import type { AdminContext } from "@/server/admin/action";
import { decodeCsvBuffer, parseCsv } from "@/server/admin/list";
import { detectFormat, parseImport, runImport } from "@/server/admin/product-import";

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--"));
const imageBaseUrl = args.find((arg) => arg.startsWith("--base="))?.slice(7) ?? "";
const preview = args.includes("--previa");

async function main() {
  if (!file) {
    console.error("Uso: pnpm import:legacy <arquivo.csv> [--base=URL] [--previa]");
    process.exit(1);
  }
  const buffer = readFileSync(file);
  const table = parseCsv(
    decodeCsvBuffer(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)),
  );
  const [headers, ...rows] = table;
  const { format, mapping } = detectFormat(headers ?? []);
  if (mapping.sku === undefined || mapping.name === undefined || mapping.price === undefined) {
    console.error(`Não reconheci as colunas de código, nome e preço. Cabeçalho: ${headers}`);
    process.exit(1);
  }
  console.log(`Formato: ${format}. Linhas: ${rows.length}.`);
  console.log(`Colunas reconhecidas: ${Object.keys(mapping).join(", ")}`);

  // Categoria do arquivo → categoria da loja, pelo nome (inteiro ou o último nível).
  const categories = await db.category.findMany({
    select: { id: true, name: true, parent: { select: { name: true } } },
  });
  const byName = new Map<string, string>();
  for (const category of categories) {
    byName.set(normalizeText(category.name), category.id);
    if (category.parent)
      byName.set(normalizeText(`${category.parent.name} ${category.name}`), category.id);
  }
  const key = (text: string) => normalizeText(text.replace(/[>/|\\-]+/g, " "));
  const categoryMap: Record<string, string> = {};
  const unmatched = new Map<string, number>();
  if (mapping.category !== undefined)
    for (const row of rows) {
      const name = (row[mapping.category] ?? "").trim();
      if (!name) continue;
      if (!(name in categoryMap))
        categoryMap[name] =
          byName.get(key(name)) ?? byName.get(key(name.split(/[>/|]/).pop() ?? "")) ?? "";
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
  const report = await runImport(input, context);
  console.log(
    `Criados: ${report.created}. Atualizados: ${report.updated}. Variações: ${report.variants}. Ignorados: ${report.skipped}.`,
  );
  for (const line of report.errors.slice(invalid.length, invalid.length + 30))
    console.log(`  ${line.name}: ${line.errors.join(" ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
