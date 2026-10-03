/** Modalidade nacional da loja: "econômico" e "expresso" nas regras de frete do painel. */
export type ServiceKind = "economy" | "express";

export type Parcel = {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type CarrierServiceQuote =
  { ok: true; priceCents: number; businessDays: number } | { ok: false; error: string };

export type CarrierQuoteInput = {
  originCep: string;
  destinationCep: string;
  parcel: Parcel;
  /** Valor dos produtos, para o seguro da transportadora. */
  declaredValueCents: number;
  kinds: ServiceKind[];
};

export type CarrierKey = "correios" | "jadlog";

/** Uma transportadora que cota as modalidades nacionais. Lança CarrierUnavailableError se estiver fora do ar. */
export interface Carrier {
  key: CarrierKey;
  /** Nome mostrado ao cliente e gravado no pedido. */
  label: string;
  quote(input: CarrierQuoteInput): Promise<Partial<Record<ServiceKind, CarrierServiceQuote>>>;
}

/** Falha de rede, de autenticação ou resposta inesperada: a transportadora não pôde ser consultada. */
export class CarrierUnavailableError extends Error {}

export type TrackingEvent = {
  description: string;
  detail: string | null;
  date: Date;
  location: string | null;
};

export type CarrierTrackingResult =
  { ok: true; events: TrackingEvent[]; delivered: boolean } | { ok: false; error: string };
