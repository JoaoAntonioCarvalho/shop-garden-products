import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutFlow } from "@/components/store/checkout/checkout-flow";
import { db } from "@/lib/db";
import { centsToReais } from "@/lib/money";
import { getCurrentUser } from "@/lib/session";
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

  const stored = (cart.checkoutData ?? {}) as CheckoutDraft;
  // Cliente logado: os dados da conta e o endereço padrão já vêm preenchidos.
  const user = await getCurrentUser();
  const account = user
    ? await db.user.findUnique({
        where: { id: user.id },
        select: {
          name: true,
          email: true,
          cpf: true,
          phone: true,
          addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
        },
      })
    : null;
  const defaultAddress = account?.addresses[0];
  const draft: CheckoutDraft = {
    ...stored,
    identification: {
      email: account?.email,
      name: account?.name,
      cpf: account?.cpf ?? undefined,
      phone: account?.phone ?? undefined,
      ...stored.identification,
    },
    address: {
      ...(defaultAddress
        ? {
            cep: defaultAddress.cep,
            street: defaultAddress.street,
            number: defaultAddress.number,
            complement: defaultAddress.complement ?? "",
            district: defaultAddress.district,
            city: defaultAddress.city,
            state: defaultAddress.state as never,
            reference: defaultAddress.reference ?? "",
          }
        : {}),
      ...stored.address,
    },
  };
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
        savedAddresses={(account?.addresses ?? []).map((a) => ({
          id: a.id,
          label: a.label || `${a.street}, ${a.number}`,
          cep: a.cep,
          street: a.street,
          number: a.number,
          complement: a.complement ?? "",
          district: a.district,
          city: a.city,
          state: a.state,
          reference: a.reference ?? "",
        }))}
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
