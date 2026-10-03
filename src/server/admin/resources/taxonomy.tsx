import "server-only";
import { z } from "zod";
import { CollectionProducts } from "@/components/admin/collection-products";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { sanitizeRichText } from "@/lib/sanitize";
import { AdminError } from "../action";
import { bool, int, optionalId, optionalText, requiredText, slugField } from "../fields";
import { redirectOldPath } from "../products";
import { defineResource } from "../resource";
import { muted, pickedImage, yesNoBadge } from "./shared";

const lines = (value: string | null | undefined) =>
  String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
const legacyPathsField = () => z.string().max(4000).transform(lines);

// ───────────────────────── Categorias ─────────────────────────

type CategoryRecord = Prisma.CategoryGetPayload<{
  include: {
    image: true;
    parent: { select: { name: true; path: true } };
    _count: { select: { children: true; primaryProducts: true } };
  };
}>;

const FILTER_GROUPS: Record<string, string> = {
  luz: "Luz",
  ambiente: "Ambiente",
  pet: "Pets",
  cuidado: "Nível de cuidado",
  porte: "Porte",
  material: "Material",
  cor: "Cor",
  altura: "Altura",
  boca: "Diâmetro da boca",
  furo: "Furo de drenagem",
  uso: "Uso",
  tipo: "Tipo",
  vaso: "Com ou sem vaso",
  marca: "Marca",
};

const categorySchema = z.object({
  name: requiredText("o nome", 80),
  slug: slugField(),
  parentId: optionalId(),
  description: optionalText(200),
  imageId: optionalId(),
  seoContent: z
    .string()
    .max(50_000)
    .transform((html) => sanitizeRichText(html) || null),
  faq: z
    .array(z.object({ question: z.string().trim().max(200), answer: z.string().trim().max(2000) }))
    .max(30)
    .default([])
    .transform((items) =>
      items
        .filter((item) => item.question && item.answer)
        .map((item) => ({ pergunta: item.question, resposta: item.answer })),
    ),
  filtersConfig: z.array(z.string().max(20)).max(20).default([]),
  legacyPaths: legacyPathsField(),
  seoTitle: optionalText(70),
  seoDescription: optionalText(170),
  isActive: bool(),
  showInMenu: bool(),
  showOnHome: bool(),
  isSecondary: bool(),
});

