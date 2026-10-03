import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { PageHeader } from "@/components/admin/admin-shell";
import { emailTemplates } from "@/components/email/templates";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { resendEmailLogAction } from "@/server/actions/admin/system";
import { emailStore, renderEmail } from "@/server/services/emails";

export const metadata: Metadata = { title: "E-mail enviado" };

export default async function EmailLogDetailPage({ params }: PageProps<"/admin/emails/[id]">) {
  await requireAdminPage("emails.view");
  const { id } = await params;
  const email = await db.emailLog.findUnique({ where: { id } });
  if (!email) notFound();
  const known = email.template in emailTemplates;
  // O conteúdo é montado de novo a partir do modelo e dos dados gravados no envio.
  let html: string | null = null;
  try {
    html = known
      ? (await renderEmail(email.template as never, email.payload as never, await emailStore()))
          .html
      : null;
  } catch {
    html = null;
  }
  return (
    <>
      <PageHeader
        back={{ href: "/admin/emails", label: "E-mails enviados" }}
        title={email.subject}
        description={`Para ${email.to}, em ${formatDateTime(email.createdAt)}. ${email.status === "SENT" ? "Enviado." : `Falhou: ${email.error ?? "erro desconhecido"}`}`}
        actions={
          <ActionButton
            variant="outline"
            action={resendEmailLogAction.bind(null, { id })}
            confirm={{
              title: "Reenviar e-mail",
              description: `O e-mail será enviado de novo para ${email.to}.`,
              confirmLabel: "Reenviar",
            }}
          >
            Reenviar
          </ActionButton>
        }
      />
      {html ? (
        <iframe
          title={`Conteúdo do e-mail: ${email.subject}`}
          srcDoc={html}
          sandbox=""
          className="h-[75vh] w-full rounded-md border border-border bg-white"
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Não foi possível montar a prévia deste e-mail (o modelo mudou ou os dados não foram
          gravados).
        </p>
      )}
    </>
  );
}
