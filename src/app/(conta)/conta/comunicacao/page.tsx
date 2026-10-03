import type { Metadata } from "next";
import { CommunicationForm } from "@/components/store/account/account-forms";
import { requireAccountUser } from "@/lib/account-guard";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Comunicação" };

export default async function CommunicationPage() {
  const user = await requireAccountUser("/conta/comunicacao");
  const prefs = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { marketingEmailOptIn: true, marketingWhatsappOptIn: true, optInAt: true, phone: true },
  });
  return (
    <div>
      <h1 className="type-h1 text-moss-900">Comunicação</h1>
      <p className="mt-3 mb-6 measure type-body text-ink-muted">
        Escolha se quer receber novidades e ofertas. Você pode mudar quando quiser.
      </p>
      <CommunicationForm
        email={prefs.marketingEmailOptIn}
        whatsapp={prefs.marketingWhatsappOptIn}
        hasPhone={Boolean(prefs.phone)}
        optInAt={
          prefs.optInAt && (prefs.marketingEmailOptIn || prefs.marketingWhatsappOptIn)
            ? formatDate(prefs.optInAt)
            : null
        }
      />
    </div>
  );
}
