import { hasTestDatabase, unique as uniqueKey } from "./setup";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { AdminContext } from "@/server/admin/action";
import { AdminError } from "@/server/admin/action";
import {
  curationCounts,
  decideProducts,
  listCuration,
  parseCurationParams,
  renameProduct,
  restoreProducts,
  setProductPrice,
  trashProducts,
} from "@/server/admin/curation";
import { detectFormat, runImport } from "@/server/admin/product-import";
import { productWhere } from "@/server/admin/product-queries";
import { parseListParams } from "@/server/admin/list";
import { getStorage } from "@/server/providers/storage";
import { importLegacyImages } from "@/server/services/legacy-images";
import { storageKeysOf } from "@/server/services/media";

const unique = (prefix: string) => uniqueKey(prefix).toUpperCase();

const audits: string[] = [];
const context = {
  user: { id: "teste-admin", role: "ADMIN" },
  audit: async (entry: { action: string }) => void audits.push(entry.action),
  ipHash: "hash",
  userAgent: null,
} as unknown as AdminContext;
const skus: string[] = [];

/** Importa produtos no formato do site antigo, direto para a curadoria. */
async function importForCuration(rows: string[][]) {
  const headers = ["CodProd", "NomeProd", "Preco", "Estoque", "ImagemProd", "ImagemDet"];
  rows.forEach((row) => skus.push(row[0]));
  await runImport(
    {
      rows,
      mapping: detectFormat(headers).mapping as Record<string, number>,
      categoryMap: {},
      publish: true,
      forCuration: true,
      imageBaseUrl: "https://fotos.example.com/img/",
      weightInKg: true,
    },
    context,
  );
  return db.product.findMany({ where: { sku: { in: rows.map((row) => row[0]) } } });
}

const png = () =>
  sharp({ create: { width: 40, height: 40, channels: 3, background: "#8a9a5b" } })
    .png()
    .toBuffer();

