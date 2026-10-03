import "server-only";
import { z } from "zod";
import { Button } from "@/components/admin/ui/button";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { sanitizeRichText } from "@/lib/sanitize";
import { AdminError } from "../action";
import { bool, int, optionalId, optionalText, requiredText, slugField, tagList } from "../fields";
import { categoryOptions, collectionOptions } from "../product-queries";
import { defineResource } from "../resource";
import { muted, pickedImage, yesNoBadge } from "./shared";

// ───────────────────────── Páginas ─────────────────────────

type PageRecord = Prisma.PageGetPayload<object>;

const footerGroups = [
  { value: "", label: "Não mostrar" },
  { value: "institucional", label: "Institucional" },
  { value: "ajuda", label: "Ajuda" },
];

export const pageResource = defineResource<PageRecord>({
  key: "paginas",
  singular: "Página",
  plural: "Páginas",
  feminine: true,
  description:
    "Páginas institucionais. Os marcadores entre chaves duplas, como {{telefone}} e {{freteGratis}}, são trocados pelos dados das configurações da loja.",
  permission: "pages.manage",
  model: "page",
  entityType: "Page",
  tags: ["pages"],
  nameOf: (page) => page.title,
  list: {
    columns: [
      { key: "title", header: "Título" },
      { key: "slug", header: "Endereço" },
      { key: "footer", header: "Rodapé" },
      { key: "status", header: "Situação" },
    ],
    orderBy: { title: "asc" },
    sortable: ["title", "slug"],
    searchPlaceholder: "Título ou endereço",
    where: (params) =>
      params.q
        ? {
            OR: [
              { title: { contains: params.q, mode: "insensitive" } },
              { slug: { contains: params.q.toLowerCase() } },
            ],
          }
        : {},
    row: (page) => ({
      title: page.title,
      slug: muted(`/${page.slug}`),
      footer: page.showInFooter
        ? (footerGroups.find((group) => group.value === page.footerGroup)?.label ?? "Sim")
        : muted("Não"),
      status: yesNoBadge(page.isPublished, "Publicada", "Rascunho"),
    }),
  },
  form: {
    schema: z
      .object({
        title: requiredText("o título", 120),
        slug: slugField(),
        content: z
          .string()
          .max(100_000)
          .transform((html) => sanitizeRichText(html)),
        seoTitle: optionalText(70),
        seoDescription: optionalText(170),
        isPublished: bool(),
        footerGroup: optionalText(40),
      })
      .transform((data) => ({ ...data, showInFooter: Boolean(data.footerGroup) })),
    fields: () => [
      { name: "title", label: "Título", type: "text", wide: true },
      { name: "slug", label: "Endereço (slug)", type: "text", help: "A página fica em /endereço." },
      {
        name: "footerGroup",
        label: "Mostrar no rodapé, no grupo",
        type: "select",
        options: footerGroups,
      },
      { name: "content", label: "Conteúdo", type: "richtext" },
      { name: "isPublished", label: "Publicada", type: "checkbox" },
      {
        name: "seoTitle",
        label: "Título para o Google",
        type: "text",
        maxLength: 60,
        counter: true,
        section: "SEO",
        wide: true,
      },
      {
        name: "seoDescription",
        label: "Descrição para o Google",
        type: "textarea",
        rows: 2,
        maxLength: 155,
        counter: true,
        section: "SEO",
        wide: true,
      },
    ],
    toForm: (page) => ({
      title: page?.title ?? "",
      slug: page?.slug ?? "",
      content: page?.content ?? "",
      seoTitle: page?.seoTitle ?? "",
      seoDescription: page?.seoDescription ?? "",
      isPublished: page?.isPublished ?? true,
      footerGroup: page?.showInFooter ? (page.footerGroup ?? "institucional") : "",
    }),
    seoUrl: (values) => `/${String(values.slug ?? "")}`,
  },
  toggles: [{ field: "isPublished", label: "Publicada" }],
});

// ───────────────────────── FAQ ─────────────────────────

type FaqRecord = Prisma.FaqItemGetPayload<object>;

