import type { Metadata } from "next";

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3100").replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${appUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

type PageMetadataInput = {
  /** Sem o nome da loja: o layout raiz acrescenta " | Net Shop Garden". */
  title: string;
  description?: string | null;
  /** Caminho canônico, com query quando ela faz parte da página (paginação). */
  path: string;
  /** Imagem de Open Graph. Sem ela, vale a imagem gerada da rota (opengraph-image). */
  image?: string | null;
  noindex?: boolean;
  /** Usa o título exatamente como veio, sem o sufixo com o nome da loja. */
  absoluteTitle?: boolean;
  type?: "website" | "article";
};

/** Metadados padrão de uma página: título, descrição única, canonical, Open Graph e Twitter Card. */
export function pageMetadata({
  title,
  description,
  path,
  image,
  noindex = false,
  absoluteTitle = false,
  type = "website",
}: PageMetadataInput): Metadata {
  const cleanDescription = description?.replace(/\s+/g, " ").trim().slice(0, 160) || undefined;
  const images = image ? [{ url: absoluteUrl(image) }] : undefined;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description: cleanDescription,
    alternates: { canonical: absoluteUrl(path) },
    robots: noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description: cleanDescription,
      url: absoluteUrl(path),
      type,
      locale: "pt_BR",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: cleanDescription,
      images: images?.map((item) => item.url),
    },
  };
}
