import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/admin-shell";
import { ManualOrderForm } from "@/components/admin/manual-order-form";
import { requireAdminPage } from "@/lib/admin-guard";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Criar pedido manual" };

export default async function NewManualOrderPage() {
  const user = await requireAdminPage("orders.create_manual");
  return (
    <>
      <PageHeader
        back={{ href: "/admin/pedidos", label: "Pedidos" }}
        title="Criar pedido manual"
        description="Para vendas fechadas no WhatsApp, por telefone ou na loja. O pedido movimenta o estoque e aparece nos relatórios por canal."
      />
      <ManualOrderForm canOverridePrice={can(user, "orders.override_price")} />
    </>
  );
}
