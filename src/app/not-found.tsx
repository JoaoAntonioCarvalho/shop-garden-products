import type { Metadata } from "next";
import { NotFoundContent } from "@/components/store/not-found-content";
import { StoreShell } from "@/components/store/store-shell";

export const metadata: Metadata = { title: "Página não encontrada", robots: { index: false } };

/** Endereços que não correspondem a nenhuma rota. Usa a mesma estrutura da loja. */
export default function NotFound() {
  return (
    <StoreShell>
      <NotFoundContent />
    </StoreShell>
  );
}
