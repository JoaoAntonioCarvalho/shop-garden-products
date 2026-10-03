"use client";

import { ChevronLeft, ChevronRight, Expand, X, ZoomIn, ZoomOut } from "lucide-react";
import Image from "next/image";
import { Dialog as RadixDialog } from "radix-ui";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useCart } from "@/components/store/cart/cart-provider";
import { ShippingCalculator } from "@/components/store/shipping-calculator";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { controlClasses } from "@/components/ui/input";
import { Price } from "@/components/ui/price";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { track } from "@/lib/analytics/events";
import { cn } from "@/lib/cn";
import { centsToReais, formatBRL } from "@/lib/money";
import { buyNowAction, quoteProductShippingAction } from "@/server/actions/cart";
import type { FormResult } from "@/server/actions/leads";
import type { PriceDisplay } from "@/server/services/pricing";

export type ViewImage = {
  id: string;
  url: string;
  alt: string;
  blurDataUrl: string | null;
  variantId: string | null;
};

export type ViewVariant = {
  id: string;
  name: string;
  sku: string;
  options: Record<string, string>;
  available: number;
  lowStockThreshold: number;
  price: PriceDisplay;
};

type ProductViewProps = {
  product: { id: string; name: string; sku: string; slug: string; categoryName?: string };
  images: ViewImage[];
  variants: ViewVariant[];
  /** Título, nome científico e nota (renderizados no servidor). */
  header: ReactNode;
  /** Blocos abaixo dos botões: entrega hoje, frete, presente, WhatsApp. */
  children?: ReactNode;
  notifyBackInStock: (input: {
    email: string;
    productId: string;
    variantId: string;
    website?: string;
  }) => Promise<FormResult>;
};

// ───────────────────────── Galeria ─────────────────────────

