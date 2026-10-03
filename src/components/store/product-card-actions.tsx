"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { track } from "@/lib/analytics/events";
import { cn } from "@/lib/cn";
import { useCart } from "./cart/cart-provider";
import { useWishlist } from "./wishlist-provider";

type WishlistToggleProps = {
  productId: string;
  productName: string;
  className?: string;
};

export function WishlistToggle({ productId, productName, className }: WishlistToggleProps) {
  const router = useRouter();
  const { has, toggle } = useWishlist();
  const [pending, startTransition] = useTransition();
  const pressed = has(productId);

  function handleClick() {
    startTransition(async () => {
      const result = await toggle(productId, !pressed);
      if (result.needsLogin) {
        router.push(`/entrar?voltar=${encodeURIComponent(window.location.pathname)}`);
      } else if (!result.ok && result.message) {
        toast(result.message, { tone: "error" });
      } else if (result.ok && !pressed) {
        track("add_to_wishlist", {
          currency: "BRL",
          value: 0,
          items: [{ item_id: productId, item_name: productName, price: 0, quantity: 1 }],
        });
      }
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
      onClick={handleClick}
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
  const { addItem } = useCart();
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
          const result = await addItem(variantId, 1);
          if (!result.ok && result.message) toast(result.message, { tone: "error" });
        })
      }
    >
      {pending ? <Spinner /> : null}
      Adicionar
      <span className="sr-only"> {productName} à sacola</span>
    </button>
  );
}