export const categoryResource = defineResource<CategoryRecord>({
  key: "categorias",
  singular: "Categoria",
  plural: "Categorias",
  feminine: true,
  permission: "categories.edit",
  model: "category",
  entityType: "Category",
  tags: ["categories", "catalog", "home"],
  nameOf: (category) => category.name,
  include: {
    image: true,
    parent: { select: { name: true, path: true } },
    _count: { select: { children: true, primaryProducts: true } },
  },
  list: {
    columns: [
      { key: "name", header: "Categoria" },
      { key: "path", header: "Endereço" },
    ],
    orderBy: { path: "asc" },
    row: (category) => ({ name: category.name, path: muted(`/categoria/${category.path}`) }),
  },
  form: {
    schema: categorySchema,
    fields: async (category) => [
      { name: "name", label: "Nome", type: "text" },
      {
        name: "slug",
        label: "Endereço (slug)",
        type: "text",
        help: "Mudar o endereço de uma categoria cria o redirecionamento do endereço antigo, inclusive das subcategorias.",
      },
      {
        name: "parentId",
        label: "Categoria pai",
        type: "select",
        options: [
          { value: "", label: "Nenhuma (categoria principal)" },
          ...(
            await db.category.findMany({
              where: { parentId: null, id: category ? { not: category.id } : undefined },
              orderBy: { position: "asc" },
              select: { id: true, name: true },
            })
          ).map((item) => ({ value: item.id, label: item.name })),
        ],
        disabled: Boolean(category && category._count.children > 0),
        help:
          category && category._count.children > 0
            ? "Esta categoria tem subcategorias, então fica como principal."
            : undefined,
      },
      {
        name: "description",
        label: "Descrição curta",
        type: "textarea",
        rows: 2,
        maxLength: 200,
        counter: true,
      },
      { name: "imageId", label: "Imagem", type: "image" },
      { name: "isActive", label: "Ativa", type: "checkbox" },
      { name: "showInMenu", label: "Aparece no menu", type: "checkbox" },
      { name: "showOnHome", label: "Aparece na home", type: "checkbox" },
      {
        name: "isSecondary",
        label: "Secundária (destaque reduzido, como jardinagem)",
        type: "checkbox",
      },
      {
        name: "filtersConfig",
        label: "Filtros que a categoria mostra",
        type: "checklist",
        options: Object.entries(FILTER_GROUPS).map(([value, label]) => ({ value, label })),
        section: "Filtros e conteúdo",
      },
      {
        name: "seoContent",
        label: "Texto no fim da página (SEO)",
        type: "richtext",
        section: "Filtros e conteúdo",
      },
      {
        name: "faq",
        label: "Perguntas frequentes da categoria",
        type: "faq",
        section: "Filtros e conteúdo",
      },
      {
        name: "seoTitle",
        label: "Título para o Google",
        type: "text",
        maxLength: 60,
        counter: true,
        section: "SEO e endereços antigos",
        wide: true,
      },
      {
        name: "seoDescription",
        label: "Descrição para o Google",
        type: "textarea",
        rows: 2,
        maxLength: 155,
        counter: true,
        section: "SEO e endereços antigos",
        wide: true,
      },
      {
        name: "legacyPaths",
        label: "Endereços do site antigo (um por linha)",
        type: "textarea",
        rows: 3,
        section: "SEO e endereços antigos",
        wide: true,
        help: "Cada endereço passa a redirecionar para esta categoria.",
      },
    ],
    toForm: (category) => ({
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      parentId: category?.parentId ?? "",
      description: category?.description ?? "",
      imageId: pickedImage(category?.image),
      seoContent: category?.seoContent ?? "",
      faq: (Array.isArray(category?.faq)
        ? (category.faq as Array<{ pergunta: string; resposta: string }>)
        : []
      ).map((item) => ({ question: item.pergunta, answer: item.resposta })),
      filtersConfig: Array.isArray(category?.filtersConfig)
        ? (category.filtersConfig as string[])
        : [],
      legacyPaths: category?.legacyPaths.join("\n") ?? "",
      seoTitle: category?.seoTitle ?? "",
      seoDescription: category?.seoDescription ?? "",
      isActive: category?.isActive ?? true,
      showInMenu: category?.showInMenu ?? true,
      showOnHome: category?.showOnHome ?? false,
      isSecondary: category?.isSecondary ?? false,
    }),
    seoUrl: (values) => `/categoria/${String(values.slug ?? "")}`,
    save: async (data: z.output<typeof categorySchema>, _context, existing) => {
      const parentId = existing && existing._count.children > 0 ? null : data.parentId;
      const parent = parentId
        ? await db.category.findUnique({
            where: { id: parentId },
            select: { path: true, parentId: true },
          })
        : null;
      if (parentId && (!parent || parent.parentId))
        throw new AdminError("A categoria pai precisa ser uma categoria principal.");
      const path = parent ? `${parent.path}/${data.slug}` : data.slug;
      const clash = await db.category.findUnique({ where: { path }, select: { id: true } });
      if (clash && clash.id !== existing?.id)
        throw new AdminError("Já existe uma categoria com este endereço.");
      const fields = { ...data, parentId, path };
      return db.$transaction(async (tx) => {
        const saved = existing
          ? await tx.category.update({ where: { id: existing.id }, data: fields })
          : await tx.category.create({
              data: {
                ...fields,
                position:
                  ((await tx.category.aggregate({ where: { parentId }, _max: { position: true } }))
                    ._max.position ?? 0) + 1,
              },
            });
        if (existing && existing.path !== path) {
          await redirectOldPath(
            tx,
            `/categoria/${existing.path}`,
            `/categoria/${path}`,
            "Endereço da categoria alterado no painel",
          );
          for (const child of await tx.category.findMany({ where: { parentId: existing.id } })) {
            const childPath = `${path}/${child.slug}`;
            await tx.category.update({ where: { id: child.id }, data: { path: childPath } });
            await redirectOldPath(
              tx,
              `/categoria/${child.path}`,
              `/categoria/${childPath}`,
              "Endereço da categoria alterado no painel",
            );
          }
        }
        for (const legacy of data.legacyPaths)
          await redirectOldPath(
            tx,
            legacy.toLowerCase(),
            `/categoria/${path}`,
            "Endereço antigo da categoria",
          );
        return saved;
      });
    },
  },
  blockDelete: (category) =>
    category._count.children > 0
      ? "Esta categoria tem subcategorias. Mova ou exclua as subcategorias antes."
      : category._count.primaryProducts > 0
        ? `Esta categoria tem ${category._count.primaryProducts} produtos. Mova os produtos para outra categoria antes de excluir.`
        : null,
});

