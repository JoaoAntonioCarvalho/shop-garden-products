import { Lock } from "lucide-react";
import Link from "next/link";
import { AnalyticsScripts, CookieBanner } from "@/components/store/cookie-consent";
import { Logo } from "@/components/store/logo";
import { WhatsAppButton } from "@/components/store/whatsapp-button";
import { Toaster } from "@/components/ui/toast";
import { getStoreSettings } from "@/server/services/settings";

/** Layout simplificado do checkout e da confirmação: sem menu e sem rodapé completo, para reduzir distrações. */
export default async function CheckoutLayout({ children }: LayoutProps<"/">) {
  const settings = await getStoreSettings();
  return (
    <div className="flex min-h-dvh flex-col bg-cream-100">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-control bg-white px-4 py-3 text-moss-700 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      <header className="border-b border-line bg-cream-50">
        <div className="container-store flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label={`${settings.name}, página inicial`}>
            <Logo name={settings.name} />
          </Link>
          <div className="flex items-center gap-2 md:gap-6">
            <p className="flex items-center gap-2 type-small text-ink-muted">
              <Lock aria-hidden="true" strokeWidth={1.5} className="size-4" />
              <span className="max-sm:sr-only">Compra segura</span>
            </p>
            <WhatsAppButton
              number={settings.whatsapp}
              message="Olá! Estou finalizando uma compra e tenho uma dúvida."
              position="checkout"
              variant="ghost"
              size="sm"
            >
              Ajuda
            </WhatsAppButton>
          </div>
        </div>
      </header>
      <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <footer className="border-t border-line py-6">
        <p className="container-store type-caption text-ink-muted">
          {settings.legalName}, CNPJ {settings.cnpj}. {settings.address}.
        </p>
      </footer>
      <Toaster />
      <CookieBanner />
      <AnalyticsScripts
        ga4Id={settings.analytics.ga4Id}
        metaPixelId={settings.analytics.metaPixelId}
      />
    </div>
  );
}
