import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { confirmLead } from "@/server/services/leads";

export const metadata: Metadata = { title: "Confirmação de cadastro", robots: { index: false } };

export default async function ConfirmNewsletterPage({
  params,
}: PageProps<"/newsletter/confirmar/[token]">) {
  const confirmed = await confirmLead((await params).token);
  return (
    <div className="container-store py-12">
      <EmptyState
        headingLevel="h1"
        title={confirmed ? "E-mail confirmado" : "Este link não vale mais"}
        description={
          confirmed
            ? "Você vai receber as novidades e ofertas da loja. O cupom que enviamos continua valendo na primeira compra."
            : "O link de confirmação já foi usado ou expirou. Se você já confirmou, não precisa fazer mais nada."
        }
        action={
          <Link href="/" className={buttonClasses("primary")}>
            Ir para a loja
          </Link>
        }
      />
    </div>
  );
}
