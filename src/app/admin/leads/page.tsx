import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/admin-shell";
import { DataTable } from "@/components/admin/data-table";
import { FilterBar } from "@/components/admin/filter-bar";
import { Card, CardContent } from "@/components/admin/ui/card";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { leadSourceLabels, leadWhere } from "@/server/admin/leads";
import { parseListParams } from "@/server/admin/list";

export const metadata: Metadata = { title: "Leads" };

function utmOf(value: unknown): string {
  const utm = (value ?? {}) as { source?: string; medium?: string; campaign?: string };
  return utm.source ? [utm.source, utm.medium, utm.campaign].filter(Boolean).join(" / ") : "direto";
}

export default async function AdminLeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  const user = await requireAdminPage("leads.view");
  const params = parseListParams(await searchParams);
  const where = leadWhere(params);
  const [leads, total, withConsent] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.pageSize,
    }),
    db.lead.count({ where }),
    db.lead.count({ where: { AND: [where, { consentAt: { not: null }, unsubscribedAt: null }] } }),
  ]);
  // "Já comprou": e-mails desta página que têm pedido pago.
  const emails = [...new Set(leads.map((lead) => lead.email))];
  const [buyers, allBuyers] = await Promise.all([
    db.order.findMany({
      where: { customerEmail: { in: emails }, paidAt: { not: null } },
      distinct: ["customerEmail"],
      select: { customerEmail: true },
    }),
    db.$queryRaw<
      Array<{ count: number }>
    >`SELECT COUNT(DISTINCT l.email)::int AS count FROM "Lead" l JOIN "Order" o ON o."customerEmail" = l.email AND o."paidAt" IS NOT NULL WHERE l.source <> 'BACK_IN_STOCK'`,
  ]);
  const bought = new Set(buyers.map((order) => order.customerEmail));
  const totalLeads = await db.lead.count({ where: { source: { not: "BACK_IN_STOCK" } } });
  const converted = allBuyers[0]?.count ?? 0;

  return (
    <>
      <PageHeader
        title="Leads"
        description="Contatos captados com consentimento. A exportação traz só quem tem consentimento ativo e fica registrada na auditoria."
      />
      <Card className="mb-4">
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
          {[
            ["Leads nesta lista", String(total)],
            ["Com consentimento ativo", String(withConsent)],
            [
              "Conversão geral em compra",
              totalLeads
                ? `${converted} de ${totalLeads} (${Math.round((converted / totalLeads) * 100)}%)`
                : "Sem leads",
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <FilterBar
        searchPlaceholder="E-mail ou nome"
        exportHref={can(user, "leads.export") ? "/admin/exportar/leads" : undefined}
        fields={[
          {
            type: "select",
            name: "origem",
            label: "Origem",
            options: Object.entries(leadSourceLabels).map(([value, label]) => ({ value, label })),
          },
          {
            type: "select",
            name: "consentimento",
            label: "Consentimento",
            options: [
              { value: "ativo", label: "Ativo" },
              { value: "descadastrado", label: "Descadastrado" },
            ],
          },
          { type: "toggle", name: "confirmado", label: "E-mail confirmado" },
          { type: "date", name: "de", label: "De" },
          { type: "date", name: "ate", label: "Até" },
        ]}
      />
      <DataTable
        label="Leads"
        columns={[
          { key: "email", header: "E-mail" },
          { key: "whatsapp", header: "WhatsApp" },
          { key: "source", header: "Origem" },
          { key: "consent", header: "Consentimento" },
          { key: "confirmed", header: "Confirmado" },
          { key: "coupon", header: "Cupom" },
          { key: "bought", header: "Já comprou" },
          { key: "utm", header: "Campanha" },
          { key: "createdAt", header: "Data" },
        ]}
        total={total}
        page={params.page}
        pageSize={params.pageSize}
        sort={null}
        dir="desc"
        rows={leads.map((lead) => ({
          id: lead.id,
          cells: {
            email: (
              <>
                {lead.email}
                {lead.name ? (
                  <span className="block text-xs text-muted-foreground">{lead.name}</span>
                ) : null}
              </>
            ),
            whatsapp: lead.whatsapp ?? "",
            source: leadSourceLabels[lead.source],
            consent: lead.unsubscribedAt ? (
              <span className="text-destructive">Descadastrado</span>
            ) : lead.consentAt ? (
              `Em ${formatDate(lead.consentAt)}`
            ) : (
              <span className="text-muted-foreground">Sem consentimento</span>
            ),
            confirmed: lead.confirmedAt ? (
              "Sim"
            ) : (
              <span className="text-muted-foreground">Não</span>
            ),
            coupon: lead.couponIssued ?? "",
            bought: bought.has(lead.email) ? (
              "Sim"
            ) : (
              <span className="text-muted-foreground">Não</span>
            ),
            utm: <span className="text-muted-foreground">{utmOf(lead.utm)}</span>,
            createdAt: (
              <span className="whitespace-nowrap text-muted-foreground">
                {formatDate(lead.createdAt)}
              </span>
            ),
          },
        }))}
      />
    </>
  );
}
