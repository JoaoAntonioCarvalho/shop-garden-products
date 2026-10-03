import "server-only";
import { unstable_cache } from "next/cache";
import type { StoreSettings } from "@/config/store.config";
import type { BannerPlacement } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { renderTokens } from "@/lib/template";
import { HOME_TAG, toImage } from "./catalog";

export const PAGES_TAG = "pages";

const mediaSelect = { alt: true, blurDataUrl: true, variants: true } as const;

const loadBanners = unstable_cache(
  async () => {
    const rows = await db.banner.findMany({
      where: { isActive: true },
      orderBy: [{ placement: "asc" }, { position: "asc" }],
      include: { imageDesktop: { select: mediaSelect }, imageMobile: { select: mediaSelect } },
    });
    return rows.map((row) => ({
      id: row.id,
      placement: row.placement,
      title: row.title,
      subtitle: row.subtitle,
      ctaLabel: row.ctaLabel,
      ctaUrl: row.ctaUrl,
      ctaType: row.ctaType,
      whatsappMessage: row.whatsappMessage,
      secondaryCtaLabel: row.secondaryCtaLabel,
      secondaryCtaUrl: row.secondaryCtaUrl,
      secondaryCtaType: row.secondaryCtaType,
      secondaryWhatsappMessage: row.secondaryWhatsappMessage,
      imageDesktop: toImage(row.imageDesktop),
      imageMobile: toImage(row.imageMobile),
      imageCaption: row.imageCaption,
      imageCaptionScientific: row.imageCaptionScientific,
      categoryId: row.categoryId,
      startsAt: row.startsAt?.toISOString() ?? null,
      endsAt: row.endsAt?.toISOString() ?? null,
      utmCampaign: row.utmCampaign,
    }));
  },
  ["banners"],
  { tags: [HOME_TAG] },
);

export type BannerData = Awaited<ReturnType<typeof loadBanners>>[number];

/** Banners ativos de uma posição, dentro do período agendado, com os {{marcadores}} preenchidos. */
export async function getBanners(
  placement: BannerPlacement,
  settings: StoreSettings,
  categoryId?: string,
): Promise<BannerData[]> {
  const now = Date.now();
  return (await loadBanners())
    .filter(
      (banner) =>
        banner.placement === placement &&
        (categoryId === undefined || banner.categoryId === categoryId) &&
        (!banner.startsAt || Date.parse(banner.startsAt) <= now) &&
        (!banner.endsAt || Date.parse(banner.endsAt) >= now),
    )
    .map((banner) => ({
      ...banner,
      title: renderTokens(banner.title, settings),
      subtitle: banner.subtitle ? renderTokens(banner.subtitle, settings) : null,
    }));
}

const loadHomeSections = unstable_cache(
  async () =>
    db.homeSection.findMany({
      where: { isActive: true },
      orderBy: { position: "asc" },
      select: {
        id: true,
        key: true,
        type: true,
        title: true,
        subtitle: true,
        body: true,
        sourceId: true,
        productIds: true,
        limit: true,
      },
    }),
  ["home-sections"],
  { tags: [HOME_TAG] },
);

export async function getHomeSections() {
  return loadHomeSections();
}

const loadTestimonials = unstable_cache(
  async () =>
    db.testimonial.findMany({
      where: { isPublished: true },
      orderBy: { position: "asc" },
      select: {
        id: true,
        authorName: true,
        authorCity: true,
        rating: true,
        body: true,
        source: true,
      },
    }),
  ["testimonials"],
  { tags: [HOME_TAG] },
);

export async function getTestimonials() {
  return loadTestimonials();
}

const loadPage = unstable_cache(
  async (slug: string) =>
    db.page.findFirst({
      where: { slug, isPublished: true },
      select: {
        slug: true,
        title: true,
        content: true,
        seoTitle: true,
        seoDescription: true,
        updatedAt: true,
      },
    }),
  ["page"],
  { tags: [PAGES_TAG] },
);

export async function getPage(slug: string) {
  const page = await loadPage(slug);
  // O cache devolve datas como texto.
  return page ? { ...page, updatedAt: new Date(page.updatedAt) } : null;
}

const loadFaq = unstable_cache(
  async () =>
    db.faqItem.findMany({
      where: { isPublished: true },
      orderBy: [{ group: "asc" }, { position: "asc" }],
      select: { id: true, question: true, answer: true, group: true },
    }),
  ["faq"],
  { tags: [PAGES_TAG] },
);

export async function getFaq() {
  return loadFaq();
}

/** Imagem de um MediaAsset pelo id (seções da home guardam o id em sourceId). */
export const getMediaImage = unstable_cache(
  async (id: string) =>
    toImage(await db.mediaAsset.findUnique({ where: { id }, select: mediaSelect })),
  ["media-image"],
  { tags: [HOME_TAG] },
);

/** Foto do pop-up de boas-vindas: a mesma da seção de newsletter da home. */
export const getPopupImage = unstable_cache(
  async () => {
    const section = await db.homeSection.findUnique({
      where: { key: "newsletter" },
      select: { sourceId: true },
    });
    if (!section?.sourceId) return null;
    return toImage(
      await db.mediaAsset.findUnique({ where: { id: section.sourceId }, select: mediaSelect }),
    );
  },
  ["popup-image"],
  { tags: [HOME_TAG] },
);
