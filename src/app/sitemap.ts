import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/seo/metadata";

const CHUNK = 5000;
const STATIC_PATHS = [
  "/",
  "/presentes",
  "/ajuda",
  "/contato",
  "/avaliacoes",
  "/solicitar-produto",
  "/rastreio",
];

type Entry = { path: string; lastModified?: Date; priority: number };

/** Todas as URLs públicas, das mais importantes para as menos. */
async function allEntries(): Promise<Entry[]> {
  const [categories, collections, occasions, pages, products] = await Promise.all([
    db.category.findMany({ where: { isActive: true }, select: { path: true, updatedAt: true } }),
    db.collection.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
    db.occasion.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
    db.page.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
    db.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: { publishedAt: "desc" },
      select: { slug: true, updatedAt: true },
    }),
  ]);
  return [
    ...STATIC_PATHS.map((path) => ({ path, priority: path === "/" ? 1 : 0.5 })),
    ...categories.map((item) => ({
      path: `/categoria/${item.path}`,
      lastModified: item.updatedAt,
      priority: 0.8,
    })),
    ...collections.map((item) => ({
      path: `/colecao/${item.slug}`,
      lastModified: item.updatedAt,
      priority: 0.7,
    })),
    ...occasions.map((item) => ({
      path: `/presentes/${item.slug}`,
      lastModified: item.updatedAt,
      priority: 0.6,
    })),
    ...pages.map((item) => ({
      path: `/${item.slug}`,
      lastModified: item.updatedAt,
      priority: 0.4,
    })),
    ...products.map((item) => ({
      path: `/produto/${item.slug}`,
      lastModified: item.updatedAt,
      priority: 0.7,
    })),
  ];
}

export async function sitemapCount(): Promise<number> {
  const [products, others] = await Promise.all([
    db.product.count({ where: { status: "ACTIVE" } }),
    db.category.count({ where: { isActive: true } }),
  ]);
  return Math.max(1, Math.ceil((products + others + 60) / CHUNK));
}

/** O sitemap é dividido em arquivos de 5.000 URLs: /sitemap/0.xml, /sitemap/1.xml... */
export async function generateSitemaps() {
  return Array.from({ length: await sitemapCount() }, (_, id) => ({ id }));
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id) || 0;
  const entries = await allEntries();
  return entries.slice(id * CHUNK, (id + 1) * CHUNK).map((entry) => ({
    url: absoluteUrl(entry.path),
    lastModified: entry.lastModified,
    priority: entry.priority,
  }));
}
