import type { Metadata } from "next";
import Image from "next/image";
import { PageHeader } from "@/components/admin/admin-shell";
import type { FormValues } from "@/components/admin/entity-form";
import { FilterBar } from "@/components/admin/filter-bar";
import { Inbox } from "@/components/admin/inbox";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { updateInboxItemAction } from "@/server/actions/admin/customers";
import { parseListParams } from "@/server/admin/list";
import { toMediaItem } from "@/server/admin/media";
import { getStoreSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Solicitações de produto" };

const statusLabels: Record<string, string> = {
  NEW: "Nova",
  IN_PROGRESS: "Em andamento",
  QUOTED: "Orçamento enviado",
  CLOSED: "Encerrada",
};

export default async function ProductRequestsPage({
  searchParams,
}: PageProps<"/admin/solicitacoes">) {
  await requireAdminPage("requests.manage");
  const params = parseListParams(await searchParams);
  const status = params.filters.status;
  const [requests, team, settings] = await Promise.all([
    db.productRequest.findMany({
      where: {
        ...(status in statusLabels ? { status: status as never } : { status: { not: "CLOSED" } }),
        ...(params.q
          ? {
              OR: [
                { name: { contains: params.q, mode: "insensitive" } },
                { email: { contains: params.q.toLowerCase() } },
                { description: { contains: params.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { image: true },
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
      kind: "request",
      id,
      status: String(values.status),
      assignedToId: String(values.assignedToId ?? ""),
      internalNotes: String(values.internalNotes ?? ""),
    });
  };
  return (
    <>
      <PageHeader
        title="Solicitações de produto"
        description="Pedidos de arranjos sob medida e de produtos que o cliente não encontrou. Por padrão a lista esconde as encerradas."
      />
      <FilterBar
        searchPlaceholder="Nome, e-mail ou texto"
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
        emptyMessage="Nenhuma solicitação com esses filtros."
        statusOptions={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
        team={team.map((member) => ({ value: member.id, label: member.name }))}
        save={save}
        greeting={(item) =>
          `Olá, ${item.name.split(" ")[0]}! Aqui é da ${settings.name}. Recebemos a sua solicitação e vamos ajudar.`
        }
        subject={() => `Sua solicitação na ${settings.name}`}
        items={requests.map((request) => ({
          id: request.id,
          title: request.name,
          meta: `${request.email}${request.whatsapp ? `, ${request.whatsapp}` : ""}. Recebida em ${formatDateTime(request.createdAt)}${request.budgetRange ? `. Orçamento: ${request.budgetRange}` : ""}`,
          body: (
            <>
              {request.description}
              {request.image ? (
                <Image
                  src={toMediaItem(request.image).thumb}
                  alt={request.image.alt || "Imagem de referência enviada pelo cliente"}
                  width={160}
                  height={200}
                  unoptimized
                  className="mt-2 rounded-md border border-border"
                />
              ) : null}
            </>
          ),
          status: request.status,
          statusLabel: statusLabels[request.status],
          isNew: request.status === "NEW",
          isSample: request.isSample,
          email: request.email,
          phone: request.whatsapp,
          name: request.name,
          assignedToId: request.assignedToId,
          internalNotes: request.internalNotes,
        }))}
      />
    </>
  );
}
