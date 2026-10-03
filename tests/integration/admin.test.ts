import { hasTestDatabase, unique as uniqueKey } from "./setup";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { AdminContext } from "@/server/admin/action";
import { AdminError } from "@/server/admin/action";
import { decodeCsvBuffer, parseCsv, toCsv } from "@/server/admin/list";
import { detectFormat, importSchema, runImport } from "@/server/admin/product-import";
import {
  LowQualityError,
  productSchema,
  removeSampleData,
  saveProduct,
} from "@/server/admin/products";
import { assertRedirectIsSafe } from "@/server/admin/redirect-rules";

// Os SKUs são gravados em maiúsculas.
const unique = (prefix: string) => uniqueKey(prefix).toUpperCase();

const audits: string[] = [];
const context = {
  user: { id: "teste-admin", role: "ADMIN" },
  audit: async (entry: { action: string }) => void audits.push(entry.action),
  ipHash: "hash",
  userAgent: null,
} as unknown as AdminContext;
const cleanup = { skus: [] as string[], redirects: [] as string[] };

const baseProduct = (key: string, overrides: Record<string, unknown> = {}) =>
  productSchema.parse({
    name: `Vaso ${key}`,
    slug: key.toLowerCase(),
    sku: key,
    productType: "POT",
    status: "DRAFT",
    deliveryScope: "NATIONAL",
    tags: "sala, presente",
    variants: [
      {
        name: "Padrão",
        sku: `${key}-01`,
        priceCents: "89,90",
        weightGrams: "900",
        stockOnHand: "4",
        lowStockThreshold: "3",
        isActive: true,
      },
    ],
    ...overrides,
  });

