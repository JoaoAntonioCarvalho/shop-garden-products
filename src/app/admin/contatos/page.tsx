import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import type { FormValues } from "@/components/admin/entity-form";
import { FilterBar } from "@/components/admin/filter-bar";
import { Inbox } from "@/components/admin/inbox";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { updateInboxItemAction } from "@/server/actions/admin/customers";
import { parseListParams } from "@/server/admin/list";
import { getStoreSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Contatos" };

const statusLabels: Record<string, string> = {
  NEW: "Não lida",
  READ: "Lida",
  ANSWERED: "Respondida",
  CLOSED: "Encerrada",
};

export default async function ContactMessagesPage({ searchParams }: PageProps<"/admin/contatos">) {
  await requireAdminPage("requests.manage");
  const params = parseListParams(await searchParams);
  const status = params.filters.status;
  const [messages, team, settings] = await Promise.all([
    db.contactMessage.findMany({
      where: {
        ...(status in statusLabels ? { status: status as never } : { status: { not: "CLOSED" } }),
        ...(params.q
          ? {
              OR: [
                { name: { contains: params.q, mode: "insensitive" } },
                { email: { contains: params.q.toLowerCase() } },
                { message: { contains: params.q, mode: "insensitive" } },
                { orderNumber: { contains: params.q.toUpperCase() } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] }, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getStoreSettings(),
  ]);
  const save = (id: string) => async (values: FormValues) => {
    "use server";
    return updateInboxItemAction({
      kind: "contact",
      id,
      status: String(values.status),
      assignedToId: String(values.assignedToId ?? ""),
      internalNotes: String(values.internalNotes ?? ""),
    });
  };
  return (
    <>
      <PageHeader
        title="Contatos"
        description="Mensagens enviadas pelo formulário de contato. Por padrão a lista esconde as encerradas."
      />
      <FilterBar
        searchPlaceholder="Nome, e-mail, texto ou número do pedido"
        fields={[
          {
            type: "select",
            name: "status",
            label: "Status",
            options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
          },
        ]}
      />
      <Inbox
        emptyMessage="Nenhuma mensagem com esses filtros."
        statusOptions={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
        team={team.map((member) => ({ value: member.id, label: member.name }))}
        save={save}
        greeting={(item) =>
          `Olá, ${item.name.split(" ")[0]}! Aqui é da ${settings.name}, respondendo a sua mensagem.`
        }
        subject={(item) => `Re: ${item.title}`}
        items={messages.map((message) => ({
          id: message.id,
          title: message.subject,
          meta: `${message.name}, ${message.email}${message.phone ? `, ${message.phone}` : ""}. Recebida em ${formatDateTime(message.createdAt)}`,
          body: (
            <>
              {message.message}
              {message.orderNumber ? (
                <Link
                  href={`/admin/pedidos/${message.orderNumber}`}
                  className="mt-1 block text-primary underline-offset-2 hover:underline"
                >
                  Pedido {message.orderNumber}
                </Link>
              ) : null}
            </>
          ),
          status: message.status,
          statusLabel: statusLabels[message.status],
          isNew: message.status === "NEW",
          isSample: message.isSample,
          email: message.email,
          phone: message.phone,
          name: message.name,
          assignedToId: message.assignedToId,
          internalNotes: message.internalNotes,
        }))}
      />
    </>
  );
}
