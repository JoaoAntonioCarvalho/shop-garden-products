import type { Metadata } from "next";
import Link from "next/link";
import { FaqSearch } from "@/components/store/faq-search";
import { WhatsAppButton } from "@/components/store/whatsapp-button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { buttonClasses } from "@/components/ui/button";
import { breadcrumbJsonLd, faqJsonLd, JsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { renderTokens } from "@/lib/template";
import { getFaq } from "@/server/services/content";
import { getStoreSettings } from "@/server/services/settings";

export const metadata: Metadata = pageMetadata({
  title: "Ajuda",
  description: "Respostas sobre pedidos, entrega, pagamento, trocas e cuidados com plantas.",
  path: "/ajuda",
});

/** Ordem dos grupos na página; os que não estão na lista vêm depois, em ordem alfabética. */
const GROUP_ORDER = ["Pedidos", "Entrega", "Pagamento", "Trocas", "Cuidados com plantas"];

export default async function HelpPage() {
  const [faq, settings] = await Promise.all([getFaq(), getStoreSettings()]);
  const items = faq.map((item) => ({
    ...item,
    question: renderTokens(item.question, settings),
    answer: renderTokens(item.answer, settings),
  }));
  const names = [...new Set(items.map((item) => item.group))].sort(
    (a, b) =>
      (GROUP_ORDER.indexOf(a) + 1 || 99) - (GROUP_ORDER.indexOf(b) + 1 || 99) ||
      a.localeCompare(b, "pt-BR"),
  );
  const crumbs = [{ label: "Início", href: "/" }, { label: "Ajuda" }];
  return (
    <div className="container-store py-8 md:py-12">
      <JsonLd data={[breadcrumbJsonLd(crumbs), faqJsonLd(items)]} />
      <Breadcrumb items={crumbs} />
      <h1 className="mt-6 type-h1 text-moss-900">Como podemos ajudar?</h1>
      <p className="mt-2 mb-6 measure type-body text-ink">
        Reunimos aqui as dúvidas mais comuns. Se a sua não estiver na lista, fale com a gente.
      </p>
      <FaqSearch
        groups={names.map((name) => ({ name, items: items.filter((item) => item.group === name) }))}
      />
      <section aria-labelledby="ajuda-contato" className="mt-12 border-t border-line pt-8">
        <h2 id="ajuda-contato" className="type-h2 text-moss-900">
          Não encontrou a resposta?
        </h2>
        <p className="mt-2 type-body text-ink">
          Atendemos{" "}
          {settings.businessHours.charAt(0).toLowerCase() + settings.businessHours.slice(1)}.
        </p>
        <p className="mt-4 flex flex-wrap gap-3">
          <WhatsAppButton
            number={settings.whatsapp}
            message="Olá! Vim pela página de ajuda e tenho uma dúvida."
            position="pagina"
          >
            Falar pelo WhatsApp
          </WhatsAppButton>
          <Link href="/contato" className={buttonClasses("secondary")}>
            Enviar uma mensagem
          </Link>
          <Link href="/rastreio" className={buttonClasses("ghost")}>
            Rastrear um pedido
          </Link>
        </p>
      </section>
    </div>
  );
}
