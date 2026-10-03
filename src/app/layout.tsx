import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Net Shop Garden",
  description: "Plantas, orquídeas e arranjos com curadoria Shopping Garden",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
