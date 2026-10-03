import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/admin-shell";
import { Card, CardContent } from "@/components/admin/ui/card";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatBRL } from "@/lib/money";
import { stockValueReport } from "@/server/admin/inventory";

export const metadata: Metadata = { title: "Valor em estoque" };

export default async function StockValuePage() {
  await requireAdminPage("inventory.value_report");
  const { rows, total } = await stockValueReport();
  return (
    <>
      <PageHeader
        back={{ href: "/admin/estoque", label: "Estoque" }}
        title="Valor em estoque"
        description="Unidades em estoque valorizadas pelo custo e pelo preço de venda, por categoria principal."
      />
      {total.withoutCost > 0 ? (
        <p className="mb-3 text-sm text-warning">
          {total.withoutCost} variações com estoque estão sem custo cadastrado e entram com custo
          zero.
        </p>
      ) : null}
      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <table className="w-full text-left text-sm" aria-label="Valor em estoque por categoria">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="py-1.5">
                  Categoria
                </th>
                <th scope="col" className="py-1.5 text-right">
                  Unidades
                </th>
                <th scope="col" className="py-1.5 text-right">
                  A preço de custo
                </th>
                <th scope="col" className="py-1.5 text-right">
                  A preço de venda
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((row) => (
                <tr key={row.category} className="border-t border-border">
                  <td className="py-1.5">{row.category}</td>
                  <td className="py-1.5 text-right">{row.units}</td>
                  <td className="py-1.5 text-right">{formatBRL(row.costCents)}</td>
                  <td className="py-1.5 text-right">{formatBRL(row.saleCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="font-semibold tabular-nums">
              <tr className="border-t border-border">
                <th scope="row" className="py-2 text-left">
                  Total
                </th>
                <td className="py-2 text-right">{total.units}</td>
                <td className="py-2 text-right">{formatBRL(total.costCents)}</td>
                <td className="py-2 text-right">{formatBRL(total.saleCents)}</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
