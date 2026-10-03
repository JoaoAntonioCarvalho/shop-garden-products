import type { Metadata } from "next";
import { ContactForm } from "@/components/store/public-forms";
import { WhatsAppButton } from "@/components/store/whatsapp-button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { breadcrumbJsonLd, JsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { getCurrentUser } from "@/lib/session";
import { getStoreSettings } from "@/server/services/settings";

export const metadata: Metadata = pageMetadata({
  title: "Contato",
  description: "Fale com a loja por WhatsApp, e-mail ou pelo formulário.",
  path: "/contato",
});

export default async function ContactPage() {
  const [settings, user] = await Promise.all([getStoreSettings(), getCurrentUser()]);
  const crumbs = [{ label: "Início", href: "/" }, { label: "Contato" }];
  return (
    <div className="container-store py-8 md:py-12">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumb items={crumbs} />
      <div className="mt-6 grid gap-10 lg:grid-cols-[3fr_2fr] lg:gap-16">
        <div>
          <h1 className="type-h1 text-moss-900">Fale com a gente</h1>
          <p className="mt-2 mb-8 measure type-body text-ink">
            Escreva a sua dúvida, pedido ou sugestão. Respondemos por e-mail em até um dia útil.
          </p>
          <ContactForm defaults={user ? { name: user.name, email: user.email } : undefined} />
        </div>
        <aside
          aria-labelledby="outros-canais"
          className="self-start border border-line bg-cream-100 p-6"
        >
          <h2 id="outros-canais" className="type-h3 text-moss-900">
            Outros canais
          </h2>
          <dl className="mt-4 flex flex-col gap-4 type-body text-ink">
            <div>
              <dt className="type-small text-ink-muted">WhatsApp</dt>
              <dd>{settings.phoneDisplay}</dd>
            </div>
            <div>
              <dt className="type-small text-ink-muted">E-mail</dt>
              <dd>
                <a
                  href={`mailto:${settings.email}`}
                  className="text-moss-700 underline underline-offset-4"
                >
                  {settings.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="type-small text-ink-muted">Horário de atendimento</dt>
              <dd>{settings.businessHours}</dd>
            </div>
          </dl>
          <WhatsAppButton
            number={settings.whatsapp}
            message="Olá! Vim pelo site e gostaria de ajuda."
            position="pagina"
            className="mt-6"
          >
            Falar pelo WhatsApp
          </WhatsAppButton>
        </aside>
      </div>
    </div>
  );
}
