"use server";

import { z } from "zod";
import { requirePermission } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { AdminError, runAdmin } from "@/server/admin/action";
import {
  deleteMediaFiles,
  mediaUsage,
  mediaUsageInclude,
  toMediaItem,
  type MediaItem,
} from "@/server/admin/media";
import { invalidate } from "@/server/cache";

/** Biblioteca para o seletor de imagens dos formulários. */
export async function listMediaAction(
  query: string,
  page = 1,
): Promise<{ items: MediaItem[]; hasMore: boolean }> {
  await requirePermission("media.view");
  const q = String(query).trim().slice(0, 80);
  const take = 24;
  const assets = await db.mediaAsset.findMany({
    where: q
      ? {
          OR: [
            { alt: { contains: q, mode: "insensitive" } },
            { originalName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    skip: (Math.max(1, Number(page) || 1) - 1) * take,
    take: take + 1,
  });
  return { items: assets.slice(0, take).map(toMediaItem), hasMore: assets.length > take };
}

const altSchema = z.object({ id: z.string().max(40), alt: z.string().trim().max(200) });

export async function updateMediaAltAction(input: z.input<typeof altSchema>) {
  return runAdmin("media.upload", altSchema, input, async (data, { audit }) => {
    const before = await db.mediaAsset.findUnique({
      where: { id: data.id },
      select: { alt: true },
    });
    if (!before) throw new AdminError("Imagem não encontrada.");
    await db.mediaAsset.update({ where: { id: data.id }, data: { alt: data.alt } });
    await audit({
      action: "media.update_alt",
      entityType: "MediaAsset",
      entityId: data.id,
      diff: { alt: { antes: before.alt, depois: data.alt } },
    });
    invalidate("catalog", "home");
    return { message: "Texto alternativo salvo" };
  });
}

const deleteSchema = z.object({ id: z.string().max(40) });

export async function deleteMediaAction(input: z.input<typeof deleteSchema>) {
  return runAdmin("media.delete", deleteSchema, input, async (data, { audit }) => {
    const asset = await db.mediaAsset.findUnique({
      where: { id: data.id },
      include: { ...mediaUsageInclude, productRequests: { select: { id: true } } },
    });
    if (!asset) throw new AdminError("Imagem não encontrada.");
    const usage = mediaUsage(asset);
    if (usage.length > 0 || asset.productRequests.length > 0) {
      throw new AdminError(
        `Esta imagem está em uso (${usage[0]?.label ?? "solicitação de produto"}). Troque a imagem nesse lugar antes de excluir.`,
      );
    }
    await db.mediaAsset.delete({ where: { id: data.id } });
    // As imagens de amostra compartilham arquivos gerados pelo seed; só os envios do painel são apagados do disco.
    if (!asset.isSample) await deleteMediaFiles(asset.storageKey);
    await audit({
      action: "media.delete",
      entityType: "MediaAsset",
      entityId: data.id,
      diff: { arquivo: asset.originalName },
    });
    return { message: "Imagem excluída" };
  });
}
