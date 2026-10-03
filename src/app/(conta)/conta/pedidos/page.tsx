import { PackageOpen } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/store/account/order-status-badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { requireAccountUser } from "@/lib/account-guard";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import type { OrderStatusCode } from "@/server/services/order-status";

export const metadata: Metadata = { title: "Meus pedidos" };

const PAGE_SIZE = 10;

export default async function OrdersPage({ searchParams }: PageProps<"/conta/pedidos">) {
  const user = await requireAccountUser("/conta/pedidos");
  const query = await searchParams;
  const page = Math.max(
    1,
    Number(Array.isArray(query.pagina) ? query.pagina[0] : query.pagina) || 1,
  );
  const [orders, total] = await Promise.all([
    db.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        number: true,
        status: true,
        totalCents: true,
        createdAt: true,
        items: { take: 4, select: { id: true, imageUrl: true, productName: true } },
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where: { userId: user.id } }),
  ]);

  return (
    <div>
      <h1 className="type-h1 text-moss-900">Pedidos</h1>
      {orders.length === 0 ? (
        <EmptyState
          icon={<PackageOpen aria-hidden="true" strokeWidth={1.5} />}
          title="Você ainda não fez pedidos"
          description="Quando fizer, eles aparecem aqui com o andamento da entrega."
          action={
            <Link href="/colecao/mais-vendidos" className={buttonClasses("secondary")}>
              Ver mais vendidos
            </Link>
          }
        />
      ) : (
        <>
          <ul className="mt-6 flex flex-col gap-4">
            {orders.map((order) => (
              <li key={order.number} className="rounded-control border border-line bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="type-body font-semibold text-ink">
                      <Link
                        href={`/conta/pedidos/${order.number}`}
                        className="underline-offset-3 hover:underline"
                      >
                        Pedido {order.number}
                      </Link>
                    </h2>
                    <p className="type-small text-ink-muted">
                      {formatDate(order.createdAt)}, {order._count.items}{" "}
                      {order._count.items === 1 ? "item" : "itens"}, {formatBRL(order.totalCents)}
                    </p>
                  </div>
                  <OrderStatusBadge status={order.status as OrderStatusCode} />
                </div>
                <ul className="mt-4 flex gap-2" aria-label="Itens do pedido">
                  {order.items.map((item) => (
                    <li
                      key={item.id}
                      className="relative aspect-4/5 w-12 overflow-hidden rounded-photo bg-cream-50"
                    >
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.productName}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <Pagination
            className="mt-8"
            page={page}
            totalPages={Math.ceil(total / PAGE_SIZE)}
            hrefFor={(target) => `/conta/pedidos${target > 1 ? `?pagina=${target}` : ""}`}
          />
        </>
      )}
    </div>
  );
}
