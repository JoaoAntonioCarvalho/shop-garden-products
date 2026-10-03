import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/store/account/auth-card";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { verifyEmailToken } from "@/server/services/accounts";

export const metadata: Metadata = { title: "Confirmar e-mail" };

export default async function VerifyEmailPage({ params }: PageProps<"/verificar-email/[token]">) {
  const { token } = await params;
  const result = await verifyEmailToken(token);

  return (
    <AuthCard title="Confirmar e-mail">
      <div className="flex flex-col gap-4">
        {result.ok ? (
          <Alert tone="success" title="E-mail confirmado">
            {result.email} está confirmado. Os pedidos feitos com este e-mail aparecem na sua conta.
          </Alert>
        ) : (
          <Alert tone="error" title="Este link não vale mais">
            Os links de confirmação valem por 24 horas e só podem ser usados uma vez. Entre na conta
            e peça um novo.
          </Alert>
        )}
        <Link href="/conta" className={buttonClasses("primary", "md", "self-start")}>
          Ir para a minha conta
        </Link>
      </div>
    </AuthCard>
  );
}
