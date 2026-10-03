"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { Toast as RadixToast } from "radix-ui";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error";

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
  /** Ação opcional, como "Desfazer" ao remover um item da sacola. */
  action?: { label: string; onClick: () => void };
  duration: number;
};

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emptySnapshot: ToastItem[] = [];

function emit() {
  listeners.forEach((listener) => listener());
}

function dismiss(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

/** Mostra um aviso curto. Pode ser chamado de qualquer Client Component. */
export function toast(
  message: string,
  options: { tone?: ToastTone; action?: ToastItem["action"]; duration?: number } = {},
) {
  items = [
    ...items,
    {
      id: nextId++,
      message,
      tone: options.tone ?? "success",
      action: options.action,
      duration: options.duration ?? 5000,
    },
  ];
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Renderizado uma vez no layout. Os avisos são anunciados por leitores de tela. */
export function Toaster() {
  const current = useSyncExternalStore(
    subscribe,
    () => items,
    () => emptySnapshot,
  );

  return (
    <RadixToast.Provider label="Aviso" swipeDirection="right">
      {current.map((item) => (
        <RadixToast.Root
          key={item.id}
          duration={item.duration}
          onOpenChange={(open) => {
            if (!open) dismiss(item.id);
          }}
          className="flex items-center gap-3 rounded-control border border-line bg-white py-2 pr-2 pl-4 shadow-overlay data-[state=open]:animate-overlay-in"
        >
          {item.tone === "success" ? (
            <CircleCheck
              aria-hidden="true"
              strokeWidth={1.5}
              className="size-5 flex-none text-success"
            />
          ) : (
            <CircleAlert
              aria-hidden="true"
              strokeWidth={1.5}
              className="size-5 flex-none text-danger"
            />
          )}
          <RadixToast.Description className="flex-1 type-small text-ink">
            {item.message}
          </RadixToast.Description>
          {item.action ? (
            <RadixToast.Action
              altText={item.action.label}
              onClick={item.action.onClick}
              className="min-h-11 rounded-control px-3 text-[14px] font-medium text-moss-700 underline underline-offset-3 hover:bg-moss-100"
            >
              {item.action.label}
            </RadixToast.Action>
          ) : null}
          <RadixToast.Close
            aria-label="Fechar aviso"
            className={cn(
              "flex size-11 flex-none items-center justify-center rounded-control text-moss-700 hover:bg-moss-100",
            )}
          >
            <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
          </RadixToast.Close>
        </RadixToast.Root>
      ))}
      <RadixToast.Viewport className="fixed right-4 bottom-4 left-4 z-[60] flex flex-col gap-2 md:left-auto md:w-[380px]" />
    </RadixToast.Provider>
  );
}
