import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { DataTable } from "@/components/admin/data-table";
import { FilterBar } from "@/components/admin/filter-bar";
import { Badge } from "@/components/admin/ui/badge";
import { emailTemplates } from "@/components/email/templates";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { dateRangeOf, parseListParams } from "@/server/admin/list";

export const metadata: Metadata = { title: "E-mails enviados" };

const labels = emailTemplates as Record<string, { label: string }>;

export default async function EmailLogPage({ searchParams }: PageProps<"/admin/emails">) {
  await requireAdminPage("emails.view");
  const params = parseListParams(await searchParams);
  const f = params.filters;
  const and: Prisma.EmailLogWhereInput[] = [];
  if (params.q)
    and.push({
      OR: [
        { to: { contains: params.q.toLowerCase() } },
        { subject: { contains: params.q, mode: "insensitive" } },
      ],
    });
  if (f.modelo) and.push({ template: f.modelo });
  if (f.status === "SENT" || f.status === "FAILED") and.push({ status: f.status });
  const range = dateRangeOf(f.de, f.ate);
  if (range) and.push({ createdAt: range });
  const where = { AND: and };
  const [emails, total] = await Promise.all([
    db.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.pageSize,
      include: { order: { select: { number: true } } },
    }),
    db.emailLog.count({ where }),
  ]);
  return (
    <>
      <PageHeader
        title="E-mails enviados"
        description="Todos os e-mails que a loja enviou ou tentou enviar. Abra um e-mail para ver o conteúdo e reenviar."
      />
      <FilterBar
        searchPlaceholder="Destinatário ou assunto"
        fields={[
          {
            type: "select",
            name: "modelo",
            label: "Modelo",
            options: Object.entries(labels).map(([value, item]) => ({ value, label: item.label })),
          },
          {
            type: "select",
            name: "status",
            label: "Situação",
            options: [
              { value: "SENT", label: "Enviado" },
              { value: "FAILED", label: "Falhou" },
            ],
          },
          { type: "date", name: "de", label: "De" },
          { type: "date", name: "ate", label: "Até" },
        ]}
      />
      <DataTable
        label="E-mails enviados"
        columns={[
          { key: "subject", header: "Assunto" },
          { key: "to", header: "Para" },
          { key: "template", header: "Modelo" },
          { key: "status", header: "Situação" },
          { key: "date", header: "Data" },
        ]}
        total={total}
        page={params.page}
        pageSize={params.pageSize}
        sort={null}
        dir="desc"
        rows={emails.map((email) => ({
          id: email.id,
          cells: {
            subject: (
              <Link
                href={`/admin/emails/${email.id}`}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {email.subject}
              </Link>
            ),
            to: email.to,
            template: (
              <>
                {labels[email.template]?.label ?? email.template}
                {email.order ? (
                  <span className="block text-xs text-muted-foreground">
                    Pedido {email.order.number}
                  </span>
                ) : null}
              </>
            ),
            status:
              email.status === "SENT" ? (
                <Badge variant="secondary">Enviado</Badge>
              ) : (
                <Badge variant="destructive">Falhou</Badge>
              ),
            date: (
              <span className="whitespace-nowrap text-muted-foreground">
                {formatDateTime(email.createdAt)}
              </span>
            ),
          },
        }))}
      />
    </>
  );
}
