import { NextResponse } from "next/server";
import { ForbiddenError, auditContext, requirePermission } from "@/lib/admin-guard";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { exportUserData } from "@/server/services/accounts";

/** Exportação dos dados de um cliente (LGPD), só para ADMIN e registrada na auditoria. */
export async function GET(
  _request: Request,
  context: RouteContext<"/admin/clientes/[id]/exportar">,
) {
  const { id } = await context.params;
  let user;
  try {
    user = await requirePermission("customers.export");
  } catch (error) {
    if (error instanceof ForbiddenError)
      return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
  const customer = await db.user.findUnique({
    where: { id },
    select: { role: true, anonymizedAt: true },
  });
  if (!customer || customer.role !== "CUSTOMER" || customer.anonymizedAt)
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  const data = await exportUserData(id);
  await logAudit({
    userId: user.id,
    action: "customer.export",
    entityType: "User",
    entityId: id,
    ...(await auditContext()),
  });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="cliente-${id}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
