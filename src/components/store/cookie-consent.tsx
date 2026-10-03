"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import {
  CONSENT_COOKIE,
  CONSENT_EVENT,
  CONSENT_MAX_AGE_SECONDS,
  OPEN_PREFERENCES_EVENT,
  readConsent,
  serializeConsent,
  type Consent,
} from "@/lib/consent";

function subscribe(listener: () => void) {
  window.addEventListener(CONSENT_EVENT, listener);
  return () => window.removeEventListener(CONSENT_EVENT, listener);
}
// O valor é comparado como texto para o React não ver um objeto novo a cada leitura.
const snapshot = () => JSON.stringify(readConsent());

/** Consentimento atual. Null no servidor e antes de a pessoa escolher. */
export function useConsent(): Consent | null {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "null");
  return JSON.parse(raw) as Consent | null;
}

function saveConsent(consent: Consent) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${serializeConsent(consent)}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/** Barra de cookies: aceitar todos, recusar os opcionais ou personalizar. A escolha vale 12 meses. */
export function CookieBanner() {
  const consent = useConsent();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    // A barra só aparece depois de ler o cookie no navegador, para não piscar para quem já escolheu.
    const frame = requestAnimationFrame(() => setMounted(true));
    const openPreferences = () => {
      const current = readConsent();
      setAnalytics(current?.analytics ?? false);
      setMarketing(current?.marketing ?? false);
      setOpen(true);
    };
    window.addEventListener(OPEN_PREFERENCES_EVENT, openPreferences);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(OPEN_PREFERENCES_EVENT, openPreferences);
    };
  }, []);

  const choose = (value: Consent) => {
    saveConsent(value);
    setOpen(false);
  };

  return (
    <>
      {mounted && !consent && !open ? (
        <section
          aria-label="Uso de cookies"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white p-4 shadow-overlay print:hidden"
        >
          <div className="container-store flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="type-small text-ink">
              Usamos cookies necessários para a loja funcionar e, com a sua permissão, cookies de
              análise e de marketing.{" "}
              <Link href="/cookies" className="text-moss-700 underline underline-offset-4">
                Política de cookies
              </Link>
            </p>
            <div className="flex flex-wrap gap-2">
              {/* Aceitar e recusar têm o mesmo peso visual: a escolha é do visitante. */}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => choose({ analytics: true, marketing: true })}
              >
                Aceitar todos
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => choose({ analytics: false, marketing: false })}
              >
                Recusar opcionais
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT))}
              >
                Personalizar
              </Button>
            </div>
          </div>
        </section>
      ) : null}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Preferências de cookies"
        description="Escolha o que a loja pode usar neste navegador. Você pode mudar quando quiser, pelo link no rodapé."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => choose({ analytics: false, marketing: false })}
            >
              Recusar opcionais
            </Button>
            <Button onClick={() => choose({ analytics, marketing })}>Salvar preferências</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Checkbox
            checked
            disabled
            readOnly
            label="Necessários"
            description="Sacola, login e segurança. Sem eles a loja não funciona, por isso ficam sempre ligados."
          />
          <Checkbox
            checked={analytics}
            onChange={(event) => setAnalytics(event.target.checked)}
            label="Análise"
            description="Mostram como a loja é usada, para melhorarmos as páginas. Google Analytics."
          />
          <Checkbox
            checked={marketing}
            onChange={(event) => setMarketing(event.target.checked)}
            label="Marketing"
            description="Medem o resultado de anúncios e permitem mostrar ofertas em outros sites. Pixel da Meta."
          />
        </div>
      </Dialog>
    </>
  );
}

/** Link do rodapé que reabre as preferências. */
export function CookiePreferencesButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT))}
      className="min-h-11 text-left underline underline-offset-4 hover:no-underline"
    >
      Preferências de cookies
    </button>
  );
}

/**
 * Scripts de terceiros. Só são carregados depois do consentimento da categoria correspondente:
 * sem consentimento, nenhum pedido sai para o Google ou para a Meta.
 */
export function AnalyticsScripts({ ga4Id, metaPixelId }: { ga4Id: string; metaPixelId: string }) {
  const consent = useConsent();
  return (
    <>
      {consent?.analytics && ga4Id ? (
        <>
          <Script
            id="ga4-lib"
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config',${JSON.stringify(ga4Id)},{anonymize_ip:true});`}
          </Script>
        </>
      ) : null}
      {consent?.marketing && metaPixelId ? (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(metaPixelId)});fbq('track','PageView');`}
        </Script>
      ) : null}
    </>
  );
}
