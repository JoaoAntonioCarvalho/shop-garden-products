"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Dialog, Drawer } from "@/components/ui/dialog";
import { NewsletterForm, type LeadFormInput, type LeadFormResult } from "./newsletter-form";

const STORAGE_KEY = "nsg_popup_seen";
const SESSION_KEY = "nsg_popup_session";
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
const DELAY_MS = 25_000;

/** O pop-up nunca aparece onde atrapalharia: compra em andamento, conta e páginas institucionais. */
const BLOCKED =
  /^\/(checkout|carrinho|pedido|conta|entrar|criar-conta|esqueci-a-senha|redefinir-senha|verificar-email|rastreio|sobre|entrega|trocas-e-devolucoes|pagamentos|ajuda|contato|avaliacoes|solicitar-produto|privacidade|cookies|termos|newsletter|descadastrar|admin|dev)(\/|$)/;

function alreadySeen(): boolean {
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return true;
    const last = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(last) && last > 0 && Date.now() - last < FOURTEEN_DAYS;
  } catch {
    // Sem armazenamento (modo restrito), é melhor não mostrar do que mostrar a cada página.
    return true;
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // nada a fazer
  }
}

type WelcomePopupProps = {
  subscribe: (input: LeadFormInput) => Promise<LeadFormResult>;
  storeName: string;
  discountPercent: number;
  image: { url: string; alt: string; blurDataUrl?: string | null } | null;
};

/**
 * Pop-up de boas-vindas (seção 10.1): no máximo uma vez a cada 14 dias, depois de 25 segundos,
 * de metade da página rolada ou de intenção de saída no desktop. Modal no desktop, folha
 * inferior no celular. Fecha por Esc, pelo botão e por clique fora, com o foco preso.
 */
export function WelcomePopup({ subscribe, storeName, discountPercent, image }: WelcomePopupProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const blocked = BLOCKED.test(pathname);

  useEffect(() => {
    if (blocked || alreadySeen()) return;
    const show = () => {
      if (alreadySeen()) return;
      markSeen();
      setMobile(window.matchMedia("(max-width: 767px)").matches);
      setOpen(true);
    };
    const timer = setTimeout(show, DELAY_MS);
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable > 0 && window.scrollY / scrollable >= 0.5) show();
    };
    const onLeave = (event: MouseEvent) => {
      if (event.clientY <= 0 && window.matchMedia("(pointer: fine)").matches) show();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, [blocked, pathname]);

  if (blocked) return null;
  const title = `Ganhe ${discountPercent}% na primeira compra`;
  const description =
    "Cadastre o seu e-mail para receber o cupom, novidades e cuidados com plantas.";
  const form = (
    <NewsletterForm
      submit={subscribe}
      source="POPUP"
      storeName={storeName}
      discountPercent={discountPercent}
    />
  );

  if (mobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        className="max-h-[70dvh]"
      >
        <div className="overflow-y-auto p-5">{form}</div>
      </Drawer>
    );
  }
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={title}
      description={description}
      hideTitle
      className="max-w-3xl"
    >
      <div className="grid md:grid-cols-[2fr_3fr]">
        {image ? (
          <Image
            src={image.url}
            alt={image.alt}
            width={480}
            height={600}
            sizes="320px"
            placeholder={image.blurDataUrl ? "blur" : "empty"}
            blurDataURL={image.blurDataUrl ?? undefined}
            className="hidden h-full w-full object-cover md:block"
          />
        ) : (
          <div className="hidden bg-cream-100 md:block" />
        )}
        <div className="flex flex-col gap-4 p-6 md:p-8">
          <p aria-hidden="true" className="pr-10 type-h2 text-moss-900">
            {title}
          </p>
          <p aria-hidden="true" className="type-body text-ink">
            {description}
          </p>
          {form}
        </div>
      </div>
    </Dialog>
  );
}
