import "server-only";
import { isIP } from "node:net";
import { db } from "@/lib/db";
import { invalidateProducts, refreshProductDerived } from "@/server/admin/products";
import { MAX_UPLOAD_BYTES, processAndStoreImage } from "@/server/services/media";

const TIMEOUT_MS = 20_000;

/** Só endereços públicos da web: a lista vem de um arquivo importado, nunca de um visitante. */
export function isFetchableImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host.includes(".") && !host.includes(":")) return false;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  // Endereço IP literal: recusado, para a loja nunca buscar nada na rede interna.
  return isIP(host) === 0;
}

async function download(url: string, fetcher: typeof fetch): Promise<Buffer> {
  const response = await fetcher(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "image/*" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES) throw new Error("Imagem acima de 10 MB");
  return Buffer.from(await response.arrayBuffer());
}

export type LegacyImageResult = { imported: number; failed: number; published: boolean };

/**
 * Traz para a loja as fotos que o produto tinha no site antigo. Cada foto baixada vira uma imagem
 * do produto (a primeira é a capa) e sai da lista de pendentes; as que falharem ficam para uma
 * nova tentativa. Um produto mantido na curadoria é publicado quando ganha a primeira foto.
 */
export async function importLegacyImages(
  productId: string,
  fetcher: typeof fetch = fetch,
): Promise<LegacyImageResult> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      slug: true,
      legacyImageUrls: true,
      _count: { select: { images: true } },
    },
  });
  const result: LegacyImageResult = { imported: 0, failed: 0, published: false };
  if (!product || product.legacyImageUrls.length === 0) return result;

  const remaining: string[] = [];
  let position = product._count.images;
  for (const url of product.legacyImageUrls) {
    if (!isFetchableImageUrl(url)) {
      result.failed++;
      continue; // endereço inválido: não adianta tentar de novo
    }
    try {
      const processed = await processAndStoreImage(await download(url, fetcher));
      const media = await db.mediaAsset.create({
        data: {
          originalName: decodeURIComponent(new URL(url).pathname.split("/").pop() || "foto").slice(
            0,
            200,
          ),
          storageKey: processed.storageKey,
          mimeType: processed.mimeType,
          sizeBytes: processed.sizeBytes,
          width: processed.width,
          height: processed.height,
          blurDataUrl: processed.blurDataUrl,
          variants: processed.variants,
          alt: product.name.slice(0, 200),
        },
      });
      await db.productImage.create({
        data: { productId: product.id, mediaId: media.id, position, isCover: position === 0 },
      });
      position++;
      result.imported++;
    } catch {
      result.failed++;
      remaining.push(url);
    }
  }

  await db.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: product.id },
      data: { legacyImageUrls: remaining },
    });
    await refreshProductDerived(tx, product.id);
    if (result.imported > 0) result.published = await publishIfReady(tx, product.id);
  });
  if (result.imported > 0) invalidateProducts([product.slug]);
  return result;
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * Publica um produto mantido na curadoria quando ele tem o mínimo para aparecer na loja: foto,
 * preço e uma variação ativa. Devolve se publicou.
 */
export async function publishIfReady(tx: Tx, productId: string): Promise<boolean> {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: {
      status: true,
      curation: true,
      deletedAt: true,
      publishedAt: true,
      _count: { select: { images: true } },
      variants: { where: { isActive: true, priceCents: { gt: 0 } }, select: { id: true } },
    },
  });
  if (
    !product ||
    product.curation !== "KEPT" ||
    product.deletedAt ||
    product.status !== "DRAFT" ||
    product._count.images === 0 ||
    product.variants.length === 0
  )
    return false;
  await tx.product.update({
    where: { id: productId },
    data: { status: "ACTIVE", publishedAt: product.publishedAt ?? new Date() },
  });
  return true;
}
