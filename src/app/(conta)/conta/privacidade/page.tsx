import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccountForm } from "@/components/store/account/account-forms";
import { buttonClasses } from "@/components/ui/button";
import { requireAccountUser } from "@/lib/account-guard";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Privacidade" };

export default async function PrivacyPage() {
  const user = await requireAccountUser("/conta/privacidade");
  const pending = await db.dataRequest.findFirst({
    where: { userId: user.id, type: "DELETE", status: "OPEN" },
    select: { id: true },
  });
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="baixar-dados">
        <h1 className="type-h1 text-moss-900">Privacidade</h1>
        <h2 id="baixar-dados" className="mt-8 type-h3 text-moss-900">
          Baixar meus dados
        </h2>
        <p className="mt-2 mb-4 measure type-body text-ink-muted">
          Um arquivo com os seus dados cadastrais, endereços, pedidos e consentimentos, no formato
          JSON.
        </p>
        {/* Download direto de arquivo: não é navegação entre páginas. */}
        <a href="/api/conta/dados" download className={buttonClasses("secondary")}>
          <Download aria-hidden="true" strokeWidth={1.5} className="size-4" />
          Baixar meus dados
        </a>
      </section>
      <section aria-labelledby="excluir-conta" className="border-t border-line pt-8">
        <h2 id="excluir-conta" className="type-h3 text-moss-900">
          Excluir minha conta
        </h2>
        <p className="mt-2 mb-4 measure type-body text-ink-muted">
          Ao excluir a conta, seus dados pessoais são apagados. Os pedidos são mantidos sem
          identificação, porque a legislação fiscal exige guardar o registro das vendas. Veja a{" "}
          <Link href="/privacidade" className="text-moss-700 underline underline-offset-3">
            política de privacidade
          </Link>
          .
        </p>
        <DeleteAccountForm pendingRequest={Boolean(pending)} />
      </section>
    </div>
  );
}
