import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { DataTable } from "@/components/admin/data-table";
import { FilterBar } from "@/components/admin/filter-bar";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDate } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { can } from "@/lib/permissions";
import { formatPhone } from "@/lib/validators/phone";
import { UF } from "@/lib/validators/checkout";
import { listCustomers } from "@/server/admin/customers";
import { parseListParams } from "@/server/admin/list";

export const metadata: Metadata = { title: "Clientes" };

export default async function AdminCustomersPage({ searchParams }: PageProps<"/admin/clientes">) {
  const user = await requireAdminPage("customers.view");
  const params = parseListParams(await searchParams, { sort: "createdAt", dir: "desc" });
  const { rows, total } = await listCustomers(params);
  return (
    <>
      <PageHeader
        title="Clientes"
        description="Os números consideram pedidos pagos. A exportação da lista fica registrada na auditoria."
      />
      {can(user, "customers.export") ? (
        <p className="mb-3 text-sm text-muted-foreground">
          Ao exportar, você assume a guarda de dados pessoais. Use só para atender clientes e nunca
          para campanhas sem consentimento.
        </p>
      ) : null}
      <FilterBar
        searchPlaceholder="Nome, e-mail, CPF ou telefone"
        exportHref={can(user, "customers.export") ? "/admin/exportar/clientes" : undefined}
        fields={[
          {
            type: "select",
            name: "pedidos",
            label: "Pedidos",
            options: [
              { value: "com", label: "Com pedidos" },
              { value: "sem", label: "Sem pedidos" },
            ],
          },
          { type: "text", name: "gasto-min", label: "Gasto mínimo", placeholder: "R$" },
          { type: "text", name: "gasto-max", label: "Gasto máximo", placeholder: "R$" },
          {
            type: "select",
            name: "sem-comprar",
            label: "Último pedido há mais de",
            options: [
              { value: "30", label: "30 dias" },
              { value: "60", label: "60 dias" },
              { value: "90", label: "90 dias" },
              { value: "180", label: "180 dias" },
            ],
          },
          {
            type: "select",
            name: "uf",
            label: "Estado",
            options: UF.map((uf) => ({ value: uf, label: uf })),
          },
          {
            type: "select",
            name: "consentimento",
            label: "Consentimento",
            options: [
              { value: "email", label: "Aceita e-mail" },
              { value: "whatsapp", label: "Aceita WhatsApp" },
              { value: "nenhum", label: "Nenhum" },
            ],
          },
          { type: "toggle", name: "aniversario", label: "Aniversariantes do mês" },
        ]}
      />
      <DataTable
        label="Clientes"
        columns={[
          { key: "name", header: "Nome", sortable: true },
          { key: "contact", header: "Contato" },
          { key: "city", header: "Cidade" },
          { key: "orders", header: "Pedidos", sortable: true, align: "right" },
          { key: "totalCents", header: "Total gasto", sortable: true, align: "right" },
          { key: "lastOrderAt", header: "Último pedido", sortable: true },
          { key: "consent", header: "Consentimento" },
          { key: "createdAt", header: "Cadastro", sortable: true },
        ]}
        total={total}
        page={params.page}
        pageSize={params.pageSize}
        sort={params.sort}
        dir={params.dir}
        rows={rows.map((customer) => ({
          id: customer.id,
          cells: {
            name: (
              <>
                <Link
                  href={`/admin/clientes/${customer.id}`}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  {customer.name}
                </Link>
                {customer.isSample ? (
                  <span className="ml-1.5 rounded-xs bg-secondary px-1 text-xs text-muted-foreground">
                    Teste
                  </span>
                ) : null}
              </>
            ),
            contact: (
              <>
                {customer.email}
                <span className="block text-xs text-muted-foreground">
                  {customer.phone ? formatPhone(customer.phone) : "Sem telefone"}
                </span>
              </>
            ),
            city: customer.city ? `${customer.city}/${customer.state}` : "",
            orders: customer.orders,
            totalCents: formatBRL(customer.totalCents),
            lastOrderAt: (
              <span className="text-muted-foreground">
                {customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "Nunca"}
              </span>
            ),
            consent: [
              customer.marketingEmailOptIn ? "E-mail" : null,
              customer.marketingWhatsappOptIn ? "WhatsApp" : null,
            ]
              .filter(Boolean)
              .join(" e ") || <span className="text-muted-foreground">Nenhum</span>,
            createdAt: (
              <span className="text-muted-foreground">{formatDate(customer.createdAt)}</span>
            ),
          },
        }))}
      />
    </>
  );
}