describe.skipIf(!hasTestDatabase)("admin: produtos", () => {
  afterAll(async () => {
    await db.product.deleteMany({ where: { sku: { in: cleanup.skus } } });
    await db.redirect.deleteMany({ where: { fromPath: { in: cleanup.redirects } } });
    await db.$disconnect();
  });

  it("salva o produto com variação, estoque inicial e campos derivados", async () => {
    const key = unique("ADM");
    cleanup.skus.push(key);
    const saved = await saveProduct(baseProduct(key), context);
    const product = await db.product.findUniqueOrThrow({
      where: { id: saved.id },
      include: { variants: { include: { movements: true } } },
    });
    expect(product.minPriceCents).toBe(8990);
    expect(product.totalAvailable).toBe(4);
    expect(product.searchText).toContain(key.toLowerCase());
    expect(product.tags).toEqual(["sala", "presente"]);
    expect(
      product.variants[0].movements.map((movement) => [movement.type, movement.quantity]),
    ).toEqual([["IN", 4]]);
    expect(audits).toContain("product.create");
  });

  it("mudar o estoque pelo cadastro gera um ajuste de inventário", async () => {
    const key = unique("ADM");
    cleanup.skus.push(key);
    const saved = await saveProduct(baseProduct(key), context);
    const variant = await db.productVariant.findFirstOrThrow({ where: { productId: saved.id } });
    await saveProduct(
      baseProduct(key, {
        id: saved.id,
        variants: [
          {
            id: variant.id,
            name: "Padrão",
            sku: `${key}-01`,
            priceCents: "99,90",
            weightGrams: "900",
            stockOnHand: "10",
            lowStockThreshold: "3",
            isActive: true,
          },
        ],
      }),
      context,
    );
    const movements = await db.inventoryMovement.findMany({
      where: { variantId: variant.id },
      orderBy: { createdAt: "asc" },
    });
    expect(
      movements.map((movement) => [movement.type, movement.quantity, movement.stockOnHandAfter]),
    ).toEqual([
      ["IN", 4, 4],
      ["ADJUSTMENT", 6, 10],
    ]);
    expect((await db.product.findUniqueOrThrow({ where: { id: saved.id } })).minPriceCents).toBe(
      9990,
    );
  });

  it("publicar exige imagem; com qualidade baixa, pede confirmação e nada é gravado", async () => {
    const key = unique("ADM");
    cleanup.skus.push(key);
    await expect(saveProduct(baseProduct(key, { status: "ACTIVE" }), context)).rejects.toThrow(
      /pelo menos uma imagem/,
    );
    const media = await db.mediaAsset.create({
      data: {
        originalName: "t.webp",
        storageKey: `teste/${key}-1600.webp`,
        mimeType: "image/webp",
        sizeBytes: 1,
        width: 10,
        height: 10,
        alt: "",
        isSample: true,
      },
    });
    const images = [{ mediaId: media.id, alt: "Vaso de teste", isCover: true }];
    await expect(
      saveProduct(baseProduct(key, { status: "ACTIVE", images }), context),
    ).rejects.toBeInstanceOf(LowQualityError);
    expect(await db.product.findUnique({ where: { sku: key } })).toBeNull();
    const saved = await saveProduct(
      baseProduct(key, { status: "ACTIVE", images, confirmLowQuality: true }),
      context,
    );
    const product = await db.product.findUniqueOrThrow({ where: { id: saved.id } });
    expect(product.status).toBe("ACTIVE");
    expect(product.publishedAt).not.toBeNull();
    expect((await db.mediaAsset.findUniqueOrThrow({ where: { id: media.id } })).alt).toBe(
      "Vaso de teste",
    );

    // Mudar o endereço de um produto publicado cria o redirecionamento do endereço antigo.
    const variant = await db.productVariant.findFirstOrThrow({ where: { productId: saved.id } });
    const newSlug = `${key.toLowerCase()}-novo`;
    cleanup.redirects.push(`/produto/${key.toLowerCase()}`);
    await saveProduct(
      baseProduct(key, {
        id: saved.id,
        slug: newSlug,
        status: "ACTIVE",
        images,
        variants: [
          {
            id: variant.id,
            name: "Padrão",
            sku: `${key}-01`,
            priceCents: "89,90",
            weightGrams: "900",
            stockOnHand: "4",
            lowStockThreshold: "3",
            isActive: true,
          },
        ],
      }),
      context,
    );
    expect(
      await db.redirect.findUnique({ where: { fromPath: `/produto/${key.toLowerCase()}` } }),
    ).toMatchObject({ toPath: `/produto/${newSlug}`, statusCode: 301 });
    await db.product.delete({ where: { id: saved.id } });
    await db.mediaAsset.delete({ where: { id: media.id } });
  });

  it("recusa SKU repetido e preço promocional maior que o preço", async () => {
    const key = unique("ADM");
    cleanup.skus.push(key);
    await saveProduct(baseProduct(key), context);
    const other = unique("ADM");
    await expect(
      saveProduct(
        baseProduct(other, {
          variants: [
            {
              name: "Padrão",
              sku: `${key}-01`,
              priceCents: "10,00",
              weightGrams: "1",
              stockOnHand: "0",
              lowStockThreshold: "0",
              isActive: true,
            },
          ],
        }),
        context,
      ),
    ).rejects.toThrow(/já é de outro produto/);
    await expect(
      saveProduct(
        baseProduct(other, {
          variants: [
            {
              name: "Padrão",
              sku: `${other}-01`,
              priceCents: "10,00",
              promoPriceCents: "12,00",
              weightGrams: "1",
              stockOnHand: "0",
              lowStockThreshold: "0",
              isActive: true,
            },
          ],
        }),
        context,
      ),
    ).rejects.toBeInstanceOf(AdminError);
  });
});

describe.skipIf(!hasTestDatabase)("admin: importação de produtos", () => {
  it("lê o CSV do site antigo em ISO-8859-1, com ponto e vírgula, vírgula decimal e variações", async () => {
    const key = unique("IMP");
    const csv = [
      "NomeCat;CodProd;NomeProd;Peso;Descricao;DescrLonga;Preco;PrecoProm;DataPromInicio;DataPromFim;Estoque;Disponivel;IDProdutoPai",
      `Orquídeas;${key};Orquídea Phalaenopsis ${key};1,2;Orquídea branca;Descrição longa da orquídea;129,90;;;;0;1;`,
      `Orquídeas;${key}-P;Pequena;0,8;;;99,90;89,90;01/01/2020;31/12/2099;5;1;${key}`,
      `Orquídeas;${key}-G;Grande;1,5;;;159,90;;;;3;1;${key}`,
      `Orquídeas;${key}-X;Sem preço;1;;;abc;;;;1;1;`,
    ].join("\r\n");
    const [headers, ...rows] = parseCsv(
      decodeCsvBuffer(Uint8Array.from(Buffer.from(csv, "latin1")).buffer),
    );
    expect(headers[2]).toBe("NomeProd");
    expect(rows[0][0]).toBe("Orquídeas");
    const { format, mapping } = detectFormat(headers);
    expect(format).toBe("fastcommerce");

    const input = importSchema.parse({
      rows,
      mapping,
      categoryMap: {},
      publish: false,
      weightInKg: true,
    });
    const report = await runImport(input, context);
    expect(report).toMatchObject({ created: 1, updated: 0, variants: 2, skipped: 1 });
    expect(report.errors[0].errors[0]).toBe("Preço inválido.");

    const product = await db.product.findUniqueOrThrow({
      where: { sku: key },
      include: { variants: { orderBy: { position: "asc" } } },
    });
    expect(product.status).toBe("DRAFT");
    expect(product.name).toBe(`Orquídea Phalaenopsis ${key}`);
    expect(product.productType).toBe("ORCHID");
    expect(
      product.variants.map((variant) => [
        variant.sku,
        variant.priceCents,
        variant.promoPriceCents,
        variant.stockOnHand,
        variant.weightGrams,
      ]),
    ).toEqual([
      [`${key}-P`, 9990, 8990, 5, 800],
      [`${key}-G`, 15990, null, 3, 1500],
    ]);
    expect(product.minPriceCents).toBe(8990);
    expect(product.totalAvailable).toBe(8);

    // Importar de novo atualiza em vez de duplicar.
    const again = await runImport(input, context);
    expect(again).toMatchObject({ created: 0, updated: 1 });
    expect(await db.product.count({ where: { sku: key } })).toBe(1);
    await db.product.delete({ where: { id: product.id } });
  });

  it("protege o CSV exportado contra fórmulas de planilha", () => {
    expect(toCsv(["nome"], [["=SOMA(A1)"], ["ok; com ponto e vírgula"]])).toContain("'=SOMA(A1)");
    expect(toCsv(["nome"], [["a;b"]])).toContain('"a;b"');
  });
});

