import type { Metadata } from "next";
import { ActionButton } from "@/components/admin/action-button";
import { PageHeader } from "@/components/admin/admin-shell";
import { DataTable } from "@/components/admin/data-table";
import { CopyButton } from "@/components/admin/order-actions";
import { Card, CardContent } from "@/components/admin/ui/card";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { formatBRL } from "@/lib/money";
import { markCartContactedAction, sendCartRecoveryAction } from "@/server/actions/admin/customers";
import { abandonedCartWhere, recoveryWindowStart } from "@/server/admin/customers";
import { parseListParams } from "@/server/admin/list";
import { getEffectivePriceCents } from "@/server/services/pricing";
import { getStoreSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Carrinhos abandonados" };

export default async function AbandonedCartsPage({ searchParams }: PageProps<"/admin/carrinhos">) {
  await requireAdminPage("carts.view");
  const params = parseListParams(await searchParams);
  const where = abandonedCartWhere();
  const since = recoveryWindowStart();
  const [carts, total, all, contacted, recovered, settings] = await Promise.all([
    db.cart.findMany({
      where,
      orderBy: { lastActivityAt: "desc" },
      skip: params.skip,
      take: params.pageSize,
      include: {
        user: { select: { name: true, email: true, phone: true } },
        items: { include: { variant: { include: { product: { select: { name: true } } } } } },
      },
    }),
    db.cart.count({ where }),
    db.cart.findMany({
      where,
      select: {
        items: {
          select: {
            quantity: true,
            variant: {
              select: {
                priceCents: true,
                promoPriceCents: true,
                promoStartsAt: true,
                promoEndsAt: true,
              },
            },
          },
        },
      },
      take: 2000,
    }),
    db.cart.count({
      where: { OR: [{ recoveryEmailSentAt: { gte: since } }, { contactedAt: { gte: since } }] },
    }),
    db.cart.count({
      where: {
        status: "CONVERTED",
        OR: [{ recoveryEmailSentAt: { gte: since } }, { contactedAt: { gte: since } }],
      },
    }),
    getStoreSettings(),
  ]);
  const valueOf = (items: (typeof all)[number]["items"]) =>
    items.reduce((sum, item) => sum + item.quantity * getEffectivePriceCents(item.variant), 0);
  const totalValue = all.reduce((sum, cart) => sum + valueOf(cart.items), 0);
  const base = getEnv().APP_URL;

  return (
    <>
      <PageHeader
        title="Carrinhos abandonados"
        description="Sacolas com e-mail ou conta, com itens, paradas há mais de 2 horas e sem pedido."
      />
      <Card className="mb-4">
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
          {[
            ["Carrinhos abandonados", String(total)],
            ["Valor parado nas sacolas", formatBRL(totalValue)],
            [
              "Recuperados nos últimos 30 dias",
              contacted
                ? `${recovered} de ${contacted} contatados (${Math.round((recovered / contacted) * 100)}%)`
                : "Nenhum contato ainda",
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <DataTable
        label="Carrinhos abandonados"
        columns={[
          { key: "customer", header: "Cliente" },
          { key: "items", header: "Itens" },
          { key: "value", header: "Valor", align: "right" },
          { key: "activity", header: "Última atividade" },
          { key: "actions", header: "Ações" },
        ]}
        total={total}
        page={params.page}
        pageSize={params.pageSize}
        sort={null}
        dir="desc"
        emptyMessage="Nenhum carrinho abandonado."
        rows={carts.map((cart) => {
          const email = cart.email ?? cart.user?.email ?? "";
          const link = `${base}/carrinho/recuperar/${cart.token}?utm_source=whatsapp&utm_medium=recuperacao`;
          const message = `Olá${cart.user?.name ? `, ${cart.user.name.split(" ")[0]}` : ""}! Aqui é da ${settings.name}. Vimos que você deixou ${cart.items.length === 1 ? cart.items[0].variant.product.name : "alguns produtos"} na sacola. Posso ajudar com alguma dúvida? Sua sacola está guardada aqui: ${link}`;
          return {
            id: cart.id,
            cells: {
              customer: (
                <>
                  {cart.user?.name ?? "Visitante"}
                  <span className="block text-xs text-muted-foreground">{email}</span>
                </>
              ),
              items: (
                <ul className="text-sm">
                  {cart.items.slice(0, 4).map((item) => (
                    <li key={item.id}>
                      {item.quantity}x {item.variant.product.name}
                    </li>
                  ))}
                  {cart.items.length > 4 ? (
                    <li className="text-muted-foreground">e mais {cart.items.length - 4}</li>
                  ) : null}
                </ul>
              ),
              value: formatBRL(valueOf(cart.items)),
              activity: (
                <span className="text-muted-foreground">
                  {formatDateTime(cart.lastActivityAt)}
                  {cart.recoveryEmailSentAt ? (
                    <span className="block text-xs">
                      E-mail enviado em {formatDateTime(cart.recoveryEmailSentAt)}
                    </span>
                  ) : null}
                  {cart.contactedAt ? (
                    <span className="block text-xs">
                      Contatado em {formatDateTime(cart.contactedAt)}
                    </span>
                  ) : null}
                </span>
              ),
              actions: (
                <span className="flex flex-wrap gap-1.5">
                  <ActionButton
                    size="sm"
                    variant="outline"
                    action={sendCartRecoveryAction.bind(null, { id: cart.id })}
                  >
                    Enviar e-mail de recuperação
                  </ActionButton>
                  <CopyButton value={message} label="Copiar mensagem de WhatsApp" />
                  <ActionButton
                    size="sm"
                    variant="ghost"
                    action={markCartContactedAction.bind(null, { id: cart.id })}
                  >
                    {cart.contactedAt ? "Desmarcar contato" : "Marcar como contatado"}
                  </ActionButton>
                </span>
              ),
            },
          };
        })}
      />
    </>
  );
}