// ───────────────────────── Coleções ─────────────────────────

type CollectionRecord = Prisma.CollectionGetPayload<{
  include: { image: true; _count: { select: { products: true } } };
}>;
type Rule = { kind?: string; days?: number; path?: string; tag?: string };

const ruleLabels: Record<string, string> = {
  new: "Novidades",
  bestsellers: "Mais vendidos",
  sale: "Em promoção",
  tag: "Produtos com uma tag",
  category: "Produtos de uma categoria",
};

const collectionSchema = z
  .object({
    name: requiredText("o nome", 80),
    slug: slugField(),
    description: optionalText(300),
    content: z
      .string()
      .max(50_000)
      .transform((html) => sanitizeRichText(html) || null),
    imageId: optionalId(),
    isActive: bool(),
    type: z.enum(["MANUAL", "RULE"]),
    ruleKind: z.string().max(20).default("new"),
    ruleDays: int("os dias", 1, 365),
    rulePath: optionalText(200),
    ruleTag: optionalText(40),
    legacyPaths: legacyPathsField(),
  })
  .superRefine((data, context) => {
    if (data.type !== "RULE") return;
    if (!(data.ruleKind in ruleLabels))
      context.addIssue({ code: "custom", path: ["ruleKind"], message: "Escolha a regra." });
    if (data.ruleKind === "tag" && !data.ruleTag)
      context.addIssue({ code: "custom", path: ["ruleTag"], message: "Informe a tag." });
    if (data.ruleKind === "category" && !data.rulePath)
      context.addIssue({ code: "custom", path: ["rulePath"], message: "Escolha a categoria." });
  });