function Gallery({ images, productName }: { images: ViewImage[]; productName: string }) {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const current = images[Math.min(index, images.length - 1)];
  const many = images.length > 1;

  const go = (next: number) => {
    const target = (next + images.length) % images.length;
    setIndex(target);
    setZoomed(false);
    const strip = stripRef.current;
    if (strip) strip.scrollTo({ left: strip.clientWidth * target, behavior: "smooth" });
  };

  if (!current) {
    return <div className="aspect-4/5 rounded-photo bg-white" />;
  }

  return (
    <div className="lg:grid lg:grid-cols-[72px_1fr] lg:gap-4">
      {/* Miniaturas verticais no desktop */}
      {many ? (
        <ul className="hidden flex-col gap-2 lg:flex" aria-label="Fotos do produto">
          {images.map((image, i) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={`Ver foto ${i + 1} de ${images.length}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "relative block aspect-4/5 w-full overflow-hidden rounded-photo border bg-white",
                  i === index ? "border-moss-700" : "border-line hover:border-moss-500",
                )}
              >
                <Image src={image.url} alt="" fill sizes="72px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="hidden lg:block" />
      )}

      <div className="relative">
        {/* Desktop: uma foto por vez. Mobile: carrossel com deslize. */}
        <div
          ref={stripRef}
          onScroll={(event) => {
            const strip = event.currentTarget;
            const next = Math.round(strip.scrollLeft / strip.clientWidth);
            if (next !== index && window.matchMedia("(max-width: 1023px)").matches) setIndex(next);
          }}
          className="-mx-6 flex snap-x snap-mandatory overflow-x-auto lg:mx-0 lg:block lg:overflow-visible"
        >
          {images.map((image, i) => (
            <button
              key={image.id}
              type="button"
              onClick={() => {
                setIndex(i);
                setFullscreen(true);
              }}
              aria-label={`Ampliar foto ${i + 1} de ${images.length}: ${image.alt || productName}`}
              className={cn(
                "relative block aspect-4/5 w-full flex-none snap-center overflow-hidden bg-white lg:rounded-photo",
                i === index ? "lg:block" : "lg:hidden",
                i === 0 && "animate-fade-in",
              )}
            >
              <Image
                src={image.url}
                alt={image.alt || productName}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                priority={i === 0}
                placeholder={image.blurDataUrl ? "blur" : "empty"}
                blurDataURL={image.blurDataUrl ?? undefined}
                className="object-cover"
              />
            </button>
          ))}
        </div>

        <span className="pointer-events-none absolute right-3 bottom-3 hidden rounded-control bg-white/90 p-2 text-moss-700 lg:block">
          <Expand aria-hidden="true" strokeWidth={1.5} className="size-5" />
        </span>

        {many ? (
          <div className="mt-3 flex items-center justify-center gap-1 lg:hidden" aria-hidden="true">
            {images.map((image, i) => (
              <span
                key={image.id}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-5 bg-moss-700" : "w-1.5 bg-moss-500/40",
                )}
              />
            ))}
          </div>
        ) : null}
        <p className="sr-only" aria-live="polite">
          Foto {index + 1} de {images.length}
        </p>
      </div>

      <RadixDialog.Root
        open={fullscreen}
        onOpenChange={(open) => {
          setFullscreen(open);
          setZoomed(false);
        }}
      >
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-50 bg-white" />
          <RadixDialog.Content
            aria-describedby={undefined}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") go(index + 1);
              if (event.key === "ArrowLeft") go(index - 1);
            }}
            className="fixed inset-0 z-50 flex flex-col"
          >
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
              <RadixDialog.Title className="type-small text-ink">
                {productName}, foto {index + 1} de {images.length}
              </RadixDialog.Title>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoomed((value) => !value)}
                  aria-pressed={zoomed}
                  aria-label={zoomed ? "Reduzir zoom" : "Aumentar zoom"}
                  className="flex size-11 items-center justify-center rounded-control text-moss-700 hover:bg-moss-100"
                >
                  {zoomed ? (
                    <ZoomOut aria-hidden="true" strokeWidth={1.5} className="size-5" />
                  ) : (
                    <ZoomIn aria-hidden="true" strokeWidth={1.5} className="size-5" />
                  )}
                </button>
                <RadixDialog.Close
                  aria-label="Fechar"
                  className="flex size-11 items-center justify-center rounded-control text-moss-700 hover:bg-moss-100"
                >
                  <X aria-hidden="true" strokeWidth={1.5} className="size-5" />
                </RadixDialog.Close>
              </div>
            </div>
            {/* O contêiner rola quando há zoom; no celular o gesto de pinça do navegador também funciona. */}
            <div
              className="relative flex-1 overflow-auto"
              onWheel={(event) => {
                if (event.deltaY < 0 && !zoomed) setZoomed(true);
                if (event.deltaY > 0 && zoomed && event.currentTarget.scrollTop === 0)
                  setZoomed(false);
              }}
            >
              <div
                className={cn("relative mx-auto", zoomed ? "h-[200%] w-[200%]" : "h-full w-full")}
              >
                <Image
                  src={current.url}
                  alt={current.alt || productName}
                  fill
                  sizes={zoomed ? "200vw" : "100vw"}
                  onClick={() => setZoomed((value) => !value)}
                  className={cn("object-contain", zoomed ? "cursor-zoom-out" : "cursor-zoom-in")}
                />
              </div>
            </div>
            {many ? (
              <div className="flex items-center justify-center gap-4 border-t border-line p-2">
                <button
                  type="button"
                  onClick={() => go(index - 1)}
                  aria-label="Foto anterior"
                  className="flex size-11 items-center justify-center rounded-control text-moss-700 hover:bg-moss-100"
                >
                  <ChevronLeft aria-hidden="true" strokeWidth={1.5} className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={() => go(index + 1)}
                  aria-label="Próxima foto"
                  className="flex size-11 items-center justify-center rounded-control text-moss-700 hover:bg-moss-100"
                >
                  <ChevronRight aria-hidden="true" strokeWidth={1.5} className="size-6" />
                </button>
              </div>
            ) : null}
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </div>
  );
}

// ───────────────────────── Avise-me ─────────────────────────

function BackInStockForm({
  productId,
  variantId,
  notify,
}: {
  productId: string;
  variantId: string;
  notify: ProductViewProps["notifyBackInStock"];
}) {
  const [result, setResult] = useState<FormResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (result?.ok) {
    return (
      <Alert tone="success" live>
        {result.message}
      </Alert>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        startTransition(async () => {
          setResult(
            await notify({
              email: String(form.get("email") ?? ""),
              website: String(form.get("website") ?? ""),
              productId,
              variantId,
            }),
          );
        });
      }}
      className="flex flex-col gap-2"
    >
      <label htmlFor="avise-me-email" className="type-small font-medium text-ink">
        Avise-me quando chegar
      </label>
      <div className="flex gap-2">
        <input
          id="avise-me-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Seu e-mail"
          aria-describedby={result && !result.ok ? "avise-me-erro" : undefined}
          aria-invalid={result && !result.ok ? true : undefined}
          className={cn(controlClasses, "h-11")}
        />
        <Button type="submit" variant="secondary" loading={pending}>
          Avisar
        </Button>
      </div>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <p id="avise-me-erro" aria-live="polite" className="type-small text-danger empty:hidden">
        {result && !result.ok ? result.error : null}
      </p>
    </form>
  );
}

// ───────────────────────── Galeria + compra ─────────────────────────

/** Galeria e bloco de compra compartilham a variante escolhida: trocar a variante troca as fotos. */
export function ProductView({
  product,
  images,
  variants,
  header,
  children,
  notifyBackInStock,
}: ProductViewProps) {
  const { addItem } = useCart();
  const firstAvailable = variants.find((variant) => variant.available > 0) ?? variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAdd, startAdd] = useTransition();
  const [pendingBuy, startBuy] = useTransition();
  const [barVisible, setBarVisible] = useState(false);
  const addButtonRef = useRef<HTMLDivElement>(null);

  const variant = variants.find((item) => item.id === variantId) ?? variants[0];
  const soldOut = !variant || variant.available <= 0;
  const optionNames = useMemo(
    () => [...new Set(variants.flatMap((item) => Object.keys(item.options)))],
    [variants],
  );

  // Fotos da variante escolhida primeiro; sem fotos próprias, as gerais do produto.
  const selectedId = variant?.id;
  const ownImages = images.filter((image) => image.variantId === selectedId);
  const sharedImages = images.filter((image) => image.variantId === null);
  const galleryImages = ownImages.length
    ? [...ownImages, ...sharedImages]
    : sharedImages.length
      ? sharedImages
      : images;

  useEffect(() => {
    if (!variant) return;
    track("view_item", {
      currency: "BRL",
      value: centsToReais(variant.price.priceCents),
      items: [
        {
          item_id: variant.sku,
          item_name: product.name,
          item_category: product.categoryName,
          item_variant: variant.name,
          price: centsToReais(variant.price.priceCents),
          quantity: 1,
        },
      ],
    });
    // Só no primeiro carregamento da página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Barra fixa no mobile quando o botão principal sai da tela.
  useEffect(() => {
    const element = addButtonRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) =>
      setBarVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function selectOption(name: string, value: string) {
    const wanted = { ...variant.options, [name]: value };
    const exact = variants.find((item) =>
      optionNames.every((key) => item.options[key] === wanted[key]),
    );
    const fallback = variants.find((item) => item.options[name] === value);
    const next = exact ?? fallback;
    if (next) {
      setVariantId(next.id);
      setQuantity(1);
      setMessage(null);
    }
  }

  function add() {
    if (!variant) return;
    startAdd(async () => {
      const result = await addItem(variant.id, quantity);
      setMessage(
        result.ok ? null : (result.message ?? "Não foi possível adicionar. Tente de novo."),
      );
    });
  }

  function buy() {
    if (!variant) return;
    startBuy(async () => {
      // Em caso de sucesso a ação redireciona para o checkout e não retorna.
      const result = await buyNowAction(variant.id, quantity);
      if (result && !result.ok)
        setMessage(result.message ?? "Não foi possível continuar. Tente de novo.");
    });
  }

  const addButton = (className?: string) => (
    <Button size="lg" className={className} loading={pendingAdd} disabled={soldOut} onClick={add}>
      Adicionar à sacola
    </Button>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,58fr)_minmax(0,42fr)] lg:gap-12">
      <Gallery key={variant?.id} images={galleryImages} productName={product.name} />

      <div className="lg:sticky lg:top-24 lg:self-start">
        {header}
        {variant ? <p className="mt-1 type-caption text-ink-muted">Código {variant.sku}</p> : null}

        {variant ? <Price price={variant.price} size="product" className="mt-5" /> : null}

        {optionNames.map((name) => {
          const values = [...new Set(variants.map((item) => item.options[name]).filter(Boolean))];
          return (
            <fieldset key={name} className="mt-6">
              <legend className="type-small font-medium text-ink">
                {name}: <span className="font-normal text-ink-muted">{variant.options[name]}</span>
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {values.map((value) => {
                  const candidates = variants.filter((item) => item.options[name] === value);
                  const available = candidates.some((item) => item.available > 0);
                  const selected = variant.options[name] === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => selectOption(name, value)}
                      className={cn(
                        "min-h-11 rounded-control border px-4 text-[15px] transition-colors",
                        selected
                          ? "border-moss-700 bg-moss-100 font-medium text-moss-900"
                          : "border-moss-500 bg-white text-ink hover:border-moss-700",
                        !available && "text-ink-muted line-through",
                      )}
                    >
                      {value}
                      {!available ? <span className="sr-only"> (esgotado)</span> : null}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        <div className="mt-6" aria-live="polite">
          {soldOut ? (
            <Alert tone="warning" title="Esgotado" />
          ) : variant.available <= variant.lowStockThreshold ? (
            <Alert
              tone="warning"
              title={
                variant.available === 1 ? "Última unidade" : `Últimas ${variant.available} unidades`
              }
            />
          ) : (
            <p className="flex items-center gap-2 type-small text-success">
              <span aria-hidden="true" className="size-2 rounded-full bg-success" />
              Em estoque
            </p>
          )}
        </div>

        {soldOut && variant ? (
          <div className="mt-5">
            <BackInStockForm
              key={variant.id}
              productId={product.id}
              variantId={variant.id}
              notify={notifyBackInStock}
            />
          </div>
        ) : (
          <div ref={addButtonRef} className="mt-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <QuantityStepper
                value={quantity}
                onChange={setQuantity}
                max={Math.max(1, variant.available)}
                label={product.name}
              />
              {addButton("flex-1")}
            </div>
            <Button size="lg" variant="secondary" loading={pendingBuy} onClick={buy}>
              Comprar agora
            </Button>
            {message ? (
              <Alert tone="error" live>
                {message}
              </Alert>
            ) : null}
          </div>
        )}

        {variant ? (
          <ShippingCalculator
            key={`${variant.id}-${quantity}`}
            className="mt-6"
            quote={(cep) => quoteProductShippingAction(variant.id, quantity, cep)}
          />
        ) : null}

        {children}
      </div>

      {/* Barra fixa no mobile */}
      {!soldOut && variant ? (
        <div
          aria-hidden={!barVisible}
          className={cn(
            "fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-line bg-white px-4 py-2.5 transition-transform lg:hidden",
            barVisible ? "translate-y-0" : "translate-y-full",
          )}
        >
          <p className="flex-1 leading-tight">
            <span className="block text-[16px] font-semibold text-ink tabular-nums">
              {formatBRL(variant.price.priceCents)}
            </span>
            <span className="block type-caption text-moss-700 tabular-nums">
              {formatBRL(variant.price.pixCents)} no Pix
            </span>
          </p>
          <Button loading={pendingAdd} tabIndex={barVisible ? 0 : -1} onClick={add}>
            Adicionar à sacola
          </Button>
        </div>
      ) : null}
    </div>
  );
}
