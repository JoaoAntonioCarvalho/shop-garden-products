"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

type ActionResult = { ok: boolean; message?: string };

/**
 * Ações do card ligadas ao servidor. São registradas uma vez pelo layout da loja
 * (carrinho na fase 4, favoritos na fase 5), para que o card não dependa desses módulos.
 */
type CardActions = {
  addToCart?: (variantId: string, productName: string) => Promise<ActionResult>;
  toggleWishlist?: (productId: string, next: boolean) => Promise<ActionResult>;
};

const registered: CardActions = {};

export function registerCardActions(actions: CardActions) {
  Object.assign(registered, actions);
}

type WishlistToggleProps = {
  productId: string;
  productName: string;
  initial: boolean;
  className?: string;
};

export function WishlistToggle({
  productId,
  productName,
  initial,
  className,
}: WishlistToggleProps) {
  const [pressed, setPressed] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !pressed;
    setPressed(next);
    startTransition(async () => {
      const result = await registered.toggleWishlist?.(productId, next);
      if (result && !result.ok) setPressed(!next);
    });
  }

  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={
        pressed ? `Remover ${productName} dos favoritos` : `Adicionar ${productName} aos favoritos`
      }
      disabled={pending}
      onClick={toggle}
      className={cn(
        "flex size-11 items-center justify-center rounded-full text-moss-700 transition-colors hover:text-moss-900",
        className,
      )}
    >
      <span className="flex size-8 items-center justify-center rounded-full bg-white/90">
        <Heart
          aria-hidden="true"
          strokeWidth={1.5}
          fill={pressed ? "currentColor" : "none"}
          className="size-[18px]"
        />
      </span>
    </button>
  );
}

type CardAddButtonProps = {
  productSlug: string;
  productName: string;
  variantId: string | null;
  hasOptions: boolean;
  soldOut: boolean;
};

const linkClass = buttonClasses(
  "ghost",
  "sm",
  "-ml-3 justify-start text-left whitespace-normal underline underline-offset-3",
);

export function CardAddButton({
  productSlug,
  productName,
  variantId,
  hasOptions,
  soldOut,
}: CardAddButtonProps) {
  const [pending, startTransition] = useTransition();
  const href = `/produto/${productSlug}`;

  if (soldOut) {
    return (
      <Link href={href} className={linkClass}>
        Avise-me quando chegar
        <span className="sr-only">: {productName}</span>
      </Link>
    );
  }

  if (hasOptions || !variantId) {
    return (
      <Link href={href} className={linkClass}>
        Escolher opções
        <span className="sr-only"> de {productName}</span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={linkClass}
      aria-busy={pending || undefined}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await registered.addToCart?.(variantId, productName);
        })
      }
    >
      {pending ? <Spinner /> : null}
      Adicionar
      <span className="sr-only"> {productName} à sacola</span>
    </button>
  );
}
