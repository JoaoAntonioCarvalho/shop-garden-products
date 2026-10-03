import type { Metadata } from "next";
import { NotFoundContent } from "@/components/store/not-found-content";

export const metadata: Metadata = { title: "Página não encontrada", robots: { index: false } };

export default function StoreNotFound() {
  return <NotFoundContent />;
}
