"use server";

import { after } from "next/server";
import { z } from "zod";
import { runAdmin, type AdminResult } from "@/server/admin/action";
import {
  categorySchema,
  curationCounts,
  decideProducts,
  decideSchema,
  idsSchema,
  nextLegacyPhotoBatch,
  priceSchema,
  renameProduct,
  renameSchema,
  restoreProducts,
  setProductPrice,
  setProductsCategory,
  trashProducts,
} from "@/server/admin/curation";
import { importLegacyImages } from "@/server/services/legacy-images";

/** Fotos trazidas logo depois da decisão, sem segurar a resposta. O restante fica para o botão. */
const PHOTOS_AFTER_DECISION = 8;

export async function decideProductsAction(input: z.input<typeof decideSchema>) {
  return runAdmin("products.edit", decideSchema, input, async (data, context) => {
    const result = await decideProducts(data, context);
    if (data.decision === "keep" || data.decision === "feature") {
      const first = result.ids.slice(0, PHOTOS_AFTER_DECISION);
      after(async () => {
        for (const id of first) await importLegacyImages(id).catch(() => undefined);
      });
    }
    return { message: result.message };
  });
}

export async function trashProductsAction(ids: string[]) {
  return runAdmin("products.delete", idsSchema, { ids }, async (data, context) => {
    const result = await trashProducts(data.ids, context);
    return { message: result.message };
  });
}

export async function restoreProductsAction(ids: string[]) {
  return runAdmin("products.delete", idsSchema, { ids }, async (data, context) => {
    const result = await restoreProducts(data.ids, context);
    return { message: result.message };
  });
}

export async function renameProductAction(input: z.input<typeof renameSchema>) {
  return runAdmin("products.edit", renameSchema, input, (data, context) =>
    renameProduct(data, context),
  );
}

export async function setProductPriceAction(input: z.input<typeof priceSchema>) {
  return runAdmin("products.edit_price", priceSchema, input, (data, context) =>
    setProductPrice(data, context),
  );
}

export async function setProductsCategoryAction(input: z.input<typeof categorySchema>) {
  return runAdmin("products.edit", categorySchema, input, (data, context) =>
    setProductsCategory(data, context),
  );
}

const photoBatchSchema = z.object({ afterId: z.string().max(40).default("") });
type PhotoBatch = { lastId: string; imported: number; failed: number; remaining: number };

/**
 * Traz as fotos do site antigo de um pequeno lote de produtos mantidos. A tela chama de novo com
 * o cursor devolvido até acabar, para nenhuma chamada passar do tempo limite do servidor.
 */
export async function importLegacyPhotosAction(
  input: z.input<typeof photoBatchSchema>,
): Promise<AdminResult<PhotoBatch>> {
  return runAdmin<typeof photoBatchSchema, PhotoBatch>(
    "products.edit_images",
    photoBatchSchema,
    input,
    async (data, { audit }) => {
      const batch = await nextLegacyPhotoBatch(data.afterId, 3);
      let imported = 0;
      let failed = 0;
      for (const id of batch) {
        const result = await importLegacyImages(id);
        imported += result.imported;
        failed += result.failed;
      }
      const lastId = batch.at(-1) ?? "";
      const remaining = lastId ? (await nextLegacyPhotoBatch(lastId, 1)).length : 0;
      if (imported > 0)
        await audit({
          action: "product.import_legacy_photos",
          entityType: "Product",
          diff: { produtos: batch.length, fotos: imported, falhas: failed },
        });
      const counts = remaining ? null : await curationCounts();
      return {
        message: remaining
          ? "Trazendo fotos"
          : counts?.photosPending
            ? `Fotos trazidas. ${counts.photosPending} produtos ficaram com foto pendente.`
            : "Todas as fotos foram trazidas",
        data: { lastId, imported, failed, remaining },
      };
    },
  );
}
