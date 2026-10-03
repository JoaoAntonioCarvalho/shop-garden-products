/**
 * Cliente das APIs dos Correios (token, preço, prazo e rastro), conforme a descrição OpenAPI
 * publicada em https://api.correios.com.br/{token,preco,prazo,srorastro}/v3/api-docs.
 * Exige contrato: usuário do Meu Correios, código de acesso às APIs e cartão de postagem.
 */

import { CarrierUnavailableError, type CarrierServiceQuote, type Parcel } from "../carriers/types";

export type CorreiosConfig = {
  baseUrl: string;
  user: string;
  accessCode: string;
  postingCard: string;
  contract?: string;
  dr?: number;
};

export type CorreiosPackage = Parcel;
export type CorreiosServiceQuote = CarrierServiceQuote;

export type CorreiosTrackingEvent = {
  /** Código do evento, como "BDE" (baixa de distribuição externa). */
  code: string;
  type: string;
  description: string;
  detail: string | null;
  date: Date;
  location: string | null;
};

export type CorreiosTracking =
  { ok: true; events: CorreiosTrackingEvent[] } | { ok: false; error: string };

/** Falha de rede, de autenticação ou resposta inesperada: o serviço não pôde ser consultado. */
export class CorreiosUnavailableError extends CarrierUnavailableError {}

const TIMEOUT_MS = 8000;
const TOKEN_MARGIN_MS = 5 * 60 * 1000;

