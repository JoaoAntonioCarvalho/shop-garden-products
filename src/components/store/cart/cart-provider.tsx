"use client";

import { ShoppingBag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, useTransition, type ReactNode } from "react";
import { FreeShippingProgress } from "@/components/store/free-shipping-progress";
import { ProductCard } from "@/components/store/product-card";
import { buttonClasses } from "@/components/ui/button";
import { Drawer } from "@/components/ui/dialog";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { toast } from "@/components/ui/toast";
import { track } from "@/lib/analytics/events";
import { centsToReais, formatBRL } from "@/lib/money";
import {
  addToCartAction,
  getMiniCartAction,
  removeCartItemAction,
  setCartQuantityAction,
  type MiniCartData,
} from "@/server/actions/cart";

type CartContextValue = {
  count: number;
  /** Adiciona e abre a gaveta com "Adicionado à sacola". */
  addItem: (variantId: string, quantity: number) => Promise<{ ok: boolean; message?: string }>;
  openCart: () => void;
};

const CartContext = createContext<CartContextValue>({
  count: 0,
  addItem: async () => ({ ok: false, message: "A sacola não está disponível nesta página." }),
  openCart: () => undefined,
});

export const useCart = () => useContext(CartContext);

export function CartProvider({ initialCount, children }: { initialCount: number; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [count, setCount] = useState(initialCount);
  const [syncedCount, setSyncedCount] = useState(initialCount);
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  const [data, setData] = useState<MiniCartData | null>(null);
  const [justAdded, setJustAdded] = useState(false);
  const [pending, startTransition] = useTransition();

  // O contador vem do servidor a cada navegação.
  if (initialCount !== syncedCount) {
    setSyncedCount(initialCount);
    setCount(initialCount);
  }
  // Fecha a gaveta ao mudar de página.
  if (open && pathname !== openedAt) setOpen(false);

  const apply = useCallback(
    (next: MiniCartData) => {
      setData(next);
      setCount(next.itemCount);
      // Páginas que mostram a sacola (carrinho, checkout) precisam refletir a mudança.
      router.refresh();
    },
    [router],
  );

  const show = useCallback(
    (added: boolean) => {
      setJustAdded(added);
      setOpenedAt(pathname);
      setOpen(true);
    },
    [pathname],
  );

  const openCart = useCallback(() => {
    show(false);
    startTransition(async () => {
      const next = await getMiniCartAction();
      setData(next);
      setCount(next.itemCount);
    });
  }, [show]);

  const addItem = useCallback<CartContextValue["addItem"]>(
    async (variantId, quantity) => {
      const result = await addToCartAction(variantId, quantity);
      if (!result.ok || !result.cart) return { ok: false, message: result.message };
      if (result.added) {
        track("add_to_cart", { currency: "BRL", value: result.added.price * result.added.quantity, items: [result.added] });
      }
      apply(result.cart);
      show(true);
      if (result.message) toast(result.message);
      return { ok: true };
    },
    [apply, show],
  );

  function changeQuantity(itemId: string, quantity: number) {
    startTransition(async () => {
      const result = await setCartQuantityAction(itemId, quantity);
      apply(result.cart);
      if (result.message) toast(result.message);
    });
  }

  function remove(itemId: string) {
    startTransition(async () => {
      const result = await removeCartItemAction(itemId);
      apply(result.cart);
      const removed = result.removed;
      if (!removed) return;
      if (removed.item) track("remove_from_cart", { currency: "BRL", value: removed.item.price * removed.item.quantity, items: [removed.item] });
      toast(`${removed.name} saiu da sacola`, {
        duration: 5000,
        action: {
          label: "Desfazer",
          onClick: async () => {
            const restored = await addToCartAction(removed.variantId, removed.quantity);
            if (restored.cart) apply(restored.cart);
          },
        },
      });
    });
  }

  const value = useMemo(() => ({ count, addItem, openCart }), [count, addItem, openCart]);
  const empty = data !== null && data.lines.length === 0;

  return (
    <CartContext.Provider value={value}>
      {children}
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title={justAdded ? "Adicionado à sacola" : "Sacola"}
        footer={
          data && !empty ? (
            <div className="flex flex-col gap-3">
              <dl className="flex flex-col gap-1">
                <div className="flex justify-between type-body text-ink">
                  <dt>Subtotal</dt>
                  <dd className="font-semibold tabular-nums">{formatBRL(data.subtotalCents)}</dd>
                </div>
                {data.totalWithPixCents < data.subtotalCents ? (
                  <div className="flex justify-between type-small text-moss-700">
                    <dt>No Pix</dt>
                    <dd className="font-medium tabular-nums">{formatBRL(data.totalWithPixCents)}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/carrinho" className={buttonClasses("secondary")}>
                  Ver sacola
                </Link>
                <Link
                  href="/checkout"
                  className={buttonClasses("primary")}
                  onClick={() =>
                    track("begin_checkout", {
                      currency: "BRL",
                      value: centsToReais(data.subtotalCents),
                      items: data.lines.map((line) => ({ item_id: line.sku, item_name: line.name, item_variant: line.variantName ?? undefined, price: centsToReais(line.unitPriceCents), quantity: line.quantity })),
                    })
                  }
                >
                  Finalizar compra
                </Link>
              </div>
            </div>
          ) : undefined
        }
      >
        <div aria-busy={pending || undefined} className={pending ? "opacity-70 transition-opacity" : "transition-opacity"}>
          {data === null ? (
            <p role="status" className="type-body text-ink-muted">
              Carregando a sacola
            </p>
          ) : empty ? (
            <EmptyState
              icon={<ShoppingBag aria-hidden="true" strokeWidth={1.5} />}
              headingLevel="h3"
              title="Sua sacola está vazia"
              description="Que tal começar pelos mais vendidos?"
              action={
                <Link href="/colecao/mais-vendidos" className={buttonClasses("secondary")}>
                  Ver mais vendidos
                </Link>
              }
              className="py-8"
            />
          ) : (
            <>
              {data.notices.map((notice) => (
                <Alert key={notice} tone="warning" live className="mb-4">
                  {notice}
                </Alert>
              ))}
              <FreeShippingProgress subtotalCents={data.subtotalCents} thresholdCents={data.freeShippingThresholdCents} className="mb-5" />
              <ul className="divide-y divide-line border-y border-line">
                {data.lines.map((line) => (
                  <li key={line.itemId} className="flex gap-3 py-4">
                    <Link href={`/produto/${line.slug}`} className="relative aspect-4/5 w-16 flex-none overflow-hidden rounded-photo bg-white" tabIndex={-1} aria-hidden="true">
                      {line.image ? <Image src={line.image.url} alt="" fill sizes="64px" className="object-cover" /> : null}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/produto/${line.slug}`} className="line-clamp-2 type-small font-medium text-ink underline-offset-3 hover:underline">
                        {line.name}
                      </Link>
                      {line.variantName ? <p className="type-caption text-ink-muted">{line.variantName}</p> : null}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <QuantityStepper size="sm" value={line.quantity} max={line.available} label={line.name} onChange={(quantity) => changeQuantity(line.itemId, quantity)} />
                        <p className="type-small font-medium text-ink tabular-nums">{formatBRL(line.lineTotalCents)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(line.itemId)}
                        className="mt-1 min-h-11 type-caption text-moss-700 underline underline-offset-3 hover:text-moss-900 md:min-h-8"
                      >
                        Remover<span className="sr-only"> {line.name} da sacola</span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {justAdded && data.suggestions.length > 0 ? (
                <section aria-labelledby="sacola-sugestoes" className="mt-6">
                  <h3 id="sacola-sugestoes" className="mb-3 type-small font-semibold text-ink">
                    Combina com a sua sacola
                  </h3>
                  <ul className="grid grid-cols-2 gap-4">
                    {data.suggestions.map((card) => (
                      <li key={card.id}>
                        <ProductCard product={card} sizes="180px" />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>
      </Drawer>
    </CartContext.Provider>
  );
}

/** Ícone de sacola do cabeçalho, com o contador em vinho. Abre o mini-carrinho. */
export function CartButton() {
  const { count, openCart } = useCart();
  const label = count === 0 ? "Abrir sacola, vazia" : `Abrir sacola, ${count} ${count === 1 ? "item" : "itens"}`;
  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={label}
      className="relative -mr-2.5 flex size-11 items-center justify-center rounded-control text-moss-700 transition-colors hover:bg-moss-100 lg:mr-0"
    >
      <ShoppingBag aria-hidden="true" strokeWidth={1.5} className="size-[22px]" />
      {count > 0 ? (
        <span aria-hidden="true" className="absolute top-1 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-wine-700 px-1 text-[11px] leading-none font-semibold text-white tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}
