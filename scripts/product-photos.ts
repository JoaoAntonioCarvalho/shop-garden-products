/**
 * Fotos padronizadas do catálogo (fundo branco, 4:5, produto centralizado), com volta às originais.
 * A foto original nunca é apagada: a troca só muda para qual imagem o produto aponta, e o par
 * original/padronizada de cada produto fica registrado em scripts/data/fotos-padronizadas.json.
 *
 * Uso: pnpm photos <comando>
 *   aplicar <pasta>          envia <pasta>/<id da mídia original>.jpg e troca a foto do produto
 *   originais [sku ...]      volta para a foto original (todos os produtos, ou só os SKUs dados)
 *   padronizadas [sku ...]   refaz a troca com as fotos que já foram enviadas
 *
 * O banco é o de DATABASE_URL e o armazenamento, o do ambiente. Depois de rodar em produção,
 * chamar /api/cron/atualizar-cache para a loja mostrar a mudança.
 */
import "dotenv/config";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { processAndStoreImage } from "@/server/services/media";

type PhotoRecord = {
  productId: string;
  sku: string;
  imageId: string;
  originalMediaId: string;
  standardMediaId: string;
};

const RECORD_FILE = path.join(process.cwd(), "scripts", "data", "fotos-padronizadas.json");
const [command, ...rest] = process.argv.slice(2);

const readRecords = (): PhotoRecord[] =>
  existsSync(RECORD_FILE) ? (JSON.parse(readFileSync(RECORD_FILE, "utf8")) as PhotoRecord[]) : [];
const writeRecords = (records: PhotoRecord[]) =>
  writeFileSync(RECORD_FILE, `${JSON.stringify(records, null, 1)}\n`);

async function adminId() {
  const admin = await db.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return admin?.id;
}

/** Envia as fotos da pasta e troca a imagem do produto. Pode ser interrompido e retomado. */
async function apply(folder: string) {
  const records = readRecords();
  const done = new Set(records.map((record) => record.originalMediaId));
  const files = readdirSync(folder).filter((file) => file.endsWith(".jpg"));
  const pending = files.map((file) => file.slice(0, -4)).filter((id) => !done.has(id));
  const images = await db.productImage.findMany({
    where: { mediaId: { in: pending } },
    select: {
      id: true,
      productId: true,
      media: { select: { id: true, alt: true } },
      product: {
        select: {
          name: true,
          variants: { select: { sku: true }, orderBy: { position: "asc" }, take: 1 },
        },
      },
    },
  });
  const uploadedById = await adminId();
  let count = 0;
  for (const image of images) {
    const sku = image.product.variants[0]?.sku ?? image.productId;
    const processed = await processAndStoreImage(
      readFileSync(path.join(folder, `${image.media.id}.jpg`)),
    );
    const media = await db.mediaAsset.create({
      data: {
        originalName: `${sku}-padronizada.jpg`.replace(/[\\/]/g, "-"),
        storageKey: processed.storageKey,
        mimeType: processed.mimeType,
        sizeBytes: processed.sizeBytes,
        width: processed.width,
        height: processed.height,
        blurDataUrl: processed.blurDataUrl,
        variants: processed.variants,
        alt: image.media.alt || image.product.name.slice(0, 200),
        uploadedById,
      },
    });
    await db.productImage.update({ where: { id: image.id }, data: { mediaId: media.id } });
    records.push({
      productId: image.productId,
      sku,
      imageId: image.id,
      originalMediaId: image.media.id,
      standardMediaId: media.id,
    });
    count++;
    if (count % 20 === 0) {
      writeRecords(records);
      console.log(`${count} de ${images.length}`);
    }
  }
  writeRecords(records);
  await logAudit({
    userId: uploadedById,
    action: "product.images",
    entityType: "Product",
    userAgent: "script: fotos padronizadas",
    diff: {
      produtos: count,
      motivo:
        "Fotos refeitas em fundo branco, 4:5. As originais continuam guardadas (pnpm photos originais)",
    },
  });
  console.log(`Fotos trocadas: ${count}. Sem produto correspondente: ${pending.length - count}.`);
}

/** Aponta os produtos para a foto original ou para a padronizada. */
async function switchTo(target: "originalMediaId" | "standardMediaId", skus: string[]) {
  const records = readRecords().filter((record) => skus.length === 0 || skus.includes(record.sku));
  let count = 0;
  for (const record of records) {
    const result = await db.productImage.updateMany({
      where: { id: record.imageId, mediaId: { not: record[target] } },
      data: { mediaId: record[target] },
    });
    count += result.count;
  }
  await logAudit({
    userId: await adminId(),
    action: "product.images",
    entityType: "Product",
    userAgent: "script: fotos padronizadas",
    diff: {
      produtos: count,
      motivo:
        target === "originalMediaId" ? "Volta às fotos originais" : "Volta às fotos padronizadas",
      ...(skus.length > 0 ? { skus } : {}),
    },
  });
  console.log(`Produtos alterados: ${count} de ${records.length}.`);
}

async function main() {
  if (command === "aplicar" && rest[0]) await apply(rest[0]);
  else if (command === "originais") await switchTo("originalMediaId", rest);
  else if (command === "padronizadas") await switchTo("standardMediaId", rest);
  else {
    console.error(
      "Uso: pnpm photos aplicar <pasta> | originais [sku ...] | padronizadas [sku ...]",
    );
    process.exitCode = 1;
  }
  await db.$disconnect();
}

void main();
