import type { StoreSettings } from "@/config/store.config";
import { getSameDayStatus, nextDeliveryDates, zonedParts } from "@/lib/dates";
import { isCepInRange, normalizeCep } from "@/lib/validators/cep";
import type { ShippingOption, ShippingProvider, ShippingQuoteInput } from "./types";

/** Regra de frete, como na tabela ShippingRule. */
export type ShippingRuleData = {
  code: string;
  name: string;
  method: "SAME_DAY" | "LOCAL_SCHEDULED" | "NATIONAL_ECONOMY" | "NATIONAL_EXPRESS" | "PICKUP";
  cepStart: string;
  cepEnd: string;
  baseFeeCents: number;
  feePerKgCents: number;
  freeAboveCents: number | null;
  usesStoreFreeThreshold: boolean;
  minDays: number;
  maxDays: number;
  cutoffTime: string | null;
  weekdays: number[];
  allowsLocalOnlyProducts: boolean;
  description: string | null;
  isActive: boolean;
  position: number;
};

export type ShippingSettings = Pick<
  StoreSettings,
  "sameDay" | "freeShippingThresholdCents" | "holidays" | "address"
>;

export const LOCAL_ONLY_NOTICE =
  "Plantas naturais, orquídeas e arranjos naturais são entregues apenas na Grande São Paulo. Remova esses itens para ver opções de envio para o seu CEP.";

const SCHEDULE_DAYS = 14;

/**
 * Cálculo simulado de frete a partir das regras cadastradas (seção 9.4). Função pura: recebe as
 * regras e a configuração, e devolve as opções que o cliente vê.
 */
export function computeShippingOptions(
  input: ShippingQuoteInput,
  rules: ShippingRuleData[],
  settings: ShippingSettings,
): ShippingOption[] {
  const cep = normalizeCep(input.cep);
  if (!cep || input.items.length === 0) return [];

  const hasLocalOnly = input.items.some((item) => item.deliveryScope === "LOCAL_ONLY");
  const allSameDay = input.items.every((item) => item.sameDayEligible);
  const weightKg = Math.max(
    1,
    Math.ceil(input.items.reduce((sum, item) => sum + item.weightGrams * item.quantity, 0) / 1000),
  );
  const today = zonedParts(input.now).dateKey;

  const options: ShippingOption[] = [];
  const seenMethods = new Set<string>();

  const matching = rules
    .filter((rule) => rule.isActive && isCepInRange(cep, rule.cepStart, rule.cepEnd))
    .sort((a, b) => a.position - b.position);

  for (const rule of matching) {
    // Uma opção por modalidade: vale a primeira regra, pela ordem.
    if (seenMethods.has(rule.method)) continue;
    if (hasLocalOnly && !rule.allowsLocalOnlyProducts) continue;

    const freeAbove =
      rule.freeAboveCents ??
      (rule.usesStoreFreeThreshold ? settings.freeShippingThresholdCents : null);
    const originalPriceCents =
      rule.method === "NATIONAL_ECONOMY" || rule.method === "NATIONAL_EXPRESS"
        ? rule.baseFeeCents + rule.feePerKgCents * weightKg
        : rule.baseFeeCents;
    const isFree =
      originalPriceCents === 0 ||
      (freeAbove !== null && freeAbove > 0 && input.subtotalCents >= freeAbove);
    const base = {
      code: rule.code,
      name: rule.name,
      priceCents: isFree ? 0 : originalPriceCents,
      originalPriceCents,
      isFree,
      minDays: rule.minDays,
      maxDays: rule.maxDays,
      requiresScheduling: false,
      description: rule.description ?? "",
    };

    switch (rule.method) {
      case "SAME_DAY": {
        if (!allSameDay) break;
        const status = getSameDayStatus(
          {
            enabled: settings.sameDay.enabled,
            cutoffTime: settings.sameDay.cutoffTime,
            days: rule.weekdays as never,
          },
          settings.holidays,
          input.now,
          rule.cutoffTime,
        );
        if (!status.open) break;
        options.push({
          ...base,
          minDays: 0,
          maxDays: 0,
          deliveryDate: today,
          description: `Receba hoje até ${settings.sameDay.deliverByHour}h.`,
        });
        seenMethods.add(rule.method);
        break;
      }
      case "LOCAL_SCHEDULED": {
        const availableDates = nextDeliveryDates(
          input.now,
          SCHEDULE_DAYS,
          rule.weekdays,
          settings.holidays,
          Math.max(1, rule.minDays),
        );
        if (availableDates.length === 0) break;
        options.push({ ...base, requiresScheduling: true, availableDates });
        seenMethods.add(rule.method);
        break;
      }
      case "PICKUP":
        options.push({
          ...base,
          priceCents: 0,
          originalPriceCents: 0,
          isFree: true,
          description: rule.description || settings.address,
        });
        seenMethods.add(rule.method);
        break;
      default:
        options.push(base);
        seenMethods.add(rule.method);
    }
  }

  return options;
}

/** O carrinho tem itens só locais e o CEP não é atendido por nenhuma regra local. */
export function isBlockedByLocalOnly(
  input: ShippingQuoteInput,
  rules: ShippingRuleData[],
): boolean {
  const cep = normalizeCep(input.cep);
  if (!cep || !input.items.some((item) => item.deliveryScope === "LOCAL_ONLY")) return false;
  return !rules.some(
    (rule) =>
      rule.isActive &&
      rule.allowsLocalOnlyProducts &&
      isCepInRange(cep, rule.cepStart, rule.cepEnd),
  );
}

export class MockShippingProvider implements ShippingProvider {
  constructor(
    private readonly load: () => Promise<{ rules: ShippingRuleData[]; settings: ShippingSettings }>,
  ) {}

  async quote(input: ShippingQuoteInput): Promise<ShippingOption[]> {
    const { rules, settings } = await this.load();
    return computeShippingOptions(input, rules, settings);
  }
}
