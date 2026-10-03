import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichText } from "@/components/store/rich-text";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { buttonClasses } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { breadcrumbJsonLd, JsonLd, storeJsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { stripHtml } from "@/lib/sanitize";
import { renderTokens } from "@/lib/template";
import { getPage } from "@/server/services/content";
import { getStoreSettings } from "@/server/services/settings";

type Props = PageProps<"/[pagina]">;

/** Páginas com texto jurídico de modelo, que o dono precisa revisar com um advogado. */
const LEGAL = new Set(["privacidade", "cookies", "termos", "trocas-e-devolucoes"]);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pagina } = await params;
  const [page, settings] = await Promise.all([getPage(pagina), getStoreSettings()]);
  if (!page) return {};
  return pageMetadata({
    title: page.seoTitle || page.title,
    description: page.seoDescription || stripHtml(renderTokens(page.content, settings)),
    path: `/${page.slug}`,
  });
}

/** Páginas institucionais (Sobre, Entrega, Trocas, Pagamentos, Privacidade, Cookies, Termos e as criadas no painel). */
export default async function InstitutionalPage({ params }: Props) {
  const { pagina } = await params;
  const [page, settings] = await Promise.all([getPage(pagina), getStoreSettings()]);
  if (!page) notFound();
  const crumbs = [{ label: "Início", href: "/" }, { label: page.title }];
  return (
    <div className="container-store py-8 md:py-12">
      <JsonLd
        data={
          page.slug === "sobre"
            ? [breadcrumbJsonLd(crumbs), storeJsonLd(settings)]
            : breadcrumbJsonLd(crumbs)
        }
      />
      <Breadcrumb items={crumbs} />
      <article className="mt-6 measure">
        <h1 className="type-h1 text-moss-900">{page.title}</h1>
        <RichText html={page.content} settings={settings} className="mt-6" />
        <p className="mt-8 type-caption text-ink-muted">
          Atualizado em {formatDate(page.updatedAt)}.
          {LEGAL.has(page.slug) ? " Em caso de dúvida sobre este texto, fale com a gente." : ""}
        </p>
        <p className="mt-6 flex flex-wrap gap-3">
          <Link href="/contato" className={buttonClasses("secondary")}>
            Falar com a loja
          </Link>
          <Link href="/ajuda" className={buttonClasses("ghost")}>
            Ver a central de ajuda
          </Link>
        </p>
      </article>
    </div>
  );
}
