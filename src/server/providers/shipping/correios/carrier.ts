import type {
  Carrier,
  CarrierQuoteInput,
  CarrierServiceQuote,
  Parcel,
  ServiceKind,
} from "../carriers/types";
import type { CorreiosClient } from "./client";

/** Limites de pacote dos Correios: 100 cm por lado e 200 cm na soma dos três. */
const MAX_SIDE_CM = 100;
const MAX_SUM_CM = 200;

export function exceedsCorreiosLimits(parcel: Parcel): boolean {
  const sides = [parcel.lengthCm, parcel.widthCm, parcel.heightCm];
  return (
    Math.max(...sides) > MAX_SIDE_CM || sides.reduce((sum, side) => sum + side, 0) > MAX_SUM_CM
  );
}

/** Correios como transportadora: econômico pelo PAC e expresso pelo SEDEX do contrato. */
export class CorreiosCarrier implements Carrier {
  readonly key = "correios";
  readonly label = "Correios";

  constructor(
    private readonly client: Pick<CorreiosClient, "quote">,
    private readonly services: Record<ServiceKind, string>,
  ) {}

  async quote(input: CarrierQuoteInput) {
    const result: Partial<Record<ServiceKind, CarrierServiceQuote>> = {};
    if (exceedsCorreiosLimits(input.parcel)) {
      const error = "Pacote acima do limite dos Correios (100 cm por lado, 200 cm na soma)";
      for (const kind of input.kinds) result[kind] = { ok: false, error };
      return result;
    }
    const quotes = await this.client.quote({
      originCep: input.originCep,
      destinationCep: input.destinationCep,
      services: input.kinds.map((kind) => this.services[kind]),
      package: input.parcel,
    });
    for (const kind of input.kinds)
      result[kind] = quotes[this.services[kind]] ?? { ok: false, error: "Sem resposta" };
    return result;
  }
}
