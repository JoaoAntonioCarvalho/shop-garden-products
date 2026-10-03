"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const links = [
  { href: "/conta", label: "Visão geral" },
  { href: "/conta/pedidos", label: "Pedidos" },
  { href: "/conta/enderecos", label: "Endereços" },
  { href: "/conta/favoritos", label: "Favoritos" },
  { href: "/conta/dados", label: "Dados pessoais" },
  { href: "/conta/senha", label: "Senha" },
  { href: "/conta/comunicacao", label: "Comunicação" },
  { href: "/conta/privacidade", label: "Privacidade" },
];

/** Navegação da área do cliente: lateral no desktop e abas roláveis no mobile. */
export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Minha conta">
      <ul className="-mx-6 flex gap-1 overflow-x-auto border-b border-line px-6 lg:mx-0 lg:flex-col lg:border-b-0 lg:px-0">
        {links.map((link) => {
          const active =
            link.href === "/conta" ? pathname === "/conta" : pathname.startsWith(link.href);
          return (
            <li key={link.href} className="flex-none">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center border-b-2 px-3 text-[15px] whitespace-nowrap transition-colors lg:rounded-control lg:border-b-0 lg:px-4",
                  active
                    ? "border-moss-700 font-medium text-moss-900 lg:bg-moss-100"
                    : "border-transparent text-ink-muted hover:text-moss-700 lg:hover:bg-moss-100",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
