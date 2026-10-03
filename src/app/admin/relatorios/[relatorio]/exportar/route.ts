import { ForbiddenError, auditContext, requirePermission } from "@/lib/admin-guard";
import { logAudit } from "@/lib/audit";
import { formatCentsPlain } from "@/lib/money";
import { csvResponse, toCsv } from "@/server/admin/list";
import { resolvePeriod } from "@/server/admin/periods";
import { getReport } from "@/server/admin/reports";

/** CSV de um relatório, com o mesmo período e agrupamento da tela. Fica registrado na auditoria. */
export async function GET(
  request: Request,
  context: RouteContext<"/admin/relatorios/[relatorio]/exportar">,
) {
  const report = getReport((await context.params).relatorio);
  if (!report) return new Response("Relatório desconhecido", { status: 404 });
  let user;
  try {
    user = await requirePermission("reports.view");
  } catch (error) {
    if (error instanceof ForbiddenError) return new Response("Sem permissão", { status: 403 });
    throw error;
  }
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const period = resolvePeriod(query);
  const option = report.options?.choices.some(
    (choice) => choice.value === query[report.options!.name],
  )
    ? query[report.options.name]
    : (report.options?.choices[0].value ?? "");
  const result = await report.build(period, user, option);
  await logAudit({
    userId: user.id,
    action: "reports.export",
    entityType: "Report",
    diff: { relatorio: report.key, periodo: period.label, linhas: result.rows.length },
    ...(await auditContext()),
  });
  return csvResponse(
    `relatorio-${report.key}`,
    toCsv(
      result.columns.map((column) => column.label),
      result.rows.map((row) =>
        row.map((value, index) =>
          value === null
            ? ""
            : result.columns[index].type === "money"
              ? formatCentsPlain(Number(value))
              : value,
        ),
      ),
    ),
  );
}
