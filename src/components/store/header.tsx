import { Heart, Search, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { StoreNavigation } from "@/config/navigation";
import type { StoreSettings } from "@/config/store.config";
import { Logo } from "./logo";
import { MegaMenu } from "./mega-menu";
import { MobileMenu } from "./mobile-menu";

const iconButton =
  "relative flex size-11 items-center justify-center rounded-control text-moss-700 transition-colors hover:bg-moss-100";

function Counter({ count, tone }: { count: number; tone: "wine" | "moss" }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className={`absolute top-1 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] leading-none font-semibold text-white tabular-nums ${tone === "wine" ? "bg-wine-700" : "bg-moss-700"}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function SearchForm({ id, className }: { id: string; className?: string }) {
  return (
    <form action="/busca" role="search" className={className}>
      <label htmlFor={id} className="sr-only">
        Buscar produtos
      </label>
      <div className="relative">
        <input
          id={id}
          type="search"
          name="q"
          required
          minLength={2}
          autoComplete="off"
          placeholder="Buscar orquídeas, vasos, arranjos..."
          className="h-11 w-full rounded-control border border-moss-500 bg-white pr-12 pl-4 text-[16px] text-ink placeholder:text-ink-muted hover:border-moss-700 focus-visible:border-moss-700"
        />
        <button
          type="submit"
          aria-label="Buscar"
          className="absolute top-0 right-0 flex size-11 items-center justify-center text-moss-700"
        >
          <Search aria-hidden="true" strokeWidth={1.5} className="size-5" />
        </button>
      </div>
    </form>
  );
}

type HeaderProps = {
  settings: StoreSettings;
  navigation: StoreNavigation;
  cartCount: number;
  wishlistCount: number;
  /** Busca com sugestões (fase 3), menu da conta (fase 5) e botão da sacola (fase 4) entram por aqui. */
  search?: ReactNode;
  account?: ReactNode;
  cart?: ReactNode;
};

export function Header({
  settings,
  navigation,
  cartCount,
  wishlistCount,
  search,
  account,
  cart,
}: HeaderProps) {
  const cartLabel =
    cartCount === 0
      ? "Sacola vazia"
      : `Sacola com ${cartCount} ${cartCount === 1 ? "item" : "itens"}`;

  return (
    // "contents" deixa a linha principal ficar fixa em relação à página, não ao cabeçalho.
    <header className="contents">
      <div className="sticky top-0 z-40 border-b border-line bg-cream-50">
        <div className="container-store flex h-16 items-center gap-2 lg:gap-8">
          <MobileMenu
            items={navigation.main}
            secondaryLinks={[
              { label: "Minha conta", href: "/conta" },
              { label: "Rastrear pedido", href: "/rastreio" },
              { label: "Ajuda", href: "/ajuda" },
            ]}
            whatsapp={settings.whatsapp}
            instagram={settings.instagram}
          />

          <Link
            href="/"
            aria-label={`${settings.name}, página inicial`}
            className="mx-auto flex-none lg:mx-0"
          >
            <Logo name={settings.name} />
          </Link>

          <div className="hidden flex-1 justify-center lg:flex">
            {search ?? <SearchForm id="busca-desktop" className="w-full max-w-[560px]" />}
          </div>

          <div className="flex items-center lg:gap-1">
            <div className="hidden lg:block">
              {account ?? (
                <Link href="/conta" aria-label="Minha conta" className={iconButton}>
                  <User aria-hidden="true" strokeWidth={1.5} className="size-[22px]" />
                </Link>
              )}
            </div>
            <Link
              href="/conta/favoritos"
              aria-label={wishlistCount > 0 ? `Favoritos: ${wishlistCount}` : "Favoritos"}
              className={`${iconButton} hidden lg:flex`}
            >
              <Heart aria-hidden="true" strokeWidth={1.5} className="size-[22px]" />
              <Counter count={wishlistCount} tone="moss" />
            </Link>
            {cart ?? (
              <Link
                href="/carrinho"
                aria-label={cartLabel}
                className={`${iconButton} -mr-2.5 lg:mr-0`}
              >
                <ShoppingBag aria-hidden="true" strokeWidth={1.5} className="size-[22px]" />
                <Counter count={cartCount} tone="wine" />
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-line bg-cream-50 py-2.5 lg:hidden">
        <div className="container-store">{search ?? <SearchForm id="busca-mobile" />}</div>
      </div>

      <MegaMenu items={navigation.main} />
    </header>
  );
}
