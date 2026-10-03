import type { Metadata } from "next";
import { ProductRequestForm } from "@/components/store/public-forms";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { breadcrumbJsonLd, JsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = pageMetadata({
  title: "Não encontrou o que procura?",
  description:
    "Conte o que você procura e a nossa equipe busca a planta, o vaso ou o arranjo para você.",
  path: "/solicitar-produto",
});

export default async function ProductRequestPage() {
  const user = await getCurrentUser();
  const crumbs = [{ label: "Início", href: "/" }, { label: "Solicitar produto" }];
  return (
    <div className="container-store py-8 md:py-12">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumb items={crumbs} />
      <div className="mt-6 max-w-3xl">
        <h1 className="type-h1 text-moss-900">Não encontrou o que procura?</h1>
        <p className="mt-2 mb-8 measure type-body text-ink">
          Conte o que você tem em mente. Nossa equipe procura no Shopping Garden e responde com
          opções e valores, sem compromisso.
        </p>
        <ProductRequestForm defaults={user ? { name: user.name, email: user.email } : undefined} />
      </div>
    </div>
  );
}
