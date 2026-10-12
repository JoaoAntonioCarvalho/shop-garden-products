/**
 * Revisão em lote dos nomes e descrições vindos do site antigo (caixa alta, acentos, unidades,
 * prazo de envio), com volta ao texto original. O texto de antes de cada produto fica em
 * scripts/data/textos-originais.json.
 *
 * Uso: pnpm texts <comando>
 *   aplicar <arquivo.json>   grava os textos novos: [{ id, sku, before, after }]
 *   originais [sku ...]      volta ao texto original (todos os produtos, ou só os SKUs dados)
 *
 * O endereço (slug) do produto não muda. Depois de rodar em produção, chamar
 * /api/cron/atualizar-cache para a loja mostrar a mudança.
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { sanitizeRichText } from "@/lib/sanitize";
import { refreshProductDerived } from "@/server/admin/products";

type Texts = { name?: string; description?: string; shortDescription?: string };
type Change = { id: string; sku: string; before: Texts; after: Texts };

const RECORD_FILE = path.join(process.cwd(), "scripts", "data", "textos-originais.json");
const [command, ...rest] = process.argv.slice(2);

const readRecords = (): Record<string, { sku: string; before: Texts }> =>
  existsSync(RECORD_FILE) ? JSON.parse(readFileSync(RECORD_FILE, "utf8")) : {};

async function adminId() {
  const admin = await db.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return admin?.id ?? null;
}

async function write(id: string, data: Texts) {
  await db.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        ...data,
        ...(data.description ? { description: sanitizeRichText(data.description) } : {}),
      },
    });
    await refreshProductDerived(tx, id);
  });
}

async function inBatches<T>(items: T[], size: number, run: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(run));
    console.log(`${Math.min(index + size, items.length)}/${items.length}`);
  }
}

async function apply(file: string) {
  const changes = JSON.parse(readFileSync(file, "utf8")) as Change[];
  const records = readRecords();
  // O original guardado é sempre o primeiro: rodar de novo não o substitui pelo texto já revisado.
  for (const change of changes)
    records[change.id] = {
      sku: change.sku,
      before: { ...change.before, ...records[change.id]?.before },
    };
  writeFileSync(RECORD_FILE, `${JSON.stringify(records)}\n`);
  await inBatches(changes, 6, (change) => write(change.id, change.after));
  await logAudit({
    userId: await adminId(),
    action: "product.bulk_text_review",
    entityType: "Product",
    diff: {
      produtos: changes.length,
      nomes: changes.filter((change) => change.after.name).length,
      registro: "scripts/data/textos-originais.json",
    },
  });
}

async function restore(skus: string[]) {
  const records = Object.entries(readRecords()).filter(
    ([, record]) => skus.length === 0 || skus.includes(record.sku),
  );
  await inBatches(records, 6, ([id, record]) => write(id, record.before));
  await logAudit({
    userId: await adminId(),
    action: "product.bulk_text_restore",
    entityType: "Product",
    diff: { produtos: records.length },
  });
}

async function main() {
  if (command === "aplicar" && rest[0]) await apply(rest[0]);
  else if (command === "originais") await restore(rest);
  else {
    console.error("Uso: pnpm texts aplicar <arquivo.json> | pnpm texts originais [sku ...]");
    process.exitCode = 1;
  }
  await db.$disconnect();
}

void main();