export const collectionResource = defineResource<CollectionRecord>({
  key: "colecoes",
  singular: "Coleção",
  plural: "Coleções",
  feminine: true,
  description:
    "Vitrines da loja. Uma coleção manual tem os produtos escolhidos e ordenados aqui; uma coleção por regra se atualiza sozinha.",
  permission: "collections.edit",
  model: "collection",
  entityType: "Collection",
  tags: ["catalog", "home"],
  nameOf: (collection) => collection.name,
  include: { image: true, _count: { select: { products: true } } },
  list: {
    columns: [
      { key: "name", header: "Coleção" },
      { key: "type", header: "Tipo" },
      { key: "status", header: "Situação" },
    ],
    orderBy: { position: "asc" },
    reorder: true,
    row: (collection) => {
      const rule = (collection.rule ?? {}) as Rule;
      return {
        name: (
          <>
            {collection.name}
            <span className="block text-xs font-normal text-muted-foreground">
              /colecao/{collection.slug}
            </span>
          </>
        ),
        type:
          collection.type === "MANUAL"
            ? `Manual, ${collection._count.products} produtos`
            : `Por regra: ${ruleLabels[rule.kind ?? ""] ?? "sem regra"}`,
        status: yesNoBadge(collection.isActive, "Ativa", "Inativa"),
      };
    },
  },
  form: {
    schema: collectionSchema,
    fields: async () => [
      { name: "name", label: "Nome", type: "text" },
      {
        name: "slug",
        label: "Endereço (slug)",
        type: "text",
        help: "A coleção fica em /colecao/endereço.",
      },
      {
        name: "description",
        label: "Descrição",
        type: "textarea",
        rows: 2,
        maxLength: 300,
        counter: true,
        wide: true,
      },
      { name: "content", label: "Texto acima dos produtos (opcional)", type: "richtext" },
      { name: "imageId", label: "Imagem", type: "image" },
      { name: "isActive", label: "Ativa", type: "checkbox" },
      {
        name: "type",
        label: "Tipo",
        type: "select",
        options: [
          { value: "MANUAL", label: "Manual: escolher e ordenar os produtos" },
          { value: "RULE", label: "Por regra: atualiza sozinha" },
        ],
        section: "Produtos da coleção",
      },
      {
        name: "ruleKind",
        label: "Regra",
        type: "select",
        options: Object.entries(ruleLabels).map(([value, label]) => ({ value, label })),
        section: "Produtos da coleção",
        showIf: { field: "type", in: ["RULE"] },
      },
      {
        name: "ruleDays",
        label: "Novidade é o que foi publicado há até quantos dias",
        type: "number",
        section: "Produtos da coleção",
        showIf: { field: "ruleKind", in: ["new"] },
      },
      {
        name: "ruleTag",
        label: "Tag",
        type: "text",
        section: "Produtos da coleção",
        showIf: { field: "ruleKind", in: ["tag"] },
      },
      {
        name: "rulePath",
        label: "Categoria",
        type: "select",
        section: "Produtos da coleção",
        showIf: { field: "ruleKind", in: ["category"] },
        options: [
          { value: "", label: "Escolha" },
          ...(
            await db.category.findMany({
              orderBy: { path: "asc" },
              select: { path: true, name: true },
            })
          ).map((category) => ({
            value: category.path,
            label: `${category.name} (${category.path})`,
          })),
        ],
      },
      {
        name: "legacyPaths",
        label: "Endereços do site antigo (um por linha)",
        type: "textarea",
        rows: 2,
        wide: true,
        section: "Endereços antigos",
      },
    ],
    toForm: (collection) => {
      const rule = (collection?.rule ?? {}) as Rule;
      return {
        name: collection?.name ?? "",
        slug: collection?.slug ?? "",
        description: collection?.description ?? "",
        content: collection?.content ?? "",
        imageId: pickedImage(collection?.image),
        isActive: collection?.isActive ?? true,
        type: collection?.type ?? "MANUAL",
        ruleKind: rule.kind ?? "new",
        ruleDays: rule.days ?? 45,
        ruleTag: rule.tag ?? "",
        rulePath: rule.path ?? "",
        legacyPaths: collection?.legacyPaths.join("\n") ?? "",
      };
    },
    seoUrl: (values) => `/colecao/${String(values.slug ?? "")}`,
    save: async (data: z.output<typeof collectionSchema>, _context, existing) => {
      const { ruleKind, ruleDays, rulePath, ruleTag, ...fields } = data;
      const rule =
        data.type === "RULE"
          ? {
              kind: ruleKind,
              ...(ruleKind === "new" ? { days: ruleDays } : {}),
              ...(ruleKind === "tag" ? { tag: ruleTag?.toLowerCase() } : {}),
              ...(ruleKind === "category" ? { path: rulePath } : {}),
            }
          : undefined;
      return db.$transaction(async (tx) => {
        const saved = existing
          ? await tx.collection.update({
              where: { id: existing.id },
              data: { ...fields, rule: rule ?? Prisma.DbNull },
            })
          : await tx.collection.create({ data: { ...fields, rule } });
        if (existing && existing.slug !== data.slug)
          await redirectOldPath(
            tx,
            `/colecao/${existing.slug}`,
            `/colecao/${data.slug}`,
            "Endereço da coleção alterado no painel",
          );
        for (const legacy of data.legacyPaths)
          await redirectOldPath(
            tx,
            legacy.toLowerCase(),
            `/colecao/${data.slug}`,
            "Endereço antigo da coleção",
          );
        return saved;
      });
    },
    below: async (collection) => {
      if (collection.type !== "MANUAL")
        return (
          <p className="text-sm text-muted-foreground">
            Coleção por regra: os produtos são escolhidos automaticamente.
          </p>
        );
      const items = await db.collectionProduct.findMany({
        where: { collectionId: collection.id },
        orderBy: { position: "asc" },
        include: { product: { select: { id: true, name: true, sku: true, status: true } } },
      });
      return (
        <CollectionProducts
          collectionId={collection.id}
          items={items.map((item) => ({
            id: item.product.id,
            name: item.product.name,
            sku: item.product.sku,
            active: item.product.status === "ACTIVE",
          }))}
        />
      );
    },
  },
  toggles: [{ field: "isActive", label: "Ativa" }],
});
