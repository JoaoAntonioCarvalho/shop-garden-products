import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutFlow } from "@/components/store/checkout/checkout-flow";
import { centsToReais } from "@/lib/money";
import type { CheckoutDraft } from "@/lib/validators/checkout";
import { buildCartView, getCart, revalidateCartStock } from "@/server/services/cart";
import { getStoreSettings } from "@/server/services/settings";

export const metadata: Metadata = {
  title: "Finalizar compra",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const [settings, found] = await Promise.all([getStoreSettings(), getCart()]);
  if (!found || found.items.length === 0) redirect("/carrinho");

  // Disponibilidade revalidada ao abrir o checkout.
  const { cart, notices } = await revalidateCartStock(found);
  if (cart.items.length === 0) redirect("/carrinho");

  const draft = (cart.checkoutData ?? {}) as CheckoutDraft;
  const view = await buildCartView(cart, settings, { paymentMethod: draft.paymentMethod ?? "PIX" });

  return (
    <div className="container-store pb-16">
      <h1 className="sr-only">Finalizar compra</h1>
      <CheckoutFlow
        key={view.lines.map((line) => `${line.itemId}:${line.quantity}`).join("|")}
        lines={view.lines.map((line) => ({
          id: line.itemId,
          name: line.name,
          variantName: line.variantName,
          quantity: line.quantity,
          totalCents: line.lineTotalCents,
          imageUrl: line.image?.url ?? null,
        }))}
        analyticsItems={view.lines.map((line) => ({
          item_id: line.sku,
          item_name: line.name,
          item_category: line.categoryName ?? undefined,
          item_variant: line.variantName ?? undefined,
          price: centsToReais(line.price.priceCents),
          quantity: line.quantity,
        }))}
        initialTotals={view.totals}
        draft={{
          ...draft,
          identification: {
            ...draft.identification,
            email: draft.identification?.email ?? cart.email ?? undefined,
          },
          address: { ...draft.address, cep: draft.address?.cep ?? cart.shippingCep ?? undefined },
        }}
        couponCode={view.coupon?.ok ? view.coupon.code : null}
        giftMessage={view.giftMessage}
        pixDiscountPercent={settings.pixDiscountPercent}
        showTestCards={process.env.NODE_ENV !== "production"}
        initialNotices={[
          ...notices,
          ...(view.coupon && !view.coupon.ok
            ? [`O cupom ${view.coupon.code} não pôde ser aplicado. ${view.coupon.error}`]
            : []),
        ]}
      />
    </div>
  );
}
