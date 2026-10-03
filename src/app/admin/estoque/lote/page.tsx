import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/admin-shell";
import { BatchStockIn } from "@/components/admin/stock-tools";
import { requireAdminPage } from "@/lib/admin-guard";

export const metadata: Metadata = { title: "Entrada em lote" };

export default async function BatchStockPage() {
  await requireAdminPage("inventory.adjust");
  return (
    <>
      <PageHeader
        back={{ href: "/admin/estoque", label: "Estoque" }}
        title="Entrada em lote"
        description="Para registrar a chegada de mercadoria de uma vez. Cole uma linha por item e confira a prévia antes de aplicar."
      />
      <BatchStockIn />
    </>
  );
}
