"use client";

import { User } from "lucide-react";
import Link from "next/link";
import { Popover } from "radix-ui";
import { useTransition } from "react";
import { logoutAction } from "@/server/actions/auth";

const itemClass =
  "flex min-h-11 w-full items-center px-4 text-left text-[15px] text-ink hover:bg-moss-100";

/** Menu da conta no cabeçalho: "Entrar" e "Criar conta", ou "Meus pedidos", "Favoritos" e "Sair". */
export function AccountMenu({ userName, isStaff }: { userName: string | null; isStaff: boolean }) {
  const [pending, startTransition] = useTransition();
  const firstName = userName?.split(" ")[0];

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={firstName ? `Conta de ${firstName}` : "Entrar ou criar conta"}
        className="relative flex size-11 items-center justify-center rounded-control text-moss-700 transition-colors hover:bg-moss-100"
      >
        <User aria-hidden="true" strokeWidth={1.5} className="size-[22px]" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-56 rounded-control border border-line bg-white py-2 shadow-overlay"
        >
          {firstName ? (
            <>
              <p className="px-4 pb-2 type-caption text-ink-muted">Olá, {firstName}</p>
              <Popover.Close asChild>
                <Link href="/conta/pedidos" className={itemClass}>
                  Meus pedidos
                </Link>
              </Popover.Close>
              <Popover.Close asChild>
                <Link href="/conta/favoritos" className={itemClass}>
                  Favoritos
                </Link>
              </Popover.Close>
              <Popover.Close asChild>
                <Link href="/conta" className={itemClass}>
                  Minha conta
                </Link>
              </Popover.Close>
              {isStaff ? (
                <Popover.Close asChild>
                  <Link href="/admin" className={itemClass}>
                    Painel administrativo
                  </Link>
                </Popover.Close>
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => logoutAction())}
                className={`${itemClass} border-t border-line`}
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Popover.Close asChild>
                <Link href="/entrar" className={itemClass}>
                  Entrar
                </Link>
              </Popover.Close>
              <Popover.Close asChild>
                <Link href="/criar-conta" className={itemClass}>
                  Criar conta
                </Link>
              </Popover.Close>
              <Popover.Close asChild>
                <Link href="/rastreio" className={`${itemClass} border-t border-line`}>
                  Rastrear pedido
                </Link>
              </Popover.Close>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
