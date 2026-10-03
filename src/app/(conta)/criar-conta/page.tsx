import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/store/account/auth-card";
import { SignupForm } from "@/components/store/account/auth-forms";
import { getCurrentUser, safeReturnPath } from "@/lib/session";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignupPage({ searchParams }: PageProps<"/criar-conta">) {
  const query = await searchParams;
  const returnTo = safeReturnPath(query.voltar, "");
  if (await getCurrentUser()) redirect(returnTo || "/conta");

  return (
    <AuthCard
      title="Criar conta"
      description="Leva menos de um minuto. Você já pode usar a conta antes de confirmar o e-mail."
      footer={
        <>
          Já tem conta?{" "}
          <Link
            href={returnTo ? `/entrar?voltar=${encodeURIComponent(returnTo)}` : "/entrar"}
            className="font-medium text-moss-700 underline underline-offset-3"
          >
            Entrar
          </Link>
        </>
      }
    >
      <SignupForm
        returnTo={returnTo || undefined}
        defaultEmail={typeof query.email === "string" ? query.email : ""}
      />
    </AuthCard>
  );
}
