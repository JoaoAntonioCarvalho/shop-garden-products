import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/store/account/auth-card";
import { ForgotPasswordForm } from "@/components/store/account/auth-forms";

export const metadata: Metadata = { title: "Esqueci a senha" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Esqueci a senha"
      description="Informe o e-mail da conta. Enviamos um link para você criar uma nova senha."
      footer={
        <Link href="/entrar" className="font-medium text-moss-700 underline underline-offset-3">
          Voltar para entrar
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
