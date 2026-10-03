export type ShippingQuoteItem = {
  variantId: string;
  quantity: number;
  weightGrams: number;
  sameDayEligible: boolean;
  deliveryScope: "LOCAL_ONLY" | "NATIONAL";
};

export type ShippingQuoteInput = {
  cep: string;
  items: ShippingQuoteItem[];
  subtotalCents: number;
  now: Date;
};

export type ShippingOption = {
  code: string;
  name: string;
  priceCents: number;
  originalPriceCents: number;
  isFree: boolean;
  minDays: number;
  maxDays: number;
  /** AAAA-MM-DD, quando a entrega tem data certa (entrega hoje). */
  deliveryDate?: string;
  requiresScheduling: boolean;
  /** Datas AAAA-MM-DD que o cliente pode escolher na entrega agendada. */
  availableDates?: string[];
  description: string;
};

export interface ShippingProvider {
  quote(input: ShippingQuoteInput): Promise<ShippingOption[]>;
}
