import { Clock, Mail } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  footerHelpLinks,
  footerInstitutionalLinks,
  type NavLink,
  type StoreNavigation,
} from "@/config/navigation";
import type { StoreSettings } from "@/config/store.config";
import { PaymentIcon, paymentMethods } from "./icons";
import { Logo } from "./logo";
import { NewsletterForm, type LeadFormInput, type LeadFormResult } from "./newsletter-form";
import { WhatsAppButton } from "./whatsapp-button";

const linkClass =
  "flex min-h-11 items-center text-[15px] text-cream-50 underline-offset-3 hover:underline md:min-h-9";

function FooterColumn({
  title,
  links,
  children,
}: {
  title: string;
  links?: NavLink[];
  children?: ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-2 font-serif text-[22px] font-medium text-cream-50">{title}</h2>
      {links ? (
        <ul>
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={linkClass}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {children}
    </div>
  );
}

type FooterProps = {
  settings: StoreSettings;
  navigation: StoreNavigation;
  /** Páginas institucionais marcadas para o rodapé no admin; na falta, usa a lista padrão. */
  institutionalLinks?: NavLink[];
  helpLinks?: NavLink[];
  subscribe?: (input: LeadFormInput) => Promise<LeadFormResult>;
  /** Botão que reabre o painel de consentimento de cookies (fase 7). */
  cookiePreferences?: ReactNode;
  /** Esconde o bloco de newsletter para quem já se cadastrou. */
  hideNewsletter?: boolean;
};

export function Footer({
  settings,
  navigation,
  institutionalLinks = footerInstitutionalLinks,
  helpLinks = footerHelpLinks,
  subscribe,
  cookiePreferences,
  hideNewsletter = false,
}: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="on-dark mt-auto bg-moss-700 text-cream-50">
      {hideNewsletter ? null : (
        <div className="border-b border-cream-50/25">
          <div className="container-store grid gap-6 py-12 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
            <div>
              <h2 className="type-h2 text-cream-50">
                Receba novidades e {settings.welcomeCouponPercent}% na primeira compra
              </h2>
              <p className="mt-2 type-body text-cream-50">
                Lançamentos, cuidados com plantas e ofertas, sem excesso de e-mails.
              </p>
            </div>
            <NewsletterForm
              submit={subscribe}
              source="FOOTER"
              storeName={settings.name}
              discountPercent={settings.welcomeCouponPercent}
              tone="dark"
            />
          </div>
        </div>
      )}

      <div className="container-store grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <FooterColumn title="Loja" links={navigation.categories} />
        <FooterColumn title="Ajuda" links={helpLinks} />
        <FooterColumn title="Institucional" links={institutionalLinks} />
        <FooterColumn title="Atendimento">
          <div className="mt-1 flex flex-col gap-3">
            <WhatsAppButton
              number={settings.whatsapp}
              message="Olá! Vim pelo site e gostaria de ajuda."
              position="pagina"
              variant="secondary"
              className="self-start border-cream-50 text-cream-50 hover:bg-moss-900"
            >
              {settings.phoneDisplay}
            </WhatsAppButton>
            <a href={`mailto:${settings.email}`} className={`${linkClass} gap-2 break-all`}>
              <Mail aria-hidden="true" strokeWidth={1.5} className="size-4 flex-none" />
              {settings.email}
            </a>
            <p className="flex items-start gap-2 text-[15px]">
              <Clock aria-hidden="true" strokeWidth={1.5} className="mt-1 size-4 flex-none" />
              {settings.businessHours}
            </p>
            {settings.instagram ? (
              <a
                href={settings.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                Instagram
              </a>
            ) : null}
          </div>
        </FooterColumn>
      </div>

      <div className="container-store">
        <div className="flex flex-col gap-3 border-t border-cream-50/25 py-6 md:flex-row md:items-center md:justify-between">
          <h2 className="type-small">Formas de pagamento</h2>
          <ul className="flex flex-wrap gap-2">
            {paymentMethods.map((method) => (
              <li key={method}>
                <PaymentIcon method={method} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-moss-900">
        <div className="container-store flex flex-col gap-4 pt-8 pb-24 lg:flex-row lg:items-end lg:justify-between lg:pb-8">
          <div className="flex flex-col gap-3">
            <Logo name={settings.name} tone="cream" />
            <p className="max-w-2xl type-caption text-cream-50">
              {settings.legalName}, CNPJ {settings.cnpj}. {settings.address}.
            </p>
            <p className="type-caption text-cream-50">{settings.partnerClaim}.</p>
          </div>
          <div className="flex flex-col gap-1 type-caption text-cream-50 lg:items-end">
            {cookiePreferences}
            <p>
              © {year} {settings.name}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