export const faqResource = defineResource<FaqRecord>({
  key: "ajuda",
  singular: "Pergunta",
  plural: "Ajuda (perguntas frequentes)",
  feminine: true,
  description:
    "Perguntas da central de ajuda, agrupadas por assunto. As respostas aceitam os marcadores das configurações, como {{corte}} e {{descontoPix}}.",
  permission: "pages.manage",
  model: "faqItem",
  entityType: "FaqItem",
  tags: ["pages"],
  nameOf: (item) => item.question,
  list: {
    columns: [
      { key: "question", header: "Pergunta" },
      { key: "group", header: "Grupo" },
    ],
    orderBy: [{ group: "asc" }, { position: "asc" }],
    reorder: true,
    row: (item) => ({ question: item.question, group: muted(item.group) }),
  },
  form: {
    schema: z.object({
      question: requiredText("a pergunta", 200),
      answer: requiredText("a resposta", 3000),
      group: requiredText("o grupo", 60),
      isPublished: bool(),
    }),
    fields: async () => {
      const groups = await db.faqItem.findMany({
        distinct: ["group"],
        select: { group: true },
        orderBy: { group: "asc" },
      });
      return [
        { name: "question", label: "Pergunta", type: "text", wide: true },
        { name: "answer", label: "Resposta", type: "textarea", rows: 5, wide: true },
        {
          name: "group",
          label: "Grupo",
          type: "text",
          help: `Grupos em uso: ${groups.map((item) => item.group).join(", ") || "nenhum"}.`,
        },
        { name: "isPublished", label: "Publicada", type: "checkbox" },
      ];
    },
    toForm: (item) => ({
      question: item?.question ?? "",
      answer: item?.answer ?? "",
      group: item?.group ?? "",
      isPublished: item?.isPublished ?? true,
    }),
  },
  toggles: [{ field: "isPublished", label: "Publicada" }],
});

// ───────────────────────── Seções da home ─────────────────────────

type HomeRecord = Prisma.HomeSectionGetPayload<object>;

const sectionTypeLabels: Record<string, string> = {
  BESTSELLERS: "Mais vendidos",
  NEW_ARRIVALS: "Novidades",
  COLLECTION: "Coleção",
  CATEGORY: "Categoria",
  MANUAL: "Produtos escolhidos",
  FEATURED_CATEGORIES: "Categorias em destaque",
  SECONDARY_CATEGORY: "Categoria secundária (jardinagem)",
  OCCASIONS: "Presentes por ocasião",
  TESTIMONIALS: "Depoimentos",
  BENEFITS: "Benefícios",
  HERITAGE: "História da loja",
  ABOUT: "Sobre",
  NEWSLETTER: "Newsletter",
};
const SECTION_TYPES = Object.keys(sectionTypeLabels) as [string, ...string[]];
const WITH_IMAGE = ["HERITAGE", "ABOUT", "NEWSLETTER"];
const WITH_CATEGORY = ["CATEGORY", "SECONDARY_CATEGORY"];

const homeSchema = z.object({
  type: z.enum(SECTION_TYPES),
  title: optionalText(120),
  subtitle: optionalText(240),
  body: optionalText(2000),
  collectionId: optionalId(),
  categoryId: optionalId(),
  imageId: optionalId(),
  productSkus: tagList(),
  limit: int("a quantidade de produtos", 1, 24),
  isActive: bool(),
});

