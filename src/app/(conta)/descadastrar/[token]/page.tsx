import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { unsubscribeLead } from "@/server/services/leads";

export const metadata: Metadata = { title: "Descadastro", robots: { index: false } };

/** Descadastro em um clique, pelo link que vai em todo e-mail de novidades. */
export default async function UnsubscribePage({ params }: PageProps<"/descadastrar/[token]">) {
  const email = await unsubscribeLead((await params).token);
  return (
    <div className="container-store py-12">
      <EmptyState
        headingLevel="h1"
        title={email ? "Você não vai mais receber novidades" : "Este link não é válido"}
        description={
          email
            ? `Tiramos ${email} da lista de novidades e ofertas. E-mails sobre pedidos em andamento continuam chegando.`
            : "Não encontramos este cadastro. Se continuar recebendo e-mails, fale com a gente."
        }
        action={
          <Link href="/" className={buttonClasses("secondary")}>
            Ir para a loja
          </Link>
        }
      />
    </div>
  );
}
