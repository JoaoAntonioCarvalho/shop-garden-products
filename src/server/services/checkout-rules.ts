import { businessDaysUntil, zonedParts } from "@/lib/dates";
import type { ShippingOption } from "@/server/providers/shipping/types";

export type BoletoAvailability = { available: true } | { available: false; reason: string };

const BOLETO_MIN_BUSINESS_DAYS = 3;

/**
 * Boleto indisponível (seção 9.6): com "Entrega hoje", com entrega agendada em menos de 3 dias
 * úteis e com itens perecíveis. O motivo é exibido ao lado da opção desabilitada.
 */
export function boletoAvailability(input: {
  option: ShippingOption | null;
  deliveryDate?: string | null;
  hasPerishable: boolean;
  holidays: string[];
  now: Date;
}): BoletoAvailability {
  if (input.hasPerishable) {
    return {
      available: false,
      reason:
        "Indisponível para pedidos com plantas vivas e arranjos naturais, porque a compensação leva até 3 dias úteis.",
    };
  }
  if (input.option?.deliveryDate && input.option.minDays === 0) {
    return {
      available: false,
      reason: "Indisponível para entrega hoje, porque a compensação leva até 3 dias úteis.",
    };
  }
  if (input.option?.requiresScheduling && input.deliveryDate) {
    const days = businessDaysUntil(
      zonedParts(input.now).dateKey,
      input.deliveryDate,
      input.holidays,
    );
    if (days < BOLETO_MIN_BUSINESS_DAYS) {
      return {
        available: false,
        reason:
          "Indisponível para entregas agendadas em menos de 3 dias úteis. Escolha uma data mais à frente ou pague com Pix.",
      };
    }
  }
  return { available: true };
}

/** Tipo de entrega, para a linha do tempo e para decidir entre "enviado" e "saiu para entrega". */
export function shippingKindOf(methodCode: string): "transport" | "local" | "pickup" {
  if (
    methodCode.startsWith("economico") ||
    methodCode.startsWith("expresso") ||
    methodCode.startsWith("manual-transportadora")
  )
    return "transport";
  if (methodCode.startsWith("retirada")) return "pickup";
  return "local";
}
