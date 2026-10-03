import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";
import { defaultTopBarMessages, TopBar } from "@/components/store/top-bar";
import { FloatingWhatsApp } from "@/components/store/whatsapp-button";
import { Toaster } from "@/components/ui/toast";
import { defaultNavigation } from "@/config/navigation";
import { storeConfig } from "@/config/store.config";

export default function StoreLayout({ children }: LayoutProps<"/">) {
  const settings = storeConfig;

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-control bg-white px-4 py-3 text-moss-700 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      <TopBar messages={defaultTopBarMessages(settings)} />
      <Header settings={settings} navigation={defaultNavigation} cartCount={0} wishlistCount={0} />
      <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <Footer settings={settings} navigation={defaultNavigation} />
      <FloatingWhatsApp number={settings.whatsapp} storeName={settings.name} />
      <Toaster />
    </div>
  );
}
