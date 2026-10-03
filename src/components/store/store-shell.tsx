import type { ReactNode } from "react";
import { AccountMenu } from "@/components/store/account/account-menu";
import { CartButton, CartProvider } from "@/components/store/cart/cart-provider";
import {
  AnalyticsScripts,
  CookieBanner,
  CookiePreferencesButton,
} from "@/components/store/cookie-consent";
import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";
import { SearchBox } from "@/components/store/search-box";
import { defaultTopBarMessages, TopBar } from "@/components/store/top-bar";
import { WelcomePopup } from "@/components/store/welcome-popup";
import { FloatingWhatsApp } from "@/components/store/whatsapp-button";
import { WishlistProvider } from "@/components/store/wishlist-provider";
import { Toaster } from "@/components/ui/toast";
import { db } from "@/lib/db";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import { getCurrentUser } from "@/lib/session";
import { cookies } from "next/headers";
import { subscribeLeadAction } from "@/server/actions/leads";
import { getCartCount } from "@/server/services/cart";
import { getPopupImage } from "@/server/services/content";
import { LEAD_COOKIE } from "@/server/services/leads";
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
  const [topBar, wishlist, popupImage, jar] = await Promise.all([
    getBanners("TOP_BAR", settings),
    user ? db.wishlist.findMany({ where: { userId: user.id }, select: { productId: true } }) : [],
    getPopupImage(),
    cookies(),
  ]);
  // Quem já se cadastrou não vê o convite de novo.
  const subscribed = jar.has(LEAD_COOKIE);
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
          <Footer
            settings={settings}
            navigation={navigation}
            subscribe={subscribeLeadAction}
            hideNewsletter={subscribed}
            cookiePreferences={<CookiePreferencesButton />}
          />
          {floatingWhatsApp ? (
            <FloatingWhatsApp number={settings.whatsapp} storeName={settings.name} />
          ) : null}
          <Toaster />
          {subscribed || user?.role === "ADMIN" || user?.role === "STAFF" ? null : (
            <WelcomePopup
              subscribe={subscribeLeadAction}
              storeName={settings.name}
              discountPercent={settings.welcomeCouponPercent}
              image={popupImage}
            />
          )}
          <CookieBanner />
          <AnalyticsScripts
            ga4Id={settings.analytics.ga4Id}
            metaPixelId={settings.analytics.metaPixelId}
          />
        </div>
      </WishlistProvider>
    </CartProvider>
  );
}
