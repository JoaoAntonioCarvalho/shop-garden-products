import type { Metadata } from "next";
import { AuthCard } from "@/components/store/account/auth-card";
import { OrderLookupForm } from "@/components/store/order-lookup-form";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Rastrear pedido",
    description: "Acompanhe o seu pedido com o número e o e-mail da compra.",
    path: "/rastreio",
  }),
  robots: { index: true, follow: true },
};

export default function TrackingPage() {
  return (
    <AuthCard
      title="Rastrear pedido"
      description="Informe o número do pedido e o e-mail usado na compra para ver o status, a previsão de entrega e o código de rastreio."
    >
      <OrderLookupForm />
    </AuthCard>
  );
}
