/**
 * Cliente da API da Jadlog (simulador de frete e consulta de tracking), conforme o documento
 * "Integração JADLOG" versão 2.3 (agosto de 2025). O token é fornecido pela Jadlog e vai no
 * cabeçalho Authorization de todas as requisições.
 */
import {
  CarrierUnavailableError,
  type Carrier,
  type CarrierQuoteInput,
  type CarrierServiceQuote,
  type CarrierTrackingResult,
  type Parcel,
  type ServiceKind,
  type TrackingEvent,
} from "../carriers/types";

export type JadlogConfig = {
  /** Simulador de frete: https://www.jadlog.com.br */
  baseUrl: string;
  /** Tracking: https://prd-traffic.jadlogtech.com.br */
  trackingUrl: string;
  token: string;
  /** CNPJ do tomador do serviço, só números. */
  cnpj: string;
  /** Conta corrente Jadlog, se for correntista. */
  account?: string;
  /** Contrato, se a Jadlog tiver disponibilizado uma tabela especial. */
  contract?: string;
  /** Código da modalidade usada em cada tipo de envio. Sem código, a Jadlog não cota aquele tipo. */
  modalities: Partial<Record<ServiceKind, number>>;
};

export class JadlogUnavailableError extends CarrierUnavailableError {}

const TIMEOUT_MS = 8000;
/** Modalidades aéreas (expresso, corporate, .com, cargo) cubam por 6000; as rodoviárias, por 3333. */
const AIR_MODALITIES = new Set([0, 7, 9, 12]);

/** Peso cobrado em kg: o maior entre o real e o cubado da modalidade. */
export function jadlogChargedWeightKg(parcel: Parcel, modality: number): number {
  const divisor = AIR_MODALITIES.has(modality) ? 6000 : 3333;
  const cubed = (parcel.lengthCm * parcel.widthCm * parcel.heightCm) / divisor;
  return Math.round(Math.max(parcel.weightGrams / 1000, cubed) * 100) / 100;
}

/** "2023-03-22 15:12:06", no horário de Brasília. */
export function parseJadlogDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(`${value.trim().replace(" ", "T")}-03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

type Json = Record<string, unknown>;
const errorText = (value: unknown): string | null => {
  if (!value || typeof value !== "object") return null;
  const { descricao, detalhe } = value as Json;
  return typeof descricao === "string" && descricao
    ? [descricao, typeof detalhe === "string" ? detalhe : ""].filter(Boolean).join(": ")
    : null;
};

export class JadlogClient implements Carrier {
  readonly key = "jadlog";
  readonly label = "Jadlog";

  constructor(
    private readonly config: JadlogConfig,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async post(url: string, body: unknown): Promise<Json> {
    const token = this.config.token;
    let response: Response;
    try {
      response = await this.fetcher(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: /^bearer /i.test(token) ? token : `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new JadlogUnavailableError(
        `Jadlog não respondeu: ${error instanceof Error ? error.message : "erro"}`,
      );
    }
    const data = (await response.json().catch(() => null)) as Json | null;
    if (!response.ok || !data) {
      const reason = errorText(data) ?? errorText(data?.erro) ?? errorText(data?.error);
      throw new JadlogUnavailableError(
        `Jadlog devolveu HTTP ${response.status}${reason ? `: ${reason}` : ""}`,
      );
    }
    return data;
  }

  /** Simulador de frete: uma chamada com um item por modalidade pedida. */
  async quote(input: CarrierQuoteInput) {
    const result: Partial<Record<ServiceKind, CarrierServiceQuote>> = {};
    const requested = input.kinds.flatMap((kind) => {
      const modality = this.config.modalities[kind];
      if (modality === undefined) {
        result[kind] = { ok: false, error: "Modalidade não contratada na Jadlog" };
        return [];
      }
      return [{ kind, modality }];
    });
    if (requested.length === 0) return result;

    const data = await this.post(`${this.config.baseUrl}/embarcador/api/frete/valor`, {
      frete: requested.map(({ modality }) => ({
        cepori: input.originCep,
        cepdes: input.destinationCep,
        frap: null,
        peso: jadlogChargedWeightKg(input.parcel, modality),
        cnpj: this.config.cnpj,
        conta: this.config.account ?? "",
        contrato: this.config.contract ?? null,
        modalidade: modality,
        tpentrega: "D",
        tpseguro: "N",
        vldeclarado: input.declaredValueCents / 100,
        vlcoleta: 0,
      })),
    });

    const items = Array.isArray(data.frete) ? (data.frete as Json[]) : [];
    // Erro na chamada inteira (contrato inválido, por exemplo): é configuração, não cobertura.
    const callError = errorText(data.erro) ?? errorText(data.error);
    if (callError && !items.some((item) => typeof item.vltotal === "number"))
      throw new JadlogUnavailableError(`Jadlog recusou a cotação: ${callError}`);

    requested.forEach(({ kind, modality }, index) => {
      const item = items.find((entry) => entry.modalidade === modality) ?? items[index];
      const itemError = errorText(item?.erro) ?? errorText(item?.error);
      if (itemError) result[kind] = { ok: false, error: itemError };
      else if (typeof item?.vltotal !== "number" || item.vltotal <= 0)
        result[kind] = { ok: false, error: "Resposta sem valor de frete" };
      else
        result[kind] = {
          ok: true,
          priceCents: Math.round(item.vltotal * 100),
          businessDays: typeof item.prazo === "number" ? item.prazo : 0,
        };
    });
    return result;
  }

  /**
   * Eventos da remessa, do mais recente para o mais antigo. O código digitado no pedido pode ser
   * o número de rastreamento (CT-e) ou o shipmentId: a consulta tenta os dois.
   */
  async track(code: string): Promise<CarrierTrackingResult> {
    const data = await this.post(`${this.config.trackingUrl}/embarcador/api/tracking/consultar`, {
      consulta: [{ cte: code }, { shipmentId: code }],
    });
    const items = Array.isArray(data.consulta) ? (data.consulta as Json[]) : [];
    const found = items.find((item) => item.tracking && typeof item.tracking === "object");
    if (!found) {
      const reason =
        items.map((item) => errorText(item.erro) ?? errorText(item.error)).find(Boolean) ??
        errorText(data.erro) ??
        errorText(data.error);
      return { ok: false, error: reason ?? "Remessa não encontrada" };
    }
    const tracking = found.tracking as Json;
    const events = (Array.isArray(tracking.eventos) ? (tracking.eventos as Json[]) : [])
      .map((event): TrackingEvent | null => {
        const date = parseJadlogDate(event.data);
        if (!date || typeof event.status !== "string") return null;
        return {
          description: event.status,
          detail: null,
          date,
          location: typeof event.unidade === "string" && event.unidade ? event.unidade : null,
        };
      })
      .filter((event): event is TrackingEvent => event !== null)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    const delivered =
      tracking.status === "ENTREGUE" || events.some((event) => event.description === "ENTREGUE");
    return { ok: true, events, delivered };
  }
}
