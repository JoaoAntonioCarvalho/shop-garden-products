import { ForbiddenError, auditContext, requirePermission } from "@/lib/admin-guard";
import { logAudit } from "@/lib/audit";
import { csvResponse, parseListParams, toCsv } from "@/server/admin/list";
import { exporters } from "@/server/admin/exporters";

/**
 * Exportação CSV do resultado filtrado de uma lista do admin. A permissão é conferida aqui, no
 * servidor, e toda exportação fica registrada na auditoria (com os filtros usados).
 */
export async function GET(request: Request, context: RouteContext<"/admin/exportar/[recurso]">) {
  const { recurso } = await context.params;
  const exporter = exporters[recurso];
  if (!exporter) return new Response("Exportação desconhecida", { status: 404 });

  let user;
  try {
    user = await requirePermission(exporter.permission);
  } catch (error) {
    if (error instanceof ForbiddenError)
      return new Response("Sem permissão para exportar", { status: 403 });
    throw error;
  }

  const raw = Object.fromEntries(new URL(request.url).searchParams);
  const { headers, rows } = await exporter.build(parseListParams(raw), raw);
  await logAudit({
    userId: user.id,
    action: `${exporter.auditEntity}.export`,
    entityType: exporter.auditEntity,
    diff: { linhas: rows.length, filtros: raw },
    ...(await auditContext()),
  });
  return csvResponse(recurso, toCsv(headers, rows));
}
