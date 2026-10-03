"use server";

import type { CouponActionResult } from "@/components/store/coupon-field";
import type { LeadFormInput, LeadFormResult } from "@/components/store/newsletter-form";
import type { ShippingQuoteResult } from "@/components/store/shipping-calculator";
import { storeConfig } from "@/config/store.config";

// Ações de demonstração da página de design system. Devolvem dados fixos e não tocam no banco.

export async function demoQuote(cep: string): Promise<ShippingQuoteResult> {
  const digits = cep.replace(/\D/g, "");
  if (digits.startsWith("9")) {
    return {
      ok: false,
      error: "Este CEP não foi encontrado. Confira os números ou preencha o endereço manualmente.",
    };
  }
  return {
    ok: true,
    options: [
      {
        code: "same-day",
        name: "Entrega hoje",
        priceCents: 2990,
        originalPriceCents: 2990,
        isFree: false,
        minDays: 0,
        maxDays: 0,
        deliveryDate: new Date().toISOString().slice(0, 10),
        requiresScheduling: false,
        description: "Receba hoje até 20h.",
      },
      {
        code: "local-scheduled",
        name: "Entrega agendada",
        priceCents: 0,
        originalPriceCents: 1990,
        isFree: true,
        minDays: 1,
        maxDays: 14,
        requiresScheduling: true,
        description: "Manhã ou tarde, na data que você preferir.",
      },
    ],
  };
}

export async function demoApplyCoupon(code: string): Promise<CouponActionResult> {
  if (code.trim().toUpperCase() === storeConfig.welcomeCoupon) return { ok: true };
  return { ok: false, error: "Este cupom não existe. Confira se digitou corretamente." };
}

export async function demoRemoveCoupon(): Promise<CouponActionResult> {
  return { ok: true };
}

export async function demoSubscribe(input: LeadFormInput): Promise<LeadFormResult> {
  if (input.website) return { ok: false, error: "Não foi possível concluir o cadastro." };
  return { ok: true, couponCode: storeConfig.welcomeCoupon };
}
