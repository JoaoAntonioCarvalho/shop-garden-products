import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/store/account/auth-card";
import { LoginForm } from "@/components/store/account/auth-forms";
import { getCurrentUser, safeReturnPath } from "@/lib/session";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/entrar">) {
  const query = await searchParams;
  const returnTo = safeReturnPath(query.voltar, "");
  const user = await getCurrentUser();
  if (user) redirect(returnTo || (user.role === "CUSTOMER" ? "/conta" : "/admin"));
  const signupHref = returnTo
    ? `/criar-conta?voltar=${encodeURIComponent(returnTo)}`
    : "/criar-conta";

  return (
    <AuthCard
      title="Entrar"
      description="Acompanhe os pedidos, salve endereços e guarde os seus favoritos."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link
            href={signupHref}
            className="font-medium text-moss-700 underline underline-offset-3"
          >
            Criar conta
          </Link>
        </>
      }
    >
      <LoginForm
        returnTo={returnTo || undefined}
        defaultEmail={typeof query.email === "string" ? query.email : ""}
      />
    </AuthCard>
  );
}
