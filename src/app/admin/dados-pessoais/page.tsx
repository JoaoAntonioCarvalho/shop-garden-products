import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { PageHeader } from "@/components/admin/admin-shell";
import { Badge } from "@/components/admin/ui/badge";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { resolveDataRequestAction } from "@/server/actions/admin/customers";
import { userNames } from "@/server/admin/audit";

export const metadata: Metadata = { title: "Pedidos LGPD" };

const typeLabels = { EXPORT: "Cópia dos dados", DELETE: "Exclusão da conta" } as const;
const statusLabels = { OPEN: "Aberto", DONE: "Concluído", REJECTED: "Recusado" } as const;

export default async function DataRequestsPage() {
  await requireAdminPage("data_requests.manage");
  const requests = await db.dataRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: { user: { select: { id: true, name: true, anonymizedAt: true } } },
  });
  const names = await userNames(requests.map((request) => request.handledById));
  return (
    <>
      <PageHeader
        title="Pedidos LGPD"
        description="Pedidos dos titulares sobre os próprios dados. A lei dá 15 dias para responder. Concluir um pedido de exclusão anonimiza a conta e mantém os pedidos sem identificação."
      />
      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pedido registrado.</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {requests.map((request) => (
          <li
            key={request.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background p-3 text-sm"
          >
            <div>
              <p className="font-medium">
                {typeLabels[request.type]}:{" "}
                {request.user && !request.user.anonymizedAt ? (
                  <Link
                    href={`/admin/clientes/${request.user.id}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {request.user.name}
                  </Link>
                ) : (
                  "conta já anonimizada"
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Pedido em {formatDateTime(request.createdAt)}
                {request.resolvedAt
                  ? `. Resolvido em ${formatDateTime(request.resolvedAt)}${request.handledById ? ` por ${names.get(request.handledById) ?? "usuário removido"}` : ""}`
                  : ""}
              </p>
            </div>
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant={request.status === "OPEN" ? "destructive" : "secondary"}>
                {statusLabels[request.status]}
              </Badge>
              {request.status === "OPEN" ? (
                <>
                  <ActionButton
                    size="sm"
                    action={resolveDataRequestAction.bind(null, { id: request.id, status: "DONE" })}
                    confirm={
                      request.type === "DELETE"
                        ? {
                            title: "Concluir exclusão",
                            description: `Os dados pessoais de ${request.user?.name ?? "este cliente"} serão apagados e os pedidos ficam sem identificação. Não dá para desfazer.`,
                            confirmLabel: "Anonimizar e concluir",
                          }
                        : undefined
                    }
                  >
                    {request.type === "DELETE"
                      ? "Anonimizar e concluir"
                      : "Concluir e avisar o cliente"}
                  </ActionButton>
                  <ActionButton
                    size="sm"
                    variant="outline"
                    action={resolveDataRequestAction.bind(null, {
                      id: request.id,
                      status: "REJECTED",
                    })}
                    confirm={{
                      title: "Recusar pedido",
                      description:
                        "Use só quando não foi possível confirmar a identidade de quem pediu.",
                      confirmLabel: "Recusar",
                    }}
                  >
                    Recusar
                  </ActionButton>
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