describe.skipIf(!hasTestDatabase)("admin: redirecionamentos e dados de teste", () => {
  it("recusa loops e cadeias de redirecionamento", async () => {
    const key = unique("red").toLowerCase();
    await db.redirect.create({ data: { fromPath: `/${key}-a`, toPath: `/${key}-b` } });
    await expect(assertRedirectIsSafe(`/${key}-x`, `/${key}-x`)).rejects.toThrow(/loop/);
    await expect(assertRedirectIsSafe(`/${key}-x`, `/${key}-a`)).rejects.toThrow(/cadeia/);
    await expect(assertRedirectIsSafe(`/${key}-b`, `/${key}-c`)).rejects.toThrow(/já redireciona/);
    await expect(assertRedirectIsSafe(`/${key}-x`, `/${key}-y`)).resolves.toBeUndefined();
    await db.redirect.deleteMany({ where: { fromPath: { startsWith: `/${key}` } } });
  });

  it("remover dados de teste apaga só o que é isSample", async () => {
    const key = unique("SMP");
    const variant = (sku: string) => ({
      create: { name: "Padrão", sku, priceCents: 1000, stockOnHand: 2 },
    });
    const sample = await db.product.create({
      data: {
        name: "Amostra",
        slug: `${key}-a`.toLowerCase(),
        sku: `${key}-A`,
        productType: "POT",
        isSample: true,
        variants: variant(`${key}-A1`),
      },
    });
    const real = await db.product.create({
      data: {
        name: "Real",
        slug: `${key}-r`.toLowerCase(),
        sku: `${key}-R`,
        productType: "POT",
        isSample: false,
        variants: variant(`${key}-R1`),
      },
    });
    const customer = await db.user.create({
      data: { name: "Cliente de teste", email: `${key.toLowerCase()}@example.com`, isSample: true },
    });
    const keeper = await db.user.create({
      data: {
        name: "Cliente real",
        email: `${key.toLowerCase()}-real@example.com`,
        isSample: false,
      },
    });
    await db.review.create({
      data: { productId: sample.id, authorName: "Ana", rating: 5, body: "Ótimo", isSample: true },
    });
    await db.lead.create({
      data: { email: `${key.toLowerCase()}-lead@example.com`, source: "FOOTER", isSample: true },
    });

    const report = await removeSampleData(context);
    expect(report.Produtos).toBeGreaterThanOrEqual(1);
    expect(await db.product.findUnique({ where: { id: sample.id } })).toBeNull();
    expect(await db.user.findUnique({ where: { id: customer.id } })).toBeNull();
    expect(await db.review.count({ where: { productId: sample.id } })).toBe(0);
    expect(await db.product.findUnique({ where: { id: real.id } })).not.toBeNull();
    expect(await db.user.findUnique({ where: { id: keeper.id } })).not.toBeNull();
    expect(audits).toContain("samples.remove");
    await db.product.delete({ where: { id: real.id } });
    await db.user.delete({ where: { id: keeper.id } });
  });
});
