import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/store/account/auth-card";
import { ResetPasswordForm } from "@/components/store/account/auth-forms";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { isResetTokenValid } from "@/server/services/accounts";

export const metadata: Metadata = { title: "Criar nova senha" };

export default async function ResetPasswordPage({ params }: PageProps<"/redefinir-senha/[token]">) {
  const { token } = await params;
  const valid = await isResetTokenValid(token);

  return (
    <AuthCard title="Criar nova senha">
      {valid ? (
        <ResetPasswordForm
          token={token}
          after={
            <Link href="/entrar" className={buttonClasses("primary")}>
              Entrar
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Alert tone="error" title="Este link não vale mais">
            Os links de nova senha valem por 1 hora e só podem ser usados uma vez.
          </Alert>
          <Link href="/esqueci-a-senha" className={buttonClasses("secondary", "md", "self-start")}>
            Pedir um novo link
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
