"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CouponField } from "@/components/store/coupon-field";
import { ShippingCalculator } from "@/components/store/shipping-calculator";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { toast } from "@/components/ui/toast";
import { track, type AnalyticsItem } from "@/lib/analytics/events";
import { formatBRL } from "@/lib/money";
import {
  addToCartAction,
  applyCouponAction,
  quoteCartShippingAction,
  removeCartItemAction,
  removeCouponAction,
  setCartQuantityAction,
  setGiftOptionsAction,
} from "@/server/actions/cart";

/** Quantidade e remover de uma linha da sacola. */
export function CartLineControls({
  itemId,
  name,
  quantity,
  available,
}: {
  itemId: string;
  name: string;
  quantity: number;
  available: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-busy={pending || undefined}>
      <QuantityStepper
        size="sm"
        value={quantity}
        max={available}
        label={name}
        disabled={pending}
        onChange={(next) =>
          startTransition(async () => {
            const result = await setCartQuantityAction(itemId, next);
            if (result.message) toast(result.message);
            router.refresh();
          })
        }
      />
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await removeCartItemAction(itemId);
            router.refresh();
            const removed = result.removed;
            if (!removed) return;
            if (removed.item)
              track("remove_from_cart", {
                currency: "BRL",
                value: removed.item.price * removed.item.quantity,
                items: [removed.item],
              });
            toast(`${removed.name} saiu da sacola`, {
              duration: 5000,
              action: {
                label: "Desfazer",
                onClick: async () => {
                  await addToCartAction(removed.variantId, removed.quantity);
                  router.refresh();
                },
              },
            });
          })
        }
        className="min-h-11 type-small text-moss-700 underline underline-offset-3 hover:text-moss-900"
      >
        Remover<span className="sr-only"> {name} da sacola</span>
      </button>
    </div>
  );
}

const MESSAGE_LIMIT = 240;

/** Cartão com mensagem (gratuito) e embalagem para presente. Salva ao sair do campo e ao marcar. */
export function GiftOptions({
  giftMessage,
  giftWrap,
  giftWrapPriceCents,
}: {
  giftMessage: string | null;
  giftWrap: boolean;
  giftWrapPriceCents: number;
}) {
  const router = useRouter();
  const [withCard, setWithCard] = useState(Boolean(giftMessage));
  const [message, setMessage] = useState(giftMessage ?? "");
  const [wrap, setWrap] = useState(giftWrap);
  const [pending, startTransition] = useTransition();

  function save(next: { giftMessage: string; giftWrap: boolean }) {
    startTransition(async () => {
      const result = await setGiftOptionsAction(next);
      if (!result.ok && result.message) toast(result.message, { tone: "error" });
      router.refresh();
    });
  }

  return (
    <fieldset className="border-t border-line pt-5" aria-busy={pending || undefined}>
      <legend className="float-left mb-2 w-full type-body font-semibold text-ink">
        É um presente?
      </legend>
      <div className="clear-both">
        <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5">
          <input
            type="checkbox"
            className="control-check"
            checked={withCard}
            onChange={(event) => {
              setWithCard(event.target.checked);
              if (!event.target.checked) save({ giftMessage: "", giftWrap: wrap });
            }}
          />
          <span className="type-small text-ink">
            Incluir cartão com mensagem
            <span className="block text-ink-muted">Gratuito. Escrevemos a sua mensagem à mão.</span>
          </span>
        </label>
        {withCard ? (
          <div className="mb-2 ml-8">
            <label htmlFor="mensagem-cartao" className="sr-only">
              Mensagem do cartão
            </label>
            <textarea
              id="mensagem-cartao"
              rows={3}
              maxLength={MESSAGE_LIMIT}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onBlur={() => save({ giftMessage: message, giftWrap: wrap })}
              aria-describedby="mensagem-cartao-contador"
              placeholder="Escreva a mensagem que vai junto com o presente"
              className="w-full rounded-control border border-moss-500 bg-white px-3 py-2.5 text-[16px] text-ink placeholder:text-ink-muted hover:border-moss-700"
            />
            <p id="mensagem-cartao-contador" className="type-caption text-ink-muted tabular-nums">
              {message.length} de {MESSAGE_LIMIT} caracteres
            </p>
          </div>
        ) : null}
        <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5">
          <input
            type="checkbox"
            className="control-check"
            checked={wrap}
            onChange={(event) => {
              setWrap(event.target.checked);
              save({ giftMessage: withCard ? message : "", giftWrap: event.target.checked });
            }}
          />
          <span className="type-small text-ink">
            Embalagem para presente
            <span className="block text-ink-muted tabular-nums">
              {formatBRL(giftWrapPriceCents)}
            </span>
          </span>
        </label>
      </div>
    </fieldset>
  );
}

export function CartCoupon({ applied }: { applied: { code: string; summary: string } | null }) {
  const router = useRouter();
  return (
    <CouponField
      applied={applied}
      apply={async (code) => {
        const result = await applyCouponAction(code);
        if (result.ok) router.refresh();
        return result;
      }}
      remove={async () => {
        const result = await removeCouponAction();
        router.refresh();
        return result;
      }}
    />
  );
}

export function CartShipping({ defaultCep }: { defaultCep: string }) {
  return <ShippingCalculator quote={quoteCartShippingAction} defaultCep={defaultCep} />;
}

/** Dispara view_cart uma vez ao abrir a sacola. */
export function ViewCartTracker({ value, items }: { value: number; items: AnalyticsItem[] }) {
  useEffect(() => {
    if (items.length) track("view_cart", { currency: "BRL", value, items });
    // Uma vez por abertura da página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