/** "23,50" ou "1.234,50" (como a API devolve) para centavos. */
export function parseCorreiosMoney(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

/** As datas vêm sem fuso, no horário de Brasília. */
export function parseCorreiosDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  const date = new Date(hasZone ? value : `${value}-03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Objeto entregue: baixa (BDE, BDI, BDR) com tipo 00 ou 01. */
export function isDeliveredEvent(event: Pick<CorreiosTrackingEvent, "code" | "type">): boolean {
  return ["BDE", "BDI", "BDR"].includes(event.code) && ["00", "01", "0", "1"].includes(event.type);
}

type Fetch = typeof fetch;
type Json = Record<string, unknown>;

export class CorreiosClient {
  private token: { value: string; expiresAt: number } | null = null;
  private pendingToken: Promise<string> | null = null;

  constructor(
    private readonly config: CorreiosConfig,
    private readonly fetcher: Fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  private async request(path: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetcher(`${this.config.baseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new CorreiosUnavailableError(
        `Correios não respondeu em ${path}: ${error instanceof Error ? error.message : "erro"}`,
      );
    }
  }

  private async fetchToken(): Promise<string> {
    const { user, accessCode, postingCard, contract, dr } = this.config;
    const response = await this.request("/token/v1/autentica/cartaopostagem", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${user}:${accessCode}`).toString("base64")}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        numero: postingCard,
        ...(contract ? { contrato: contract } : {}),
        ...(dr ? { dr } : {}),
      }),
    });
    const body = (await response.json().catch(() => null)) as Json | null;
    if (!response.ok || typeof body?.token !== "string") {
      const messages = Array.isArray(body?.msgs) ? body.msgs.join("; ") : "";
      throw new CorreiosUnavailableError(
        `Correios recusou a autenticação (HTTP ${response.status})${messages ? `: ${messages}` : ""}`,
      );
    }
    const expiresAt = parseCorreiosDate(body.expiraEm)?.getTime() ?? this.now() + 30 * 60 * 1000;
    this.token = { value: body.token, expiresAt };
    return body.token;
  }

  /** Token em memória, renovado um pouco antes de vencer. Chamadas simultâneas esperam a mesma renovação. */
  private async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt - TOKEN_MARGIN_MS > this.now()) return this.token.value;
    this.pendingToken ??= this.fetchToken().finally(() => {
      this.pendingToken = null;
    });
    return this.pendingToken;
  }

  private async authorized(path: string, init: RequestInit = {}): Promise<Response> {
    const call = async () =>
      this.request(path, {
        ...init,
        headers: {
          ...(init.headers as Record<string, string> | undefined),
          Authorization: `Bearer ${await this.getToken()}`,
          Accept: "application/json",
        },
      });
    const response = await call();
    if (response.status !== 401) return response;
    // Token revogado ou vencido antes da hora: renova uma vez.
    this.token = null;
    return call();
  }

  private async postJson(path: string, body: unknown): Promise<unknown> {
    const response = await this.authorized(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as unknown;
    if (!response.ok || !Array.isArray(data)) {
      const messages =
        data && typeof data === "object" && Array.isArray((data as Json).msgs)
          ? ((data as Json).msgs as unknown[]).join("; ")
          : "";
      throw new CorreiosUnavailableError(
        `Correios devolveu HTTP ${response.status} em ${path}${messages ? `: ${messages}` : ""}`,
      );
    }
    return data;
  }

  /** Preço e prazo dos serviços pedidos, em duas consultas em lote feitas ao mesmo tempo. */
  async quote(input: {
    originCep: string;
    destinationCep: string;
    services: string[];
    package: CorreiosPackage;
  }): Promise<Record<string, CorreiosServiceQuote>> {
    const { contract, dr } = this.config;
    const common = { cepOrigem: input.originCep, cepDestino: input.destinationCep };
    const [prices, deadlines] = (await Promise.all([
      this.postJson("/preco/v1/nacional", {
        idLote: "1",
        parametrosProduto: input.services.map((coProduto, index) => ({
          coProduto,
          nuRequisicao: String(index + 1),
          ...common,
          psObjeto: String(input.package.weightGrams),
          tpObjeto: "2",
          comprimento: String(input.package.lengthCm),
          largura: String(input.package.widthCm),
          altura: String(input.package.heightCm),
          ...(contract ? { nuContrato: contract } : {}),
          ...(contract && dr ? { nuDR: dr } : {}),
        })),
      }),
      this.postJson("/prazo/v1/nacional", {
        idLote: "1",
        parametrosPrazo: input.services.map((coProduto, index) => ({
          coProduto,
          nuRequisicao: String(index + 1),
          ...common,
        })),
      }),
    ])) as [Json[], Json[]];

    const result: Record<string, CorreiosServiceQuote> = {};
    for (const service of input.services) {
      const price = prices.find((item) => item.coProduto === service);
      const deadline = deadlines.find((item) => item.coProduto === service);
      const error = [price?.txErro, deadline?.txErro].find(
        (text): text is string => typeof text === "string" && text.trim() !== "",
      );
      const priceCents = parseCorreiosMoney(price?.pcFinal);
      const businessDays = deadline?.prazoEntrega;
      if (error) result[service] = { ok: false, error };
      else if (priceCents === null || typeof businessDays !== "number")
        result[service] = { ok: false, error: "Resposta sem preço ou sem prazo" };
      else result[service] = { ok: true, priceCents, businessDays };
    }
    return result;
  }

  /** Eventos de rastreamento de um objeto, do mais recente para o mais antigo. */
  async track(code: string): Promise<CorreiosTracking> {
    const response = await this.authorized(
      `/srorastro/v1/objetos/${encodeURIComponent(code)}?resultado=T`,
    );
    const data = (await response.json().catch(() => null)) as Json | null;
    if (!response.ok || !data) {
      throw new CorreiosUnavailableError(`Correios devolveu HTTP ${response.status} no rastreio`);
    }
    const object = (Array.isArray(data.objetos) ? data.objetos[0] : null) as Json | null;
    if (!object) return { ok: false, error: "Objeto não encontrado" };
    const rawEvents = Array.isArray(object.eventos) ? (object.eventos as Json[]) : [];
    if (rawEvents.length === 0)
      return {
        ok: false,
        error: typeof object.mensagem === "string" ? object.mensagem : "Sem eventos ainda",
      };
    const events = rawEvents
      .map((event): CorreiosTrackingEvent | null => {
        const date = parseCorreiosDate(event.dtHrCriado);
        if (!date || typeof event.descricao !== "string") return null;
        const unit = event.unidade as Json | undefined;
        const address = unit?.endereco as Json | undefined;
        const place = [address?.cidade, address?.uf]
          .filter((part) => typeof part === "string" && part)
          .join(", ");
        return {
          code: String(event.codigo ?? ""),
          type: String(event.tipo ?? ""),
          description: event.descricao,
          detail: typeof event.detalhe === "string" && event.detalhe ? event.detalhe : null,
          date,
          location: place || (typeof unit?.nome === "string" && unit.nome ? unit.nome : null),
        };
      })
      .filter((event): event is CorreiosTrackingEvent => event !== null)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    return { ok: true, events };
  }
}
