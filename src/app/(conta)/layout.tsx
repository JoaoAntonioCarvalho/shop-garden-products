import type { Metadata } from "next";
import { StoreShell } from "@/components/store/store-shell";

// Autenticação e área do cliente nunca são indexadas.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AccountGroupLayout({ children }: LayoutProps<"/">) {
  return <StoreShell floatingWhatsApp={false}>{children}</StoreShell>;
}
