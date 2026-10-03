import { CartButton, CartProvider } from "@/components/store/cart/cart-provider";
import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";
import { SearchBox } from "@/components/store/search-box";
import { defaultTopBarMessages, TopBar } from "@/components/store/top-bar";
import { FloatingWhatsApp } from "@/components/store/whatsapp-button";
import { Toaster } from "@/components/ui/toast";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import { getCartCount } from "@/server/services/cart";
import { getNavigation } from "@/server/services/catalog";
import { getBanners } from "@/server/services/content";
import { getStoreSettings } from "@/server/services/settings";

export default async function StoreLayout({ children }: LayoutProps<"/">) {
  const [settings, navigation, cartCount] = await Promise.all([
    getStoreSettings(),
    getNavigation(),
    getCartCount(),
  ]);
  const topBar = await getBanners("TOP_BAR", settings);
  const messages =
    topBar.length > 0 ? topBar.map((banner) => banner.title) : defaultTopBarMessages(settings);

  return (
    <CartProvider initialCount={cartCount}>
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
        cart={<CartButton />}
        wishlistCount={0}
        search={<SearchBox className="w-full lg:max-w-[560px]" />}
      />
      <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <Footer settings={settings} navigation={navigation} />
      <FloatingWhatsApp number={settings.whatsapp} storeName={settings.name} />
      <Toaster />
    </div>
    </CartProvider>
  );
}
