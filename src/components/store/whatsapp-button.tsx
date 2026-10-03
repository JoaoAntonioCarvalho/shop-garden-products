"use client";

import { usePathname } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { track, type WhatsAppPosition } from "@/lib/analytics/events";
import { cn } from "@/lib/cn";
import { buildWhatsAppUrl, withWhatsAppUtm } from "@/lib/whatsapp";
import { WhatsAppIcon } from "./icons";

type WhatsAppButtonProps = {
  /** Número da configuração da loja (whatsapp). */
  number: string;
  /** Mensagem pré-preenchida com o contexto da página. */
  message: string;
  /** Origem do clique, enviada no evento whatsapp_click. */
  position: WhatsAppPosition;
  children: ReactNode;
  variant?: "whatsapp" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
};

/** Todo link de WhatsApp do site passa por aqui: mensagem com contexto e evento com origem. */
export function WhatsAppButton({
  number,
  message,
  position,
  children,
  variant = "whatsapp",
  size = "md",
  className,
}: WhatsAppButtonProps) {
  const pathname = usePathname();
  return (
    <a
      href={buildWhatsAppUrl(number, message)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("whatsapp_click", { position, page: pathname })}
      className={buttonClasses(variant, size, cn(variant === "whatsapp" && "on-dark", className))}
    >
      <WhatsAppIcon className="size-5 flex-none" />
      {children}
      <span className="sr-only"> (abre o WhatsApp em nova aba)</span>
    </a>
  );
}

/** Mensagem do botão flutuante conforme a página (seção 10.1). */
export function floatingMessage(
  pathname: string,
  pageTitle: string,
  pageUrl: string,
  storeName: string,
) {
  if (pathname.startsWith("/produto/")) {
    const productName = pageTitle.replace(` | ${storeName}`, "").trim();
    return `Olá! Tenho uma dúvida sobre ${productName} (${withWhatsAppUtm(pageUrl, "produto")}).`;
  }
  if (pathname.startsWith("/carrinho")) {
    return "Olá! Estou finalizando uma compra e tenho uma dúvida.";
  }
  return "Olá! Vim pelo site e gostaria de ajuda.";
}

/** Botão flutuante. Não é renderizado no layout do checkout, para não distrair. */
export function FloatingWhatsApp({ number, storeName }: { number: string; storeName: string }) {
  const pathname = usePathname();
  // Antes do clique o link leva a mensagem geral; a do produto é montada no clique, com título e URL.
  const fallback = pathname.startsWith("/produto/")
    ? "Olá! Vim pelo site e gostaria de ajuda."
    : floatingMessage(pathname, "", "", storeName);

  // A mensagem do produto usa o título e a URL da página, lidos no momento do clique.
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const url = window.location.origin + window.location.pathname;
    event.currentTarget.href = buildWhatsAppUrl(
      number,
      floatingMessage(pathname, document.title, url, storeName),
    );
    track("whatsapp_click", { position: "flutuante", page: pathname });
  }

  return (
    <a
      href={buildWhatsAppUrl(number, fallback)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="on-dark fixed right-4 bottom-4 z-30 flex min-h-13 min-w-13 items-center justify-center gap-2 rounded-full bg-moss-700 px-3.5 text-[15px] font-medium text-white shadow-overlay transition-colors hover:bg-moss-900 md:right-6 md:bottom-6 md:px-5"
    >
      <WhatsAppIcon className="size-6 flex-none" />
      <span className="max-md:sr-only">Fale com a gente</span>
      <span className="sr-only"> pelo WhatsApp (abre em nova aba)</span>
    </a>
  );
}