describe.skipIf(!hasTestDatabase)("curadoria do catálogo importado", () => {
  afterAll(async () => {
    const media = await db.mediaAsset.findMany({
      where: { productImages: { some: { product: { sku: { in: skus } } } } },
    });
    await db.product.deleteMany({ where: { sku: { in: skus } } });
    await db.mediaAsset.deleteMany({ where: { id: { in: media.map((asset) => asset.id) } } });
    const storage = getStorage();
    for (const asset of media)
      for (const key of storageKeysOf(asset.storageKey)) await storage.delete(key);
    await db.$disconnect();
  });

  it("importa fora da loja, à espera da decisão, com as fotos do site antigo anotadas", async () => {
    const sku = unique("CUR");
    const [product] = await importForCuration([
      [sku, `Vaso ${sku}`, "89,90", "3", "a.jpg", "https://cdn.example.com/b.jpg | javascript:x"],
    ]);
    // "Importar e publicar" não vale para a curadoria: quem publica é a decisão do dono.
    expect(product.status).toBe("DRAFT");
    expect(product.curation).toBe("PENDING");
    expect(product.legacyImageUrls).toEqual([
      "https://fotos.example.com/img/a.jpg",
      "https://cdn.example.com/b.jpg",
    ]);
    const { items } = await listCuration(parseCurationParams({ busca: sku }));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ price: "89,90", imageIsLegacy: true, variantCount: 1 });
  });

  it("manter traz as fotos e só então publica; sem foto o produto fica fora da loja", async () => {
    const withPhoto = unique("CUR");
    const withoutPhoto = unique("CUR");
    const products = await importForCuration([
      [withPhoto, `Vaso ${withPhoto}`, "50,00", "1", "ok.png", "quebrada.png"],
      [withoutPhoto, `Vaso ${withoutPhoto}`, "50,00", "1", "", ""],
    ]);
    const ids = products.map((product) => product.id);
    const result = await decideProducts({ ids, decision: "feature" }, context);
    expect(result.published).toBe(0);
    expect(audits).toContain("product.curation_feature");

    const target = products.find((product) => product.sku === withPhoto)!;
    const image = await png();
    const fetcher = (async (url: string) =>
      String(url).endsWith("ok.png")
        ? new Response(new Uint8Array(image), { status: 200 })
        : new Response("", { status: 404 })) as unknown as typeof fetch;
    const imported = await importLegacyImages(target.id, fetcher);
    expect(imported).toEqual({ imported: 1, failed: 1, published: true });

    const after = await db.product.findUniqueOrThrow({
      where: { id: target.id },
      include: { images: { include: { media: true } } },
    });
    expect(after.status).toBe("ACTIVE");
    expect(after.isFeatured).toBe(true);
    expect(after.publishedAt).not.toBeNull();
    // A foto que falhou continua anotada para uma nova tentativa.
    expect(after.legacyImageUrls).toEqual(["https://fotos.example.com/img/quebrada.png"]);
    expect(after.images).toHaveLength(1);
    expect(after.images[0]).toMatchObject({ isCover: true, position: 0 });
    expect(after.images[0].media.alt).toBe(`Vaso ${withPhoto}`);

    const other = await db.product.findUniqueOrThrow({ where: { sku: withoutPhoto } });
    expect(other).toMatchObject({ status: "DRAFT", curation: "KEPT" });
  });

  it("excluir manda para a lixeira, some das listas e restaurar devolve o estado", async () => {
    const sku = unique("CUR");
    const [product] = await importForCuration([[sku, `Vaso ${sku}`, "10,00", "1", "", ""]]);
    await db.product.update({ where: { id: product.id }, data: { status: "ACTIVE" } });
    const before = await curationCounts();

    await trashProducts([product.id], context);
    const trashed = await db.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(trashed).toMatchObject({
      status: "ARCHIVED",
      statusBeforeDelete: "ACTIVE",
      deletedById: "teste-admin",
    });
    expect(trashed.deletedAt).not.toBeNull();
    expect((await curationCounts()).excluidos).toBe(before.excluidos + 1);

    // Fora da lista de produtos do painel e da fila de revisão.
    const where = await productWhere(parseListParams({ busca: sku }));
    expect(await db.product.count({ where })).toBe(0);
    expect((await listCuration(parseCurationParams({ busca: sku }))).items).toHaveLength(0);
    // Na aba Excluídos, o mais recente vem primeiro.
    const trash = await listCuration(parseCurationParams({ aba: "excluidos" }));
    expect(trash.items[0].id).toBe(product.id);
    expect(trash.items[0].deletedAt).not.toBeNull();

    await expect(trashProducts([product.id], context)).rejects.toThrow(AdminError);
    await expect(decideProducts({ ids: [product.id], decision: "keep" }, context)).rejects.toThrow(
      AdminError,
    );

    await restoreProducts([product.id], context);
    const restored = await db.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(restored).toMatchObject({ status: "ACTIVE", deletedAt: null, statusBeforeDelete: null });
    expect(audits).toEqual(expect.arrayContaining(["product.trash", "product.restore"]));
  });

  it("edita nome e preço; o endereço acompanha o nome enquanto o produto não foi publicado", async () => {
    const sku = unique("CUR");
    const [product] = await importForCuration([[sku, `Vaso ${sku}`, "10,00", "1", "", ""]]);
    const name = `Cachepot ${sku} novo`;
    await renameProduct({ id: product.id, name }, context);
    await setProductPrice({ id: product.id, price: "129,90" }, context);
    const edited = await db.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(edited.name).toBe(name);
    expect(edited.slug).toBe(`cachepot-${sku.toLowerCase()}-novo`);
    expect(edited.minPriceCents).toBe(12990);
    expect(edited.searchText).toContain("cachepot");
    await expect(setProductPrice({ id: product.id, price: "abc" }, context)).rejects.toThrow(
      AdminError,
    );

    await db.product.update({ where: { id: product.id }, data: { publishedAt: new Date() } });
    await renameProduct({ id: product.id, name: `Outro ${sku}` }, context);
    expect((await db.product.findUniqueOrThrow({ where: { id: product.id } })).slug).toBe(
      edited.slug,
    );
  });

  it("voltar para a revisão tira o produto da loja e dos destaques", async () => {
    const sku = unique("CUR");
    const [product] = await importForCuration([[sku, `Vaso ${sku}`, "10,00", "1", "", ""]]);
    await decideProducts({ ids: [product.id], decision: "feature" }, context);
    await decideProducts({ ids: [product.id], decision: "pending" }, context);
    expect(await db.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({
      curation: "PENDING",
      isFeatured: false,
      status: "DRAFT",
    });
  });

  it("aponta nomes repetidos, ignorando acentos e caixa", async () => {
    const key = unique("DUP");
    const [first, second] = await importForCuration([
      [`${key}A`, `Orquídea ${key}`, "10,00", "1", "", ""],
      [`${key}B`, `ORQUIDEA ${key.toLowerCase()} `, "12,00", "1", "", ""],
    ]);
    const { items } = await listCuration(parseCurationParams({ filtro: "duplicados", busca: key }));
    expect(items.map((item) => item.id).sort()).toEqual([first.id, second.id].sort());
  });
});
