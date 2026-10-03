import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { requireAdminPage } from "@/lib/admin-guard";
import { REPORTS } from "@/server/admin/reports";

export const metadata: Metadata = { title: "Relatórios" };

export default async function ReportsIndexPage() {
  await requireAdminPage("reports.view");
  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Cada relatório tem seletor de período, gráfico e exportação em CSV. Vendas contam pedidos pagos que não foram cancelados nem devolvidos."
      />
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((report) => (
          <li key={report.key}>
            <Link
              href={`/admin/relatorios/${report.key}`}
              className="block h-full rounded-md border border-border bg-background p-4 hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-medium text-primary">{report.label}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{report.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
