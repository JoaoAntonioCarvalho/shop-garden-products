import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReviewForm } from "@/components/store/account/account-forms";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getOrderForViewer } from "@/server/services/order-view";

export const metadata: Metadata = { title: "Avaliar produto" };

export default async function ReviewPage({
  params,
  searchParams,
}: PageProps<"/conta/avaliar/[slug]">) {
  const [{ slug }, query, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const orderNumber = one(query.pedido);
  const token = one(query.token);

  // Vale o cliente logado ou o link do e-mail de pedido entregue (número e token do pedido).
  const linked = orderNumber && token ? await getOrderForViewer(orderNumber, { token }) : null;
  if (!user && !linked) redirect(`/entrar?voltar=${encodeURIComponent(`/conta/avaliar/${slug}`)}`);

  const product = await db.product.findUnique({
    where: { slug },
    select: { name: true, slug: true },
  });
  if (!product) notFound();

  return (
    <div className={user ? "" : "mx-auto max-w-xl py-4"}>
      <h1 className="type-h1 text-moss-900">Avaliar produto</h1>
      <p className="mt-3 mb-6 type-body text-ink-muted">
        <Link
          href={`/produto/${product.slug}`}
          className="text-moss-700 underline underline-offset-3"
        >
          {product.name}
        </Link>
        . Sua avaliação ajuda outros clientes a escolher.
      </p>
      <ReviewForm
        productSlug={product.slug}
        productName={product.name}
        orderNumber={linked ? orderNumber : undefined}
        token={linked ? token : undefined}
      />
    </div>
  );
}
