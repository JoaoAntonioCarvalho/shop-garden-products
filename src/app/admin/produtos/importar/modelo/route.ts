import { NextResponse } from "next/server";
import { ForbiddenError, requirePermission } from "@/lib/admin-guard";
import { toCsv } from "@/server/admin/list";
import { importTemplate } from "@/server/admin/product-import";

/** "Baixar modelo CSV" da importação de produtos. */
export async function GET() {
  try {
    await requirePermission("products.import");
  } catch (error) {
    if (error instanceof ForbiddenError)
      return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
  const template = importTemplate();
  return new Response(toCsv(template.headers, template.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="modelo-produtos.csv"',
    },
  });
}
