import { randomBytes } from "node:crypto";
import sharp, { type Metadata, type OutputInfo } from "sharp";
import { getStorage } from "@/server/providers/storage";

export const IMAGE_WIDTHS = [400, 800, 1600] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export type ProcessedImage = {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  blurDataUrl: string;
  /** { "400": url, "800": url, "1600": url } */
  variants: Record<string, string>;
};

export class InvalidImageError extends Error {}

/**
 * Processa uma imagem enviada: confere o tipo real pelo conteúdo (não pela extensão), remove
 * metadados EXIF (inclusive localização), gera as versões WebP de 400, 800 e 1600 px e o
 * blurDataUrl. O nome do arquivo no armazenamento é sempre gerado pelo sistema.
 */
export async function processAndStoreImage(
  input: Buffer,
  options: { keyPrefix?: string; baseName?: string } = {},
): Promise<ProcessedImage> {
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new InvalidImageError("A imagem passa de 10 MB. Envie um arquivo menor.");
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(input).metadata();
  } catch {
    throw new InvalidImageError("Este arquivo não é uma imagem válida. Envie JPG, PNG ou WebP.");
  }
  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw new InvalidImageError("Formato não aceito. Envie JPG, PNG ou WebP.");
  }

  const storage = getStorage();
  const prefix = options.keyPrefix ?? new Date().toISOString().slice(0, 7);
  const base = options.baseName ?? randomBytes(12).toString("hex");

  // rotate() aplica a orientação do EXIF antes de os metadados serem descartados
  // (o sharp não copia metadados para a saída, a menos que se peça).
  const normalized = sharp(input).rotate();
  const variants: Record<string, string> = {};
  let largest: { key: string; info: OutputInfo } | undefined;

  for (const width of IMAGE_WIDTHS) {
    const { data, info } = await normalized
      .clone()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    const key = `${prefix}/${base}-${width}.webp`;
    variants[String(width)] = await storage.put(key, data, "image/webp");
    largest = { key, info };
  }

  const blur = await normalized.clone().resize({ width: 16 }).webp({ quality: 40 }).toBuffer();

  return {
    storageKey: largest!.key,
    mimeType: "image/webp",
    sizeBytes: largest!.info.size,
    width: largest!.info.width,
    height: largest!.info.height,
    blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
    variants,
  };
}

/** Chaves de todos os arquivos de um MediaAsset, para exclusão. */
export function storageKeysOf(storageKey: string): string[] {
  const match = /^(.*)-\d+\.webp$/.exec(storageKey);
  if (!match) return [storageKey];
  return IMAGE_WIDTHS.map((width) => `${match[1]}-${width}.webp`);
}

/** Maior versão disponível de uma imagem (a que o next/image usa como origem). */
export function largestVariantUrl(variants: unknown): string | null {
  if (!variants || typeof variants !== "object") return null;
  const map = variants as Record<string, string>;
  return map["1600"] ?? map["800"] ?? map["400"] ?? null;
}
