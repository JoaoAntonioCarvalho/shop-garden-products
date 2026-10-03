import type { Metadata } from "next";
import { ActionButton } from "@/components/admin/action-button";
import { PageHeader } from "@/components/admin/admin-shell";
import { MiniForm, type FormValues } from "@/components/admin/entity-form";
import { Badge } from "@/components/admin/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { inviteTeamMemberAction, updateTeamMemberAction } from "@/server/actions/admin/system";

export const metadata: Metadata = { title: "Usuários da equipe" };

const roleOptions = [
  { value: "STAFF", label: "Equipe: pedidos, estoque, imagens, avaliações e atendimento" },
  { value: "ADMIN", label: "Administrador: acesso completo" },
];

export default async function TeamPage() {
  const user = await requireAdminPage("users.manage");
  const members = await db.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      passwordHash: true,
    },
  });
  const invite = async (values: FormValues) => {
    "use server";
    return inviteTeamMemberAction(values as Parameters<typeof inviteTeamMemberAction>[0]);
  };
  return (
    <>
      <PageHeader
        title="Usuários da equipe"
        description="Quem acessa o painel. A loja precisa ter sempre pelo menos um administrador ativo."
      />
      <ul className="mb-4 flex flex-col gap-2">
        {members.map((member) => {
          const isSelf = member.id === user.id;
          return (
            <li
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background p-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {member.name}
                  {isSelf ? " (você)" : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {member.email}.{" "}
                  {member.passwordHash
                    ? member.lastLoginAt
                      ? `Último acesso em ${formatDateTime(member.lastLoginAt)}`
                      : "Ainda não acessou"
                    : "Convite enviado, senha ainda não definida"}
                </p>
              </div>
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant={member.role === "ADMIN" ? "default" : "secondary"}>
                  {member.role === "ADMIN" ? "Administrador" : "Equipe"}
                </Badge>
                {member.isActive ? null : <Badge variant="destructive">Desativado</Badge>}
                {isSelf ? null : (
                  <>
                    <ActionButton
                      size="sm"
                      variant="outline"
                      action={updateTeamMemberAction.bind(null, {
                        id: member.id,
                        role: member.role === "ADMIN" ? "STAFF" : "ADMIN",
                      })}
                      confirm={{
                        title: "Alterar papel",
                        description: `${member.name} passa a ser ${member.role === "ADMIN" ? "da equipe, sem acesso a preços, configurações e exportações" : "administrador, com acesso completo"}.`,
                        confirmLabel: "Alterar",
                      }}
                    >
                      {member.role === "ADMIN" ? "Tornar equipe" : "Tornar administrador"}
                    </ActionButton>
                    <ActionButton
                      size="sm"
                      variant="outline"
                      action={updateTeamMemberAction.bind(null, {
                        id: member.id,
                        isActive: !member.isActive,
                      })}
                      confirm={
                        member.isActive
                          ? {
                              title: "Desativar usuário",
                              description: `${member.name} perde o acesso ao painel na hora.`,
                              confirmLabel: "Desativar",
                            }
                          : undefined
                      }
                    >
                      {member.isActive ? "Desativar" : "Reativar"}
                    </ActionButton>
                    {member.passwordHash ? null : (
                      <ActionButton
                        size="sm"
                        variant="ghost"
                        action={updateTeamMemberAction.bind(null, { id: member.id, resend: true })}
                      >
                        Reenviar convite
                      </ActionButton>
                    )}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Convidar para a equipe</CardTitle>
        </CardHeader>
        <CardContent>
          <MiniForm
            fields={[
              { name: "name", label: "Nome", type: "text" },
              { name: "email", label: "E-mail", type: "email" },
              { name: "role", label: "Papel", type: "select", options: roleOptions, wide: true },
            ]}
            initial={{ name: "", email: "", role: "STAFF" }}
            action={invite}
            submitLabel="Enviar convite"
            resetOnDone
            variant="default"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            A pessoa recebe um link para definir a própria senha. O link vale por 1 hora e pode ser
            reenviado.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
