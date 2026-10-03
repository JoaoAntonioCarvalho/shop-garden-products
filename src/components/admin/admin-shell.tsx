"use client";

import { ExternalLink, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/admin/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/admin/ui/sheet";
import { Toaster } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { logoutAction } from "@/server/actions/auth";

export type ShellNav = Array<{
  group: string;
  items: Array<{ href: string; label: string; count?: number }>;
}>;

function NavList({ nav, onNavigate }: { nav: ShellNav; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Módulos do painel" className="flex flex-col gap-5 p-3">
      {nav.map((section) => (
        <div key={section.group}>
          <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">{section.group}</p>
          <ul>
            {section.items.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-9 items-center justify-between gap-2 rounded-md px-3 text-sm transition-colors",
                      active
                        ? "bg-primary font-medium text-primary-foreground"
                        : "text-foreground hover:bg-accent",
                    )}
                  >
                    {item.label}
                    {item.count ? (
                      <span
                        className={cn(
                          "rounded-full px-1.5 text-xs font-medium tabular-nums",
                          active ? "bg-white text-primary" : "bg-accent text-accent-foreground",
                        )}
                      >
                        {item.count}
                        <span className="sr-only"> pendentes</span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({
  nav,
  storeName,
  userName,
  roleLabel,
  children,
}: {
  nav: ShellNav;
  storeName: string;
  userName: string;
  roleLabel: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex min-h-dvh bg-muted font-sans text-sm text-foreground">
      <a
        href="#conteudo-admin"
        className="sr-only z-50 rounded-md bg-background px-4 py-3 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>

      {/* Barra lateral recolhível (desktop) */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh flex-none overflow-y-auto border-r border-border bg-background lg:block print:hidden",
          collapsed ? "lg:hidden" : "w-60",
        )}
      >
        <Link
          href="/admin"
          className="flex h-14 items-center border-b border-border px-6 text-base font-semibold text-primary"
        >
          {storeName}
        </Link>
        <NavList nav={nav} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background px-3 md:px-6 print:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Abrir menu do painel"
              >
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 overflow-y-auto p-0">
              <SheetTitle className="border-b border-border px-6 py-4 text-base text-primary">
                {storeName}
              </SheetTitle>
              <NavList nav={nav} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            aria-label={collapsed ? "Mostrar barra lateral" : "Recolher barra lateral"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <PanelLeftClose aria-hidden="true" />
            )}
          </Button>

          <form action="/admin/busca" role="search" className="relative max-w-md flex-1">
            <label htmlFor="busca-global" className="sr-only">
              Buscar pedido, cliente ou produto
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground"
            />
            <input
              id="busca-global"
              name="q"
              type="search"
              required
              minLength={2}
              placeholder="Pedido, cliente, CPF, produto ou SKU"
              className="h-9 w-full rounded-md border border-input bg-background pr-3 pl-8 text-sm placeholder:text-muted-foreground"
            />
          </form>

          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <Link href="/" target="_blank">
              <ExternalLink aria-hidden="true" />
              <span className="max-sm:sr-only">Ver loja</span>
              <span className="sr-only"> (abre em nova aba)</span>
            </Link>
          </Button>
          <div className="hidden text-right leading-tight md:block">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sair"
            disabled={pending}
            onClick={() => startTransition(() => logoutAction())}
          >
            <LogOut aria-hidden="true" />
          </Button>
        </header>

        <main
          id="conteudo-admin"
          tabIndex={-1}
          className="flex-1 p-4 outline-none md:p-6 print:p-0"
        >
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}

/** Cabeçalho de página do painel: título, descrição e ações principais. */
export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3 print:hidden">
      <div>
        {back ? (
          <Link
            href={back.href}
            className="mb-1 inline-flex min-h-8 items-center text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {back.label}
          </Link>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
