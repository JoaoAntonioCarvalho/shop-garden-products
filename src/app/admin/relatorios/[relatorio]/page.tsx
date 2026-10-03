import { Download } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/admin-shell";
import { SimpleBarChart } from "@/components/admin/charts";
import { FilterBar } from "@/components/admin/filter-bar";
import { PeriodSelect } from "@/components/admin/period-select";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent } from "@/components/admin/ui/card";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatBRL } from "@/lib/money";
import { resolvePeriod } from "@/server/admin/periods";
import { getReport, type ReportColumn } from "@/server/admin/reports";

type Props = PageProps<"/admin/relatorios/[relatorio]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getReport((await params).relatorio)?.label ?? "Relatório" };
}

function formatCell(value: string | number | null, column: ReportColumn): string {
  if (value === null || value === undefined) return "";
  if (column.type === "money") return formatBRL(Number(value));
  if (column.type === "percent") return `${Number(value).toLocaleString("pt-BR")}%`;
  if (column.type === "number") return Number(value).toLocaleString("pt-BR");
  return String(value);
}

export default async function ReportPage({ params, searchParams }: Props) {
  const user = await requireAdminPage("reports.view");
  const report = getReport((await params).relatorio);
  if (!report) notFound();
  const query = await searchParams;
  const one = (key: string) =>
    (Array.isArray(query[key]) ? query[key][0] : query[key]) ?? undefined;
  const period = resolvePeriod({ periodo: one("periodo"), de: one("de"), ate: one("ate") });
  const option = report.options?.choices.some(
    (choice) => choice.value === one(report.options!.name),
  )
    ? (one(report.options.name) as string)
    : (report.options?.choices[0].value ?? "");
  const result = await report.build(period, user, option);
  const chart = result.chart;
  const chartColumn = chart ? result.columns[chart.value] : null;
  const exportQuery = new URLSearchParams(
    Object.entries({
      periodo: one("periodo"),
      de: one("de"),
      ate: one("ate"),
      ...(report.options ? { [report.options.name]: option } : {}),
    }).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  return (
    <>
      <PageHeader
        back={{ href: "/admin/relatorios", label: "Relatórios" }}
        title={report.label}
        description={`${report.description}${report.usesPeriod ? ` Período: ${period.label}.` : ""}`}
        actions={
          <>
            {report.usesPeriod ? (
              <PeriodSelect preset={period.preset} from={period.fromKey} to={period.toKey} />
            ) : null}
            <Button asChild variant="outline" className="self-end">
              <a href={`/admin/relatorios/${report.key}/exportar?${exportQuery}`} download>
                <Download aria-hidden="true" className="size-4" />
                Exportar CSV
              </a>
            </Button>
          </>
        }
      />
      {report.options ? (
        <FilterBar
          fields={[
            {
              type: "select",
              name: report.options.name,
              label: `${report.options.label} (padrão: ${report.options.choices[0].label.toLowerCase()})`,
              options: report.options.choices,
            },
          ]}
        />
      ) : null}
      {result.note ? <p className="mb-3 text-sm text-muted-foreground">{result.note}</p> : null}
      {chart && chartColumn && result.rows.length > 0 ? (
        <Card className="mb-4">
          <CardContent className="pt-6">
            <SimpleBarChart
              caption={`${chartColumn.label} por ${result.columns[chart.label].label.toLowerCase()}`}
              money={chartColumn.type === "money"}
              dataKey={chartColumn.type === "money" ? "faturamento" : "pedidos"}
              horizontal={result.rows.length > 12 || report.key !== "vendas"}
              data={result.rows.slice(0, report.key === "vendas" ? 62 : 15).map((row) => {
                // O gráfico trabalha em reais; os relatórios, em centavos.
                const value =
                  Number(row[chart.value] ?? 0) / (chartColumn.type === "money" ? 100 : 1);
                return {
                  name: String(row[chart.label]).slice(0, 40),
                  pedidos: value,
                  faturamento: value,
                };
              })}
            />
          </CardContent>
        </Card>
      ) : null}
      <div className="overflow-x-auto rounded-md border border-border bg-background">
        <table className="w-full text-left text-sm" aria-label={report.label}>
          <thead className="text-xs text-muted-foreground">
            <tr>
              {result.columns.map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  className={column.type === "text" ? "px-3 py-2" : "px-3 py-2 text-right"}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={result.columns.length}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  Sem dados para este período.
                </td>
              </tr>
            ) : null}
            {result.rows.map((row, index) => (
              <tr key={index} className="border-t border-border">
                {row.map((value, cell) => (
                  <td
                    key={cell}
                    className={
                      result.columns[cell].type === "text"
                        ? "px-3 py-1.5"
                        : "px-3 py-1.5 text-right tabular-nums"
                    }
                  >
                    {formatCell(value, result.columns[cell])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
