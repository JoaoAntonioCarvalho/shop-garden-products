import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { PageHeader } from "@/components/admin/admin-shell";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { notifyBackInStockAction } from "@/server/actions/admin/customers";

export const metadata: Metadata = { title: "Avise-me" };

export default async function BackInStockPage() {
  await requireAdminPage("requests.manage");
  const groups = await db.lead.groupBy({
    by: ["productId"],
    where: {
      source: "BACK_IN_STOCK",
      productId: { not: null },
      notifiedAt: null,
      unsubscribedAt: null,
    },
    _count: true,
    _min: { createdAt: true },
    orderBy: { _count: { productId: "desc" } },
  });
  const products = await db.product.findMany({
    where: { id: { in: groups.map((group) => group.productId as string) } },
    select: { id: true, name: true, sku: true, totalAvailable: true, status: true },
  });
  const sent = await db.lead.count({
    where: { source: "BACK_IN_STOCK", notifiedAt: { not: null } },
  });
  return (
    <>
      <PageHeader
        title="Avise-me"
        description="Clientes que pediram aviso de produtos sem estoque. Quando o estoque é reposto pelo painel, o e-mail “Chegou” sai sozinho; aqui dá para disparar na hora."
      />
      <p className="mb-3 text-sm text-muted-foreground">{sent} avisos já enviados.</p>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pedido de aviso pendente.</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {groups.map((group) => {
          const product = products.find((item) => item.id === group.productId);
          if (!product) return null;
          return (
            <li
              key={product.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background p-3 text-sm"
            >
              <div>
                <Link
                  href={`/admin/produtos/${product.id}`}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  {product.name}
                </Link>
                <span className="block text-xs text-muted-foreground">
                  {product.sku}. {group._count}{" "}
                  {group._count === 1 ? "pessoa aguardando" : "pessoas aguardando"}
                  {group._min.createdAt
                    ? `, a primeira desde ${formatDate(group._min.createdAt)}`
                    : ""}
                  . Disponível agora: {product.totalAvailable}
                </span>
              </div>
              <ActionButton
                size="sm"
                variant="outline"
                disabled={product.totalAvailable <= 0 || product.status !== "ACTIVE"}
                action={notifyBackInStockAction.bind(null, { productId: product.id })}
              >
                Avisar que chegou
              </ActionButton>
            </li>
          );
        })}
      </ul>
    </>
  );
}