export const homeResource = defineResource<HomeRecord>({
  key: "home",
  singular: "Seção",
  plural: "Seções da home",
  feminine: true,
  description:
    "Arraste para mudar a ordem das seções da página inicial. O que for salvo aqui aparece na loja na hora.",
  permission: "home.manage",
  model: "homeSection",
  entityType: "HomeSection",
  tags: ["home"],
  nameOf: (section) => section.title || sectionTypeLabels[section.type],
  list: {
    columns: [
      { key: "title", header: "Seção" },
      { key: "type", header: "Fonte" },
    ],
    orderBy: { position: "asc" },
    reorder: true,
    row: (section) => ({
      title: section.title || sectionTypeLabels[section.type],
      type: muted(sectionTypeLabels[section.type]),
    }),
    above: () => (
      <div className="mb-4">
        <Button asChild variant="outline">
          <a href="/" target="_blank" rel="noreferrer">
            Ver prévia da home
          </a>
        </Button>
      </div>
    ),
  },
  form: {
    schema: homeSchema,
    fields: async (section) => [
      {
        name: "type",
        label: "Fonte da seção",
        type: "select",
        options: Object.entries(sectionTypeLabels).map(([value, label]) => ({ value, label })),
        disabled: Boolean(section),
      },
      { name: "title", label: "Título", type: "text" },
      { name: "subtitle", label: "Subtítulo", type: "text", wide: true },
      {
        name: "body",
        label: "Texto",
        type: "textarea",
        rows: 4,
        wide: true,
        showIf: { field: "type", in: ["HERITAGE", "ABOUT", "NEWSLETTER", "BENEFITS"] },
      },
      {
        name: "collectionId",
        label: "Coleção",
        type: "select",
        options: [{ value: "", label: "Escolha" }, ...(await collectionOptions(false))],
        showIf: { field: "type", in: ["COLLECTION"] },
      },
      {
        name: "categoryId",
        label: "Categoria",
        type: "select",
        options: [{ value: "", label: "Escolha" }, ...(await categoryOptions())],
        showIf: { field: "type", in: WITH_CATEGORY },
      },
      {
        name: "imageId",
        label: "Imagem",
        type: "image",
        showIf: { field: "type", in: WITH_IMAGE },
      },
      {
        name: "productSkus",
        label: "Produtos (códigos separados por vírgula, na ordem)",
        type: "tags",
        wide: true,
        showIf: { field: "type", in: ["MANUAL"] },
      },
      {
        name: "limit",
        label: "Quantidade de produtos",
        type: "number",
        showIf: {
          field: "type",
          in: [
            "BESTSELLERS",
            "NEW_ARRIVALS",
            "COLLECTION",
            "CATEGORY",
            "SECONDARY_CATEGORY",
            "MANUAL",
          ],
        },
      },
      { name: "isActive", label: "Ativa", type: "checkbox" },
    ],
    toForm: async (section) => {
      const products = section?.productIds.length
        ? await db.product.findMany({
            where: { id: { in: section.productIds } },
            select: { id: true, sku: true },
          })
        : [];
      const media =
        section && WITH_IMAGE.includes(section.type) && section.sourceId
          ? await db.mediaAsset.findUnique({ where: { id: section.sourceId } })
          : null;
      return {
        type: section?.type ?? "MANUAL",
        title: section?.title ?? "",
        subtitle: section?.subtitle ?? "",
        body: section?.body ?? "",
        collectionId: section?.type === "COLLECTION" ? (section.sourceId ?? "") : "",
        categoryId: section && WITH_CATEGORY.includes(section.type) ? (section.sourceId ?? "") : "",
        imageId: pickedImage(media),
        productSkus:
          section?.productIds
            .map((id) => products.find((product) => product.id === id)?.sku)
            .filter(Boolean)
            .join(", ") ?? "",
        limit: section?.limit ?? 8,
        isActive: section?.isActive ?? true,
      };
    },
    save: async (data: z.output<typeof homeSchema>, _context, existing) => {
      const type = existing?.type ?? data.type;
      const skus = data.productSkus.map((sku) => sku.toUpperCase());
      const products =
        type === "MANUAL" && skus.length
          ? await db.product.findMany({
              where: { sku: { in: skus } },
              select: { id: true, sku: true },
            })
          : [];
      const missing =
        type === "MANUAL"
          ? skus.filter((sku) => !products.some((product) => product.sku === sku))
          : [];
      if (missing.length) throw new AdminError(`Produto não encontrado: ${missing.join(", ")}.`);
      const sourceId =
        type === "COLLECTION"
          ? data.collectionId
          : WITH_CATEGORY.includes(type)
            ? data.categoryId
            : WITH_IMAGE.includes(type)
              ? data.imageId
              : null;
      if ((type === "COLLECTION" || WITH_CATEGORY.includes(type)) && !sourceId)
        throw new AdminError(type === "COLLECTION" ? "Escolha a coleção." : "Escolha a categoria.");
      const fields = {
        title: data.title,
        subtitle: data.subtitle,
        body: data.body,
        sourceId,
        limit: data.limit,
        isActive: data.isActive,
        productIds: skus
          .map((sku) => products.find((product) => product.sku === sku)?.id)
          .filter((id): id is string => Boolean(id)),
      };
      if (existing) return db.homeSection.update({ where: { id: existing.id }, data: fields });
      const last = await db.homeSection.aggregate({ _max: { position: true } });
      return db.homeSection.create({
        data: {
          ...fields,
          type: type as never,
          key: `${type.toLowerCase()}-${Date.now().toString(36)}`,
          position: (last._max.position ?? 0) + 1,
        },
      });
    },
  },
  toggles: [{ field: "isActive", label: "Ativa" }],
});
