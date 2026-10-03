import { formatDate } from "@/lib/dates";
import { formatBRL, percentOf } from "@/lib/money";

/** Dados do cupom que entram na validação (espelham a tabela Coupon). */
export type CouponData = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED" | "FREE_SHIPPING";
  value: number;
  minSubtotalCents: number | null;
  maxDiscountCents: number | null;
  usageLimit: number | null;
  usageCount: number;
  perCustomerLimit: number | null;
  firstPurchaseOnly: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  combinableWithPix: boolean;
  appliesToSameDay: boolean;
  /** Vazio = vale para qualquer categoria. Inclui as subcategorias. */
  categoryIds: string[];
  /** Vazio = vale para qualquer produto. */
  productIds: string[];
};

export type CouponLine = { productId: string; categoryIds: string[]; totalCents: number };

export type CouponContext = {
  now: Date;
  lines: CouponLine[];
  subtotalCents: number;
  /** Quantas vezes este cliente (por conta ou e-mail) já usou o cupom em pedidos pagos. */
  customerRedemptions: number;
  /** O cliente (por e-mail ou CPF) já tem algum pedido pago. */
  hasPaidOrder: boolean;
};

export type CouponResult =
  | {
      ok: true;
      coupon: CouponData;
      discountCents: number;
      freeShipping: boolean;
      /** Resumo para a sacola: "10% de desconto", "R$ 25,00 de desconto", "frete grátis". */
      summary: string;
    }
  | { ok: false; error: string };

export const COUPON_NOT_FOUND = "Este cupom não existe. Confira se digitou corretamente.";

/**
 * Valida um cupom na ordem da seção 9.2. Cada regra tem a sua própria mensagem.
 * Função pura: quem chama carrega o cupom e o histórico do cliente.
 */
export function validateCoupon(coupon: CouponData | null, context: CouponContext): CouponResult {
  // 1. Existe e está ativo.
  if (!coupon || !coupon.isActive) return { ok: false, error: COUPON_NOT_FOUND };

  // 2. Dentro do período.
  if (coupon.startsAt && context.now < coupon.startsAt) {
    return { ok: false, error: `Este cupom só vale a partir de ${formatDate(coupon.startsAt)}.` };
  }
  if (coupon.endsAt && context.now > coupon.endsAt) {
    return { ok: false, error: `Este cupom expirou em ${formatDate(coupon.endsAt)}.` };
  }

  // 3. Limite total de uso.
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    return { ok: false, error: "Este cupom atingiu o limite de usos e não está mais disponível." };
  }

  // 4. Limite por cliente.
  if (coupon.perCustomerLimit !== null && context.customerRedemptions >= coupon.perCustomerLimit) {
    return { ok: false, error: "Você já usou este cupom." };
  }

  // 5. Primeira compra.
  if (coupon.firstPurchaseOnly && context.hasPaidOrder) {
    return { ok: false, error: "Este cupom vale só para a primeira compra." };
  }

  // 6. Subtotal mínimo.
  if (coupon.minSubtotalCents !== null && context.subtotalCents < coupon.minSubtotalCents) {
    const missing = coupon.minSubtotalCents - context.subtotalCents;
    return { ok: false, error: `Faltam ${formatBRL(missing)} para usar este cupom.` };
  }

  // 7. Categorias e produtos: o desconto incide só sobre os itens elegíveis.
  const restricted = coupon.categoryIds.length > 0 || coupon.productIds.length > 0;
  const eligibleCents = restricted
    ? context.lines
        .filter(
          (line) =>
            coupon.productIds.includes(line.productId) ||
            line.categoryIds.some((id) => coupon.categoryIds.includes(id)),
        )
        .reduce((sum, line) => sum + line.totalCents, 0)
    : context.subtotalCents;
  if (restricted && eligibleCents === 0) {
    return { ok: false, error: "Este cupom não vale para os produtos da sua sacola." };
  }

  if (coupon.type === "FREE_SHIPPING") {
    return { ok: true, coupon, discountCents: 0, freeShipping: true, summary: "frete grátis" };
  }

  let discountCents =
    coupon.type === "PERCENT"
      ? percentOf(eligibleCents, coupon.value)
      : Math.min(coupon.value, eligibleCents);
  if (coupon.maxDiscountCents !== null)
    discountCents = Math.min(discountCents, coupon.maxDiscountCents);

  return {
    ok: true,
    coupon,
    discountCents,
    freeShipping: false,
    summary:
      coupon.type === "PERCENT"
        ? `${coupon.value}% de desconto`
        : `${formatBRL(discountCents)} de desconto`,
  };
}

/** Prévia em linguagem simples para o admin: "10% de desconto, válido na primeira compra, a partir de R$ 100,00, até 30/11/2026". */
export function describeCoupon(
  coupon: Omit<CouponData, "id" | "usageCount" | "categoryIds" | "productIds">,
): string {
  const parts: string[] = [];
  if (coupon.type === "PERCENT") parts.push(`${coupon.value}% de desconto`);
  if (coupon.type === "FIXED") parts.push(`${formatBRL(coupon.value)} de desconto`);
  if (coupon.type === "FREE_SHIPPING") parts.push("frete grátis");
  if (coupon.maxDiscountCents) parts.push(`limitado a ${formatBRL(coupon.maxDiscountCents)}`);
  if (coupon.firstPurchaseOnly) parts.push("válido na primeira compra");
  if (coupon.minSubtotalCents) parts.push(`a partir de ${formatBRL(coupon.minSubtotalCents)}`);
  if (coupon.startsAt) parts.push(`de ${formatDate(coupon.startsAt)}`);
  if (coupon.endsAt) parts.push(`até ${formatDate(coupon.endsAt)}`);
  if (coupon.perCustomerLimit)
    parts.push(
      `${coupon.perCustomerLimit} ${coupon.perCustomerLimit === 1 ? "uso" : "usos"} por cliente`,
    );
  if (coupon.usageLimit) parts.push(`${coupon.usageLimit} usos no total`);
  if (!coupon.combinableWithPix) parts.push("não acumula com o desconto do Pix");
  return parts.join(", ");
}
