import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/admin-shell";
import { requireAdminPage } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { normalizeText } from "@/lib/slug";
import { onlyDigits } from "@/lib/validators/cpf";
import { normalizeOrderNumber } from "@/server/services/order-view";

export const metadata: Metadata = { title: "Busca" };

/** Busca global do painel: pedido por número, cliente por nome, e-mail ou CPF, produto por nome ou SKU. */
export default async function AdminSearchPage({ searchParams }: PageProps<"/admin/busca">) {
  const user = await requireAdminPage("dashboard.view");
  const query = await searchParams;
  const q = ((Array.isArray(query.q) ? query.q[0] : query.q) ?? "").trim().slice(0, 80);
  const digits = onlyDigits(q);

  // Número de pedido exato vai direto para o pedido.
  if (/^(nsg-?)?\d{1,8}$/i.test(q) && can(user, "orders.view")) {
    const order = await db.order.findUnique({
      where: { number: normalizeOrderNumber(q) },
      select: { number: true },
    });
    if (order) redirect(`/admin/pedidos/${order.number}`);
  }

  const [orders, customers, products] =
    q.length < 2
      ? [[], [], []]
      : await Promise.all([
          can(user, "orders.view")
            ? db.order.findMany({
                where: {
                  OR: [
                    { customerName: { contains: q, mode: "insensitive" } },
                    { customerEmail: { contains: q.toLowerCase() } },
                    ...(digits.length >= 4 ? [{ customerCpf: { contains: digits } }] : []),
                  ],
                },
                orderBy: { createdAt: "desc" },
                take: 8,
                select: { number: true, customerName: true },
              })
            : [],
          can(user, "customers.view")
            ? db.user.findMany({
                where: {
                  role: "CUSTOMER",
                  OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { email: { contains: q.toLowerCase() } },
                    ...(digits.length >= 4 ? [{ cpf: { contains: digits } }] : []),
                  ],
                },
                take: 8,
                select: { id: true, name: true, email: true },
              })
            : [],
          can(user, "products.view")
            ? db.product.findMany({
                where: {
                  OR: [
                    { searchText: { contains: normalizeText(q) } },
                    { variants: { some: { sku: { contains: q.toUpperCase() } } } },
                  ],
                },
                take: 8,
                select: { id: true, name: true, sku: true },
              })
            : [],
        ]);

  const groups = [
    {
      title: "Pedidos",
      items: orders.map((o) => ({
        href: `/admin/pedidos/${o.number}`,
        label: o.number,
        detail: o.customerName,
      })),
    },
    {
      title: "Clientes",
      items: customers.map((c) => ({
        href: `/admin/clientes/${c.id}`,
        label: c.name,
        detail: c.email,
      })),
    },
    {
      title: "Produtos",
      items: products.map((p) => ({
        href: `/admin/produtos/${p.id}`,
        label: p.name,
        detail: p.sku,
      })),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <>
      <PageHeader title={`Busca: ${q}`} />
      {groups.length === 0 ? (
        <p className="text-muted-foreground">
          Nada encontrado. Tente o número do pedido, o e-mail do cliente ou o SKU do produto.
        </p>
      ) : null}
      <div className="flex max-w-2xl flex-col gap-6">
        {groups.map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h2 className="mb-1 text-sm font-semibold">{group.title}</h2>
            <ul className="divide-y divide-border rounded-md border border-border bg-background">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex min-h-10 items-center justify-between gap-3 px-3 hover:bg-accent"
                  >
                    <span className="font-medium">{item.label}</span>
                    <span className="truncate text-muted-foreground">{item.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
