import type { Metadata } from "next";
import Link from "next/link";
import { ResendVerificationButton } from "@/components/store/account/account-forms";
import { OrderStatusBadge } from "@/components/store/account/order-status-badge";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { requireAccountUser } from "@/lib/account-guard";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { formatCep } from "@/lib/validators/cep";
import type { OrderStatusCode } from "@/server/services/order-status";

export const metadata: Metadata = { title: "Minha conta" };

export default async function AccountOverviewPage({ searchParams }: PageProps<"/conta">) {
  const user = await requireAccountUser("/conta");
  const [query, lastOrder, address] = await Promise.all([
    searchParams,
    db.order.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { number: true, status: true, totalCents: true, createdAt: true },
    }),
    db.address.findFirst({ where: { userId: user.id, isDefault: true } }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="type-h1 text-moss-900">Olá, {user.name.split(" ")[0]}</h1>
        {query["boas-vindas"] ? (
          <p className="mt-2 type-body text-ink-muted">
            Sua conta foi criada. Bom ter você por aqui.
          </p>
        ) : null}
      </header>

      {!user.emailVerifiedAt ? (
        <Alert tone="warning" title="Confirme o seu e-mail">
          <p>
            Enviamos um link para {user.email}. Confirmar o e-mail libera os pedidos feitos antes de
            criar a conta.
          </p>
          <div className="mt-3">
            <ResendVerificationButton />
          </div>
        </Alert>
      ) : null}

      <section
        aria-labelledby="ultimo-pedido"
        className="rounded-control border border-line bg-white p-6"
      >
        <h2 id="ultimo-pedido" className="type-h3 text-moss-900">
          Último pedido
        </h2>
        {lastOrder ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="type-body font-medium text-ink">
                {lastOrder.number}{" "}
                <OrderStatusBadge status={lastOrder.status as OrderStatusCode} className="ml-2" />
              </p>
              <p className="type-small text-ink-muted">
                {formatDate(lastOrder.createdAt)}, {formatBRL(lastOrder.totalCents)}
              </p>
            </div>
            <Link
              href={`/conta/pedidos/${lastOrder.number}`}
              className={buttonClasses("secondary", "sm")}
            >
              Ver pedido
            </Link>
          </div>
        ) : (
          <div className="mt-3">
            <p className="type-body text-ink-muted">
              Você ainda não fez pedidos. Que tal começar pelos mais vendidos?
            </p>
            <Link
              href="/colecao/mais-vendidos"
              className={buttonClasses("secondary", "sm", "mt-3")}
            >
              Ver mais vendidos
            </Link>
          </div>
        )}
      </section>

      <section
        aria-labelledby="endereco-padrao"
        className="rounded-control border border-line bg-white p-6"
      >
        <h2 id="endereco-padrao" className="type-h3 text-moss-900">
          Endereço padrão
        </h2>
        {address ? (
          <address className="mt-3 type-small text-ink-muted not-italic">
            {address.recipientName}
            <br />
            {address.street}, {address.number}
            {address.complement ? `, ${address.complement}` : ""}
            <br />
            {address.district}, {address.city}/{address.state}, CEP {formatCep(address.cep)}
          </address>
        ) : (
          <p className="mt-3 type-body text-ink-muted">
            Salve um endereço para finalizar as compras mais rápido.
          </p>
        )}
        <Link
          href="/conta/enderecos"
          className="mt-3 inline-flex min-h-11 items-center type-small font-medium text-moss-700 underline underline-offset-3"
        >
          Gerenciar endereços
        </Link>
      </section>
    </div>
  );
}
