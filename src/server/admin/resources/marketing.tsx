import "server-only";
import Image from "next/image";
import Link from "next/link";
import { z } from "zod";
import { CouponBatchForm } from "@/components/admin/coupon-batch-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import type { Prisma } from "@/generated/prisma/client";
import { formatDate, formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatBRL, formatCentsPlain, parseBRLToCents } from "@/lib/money";
import { describeCoupon } from "@/server/services/coupons";
import { AdminError } from "../action";
import {
  bool,
  idList,
  optionalDateTime,
  optionalId,
  optionalInt,
  optionalMoney,
  optionalText,
  requiredText,
  slugField,
  tagList,
  toDateTimeInput,
} from "../fields";
import { toMediaItem } from "../media";
import { categoryOptions } from "../product-queries";
import { defineResource } from "../resource";
import { muted, periodText, pickedImage, yesNoBadge } from "./shared";

// ───────────────────────── Cupons ─────────────────────────

type CouponRecord = Prisma.CouponGetPayload<{
  include: {
    categories: { select: { id: true } };
    products: { select: { id: true; sku: true } };
    _count: { select: { redemptions: true } };
  };
}>;

const couponTypeLabels = {
  PERCENT: "Percentual",
  FIXED: "Valor fixo",
  FREE_SHIPPING: "Frete grátis",
} as const;

const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "O código precisa de pelo menos 3 caracteres.")
      .max(40)
      .transform((value) => value.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9_-]+$/, "Use só letras, números, hífen e sublinhado.")),
    description: optionalText(200),
    type: z.enum(["PERCENT", "FIXED", "FREE_SHIPPING"]),
    value: z.union([z.string(), z.number()]).transform(String),
    minSubtotalCents: optionalMoney(),
    maxDiscountCents: optionalMoney(),
    usageLimit: optionalInt(1),
    perCustomerLimit: optionalInt(1),
    firstPurchaseOnly: bool(),
    combinableWithPix: bool(),
    appliesToSameDay: bool(),
    startsAt: optionalDateTime(),
    endsAt: optionalDateTime(),
    isActive: bool(),
    categoryIds: idList(60),
    productSkus: tagList(),
  })
  .transform((data, context) => {
    let value = 0;
    if (data.type === "PERCENT") {
      value = Number(data.value.replace(",", ".").replace("%", ""));
      if (!Number.isInteger(value) || value < 1 || value > 100)
        context.addIssue({
          code: "custom",
          path: ["value"],
          message: "Informe um percentual inteiro entre 1 e 100.",
        });
    } else if (data.type === "FIXED") {
      value = parseBRLToCents(data.value) ?? 0;
      if (value <= 0)
        context.addIssue({
          code: "custom",
          path: ["value"],
          message: "Informe o valor do desconto em reais.",
        });
    }
    if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt)
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "O fim precisa ser depois do início.",
      });
    return { ...data, value };
  });

type CouponInput = z.output<typeof couponSchema>;

