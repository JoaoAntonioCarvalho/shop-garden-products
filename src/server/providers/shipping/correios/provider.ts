import { normalizeCep } from "@/lib/validators/cep";
import { computeShippingOptions, type ShippingRuleData, type ShippingSettings } from "../mock";
import type { ShippingOption, ShippingProvider, ShippingQuoteInput } from "../types";
import type { CorreiosClient, CorreiosServiceQuote } from "./client";
import { estimatePackage, type ItemDimensions } from "./package";

export type CorreiosProviderOptions = {
  originCep: string;
  /** Código do serviço usado no envio econômico (PAC) e no expresso (SEDEX) do contrato. */
  services: { economy: string; express: string };
  /** Dias úteis para separar e postar, somados ao prazo dos Correios. */
  handlingDays: number;
};

type Dependencies = {
  client: Pick<CorreiosClient, "quote">;
  load: () => Promise<{ rules: ShippingRuleData[]; settings: ShippingSettings }>;
  loadDimensions: (variantIds: string[]) => Promise<Map<string, ItemDimensions>>;
  options: CorreiosProviderOptions;
  log?: (message: string) => void;
};

const CACHE_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 500;

/**
 * Frete com preço e prazo dos Correios. As regras de Frete e entrega do painel continuam valendo
 * para tudo que é da loja: onde cada modalidade é oferecida, entrega local (hoje, agendada,
 * retirada), frete grátis e itens só locais. Nas modalidades nacionais, o valor e o prazo da
 * tabela são trocados pelos dos Correios (econômico pelo PAC, expresso pelo SEDEX).
 *
 * Se os Correios estiverem fora do ar, vale a tabela do painel, para o checkout não parar.
 * Se os Correios responderem que o serviço não atende o envio (CEP, peso, medidas), a opção sai.
 */
export class CorreiosShippingProvider implements ShippingProvider {
  private readonly cache = new Map<
    string,
    { at: number; quotes: Record<string, CorreiosServiceQuote> }
  >();

  constructor(private readonly deps: Dependencies) {}

  async quote(input: ShippingQuoteInput): Promise<ShippingOption[]> {
    const { rules, settings } = await this.deps.load();
    const options = computeShippingOptions(input, rules, settings);
    const { economy, express } = this.deps.options.services;
    const serviceOf = (option: ShippingOption): string | null => {
      const method = rules.find((rule) => rule.code === option.code)?.method;
      return method === "NATIONAL_ECONOMY"
        ? economy
        : method === "NATIONAL_EXPRESS"
          ? express
          : null;
    };
    const services = [...new Set(options.map(serviceOf).filter((code) => code !== null))];
    const destinationCep = normalizeCep(input.cep);
    if (services.length === 0 || !destinationCep) return options;

    let quotes: Record<string, CorreiosServiceQuote>;
    try {
      quotes = await this.carrierQuotes(input, destinationCep, services);
    } catch (error) {
      (this.deps.log ?? console.error)(
        `[correios] cotação indisponível, usando a tabela do painel: ${
          error instanceof Error ? error.message : "erro"
        }`,
      );
      return options;
    }

    return options.flatMap((option) => {
      const service = serviceOf(option);
      if (!service) return [option];
      const carrier = quotes[service];
      if (!carrier?.ok) {
        (this.deps.log ?? console.error)(
          `[correios] serviço ${service} não atende o CEP ${destinationCep}: ${
            carrier?.error ?? "sem resposta"
          }`,
        );
        return [];
      }
      const rule = rules.find((item) => item.code === option.code);
      const spread = rule ? Math.max(0, rule.maxDays - rule.minDays) : 0;
      const minDays = carrier.businessDays + this.deps.options.handlingDays;
      return [
        {
          ...option,
          originalPriceCents: carrier.priceCents,
          priceCents: option.isFree ? 0 : carrier.priceCents,
          minDays,
          maxDays: minDays + spread,
        },
      ];
    });
  }

  private async carrierQuotes(
    input: ShippingQuoteInput,
    destinationCep: string,
    services: string[],
  ): Promise<Record<string, CorreiosServiceQuote>> {
    const dimensions = await this.deps.loadDimensions(input.items.map((item) => item.variantId));
    const parcel = estimatePackage(
      input.items.map((item) => ({
        quantity: item.quantity,
        weightGrams: item.weightGrams,
        dimensions: dimensions.get(item.variantId) ?? null,
      })),
    );
    if (parcel.oversized) {
      const error = "Pacote acima do limite dos Correios (100 cm por lado, 200 cm na soma)";
      return Object.fromEntries(services.map((service) => [service, { ok: false, error }]));
    }
    // A mesma sacola é cotada várias vezes (produto, sacola, cada passo do checkout, pedido).
    const key = [
      destinationCep,
      parcel.weightGrams,
      parcel.lengthCm,
      parcel.widthCm,
      parcel.heightCm,
      ...services,
    ].join("|");
    const now = input.now.getTime();
    const cached = this.cache.get(key);
    if (cached && Math.abs(now - cached.at) < CACHE_MS) return cached.quotes;

    const quotes = await this.deps.client.quote({
      originCep: this.deps.options.originCep,
      destinationCep,
      services,
      package: parcel,
    });
    if (this.cache.size >= CACHE_LIMIT) this.cache.clear();
    this.cache.set(key, { at: now, quotes });
    return quotes;
  }
}
