import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getStorage } from "@/server/providers/storage";
import { processAndStoreImage, storageKeysOf } from "@/server/services/media";

export type MediaItem = {
  id: string;
  url: string;
  thumb: string;
  alt: string;
  width: number;
  height: number;
  name: string;
};

export function toMediaItem(asset: {
  id: string;
  alt: string;
  width: number;
  height: number;
  originalName: string;
  variants: unknown;
}): MediaItem {
  const variants = (asset.variants ?? {}) as Record<string, string>;
  const url = variants["1600"] ?? variants["800"] ?? variants["400"] ?? "";
  return {
    id: asset.id,
    url,
    thumb: variants["400"] ?? url,
    alt: asset.alt,
    width: asset.width,
    height: asset.height,
    name: asset.originalName,
  };
}

/** Processa o arquivo enviado (tipo real, EXIF, versões WebP) e cria o registro na biblioteca. */
export async function createMediaFromUpload(
  file: { name: string; buffer: Buffer },
  alt: string,
  userId: string,
): Promise<MediaItem> {
  const processed = await processAndStoreImage(file.buffer);
  const asset = await db.mediaAsset.create({
    data: {
      originalName: file.name.slice(0, 200),
      storageKey: processed.storageKey,
      mimeType: processed.mimeType,
      sizeBytes: processed.sizeBytes,
      width: processed.width,
      height: processed.height,
      blurDataUrl: processed.blurDataUrl,
      variants: processed.variants,
      alt: alt.trim().slice(0, 200),
      uploadedById: userId,
    },
  });
  return toMediaItem(asset);
}

export const mediaUsageInclude = {
  productImages: { select: { product: { select: { id: true, name: true } } } },
  categories: { select: { id: true, name: true } },
  collections: { select: { id: true, name: true } },
  occasions: { select: { id: true, name: true } },
  bannersDesktop: { select: { id: true, title: true } },
  bannersMobile: { select: { id: true, title: true } },
} satisfies Prisma.MediaAssetInclude;

type WithUsage = Prisma.MediaAssetGetPayload<{ include: typeof mediaUsageInclude }>;

/** Onde a imagem é usada, com o link de cada lugar. */
export function mediaUsage(asset: WithUsage): Array<{ label: string; href: string }> {
  const products = new Map(
    asset.productImages.map((image) => [image.product.id, image.product.name]),
  );
  return [
    ...[...products].map(([id, name]) => ({
      label: `Produto: ${name}`,
      href: `/admin/produtos/${id}`,
    })),
    ...asset.categories.map((item) => ({
      label: `Categoria: ${item.name}`,
      href: `/admin/categorias/${item.id}`,
    })),
    ...asset.collections.map((item) => ({
      label: `Coleção: ${item.name}`,
      href: `/admin/colecoes/${item.id}`,
    })),
    ...asset.occasions.map((item) => ({
      label: `Ocasião: ${item.name}`,
      href: `/admin/ocasioes/${item.id}`,
    })),
    ...[...asset.bannersDesktop, ...asset.bannersMobile].map((item) => ({
      label: `Banner: ${item.title}`,
      href: `/admin/banners/${item.id}`,
    })),
  ];
}

export const unusedMediaWhere: Prisma.MediaAssetWhereInput = {
  productImages: { none: {} },
  categories: { none: {} },
  collections: { none: {} },
  occasions: { none: {} },
  bannersDesktop: { none: {} },
  bannersMobile: { none: {} },
  productRequests: { none: {} },
};

/** Apaga os arquivos de um MediaAsset do armazenamento. Arquivos de amostra compartilhados ficam. */
export async function deleteMediaFiles(storageKey: string): Promise<void> {
  const storage = getStorage();
  await Promise.all(
    storageKeysOf(storageKey).map((key) => storage.delete(key).catch(() => undefined)),
  );
}