async function couponReport(coupon: CouponRecord) {
  const [paid, recent] = await Promise.all([
    db.order.aggregate({
      where: { couponId: coupon.id, paidAt: { not: null } },
      _count: true,
      _sum: { totalCents: true, discountCents: true },
    }),
    db.order.findMany({
      where: { couponId: coupon.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        number: true,
        customerName: true,
        totalCents: true,
        discountCents: true,
        createdAt: true,
      },
    }),
  ]);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Uso do cupom</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        <dl className="grid gap-3 sm:grid-cols-4">
          {[
            ["Usos registrados", String(coupon.usageCount)],
            ["Pedidos pagos", String(paid._count)],
            ["Faturamento com o cupom", formatBRL(paid._sum.totalCents ?? 0)],
            ["Desconto concedido", formatBRL(paid._sum.discountCents ?? 0)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {recent.length ? (
          <ul className="mt-4 flex flex-col gap-1">
            {recent.map((order) => (
              <li
                key={order.number}
                className="flex flex-wrap justify-between gap-2 border-t border-border pt-1"
              >
                <Link
                  href={`/admin/pedidos/${order.number}`}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {order.number}
                </Link>
                <span>{order.customerName}</span>
                <span className="text-muted-foreground">{formatDate(order.createdAt)}</span>
                <span className="tabular-nums">
                  {formatBRL(order.totalCents)} (desconto de {formatBRL(order.discountCents)})
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-muted-foreground">Nenhum pedido usou este cupom ainda.</p>
        )}
      </CardContent>
    </Card>
  );
}

export const couponResource = defineResource<CouponRecord>({
  key: "cupons",
  singular: "Cupom",
  plural: "Cupons",
  description:
    "O desconto do cupom é calculado no servidor, na sacola e de novo na criação do pedido.",
  permission: "coupons.manage",
  model: "coupon",
  entityType: "Coupon",
  tags: [],
  nameOf: (coupon) => coupon.code,
  include: {
    categories: { select: { id: true } },
    products: { select: { id: true, sku: true } },
    _count: { select: { redemptions: true } },
  },
  list: {
    columns: [
      { key: "code", header: "Código" },
      { key: "rule", header: "Regra" },
      { key: "usageCount", header: "Usos", align: "right" },
      { key: "period", header: "Validade" },
      { key: "status", header: "Situação" },
    ],
    sortable: ["code", "usageCount"],
    orderBy: { createdAt: "desc" },
    searchPlaceholder: "Código ou descrição",
    exportKey: "cupons",
    filters: async () => {
      const batches = await db.coupon.findMany({
        where: { batch: { not: null } },
        distinct: ["batch"],
        select: { batch: true },
      });
      return [
        {
          type: "select",
          name: "situacao",
          label: "Situação",
          options: [
            { value: "ativo", label: "Ativos" },
            { value: "inativo", label: "Inativos" },
            { value: "expirado", label: "Expirados" },
          ],
        },
        ...(batches.length
          ? [
              {
                type: "select" as const,
                name: "lote",
                label: "Lote",
                options: batches.map((item) => ({
                  value: item.batch as string,
                  label: item.batch as string,
                })),
              },
            ]
          : []),
      ];
    },
    where: (params) => ({
      AND: [
        params.q
          ? {
              OR: [
                { code: { contains: params.q.toUpperCase() } },
                { description: { contains: params.q, mode: "insensitive" } },
              ],
            }
          : {},
        params.filters.situacao === "ativo"
          ? { isActive: true, OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] }
          : {},
        params.filters.situacao === "inativo" ? { isActive: false } : {},
        params.filters.situacao === "expirado" ? { endsAt: { lt: new Date() } } : {},
        params.filters.lote ? { batch: params.filters.lote } : {},
      ],
    }),
    row: (coupon) => {
      const expired = coupon.endsAt != null && coupon.endsAt < new Date();
      const exhausted = coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit;
      return {
        code: (
          <>
            {coupon.code}
            {coupon.batch ? (
              <span className="block text-xs font-normal text-muted-foreground">
                Lote {coupon.batch}
              </span>
            ) : null}
          </>
        ),
        rule: describeCoupon(coupon),
        usageCount: coupon.usageLimit
          ? `${coupon.usageCount} de ${coupon.usageLimit}`
          : coupon.usageCount,
        period: muted(periodText(coupon.startsAt, coupon.endsAt)),
        status: yesNoBadge(
          coupon.isActive && !expired && !exhausted,
          "Ativo",
          expired ? "Expirado" : exhausted ? "Esgotado" : "Inativo",
        ),
      };
    },
    above: async () => {
      const coupons = await db.coupon.findMany({
        where: { batch: null },
        orderBy: { code: "asc" },
        select: { id: true, code: true },
      });
      return (
        <CouponBatchForm
          coupons={coupons.map((coupon) => ({ value: coupon.id, label: coupon.code }))}
        />
      );
    },
  },
  form: {
    schema: couponSchema,
    fields: async () => [
      {
        name: "code",
        label: "Código",
        type: "text",
        help: "O cliente digita este código na sacola. Sempre em maiúsculas.",
      },
      { name: "description", label: "Descrição interna", type: "text" },
      {
        name: "type",
        label: "Tipo",
        type: "select",
        options: Object.entries(couponTypeLabels).map(([value, label]) => ({ value, label })),
      },
      {
        name: "value",
        label: "Valor",
        type: "text",
        help: "Percentual (10) ou valor em reais (25,00), conforme o tipo.",
        showIf: { field: "type", in: ["PERCENT", "FIXED"] },
      },
      { name: "minSubtotalCents", label: "Compra mínima (R$)", type: "money", section: "Regras" },
      { name: "maxDiscountCents", label: "Desconto máximo (R$)", type: "money", section: "Regras" },
      { name: "usageLimit", label: "Limite total de usos", type: "number", section: "Regras" },
      { name: "perCustomerLimit", label: "Limite por cliente", type: "number", section: "Regras" },
      { name: "startsAt", label: "Início", type: "datetime", section: "Regras" },
      { name: "endsAt", label: "Fim", type: "datetime", section: "Regras" },
      {
        name: "firstPurchaseOnly",
        label: "Só na primeira compra",
        type: "checkbox",
        section: "Regras",
      },
      {
        name: "combinableWithPix",
        label: "Acumula com o desconto do Pix",
        type: "checkbox",
        section: "Regras",
      },
      {
        name: "appliesToSameDay",
        label: "Frete grátis vale para a entrega hoje",
        type: "checkbox",
        section: "Regras",
        showIf: { field: "type", in: ["FREE_SHIPPING"] },
      },
      { name: "isActive", label: "Ativo", type: "checkbox", section: "Regras" },
      {
        name: "categoryIds",
        label: "Só para estas categorias (vazio vale para todas)",
        type: "checklist",
        options: await categoryOptions(),
        section: "Onde vale",
      },
      {
        name: "productSkus",
        label: "Só para estes produtos (códigos separados por vírgula)",
        type: "tags",
        section: "Onde vale",
        wide: true,
      },
    ],
    toForm: (coupon) => ({
      code: coupon?.code ?? "",
      description: coupon?.description ?? "",
      type: coupon?.type ?? "PERCENT",
      value: coupon
        ? coupon.type === "FIXED"
          ? formatCentsPlain(coupon.value)
          : String(coupon.value)
        : "",
      minSubtotalCents:
        coupon?.minSubtotalCents != null ? formatCentsPlain(coupon.minSubtotalCents) : "",
      maxDiscountCents:
        coupon?.maxDiscountCents != null ? formatCentsPlain(coupon.maxDiscountCents) : "",
      usageLimit: coupon?.usageLimit ?? "",
      perCustomerLimit: coupon?.perCustomerLimit ?? "",
      firstPurchaseOnly: coupon?.firstPurchaseOnly ?? false,
      combinableWithPix: coupon?.combinableWithPix ?? true,
      appliesToSameDay: coupon?.appliesToSameDay ?? false,
      startsAt: toDateTimeInput(coupon?.startsAt),
      endsAt: toDateTimeInput(coupon?.endsAt),
      isActive: coupon?.isActive ?? true,
      categoryIds: coupon?.categories.map((category) => category.id) ?? [],
      productSkus: coupon?.products.map((product) => product.sku).join(", ") ?? "",
    }),
    describe: (values) => {
      const parsed = couponSchema.safeParse(values);
      if (!parsed.success) return "Preencha o código, o tipo e o valor para ver a prévia do cupom.";
      return `Prévia: ${describeCoupon(parsed.data)}.`;
    },
    save: async (data: CouponInput, _context, existing) => {
      const { categoryIds, productSkus, ...fields } = data;
      const products = productSkus.length
        ? await db.product.findMany({
            where: { sku: { in: productSkus.map((sku) => sku.toUpperCase()) } },
            select: { id: true, sku: true },
          })
        : [];
      const missing = productSkus.filter(
        (sku) => !products.some((product) => product.sku === sku.toUpperCase()),
      );
      if (missing.length)
        throw new AdminError(`Produto não encontrado: ${missing.join(", ").toUpperCase()}.`);
      const relations = {
        categories: categoryIds.map((id) => ({ id })),
        products: products.map((product) => ({ id: product.id })),
      };
      return existing
        ? db.coupon.update({
            where: { id: existing.id },
            data: {
              ...fields,
              categories: { set: relations.categories },
              products: { set: relations.products },
            },
          })
        : db.coupon.create({
            data: {
              ...fields,
              categories: { connect: relations.categories },
              products: { connect: relations.products },
            },
          });
    },
    below: couponReport,
  },
  toggles: [{ field: "isActive", label: "Ativo" }],
  blockDelete: async (coupon) =>
    (await db.order.count({ where: { couponId: coupon.id } })) > 0
      ? "Este cupom já foi usado em pedidos. Desative em vez de excluir, para o histórico continuar íntegro."
      : null,
});

// ───────────────────────── Banners ─────────────────────────

type BannerRecord = Prisma.BannerGetPayload<{
  include: { imageDesktop: true; imageMobile: true; category: { select: { name: true } } };
}>;

const placementLabels = {
  HOME_HERO: "Destaque da home",
  HOME_SECONDARY: "Faixa secundária da home",
  CATEGORY_TOP: "Topo de categoria",
  TOP_BAR: "Barra superior",
} as const;
const ctaOptions = [
  { value: "LINK", label: "Link" },
  { value: "WHATSAPP", label: "WhatsApp" },
];

const bannerSchema = z
  .object({
    placement: z.enum(["HOME_HERO", "HOME_SECONDARY", "CATEGORY_TOP", "TOP_BAR"]),
    title: requiredText("o título", 120),
    subtitle: optionalText(240),
    ctaLabel: optionalText(40),
    ctaType: z.enum(["LINK", "WHATSAPP"]),
    ctaUrl: optionalText(300),
    whatsappMessage: optionalText(300),
    secondaryCtaLabel: optionalText(40),
    secondaryCtaType: z.enum(["LINK", "WHATSAPP"]),
    secondaryCtaUrl: optionalText(300),
    secondaryWhatsappMessage: optionalText(300),
    imageDesktopId: optionalId(),
    imageMobileId: optionalId(),
    imageCaption: optionalText(120),
    imageCaptionScientific: optionalText(120),
    categoryId: optionalId(),
    startsAt: optionalDateTime(),
    endsAt: optionalDateTime(),
    utmCampaign: optionalText(80),
    isActive: bool(),
  })
  .superRefine((data, context) => {
    if (
      data.ctaLabel &&
      data.ctaType === "LINK" &&
      !data.ctaUrl?.startsWith("/") &&
      !/^https:\/\//.test(data.ctaUrl ?? "")
    )
      context.addIssue({
        code: "custom",
        path: ["ctaUrl"],
        message: "Informe o link do botão, começando com / ou https://.",
      });
    if (data.placement === "CATEGORY_TOP" && !data.categoryId)
      context.addIssue({
        code: "custom",
        path: ["categoryId"],
        message: "Escolha a categoria do banner.",
      });
    if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt)
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "O fim precisa ser depois do início.",
      });
  });

export const bannerResource = defineResource<BannerRecord>({
  key: "banners",
  singular: "Banner",
  plural: "Banners",
  description:
    "O texto do banner é sempre HTML sobre um painel sólido, nunca texto dentro da imagem. A barra superior usa só o título, com até três mensagens ativas.",
  permission: "banners.manage",
  model: "banner",
  entityType: "Banner",
  tags: ["home", "catalog"],
  nameOf: (banner) => banner.title,
  include: { imageDesktop: true, imageMobile: true, category: { select: { name: true } } },
  list: {
    columns: [
      { key: "title", header: "Título" },
      { key: "placement", header: "Posição" },
      { key: "period", header: "Agendamento" },
    ],
    orderBy: [{ placement: "asc" }, { position: "asc" }],
    reorder: true,
    row: (banner) => ({
      title: (
        <span className="flex items-center gap-3">
          {banner.imageDesktop ? (
            <Image
              src={toMediaItem(banner.imageDesktop).thumb}
              alt=""
              width={64}
              height={40}
              unoptimized
              className="h-10 w-16 rounded-sm object-cover"
            />
          ) : null}
          {banner.title}
        </span>
      ),
      placement: `${placementLabels[banner.placement]}${banner.category ? ` (${banner.category.name})` : ""}`,
      period: muted(periodText(banner.startsAt, banner.endsAt)),
    }),
  },
  form: {
    schema: bannerSchema,
    fields: async () => [
      {
        name: "placement",
        label: "Posição",
        type: "select",
        options: Object.entries(placementLabels).map(([value, label]) => ({ value, label })),
      },
      {
        name: "categoryId",
        label: "Categoria",
        type: "select",
        options: [{ value: "", label: "Escolha" }, ...(await categoryOptions())],
        showIf: { field: "placement", in: ["CATEGORY_TOP"] },
      },
      { name: "title", label: "Título", type: "text", maxLength: 120, counter: true, wide: true },
      {
        name: "subtitle",
        label: "Subtítulo",
        type: "textarea",
        rows: 2,
        maxLength: 240,
        counter: true,
        wide: true,
      },
      { name: "ctaLabel", label: "Texto do botão", type: "text", section: "Botão principal" },
      {
        name: "ctaType",
        label: "O botão abre",
        type: "select",
        options: ctaOptions,
        section: "Botão principal",
      },
      {
        name: "ctaUrl",
        label: "Link",
        type: "text",
        placeholder: "/categoria/plantas-naturais/orquideas",
        section: "Botão principal",
        showIf: { field: "ctaType", in: ["LINK"] },
      },
      {
        name: "whatsappMessage",
        label: "Mensagem do WhatsApp",
        type: "text",
        section: "Botão principal",
        showIf: { field: "ctaType", in: ["WHATSAPP"] },
      },
      {
        name: "secondaryCtaLabel",
        label: "Texto do botão",
        type: "text",
        section: "Segundo botão (opcional)",
      },
      {
        name: "secondaryCtaType",
        label: "O botão abre",
        type: "select",
        options: ctaOptions,
        section: "Segundo botão (opcional)",
      },
      {
        name: "secondaryCtaUrl",
        label: "Link",
        type: "text",
        section: "Segundo botão (opcional)",
        showIf: { field: "secondaryCtaType", in: ["LINK"] },
      },
      {
        name: "secondaryWhatsappMessage",
        label: "Mensagem do WhatsApp",
        type: "text",
        section: "Segundo botão (opcional)",
        showIf: { field: "secondaryCtaType", in: ["WHATSAPP"] },
      },
      {
        name: "imageDesktopId",
        label: "Imagem para computador (2400 × 1050)",
        type: "image",
        section: "Imagens",
      },
      {
        name: "imageMobileId",
        label: "Imagem para celular (1200 × 1500)",
        type: "image",
        section: "Imagens",
      },
      {
        name: "imageCaption",
        label: "Legenda botânica (nome popular)",
        type: "text",
        section: "Imagens",
      },
      {
        name: "imageCaptionScientific",
        label: "Legenda botânica (nome científico)",
        type: "text",
        section: "Imagens",
      },
      { name: "startsAt", label: "Aparece a partir de", type: "datetime", section: "Agendamento" },
      { name: "endsAt", label: "Aparece até", type: "datetime", section: "Agendamento" },
      {
        name: "utmCampaign",
        label: "Campanha (utm_campaign nos links)",
        type: "text",
        section: "Agendamento",
      },
      { name: "isActive", label: "Ativo", type: "checkbox", section: "Agendamento" },
    ],
    toForm: (banner) => ({
      placement: banner?.placement ?? "HOME_HERO",
      categoryId: banner?.categoryId ?? "",
      title: banner?.title ?? "",
      subtitle: banner?.subtitle ?? "",
      ctaLabel: banner?.ctaLabel ?? "",
      ctaType: banner?.ctaType ?? "LINK",
      ctaUrl: banner?.ctaUrl ?? "",
      whatsappMessage: banner?.whatsappMessage ?? "",
      secondaryCtaLabel: banner?.secondaryCtaLabel ?? "",
      secondaryCtaType: banner?.secondaryCtaType ?? "LINK",
      secondaryCtaUrl: banner?.secondaryCtaUrl ?? "",
      secondaryWhatsappMessage: banner?.secondaryWhatsappMessage ?? "",
      imageDesktopId: pickedImage(banner?.imageDesktop),
      imageMobileId: pickedImage(banner?.imageMobile),
      imageCaption: banner?.imageCaption ?? "",
      imageCaptionScientific: banner?.imageCaptionScientific ?? "",
      startsAt: toDateTimeInput(banner?.startsAt),
      endsAt: toDateTimeInput(banner?.endsAt),
      utmCampaign: banner?.utmCampaign ?? "",
      isActive: banner?.isActive ?? true,
    }),
    livePreview: "banner",
    below: (banner) => (
      <p className="text-xs text-muted-foreground">
        {periodText(banner.startsAt, banner.endsAt)}. Última alteração em{" "}
        {formatDateTime(banner.updatedAt)}.
      </p>
    ),
  },
  toggles: [{ field: "isActive", label: "Ativo" }],
});

// ───────────────────────── Depoimentos ─────────────────────────

type TestimonialRecord = Prisma.TestimonialGetPayload<object>;

export const testimonialResource = defineResource<TestimonialRecord>({
  key: "depoimentos",
  singular: "Depoimento",
  plural: "Depoimentos",
  description:
    "Depoimentos gerais sobre a loja, mostrados na home. Use só o primeiro nome e a inicial do sobrenome.",
  permission: "reviews.manage",
  model: "testimonial",
  entityType: "Testimonial",
  tags: ["home"],
  nameOf: (item) => `Depoimento de ${item.authorName}`,
  list: {
    columns: [
      { key: "authorName", header: "Autor" },
      { key: "body", header: "Texto" },
      { key: "rating", header: "Nota" },
    ],
    orderBy: { position: "asc" },
    reorder: true,
    row: (item) => ({
      authorName: `${item.authorName}${item.authorCity ? `, ${item.authorCity}` : ""}`,
      body: <span className="line-clamp-2 max-w-xl text-muted-foreground">{item.body}</span>,
      rating: `${item.rating} de 5`,
    }),
  },
  form: {
    schema: z.object({
      authorName: requiredText("o nome", 80),
      authorCity: optionalText(80),
      rating: z.coerce.number().int().min(1).max(5),
      body: requiredText("o texto do depoimento", 600),
      source: z.string().trim().max(40).default("site"),
      isPublished: bool(),
    }),
    fields: () => [
      { name: "authorName", label: "Nome (primeiro nome e inicial)", type: "text" },
      { name: "authorCity", label: "Cidade", type: "text" },
      {
        name: "rating",
        label: "Nota",
        type: "select",
        options: [5, 4, 3, 2, 1].map((value) => ({ value: String(value), label: `${value} de 5` })),
      },
      { name: "source", label: "Origem", type: "text", help: "Por exemplo: site, WhatsApp, loja." },
      {
        name: "body",
        label: "Depoimento",
        type: "textarea",
        rows: 4,
        maxLength: 600,
        counter: true,
        wide: true,
      },
      { name: "isPublished", label: "Publicado", type: "checkbox" },
    ],
    toForm: (item) => ({
      authorName: item?.authorName ?? "",
      authorCity: item?.authorCity ?? "",
      rating: String(item?.rating ?? 5),
      body: item?.body ?? "",
      source: item?.source ?? "site",
      isPublished: item?.isPublished ?? true,
    }),
  },
  toggles: [{ field: "isPublished", label: "Publicado" }],
});

// ───────────────────────── Ocasiões ─────────────────────────

type OccasionRecord = Prisma.OccasionGetPayload<{ include: { image: true } }>;

export const occasionResource = defineResource<OccasionRecord>({
  key: "ocasioes",
  singular: "Ocasião",
  plural: "Ocasiões",
  feminine: true,
  description:
    "Ocasiões de presente (aniversário, casa nova...). Cada uma mostra os produtos presenteáveis que têm a tag indicada.",
  permission: "home.manage",
  model: "occasion",
  entityType: "Occasion",
  tags: ["home", "catalog"],
  nameOf: (item) => item.name,
  include: { image: true },
  list: {
    columns: [
      { key: "name", header: "Nome" },
      { key: "tag", header: "Tag dos produtos" },
    ],
    orderBy: { position: "asc" },
    reorder: true,
    row: (item) => ({ name: item.name, tag: muted(item.tag) }),
  },
  form: {
    schema: z.object({
      name: requiredText("o nome", 80),
      slug: slugField(),
      description: optionalText(200),
      imageId: optionalId(),
      tag: requiredText("a tag", 40).transform((value) => value.toLowerCase()),
      isActive: bool(),
    }),
    fields: () => [
      { name: "name", label: "Nome", type: "text" },
      {
        name: "slug",
        label: "Endereço (slug)",
        type: "text",
        help: "A página fica em /presentes/endereço.",
      },
      {
        name: "tag",
        label: "Tag dos produtos",
        type: "text",
        help: "Produtos com esta tag e marcados como bons para presente aparecem na ocasião.",
      },
      {
        name: "description",
        label: "Descrição",
        type: "textarea",
        rows: 2,
        maxLength: 200,
        counter: true,
      },
      { name: "imageId", label: "Imagem", type: "image" },
      { name: "isActive", label: "Ativa", type: "checkbox" },
    ],
    toForm: (item) => ({
      name: item?.name ?? "",
      slug: item?.slug ?? "",
      description: item?.description ?? "",
      imageId: pickedImage(item?.image),
      tag: item?.tag ?? "",
      isActive: item?.isActive ?? true,
    }),
  },
  toggles: [{ field: "isActive", label: "Ativa" }],
});
