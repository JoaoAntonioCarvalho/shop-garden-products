import type { Metadata } from "next";
import { EmailForm, ProfileForm } from "@/components/store/account/account-forms";
import { requireAccountUser } from "@/lib/account-guard";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Dados pessoais" };

export default async function ProfilePage() {
  const user = await requireAccountUser("/conta/dados");
  const profile = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { name: true, phone: true, cpf: true, birthDate: true },
  });
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="dados-pessoais">
        <h1 id="dados-pessoais" className="mb-6 type-h1 text-moss-900">
          Dados pessoais
        </h1>
        <ProfileForm
          profile={{ ...profile, birthDate: profile.birthDate?.toISOString().slice(0, 10) ?? null }}
        />
      </section>
      <section aria-labelledby="alterar-email" className="border-t border-line pt-8">
        <h2 id="alterar-email" className="mb-4 type-h3 text-moss-900">
          Alterar e-mail
        </h2>
        <EmailForm email={user.email} />
      </section>
    </div>
  );
}
