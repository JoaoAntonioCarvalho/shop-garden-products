import type { StoreSettings } from "@/config/store.config";
import { percentOf } from "@/lib/money";

/** Campos da variante que entram no cálculo de preço. */
export type PricedVariant = {
  priceCents: number;
  compareAtPriceCents?: number | null;
  promoPriceCents?: number | null;
  promoStartsAt?: Date | null;
  promoEndsAt?: Date | null;
};

export type PricingSettings = Pick<
  StoreSettings,
  "pixDiscountPercent" | "maxInstallments" | "minInstallmentCents"
>;

export type PriceDisplay = {
  /** Preço efetivo (com promoção, se ativa). */
  priceCents: number;
  /** Preço "de", só quando maior que o efetivo. */
  compareAtCents: number | null;
  /** Percentual de desconto sobre o preço "de", arredondado para baixo. */
  discountPercent: number | null;
  onPromotion: boolean;
  /** Fim da promoção, para o JSON-LD (priceValidUntil). */
  promoEndsAt: Date | null;
  pixCents: number;
  pixDiscountPercent: number;
  /** Nulo quando só cabe uma parcela: nesse caso exibe-se apenas o preço à vista. */
  installments: { count: number; valueCents: number } | null;
};

export function isPromoActive(variant: PricedVariant, now: Date = new Date()): boolean {
  if (variant.promoPriceCents == null) return false;
  if (variant.promoPriceCents >= variant.priceCents) return false;
  if (variant.promoStartsAt && now < variant.promoStartsAt) return false;
  if (variant.promoEndsAt && now > variant.promoEndsAt) return false;
  return true;
}

export function getEffectivePriceCents(variant: PricedVariant, now: Date = new Date()): number {
  return isPromoActive(variant, now) ? (variant.promoPriceCents as number) : variant.priceCents;
}

/** Preço no Pix: efetivo menos o percentual; meio centavo arredonda para cima. */
export function getPixPriceCents(priceCents: number, pixDiscountPercent: number): number {
  return percentOf(priceCents, 100 - pixDiscountPercent);
}

/** Maior número de parcelas sem juros que respeita a parcela mínima. Nulo se só couber uma. */
export function getInstallments(
  priceCents: number,
  settings: Pick<PricingSettings, "maxInstallments" | "minInstallmentCents">,
): PriceDisplay["installments"] {
  const byMinimum = Math.floor(priceCents / settings.minInstallmentCents);
  const count = Math.min(settings.maxInstallments, byMinimum);
  if (count < 2) return null;
  return { count, valueCents: Math.round(priceCents / count) };
}

/**
 * Única função de cálculo de preço da loja. Alimenta card, página de produto, sacola e checkout.
 * Nenhum componente recalcula preço por conta própria.
 */
export function getPriceDisplay(
  variant: PricedVariant,
  settings: PricingSettings,
  now: Date = new Date(),
): PriceDisplay {
  const onPromotion = isPromoActive(variant, now);
  const priceCents = onPromotion ? (variant.promoPriceCents as number) : variant.priceCents;

  const candidate = onPromotion
    ? Math.max(variant.compareAtPriceCents ?? 0, variant.priceCents)
    : (variant.compareAtPriceCents ?? 0);
  const compareAtCents = candidate > priceCents ? candidate : null;
  const discountPercent = compareAtCents
    ? Math.floor(((compareAtCents - priceCents) * 100) / compareAtCents)
    : null;

  return {
    priceCents,
    compareAtCents,
    discountPercent: discountPercent && discountPercent > 0 ? discountPercent : null,
    onPromotion,
    promoEndsAt: onPromotion ? (variant.promoEndsAt ?? null) : null,
    pixCents: getPixPriceCents(priceCents, settings.pixDiscountPercent),
    pixDiscountPercent: settings.pixDiscountPercent,
    installments: getInstallments(priceCents, settings),
  };
}
