import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/metadata";
import { sitemapCount } from "./sitemap";

/** Fora de produção nada é indexado. Em produção ficam de fora as áreas privadas, a busca e os filtros. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (process.env.NODE_ENV !== "production" || process.env.NOINDEX === "true")
    return { rules: { userAgent: "*", disallow: "/" } };
  const count = await sitemapCount();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/conta",
        "/checkout",
        "/carrinho",
        "/pedido",
        "/api",
        "/busca",
        "/entrar",
        "/criar-conta",
        "/dev",
        "/*?preco=",
        "/*?ordem=",
        "/*&ordem=",
        "/*?material=",
        "/*?cor=",
        "/*?luz=",
        "/*?ambiente=",
        "/*?pet=",
        "/*?cuidado=",
        "/*?porte=",
        "/*?marca=",
        "/*?tipo=",
        "/*?avaliacao=",
        "/*?promocao=",
        "/*?entrega-hoje=",
      ],
    },
    sitemap: Array.from({ length: count }, (_, id) => absoluteUrl(`/sitemap/${id}.xml`)),
  };
}
