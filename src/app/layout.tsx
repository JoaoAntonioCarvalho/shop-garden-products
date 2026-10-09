import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { storeConfig } from "@/config/store.config";
import "./globals.css";

// As fontes ficam no repositório (src/fonts, licença OFL): o build não depende de baixar nada do
// Google Fonts, e o visitante não faz requisição a terceiros.
const cormorant = localFont({
  src: [
    { path: "../fonts/cormorant-garamond-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/cormorant-garamond-latin-500-italic.woff2", weight: "500", style: "italic" },
    { path: "../fonts/cormorant-garamond-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/cormorant-garamond-latin-600-italic.woff2", weight: "600", style: "italic" },
  ],
  display: "swap",
  variable: "--font-cormorant",
  fallback: ["Georgia", "serif"],
});

const inter = localFont({
  src: "../fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-inter",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3100"),
  title: { default: storeConfig.name, template: `%s | ${storeConfig.name}` },
  description: storeConfig.tagline,
};

export const viewport: Viewport = {
  themeColor: "#4d5236",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${cormorant.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
