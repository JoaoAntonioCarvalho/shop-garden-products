import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { PageHeader } from "@/components/admin/admin-shell";
import { MiniForm, type FormValues } from "@/components/admin/entity-form";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { OrderStatusBadge } from "@/components/store/account/order-status-badge";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDate, formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { can } from "@/lib/permissions";
import { formatCep } from "@/lib/validators/cep";
import { formatCpf, maskCpf } from "@/lib/validators/cpf";
import { formatPhone } from "@/lib/validators/phone";
import {
  addCustomerNoteAction,
  anonymizeCustomerAction,
  sendCustomerPasswordResetAction,
  updateCustomerAction,
} from "@/server/actions/admin/customers";
import { actionLabel, userNames } from "@/server/admin/audit";
import type { OrderStatusCode } from "@/server/services/order-status";

export const metadata: Metadata = { title: "Cliente" };

export default async function AdminCustomerPage({ params }: PageProps<"/admin/clientes/[id]">) {
  const user = await requireAdminPage("customers.view");
  const { id } = await params;
  const customer = await db.user.findUnique({
    where: { id },
    include: {
      addresses: { orderBy: { isDefault: "desc" } },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          number: true,
          createdAt: true,
          totalCents: true,
          status: true,
          paidAt: true,
        },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { product: { select: { name: true } } },
      },
      notesAbout: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!customer || customer.role !== "CUSTOMER") notFound();
  const [stats, top, audits] = await Promise.all([
    db.order.aggregate({
      where: { userId: id, paidAt: { not: null } },
      _count: true,
      _sum: { totalCents: true },
    }),
    db.orderItem.groupBy({
      by: ["productName"],
      where: { order: { userId: id, paidAt: { not: null } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    db.auditLog.findMany({
      where: { entityType: "User", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);
  const names = await userNames(audits.map((entry) => entry.userId));
  const total = stats._sum.totalCents ?? 0;
  const canEdit = can(user, "customers.edit");
  const anonymized = Boolean(customer.anonymizedAt);

  const save = async (values: FormValues) => {
    "use server";
    return updateCustomerAction({
      ...(values as { name: string; phone: string; cpf: string; birthDate: string }),
      id,
    });
  };
  const addNote = async (values: FormValues) => {
    "use server";
    return addCustomerNoteAction({ id, body: String(values.body ?? "") });
  };

  return (
    <>
      <PageHeader
        back={{ href: "/admin/clientes", label: "Clientes" }}
        title={customer.name}
        description={`Cliente desde ${formatDate(customer.createdAt)}${customer.lastLoginAt ? `, último acesso em ${formatDateTime(customer.lastLoginAt)}` : ""}.`}
        actions={
          anonymized ? null : (
            <>
              {canEdit ? (
                <ActionButton
                  variant="outline"
                  action={sendCustomerPasswordResetAction.bind(null, { id })}
                >
                  Enviar link para redefinir senha
                </ActionButton>
              ) : null}
              {can(user, "customers.export") ? (
                <Button asChild variant="outline">
                  <a href={`/admin/clientes/${id}/exportar`} download>
                    Exportar dados
                  </a>
                </Button>
              ) : null}
              {can(user, "customers.anonymize") ? (
                <ActionButton
                  variant="destructive"
                  redirectOnDone
                  action={anonymizeCustomerAction.bind(null, { id })}
                  confirm={{
                    title: "Anonimizar cliente",
                    description: `Os dados pessoais de ${customer.name} serão apagados (nome, e-mail, telefone, CPF, endereços). Os pedidos são mantidos sem identificação. Não dá para desfazer.`,
                    confirmLabel: "Anonimizar",
                  }}
                >
                  Anonimizar
                </ActionButton>
              ) : null}
            </>
          )
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-4">
              {[
                ["Pedidos pagos", String(stats._count)],
                ["Total gasto", formatBRL(total)],
                ["Ticket médio", formatBRL(stats._count ? Math.round(total / stats._count) : 0)],
                ["Avaliações", String(customer.reviews.length)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xl font-semibold tabular-nums">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pedidos</CardTitle>
            </CardHeader>
            <CardContent>
              {customer.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum pedido.</p>
              ) : null}
              <ul className="flex flex-col text-sm">
                {customer.orders.map((order) => (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-1.5 first:border-t-0"
                  >
                    <Link
                      href={`/admin/pedidos/${order.number}`}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {order.number}
                    </Link>
                    <span className="text-muted-foreground">{formatDate(order.createdAt)}</span>
                    <OrderStatusBadge status={order.status as OrderStatusCode} />
                    <span className="tabular-nums">{formatBRL(order.totalCents)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mais comprados</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {top.length === 0 ? (
                  <p className="text-muted-foreground">Sem compras pagas.</p>
                ) : null}
                <ul>
                  {top.map((item) => (
                    <li key={item.productName} className="flex justify-between gap-2">
                      <span>{item.productName}</span>
                      <span className="tabular-nums">{item._sum.quantity}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Avaliações</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {customer.reviews.length === 0 ? (
                  <p className="text-muted-foreground">Nenhuma avaliação.</p>
                ) : null}
                <ul className="flex flex-col gap-1">
                  {customer.reviews.map((review) => (
                    <li key={review.id}>
                      {review.product.name}: nota {review.rating}
                      <span className="block text-xs text-muted-foreground">
                        {review.body.slice(0, 100)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notas internas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <ul className="flex flex-col gap-2">
                {customer.notesAbout.map((note) => (
                  <li key={note.id} className="border-l-2 border-border pl-3">
                    {note.body}
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(note.createdAt)}, por{" "}
                      {note.author?.name ?? "usuário removido"}
                    </span>
                  </li>
                ))}
              </ul>
              {can(user, "customers.notes") && !anonymized ? (
                <MiniForm
                  fields={[
                    { name: "body", label: "Nova nota", type: "textarea", rows: 2, wide: true },
                  ]}
                  initial={{ body: "" }}
                  action={addNote}
                  submitLabel="Adicionar nota"
                  resetOnDone
                />
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {canEdit && !anonymized ? (
                <>
                  <p className="mb-3 text-muted-foreground">{customer.email}</p>
                  <MiniForm
                    fields={[
                      { name: "name", label: "Nome", type: "text", wide: true },
                      { name: "phone", label: "Telefone", type: "text" },
                      { name: "cpf", label: "CPF", type: "text" },
                      { name: "birthDate", label: "Nascimento", type: "date" },
                    ]}
                    initial={{
                      name: customer.name,
                      phone: customer.phone ? formatPhone(customer.phone) : "",
                      cpf: customer.cpf ? formatCpf(customer.cpf) : "",
                      birthDate: customer.birthDate?.toISOString().slice(0, 10) ?? "",
                    }}
                    action={save}
                    submitLabel="Salvar dados"
                  />
                </>
              ) : (
                <dl className="flex flex-col gap-1">
                  <div>{customer.email}</div>
                  <div>{customer.phone ? formatPhone(customer.phone) : "Sem telefone"}</div>
                  <div>CPF: {customer.cpf ? maskCpf(customer.cpf) : "não informado"}</div>
                </dl>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consentimentos</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p>Ofertas por e-mail: {customer.marketingEmailOptIn ? "aceita" : "não aceita"}</p>
              <p>
                Ofertas por WhatsApp: {customer.marketingWhatsappOptIn ? "aceita" : "não aceita"}
              </p>
              {customer.optInAt ? (
                <p className="text-xs text-muted-foreground">
                  Registrado em {formatDateTime(customer.optInAt)}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                E-mail {customer.emailVerifiedAt ? "confirmado" : "não confirmado"}.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Endereços</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {customer.addresses.length === 0 ? (
                <p className="text-muted-foreground">Nenhum endereço salvo.</p>
              ) : null}
              {customer.addresses.map((address) => (
                <address key={address.id} className="not-italic">
                  {address.label ? <span className="font-medium">{address.label}: </span> : null}
                  {address.street}, {address.number}
                  {address.complement ? `, ${address.complement}` : ""}
                  <span className="block text-muted-foreground">
                    {address.district}, {address.city}/{address.state}, CEP {formatCep(address.cep)}
                  </span>
                </address>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Auditoria</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {audits.length === 0 ? (
                <p className="text-muted-foreground">Nenhum registro.</p>
              ) : null}
              <ul className="flex flex-col gap-1">
                {audits.map((entry) => (
                  <li key={entry.id}>
                    {actionLabel(entry.action)}
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(entry.createdAt)}, por{" "}
                      {(entry.userId && names.get(entry.userId)) || "sistema"}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
