"use client";

import { X } from "lucide-react";
import { Dialog as RadixDialog } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const overlayClass = "fixed inset-0 z-50 bg-ink/50 data-[state=open]:animate-overlay-in";

export const closeButtonClass =
  "flex size-11 flex-none items-center justify-center rounded-control text-moss-700 transition-colors hover:bg-moss-100";

type OverlayProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Elemento que abre. Recebe o foco de volta ao fechar. */
  trigger?: ReactNode;
  title: ReactNode;
  /** Descrição lida por leitores de tela logo após o título. */
  description?: ReactNode;
  /** Esconde o título visualmente, mantendo-o para leitores de tela. */
  hideTitle?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/** Modal centralizado. Foco preso, Esc e clique fora fecham, foco volta ao gatilho. */
export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  hideTitle,
  children,
  footer,
  className,
}: OverlayProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={overlayClass} />
        <RadixDialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-panel bg-white shadow-overlay data-[state=open]:animate-overlay-in",
            className,
          )}
        >
          <div
            className={cn(
              "flex items-start justify-between gap-4 p-5 pb-0",
              hideTitle && "absolute top-0 right-0 z-10 p-2",
            )}
          >
            <div className={cn(hideTitle && "sr-only")}>
              <RadixDialog.Title className="type-h3 text-moss-900">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 type-small text-ink-muted">
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close className={closeButtonClass} aria-label="Fechar">
              <X aria-hidden="true" strokeWidth={1.5} className="size-5" />
            </RadixDialog.Close>
          </div>
          <div className={cn("overflow-y-auto", hideTitle ? "" : "p-5")}>{children}</div>
          {footer ? <div className="border-t border-line p-5">{footer}</div> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

type DrawerProps = OverlayProps & {
  /** Lado no desktop. No mobile a gaveta "bottom-on-mobile" sobe de baixo. */
  side?: "right" | "left";
  /** No mobile vira folha inferior (mini-carrinho, filtros). Com false, mantém a lateral (menu). */
  bottomOnMobile?: boolean;
};

/** Gaveta: lateral no desktop e, por padrão, inferior no mobile. */
export function Drawer({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  hideTitle,
  children,
  footer,
  side = "right",
  bottomOnMobile = true,
  className,
}: DrawerProps) {
  const sideClass =
    side === "right"
      ? "md:right-0 md:data-[state=open]:animate-slide-in-right"
      : "md:left-0 md:data-[state=open]:animate-slide-in-left";
  const mobileClass = bottomOnMobile
    ? "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-panel max-md:data-[state=open]:animate-slide-in-bottom md:inset-x-auto"
    : side === "right"
      ? "inset-y-0 right-0 w-[min(88vw,360px)] max-md:data-[state=open]:animate-slide-in-right"
      : "inset-y-0 left-0 w-[min(88vw,360px)] max-md:data-[state=open]:animate-slide-in-left";

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={overlayClass} />
        <RadixDialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed z-50 flex flex-col bg-white shadow-overlay md:inset-y-0 md:max-h-none md:w-[420px] md:rounded-none",
            mobileClass,
            sideClass,
            className,
          )}
        >
          <div className="flex items-center justify-between gap-4 border-b border-line py-2 pr-2 pl-5">
            <div className={cn(hideTitle && "sr-only")}>
              <RadixDialog.Title className="type-h3 text-moss-900">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="type-small text-ink-muted">
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close className={cn(closeButtonClass, "ml-auto")} aria-label="Fechar">
              <X aria-hidden="true" strokeWidth={1.5} className="size-5" />
            </RadixDialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
          {footer ? <div className="border-t border-line p-5">{footer}</div> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export const DialogClose = RadixDialog.Close;
