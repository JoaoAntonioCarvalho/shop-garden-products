import { ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  CartCoupon,
  CartLineControls,
  CartShipping,
  GiftOptions,
  ViewCartTracker,
} from "@/components/store/cart/cart-page-controls";
import { CategoryLinks } from "@/components/store/category-links";
import { FreeShippingProgress } from "@/components/store/free-shipping-progress";
import { ProductGrid } from "@/components/store/product-card";
import { buttonClasses } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Price } from "@/components/ui/price";
import { centsToReais, formatBRL } from "@/lib/money";
import { formatCep } from "@/lib/validators/cep";
import {
  buildCartView,
  getCart,
  getCartSuggestionIds,
  revalidateCartStock,
} from "@/server/services/cart";
import { getCards, getNavigation } from "@/server/services/catalog";
import { getStoreSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Sacola", robots: { index: false, follow: false } };

export default async function CartPage() {
  const [settings, found] = await Promise.all([getStoreSettings(), getCart()]);
  const revalidated = found ? await revalidateCartStock(found) : null;
  const view = revalidated ? await buildCartView(revalidated.cart, settings) : null;

  if (!view || view.lines.length === 0) {
    const navigation = await getNavigation();
    return (
      <div className="container-store py-12">
        {revalidated?.notices.map((notice) => (
          <Alert key={notice} tone="warning" live className="mx-auto mb-4 max-w-xl">
            {notice}
          </Alert>
        ))}
        <EmptyState
          headingLevel="h1"
          icon={<ShoppingBag aria-hidden="true" strokeWidth={1.5} />}
          title="Sua sacola está vazia"
          description="Escolha uma planta, um vaso ou um arranjo para começar."
          action={
            <Link href="/colecao/mais-vendidos" className={buttonClasses("primary")}>
              Ver mais vendidos
            </Link>
          }
        >
          <CategoryLinks links={navigation.categories} />
        </EmptyState>
      </div>
    );
  }

  const { totals, coupon } = view;
  const suggestions = await getCards(await getCartSuggestionIds(view.lines, 4), settings);

  return (
    <div className="container-store pt-8 pb-16">
      <ViewCartTracker
        value={centsToReais(view.subtotalCents)}
        items={view.lines.map((line) => ({
          item_id: line.sku,
          item_name: line.name,
          item_category: line.categoryName ?? undefined,
          item_variant: line.variantName ?? undefined,
          price: centsToReais(line.price.priceCents),
          quantity: line.quantity,
        }))}
      />
      <h1 className="type-h1 text-moss-900">Sacola</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px] lg:gap-16">
        <div>
          {revalidated?.notices.map((notice) => (
            <Alert key={notice} tone="warning" live className="mb-4">
              {notice}
            </Alert>
          ))}

          <FreeShippingProgress
            subtotalCents={view.subtotalCents}
            thresholdCents={settings.freeShippingThresholdCents}
            className="mb-6"
          />

          <ul className="divide-y divide-line border-y border-line">
            {view.lines.map((line) => (
              <li key={line.itemId} className="flex gap-4 py-5">
                <Link
                  href={`/produto/${line.productSlug}`}
                  tabIndex={-1}
                  aria-hidden="true"
                  className="relative aspect-4/5 w-20 flex-none overflow-hidden rounded-photo bg-white md:w-28"
                >
                  {line.image ? (
                    <Image
                      src={line.image.url}
                      alt=""
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                  ) : null}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:justify-between md:gap-6">
                  <div className="min-w-0">
                    <h2 className="type-body font-medium text-ink">
                      <Link
                        href={`/produto/${line.productSlug}`}
                        className="underline-offset-3 hover:underline"
                      >
                        {line.name}
                      </Link>
                    </h2>
                    {line.variantName ? (
                      <p className="type-small text-ink-muted">{line.variantName}</p>
                    ) : null}
                    <p className="mt-1 type-small">
                      <Price price={line.price} size="line" />{" "}
                      <span className="text-ink-muted">cada</span>
                    </p>
                    <div className="mt-2">
                      <CartLineControls
                        itemId={line.itemId}
                        name={line.name}
                        quantity={line.quantity}
                        available={line.available}
                      />
                    </div>
                  </div>
                  <p className="type-body font-semibold whitespace-nowrap text-ink tabular-nums md:text-right">
                    <span className="sr-only">Total do item: </span>
                    {formatBRL(line.lineTotalCents)}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6">
            <GiftOptions
              giftMessage={view.giftMessage}
              giftWrap={view.giftWrap}
              giftWrapPriceCents={settings.giftWrapPriceCents}
            />
          </div>
        </div>

        <aside
          aria-labelledby="resumo-sacola"
          className="self-start rounded-photo bg-cream-100 p-6 lg:sticky lg:top-24"
        >
          <h2 id="resumo-sacola" className="type-h3 text-moss-900">
            Resumo
          </h2>

          <div className="mt-5 flex flex-col gap-5">
            <CartCoupon
              applied={coupon?.ok ? { code: coupon.code, summary: coupon.summary } : null}
            />
            {coupon && !coupon.ok ? (
              <Alert tone="warning" live>
                O cupom {coupon.code} não vale mais para esta sacola. {coupon.error}
              </Alert>
            ) : null}
            <CartShipping defaultCep={view.shippingCep ? formatCep(view.shippingCep) : ""} />
          </div>

          <dl className="mt-6 flex flex-col gap-2 border-t border-line pt-5 type-body text-ink">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{formatBRL(totals.subtotalCents)}</dd>
            </div>
            {totals.discountCents > 0 ? (
              <div className="flex justify-between text-moss-700">
                <dt>Cupom {coupon?.code}</dt>
                <dd className="tabular-nums">- {formatBRL(totals.discountCents)}</dd>
              </div>
            ) : null}
            {totals.giftWrapCents > 0 ? (
              <div className="flex justify-between">
                <dt>Embalagem para presente</dt>
                <dd className="tabular-nums">{formatBRL(totals.giftWrapCents)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt>Frete</dt>
              <dd className="text-ink-muted">Calcule acima</dd>
            </div>
            <div className="mt-2 flex justify-between border-t border-line pt-3 text-[18px] font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatBRL(totals.totalCents)}</dd>
            </div>
            {totals.pixSavingsCents > 0 ? (
              <div className="flex justify-between rounded-control bg-moss-100 px-3 py-2 font-medium text-moss-900">
                <dt>Total no Pix</dt>
                <dd className="tabular-nums">{formatBRL(totals.totalWithPixCents)}</dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-6 flex flex-col gap-3">
            <Link href="/checkout" className={buttonClasses("primary", "lg", "w-full")}>
              Finalizar compra
            </Link>
            <Link href="/" className={buttonClasses("ghost", "md", "w-full")}>
              Continuar comprando
            </Link>
          </div>
        </aside>
      </div>

      {suggestions.length > 0 ? (
        <section aria-labelledby="complete-com" className="mt-20">
          <h2 id="complete-com" className="mb-6 type-h2 text-moss-900">
            Complete com
          </h2>
          <ProductGrid products={suggestions} listName="Sacola: complete com" layout="scroll" />
        </section>
      ) : null}
    </div>
  );
}
