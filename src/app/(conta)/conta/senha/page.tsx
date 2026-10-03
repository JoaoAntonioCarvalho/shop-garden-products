import type { Metadata } from "next";
import { PasswordForm } from "@/components/store/account/account-forms";
import { requireAccountUser } from "@/lib/account-guard";

export const metadata: Metadata = { title: "Senha" };

export default async function PasswordPage() {
  await requireAccountUser("/conta/senha");
  return (
    <div>
      <h1 className="mb-6 type-h1 text-moss-900">Senha</h1>
      <PasswordForm />
    </div>
  );
}
