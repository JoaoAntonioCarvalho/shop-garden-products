import type { ReactNode } from "react";
import { AccountMenu } from "@/components/store/account/account-menu";
import { CartButton, CartProvider } from "@/components/store/cart/cart-provider";
import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";
import { SearchBox } from "@/components/store/search-box";
import { defaultTopBarMessages, TopBar } from "@/components/store/top-bar";
import { FloatingWhatsApp } from "@/components/store/whatsapp-button";
import { WishlistProvider } from "@/components/store/wishlist-provider";
import { Toaster } from "@/components/ui/toast";
import { db } from "@/lib/db";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import { getCurrentUser } from "@/lib/session";
import { getCartCount } from "@/server/services/cart";
import { getNavigation } from "@/server/services/catalog";
import { getBanners } from "@/server/services/content";
import { getStoreSettings } from "@/server/services/settings";

/** Estrutura comum da loja e da área do cliente: barra superior, cabeçalho, conteúdo e rodapé. */
export async function StoreShell({
  children,
  floatingWhatsApp = true,
}: {
  children: ReactNode;
  floatingWhatsApp?: boolean;
}) {
  const [settings, navigation, cartCount, user] = await Promise.all([
    getStoreSettings(),
    getNavigation(),
    getCartCount(),
    getCurrentUser(),
  ]);
  const [topBar, wishlist] = await Promise.all([
    getBanners("TOP_BAR", settings),
    user ? db.wishlist.findMany({ where: { userId: user.id }, select: { productId: true } }) : [],
  ]);
  const messages =
    topBar.length > 0 ? topBar.map((banner) => banner.title) : defaultTopBarMessages(settings);

  return (
    <CartProvider initialCount={cartCount}>
      <WishlistProvider
        initialIds={wishlist.map((item) => item.productId)}
        loggedIn={Boolean(user)}
      >
        <div className="flex min-h-dvh flex-col">
          <JsonLd data={[organizationJsonLd(settings), websiteJsonLd(settings)]} />
          <a
            href="#conteudo"
            className="sr-only z-50 rounded-control bg-white px-4 py-3 text-moss-700 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
          >
            Pular para o conteúdo
          </a>
          <TopBar messages={messages} />
          <Header
            settings={settings}
            navigation={navigation}
            cartCount={cartCount}
            wishlistCount={wishlist.length}
            search={<SearchBox className="w-full lg:max-w-[560px]" />}
            account={
              <AccountMenu
                userName={user?.name ?? null}
                isStaff={user ? user.role !== "CUSTOMER" : false}
              />
            }
            cart={<CartButton />}
            loggedIn={Boolean(user)}
          />
          <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
          <Footer settings={settings} navigation={navigation} />
          {floatingWhatsApp ? (
            <FloatingWhatsApp number={settings.whatsapp} storeName={settings.name} />
          ) : null}
          <Toaster />
        </div>
      </WishlistProvider>
    </CartProvider>
  );
}
