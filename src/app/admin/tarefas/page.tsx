import type { Metadata } from "next";
import { ActionButton } from "@/components/admin/action-button";
import { PageHeader } from "@/components/admin/admin-shell";
import { Badge } from "@/components/admin/ui/badge";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { runJobAction } from "@/server/actions/admin/system";
import { JOBS } from "@/server/jobs";

export const metadata: Metadata = { title: "Tarefas agendadas" };

export default async function JobsPage() {
  await requireAdminPage("jobs.manage");
  const lastRuns = await Promise.all(
    JOBS.map((job) =>
      db.jobRun.findFirst({ where: { name: job.key }, orderBy: { startedAt: "desc" } }),
    ),
  );
  const configured = Boolean(getEnv().CRON_SECRET);
  return (
    <>
      <PageHeader
        title="Tarefas agendadas"
        description="Rotinas que mantêm a loja em dia. Um agendador externo chama cada uma no horário indicado; aqui dá para ver a última execução e rodar na hora."
      />
      {configured ? null : (
        <p className="mb-3 rounded-md border border-border bg-background p-3 text-sm text-warning">
          A variável CRON_SECRET não está configurada, então o agendador externo não consegue chamar
          as tarefas. Elas só rodam pelo botão “Executar agora”. O README explica como agendar.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {JOBS.map((job, index) => {
          const last = lastRuns[index];
          return (
            <li
              key={job.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background p-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{job.label}</p>
                <p className="text-muted-foreground">{job.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {job.schedule}. Endereço: /api/cron/{job.key}
                </p>
                <p className="mt-1 text-xs">
                  {last ? (
                    <>
                      Última execução em {formatDateTime(last.startedAt)}:{" "}
                      {last.summary ?? "em andamento"}
                    </>
                  ) : (
                    "Nunca executada."
                  )}
                </p>
              </div>
              <span className="flex items-center gap-2">
                {last ? (
                  <Badge
                    variant={
                      last.status === "OK"
                        ? "secondary"
                        : last.status === "FAILED"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {last.status === "OK"
                      ? "Concluída"
                      : last.status === "FAILED"
                        ? "Falhou"
                        : "Em andamento"}
                  </Badge>
                ) : null}
                <ActionButton
                  size="sm"
                  variant="outline"
                  action={runJobAction.bind(null, { key: job.key })}
                >
                  Executar agora
                </ActionButton>
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
