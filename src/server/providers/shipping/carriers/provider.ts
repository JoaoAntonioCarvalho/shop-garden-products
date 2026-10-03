import { normalizeCep } from "@/lib/validators/cep";
import { computeShippingOptions, type ShippingRuleData, type ShippingSettings } from "../mock";
import type { ShippingOption, ShippingProvider, ShippingQuoteInput } from "../types";
import { estimatePackage, type ItemDimensions } from "./package";
import type { Carrier, CarrierServiceQuote, ServiceKind } from "./types";

export type ItemShipmentInfo = {
  dimensions: ItemDimensions;
  /** O produto só pode ser enviado pela Jadlog (volumosos, plantas que os Correios não aceitam). */
  jadlogOnly: boolean;
};

type Dependencies = {
  carriers: Carrier[];
  load: () => Promise<{ rules: ShippingRuleData[]; settings: ShippingSettings }>;
  loadItemInfo: (variantIds: string[]) => Promise<Map<string, ItemShipmentInfo>>;
  originCep: string;
  /** Dias úteis para separar e postar, somados ao prazo da transportadora. */
  handlingDays: number;
  log?: (message: string) => void;
};

type Quotes = Partial<Record<ServiceKind, CarrierServiceQuote>>;

const CACHE_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 500;

/**
 * Frete com preço e prazo das transportadoras ligadas (Correios, Jadlog). As regras de Frete e
 * entrega do painel continuam valendo para tudo que é da loja: onde cada modalidade é oferecida,
 * entrega local (hoje, agendada, retirada), frete grátis e itens só locais. Nas modalidades
 * nacionais, o valor e o prazo da tabela são trocados pelos da transportadora mais barata entre
 * as que podem levar a sacola.
 *
 * - Sacola com produto marcado como "só Jadlog": só a Jadlog é consultada.
 * - Transportadora fora do ar: vale a tabela do painel, para o checkout não parar.
 * - Todas responderam que não atendem (CEP, peso, medidas): a modalidade sai.
 */
export class CarrierShippingProvider implements ShippingProvider {
  private readonly cache = new Map<string, { at: number; quotes: Quotes }>();

  constructor(private readonly deps: Dependencies) {}

  private log(message: string) {
    (this.deps.log ?? console.error)(`[frete] ${message}`);
  }

  async quote(input: ShippingQuoteInput): Promise<ShippingOption[]> {
    const { rules, settings } = await this.deps.load();
    const options = computeShippingOptions(input, rules, settings);
    const kindOf = (option: ShippingOption): ServiceKind | null => {
      const method = rules.find((rule) => rule.code === option.code)?.method;
      return method === "NATIONAL_ECONOMY"
        ? "economy"
        : method === "NATIONAL_EXPRESS"
          ? "express"
          : null;
    };
    const kinds = [...new Set(options.map(kindOf).filter((kind) => kind !== null))];
    const destinationCep = normalizeCep(input.cep);
    if (kinds.length === 0 || !destinationCep) return options;

    const info = await this.deps.loadItemInfo(input.items.map((item) => item.variantId));
    const jadlogOnly = input.items.some((item) => info.get(item.variantId)?.jadlogOnly);
    const carriers = this.deps.carriers.filter(
      (carrier) => !jadlogOnly || carrier.key === "jadlog",
    );
    if (carriers.length === 0) {
      this.log(
        "a sacola tem produto só Jadlog e a Jadlog não está ligada: usando a tabela do painel",
      );
      return options;
    }
    const parcel = estimatePackage(
      input.items.map((item) => ({
        quantity: item.quantity,
        weightGrams: item.weightGrams,
        dimensions: info.get(item.variantId)?.dimensions ?? null,
      })),
    );

    const answers = await Promise.all(
      carriers.map(async (carrier) => {
        // A mesma sacola é cotada várias vezes (produto, sacola, cada passo do checkout, pedido).
        const key = [
          carrier.key,
          destinationCep,
          parcel.weightGrams,
          parcel.lengthCm,
          parcel.widthCm,
          parcel.heightCm,
          input.subtotalCents,
          ...kinds,
        ].join("|");
        const now = input.now.getTime();
        const cached = this.cache.get(key);
        if (cached && Math.abs(now - cached.at) < CACHE_MS)
          return { carrier, quotes: cached.quotes };
        try {
          const quotes = await carrier.quote({
            originCep: this.deps.originCep,
            destinationCep,
            parcel,
            declaredValueCents: input.subtotalCents,
            kinds,
          });
          if (this.cache.size >= CACHE_LIMIT) this.cache.clear();
          this.cache.set(key, { at: now, quotes });
          return { carrier, quotes };
        } catch (error) {
          this.log(
            `${carrier.label} indisponível: ${error instanceof Error ? error.message : "erro"}`,
          );
          return { carrier, quotes: null };
        }
      }),
    );
    const someUnavailable = answers.some((answer) => answer.quotes === null);

    return options.flatMap((option) => {
      const kind = kindOf(option);
      if (!kind) return [option];
      const candidates = answers.flatMap(({ carrier, quotes }) => {
        const quote = quotes?.[kind];
        if (quotes && !quote?.ok)
          this.log(
            `${carrier.label} não atende ${option.name} para o CEP ${destinationCep}: ${
              quote?.error ?? "sem resposta"
            }`,
          );
        return quote?.ok ? [{ carrier, quote }] : [];
      });
      if (candidates.length === 0) return someUnavailable ? [option] : [];
      // A mais barata; no empate, a mais rápida.
      const best = candidates.reduce((a, b) =>
        b.quote.priceCents < a.quote.priceCents ||
        (b.quote.priceCents === a.quote.priceCents && b.quote.businessDays < a.quote.businessDays)
          ? b
          : a,
      );
      const rule = rules.find((item) => item.code === option.code);
      const spread = rule ? Math.max(0, rule.maxDays - rule.minDays) : 0;
      const minDays = best.quote.businessDays + this.deps.handlingDays;
      return [
        {
          ...option,
          // O nome com a transportadora vai para o pedido: a equipe sabe por onde despachar.
          name: `${option.name} (${best.carrier.label})`,
          originalPriceCents: best.quote.priceCents,
          priceCents: option.isFree ? 0 : best.quote.priceCents,
          minDays,
          maxDays: minDays + spread,
        },
      ];
    });
  }
}
