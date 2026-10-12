import { timingSafeEqual } from "node:crypto";
import {
  WebhookIgnoredError,
  WebhookSignatureError,
  type BoletoResult,
  type CardChargeResult,
  type CardToken,
  type CardTokenization,
  type OrderForPayment,
  type PaymentProvider,
  type PixChargeResult,
  type ProviderPaymentStatus,
  type RefundResult,
  type WebhookEvent,
} from "./types";

/**
 * API E-commerce Cielo (a antiga Cielo 3.0): Pix e cartão de crédito no próprio site.
 * O cartão é trocado por um token no navegador (Silent Order Post), direto com a Cielo: o número,
 * a validade e o CVV nunca passam pelo servidor da loja.
 *
 * Conferido no ambiente de testes da Cielo em 10/10/2026: Pix, cartão com token, consulta e
 * cancelamento. Com as credenciais de produção da loja, só a geração do Pix e do token de acesso
 * do cartão foram conferidas (docs/INTEGRACOES.md, seção 1).
 */
// TODO(integracao): ligar na loja depois de um Pix pago e de uma venda no cartão em produção.

/** Cabeçalho que a Cielo envia no aviso de pagamento, cadastrado no site dela junto com a URL. */
// O painel da Cielo só aceita letras no nome do cabeçalho (sem hífen, número ou espaço).
export const CIELO_WEBHOOK_HEADER = "webhooksecret";
const CIELO_WEBHOOK_HEADER_LEGACY = "x-webhook-secret";

export type CieloConfig = {
  environment: "sandbox" | "production";
  merchantId: string;
  merchantKey: string;
  /** Credenciais OAuth da tokenização do cartão. Sem elas, só o Pix funciona. */
  clientId?: string;
  clientSecret?: string;
  webhookSecret?: string;
  /** Nome na fatura do cartão: até 13 caracteres, sem acento. */
  softDescriptor?: string;
};

const HOSTS = {
  sandbox: {
    api: "https://apisandbox.cieloecommerce.cielo.com.br",
    query: "https://apiquerysandbox.cieloecommerce.cielo.com.br",
    oauth: "https://authsandbox.braspag.com.br/oauth2/token",
    sopToken: "https://transactionsandbox.pagador.com.br/post/api/public/v2/accesstoken",
    sopCard: "https://transactionsandbox.pagador.com.br/post/api/public/v1/card",
  },
  production: {
    api: "https://api.cieloecommerce.cielo.com.br",
    query: "https://apiquery.cieloecommerce.cielo.com.br",
    oauth: "https://auth.braspag.com.br/oauth2/token",
    sopToken: "https://transaction.pagador.com.br/post/api/public/v2/accesstoken",
    sopCard: "https://www.pagador.com.br/post/api/public/v1/card",
  },
} as const;

// Os endereços "sopCard" são chamados pelo navegador e precisam estar na CSP (next.config.ts).

const TIMEOUT_MS = 20_000;

export class CieloError extends Error {}

type CieloPayment = {
  PaymentId?: string;
  Paymentid?: string;
  Type?: string;
  Status?: number;
  Amount?: number;
  CapturedAmount?: number;
  ReturnCode?: string;
  ReturnMessage?: string;
  QrCodeString?: string;
  QrCodeBase64Image?: string;
  QrcodeBase64Image?: string;
  CreditCard?: { CardNumber?: string; Brand?: string };
};

/**
 * Status da Cielo → status da loja. 0 e 12 aguardam; 1 autorizado; 2 pago; 3 negado; 13 abortado;
 * 10 cancelado (devolução, se já tinha sido capturado); 11 devolvido.
 */
export function mapCieloStatus(payment: CieloPayment): ProviderPaymentStatus {
  switch (payment.Status) {
    case 1:
      return "AUTHORIZED";
    case 2:
      return "PAID";
    case 3:
    case 13:
      return "FAILED";
    case 10:
      return (payment.CapturedAmount ?? 0) > 0 ? "REFUNDED" : "CANCELED";
    case 11:
      return "REFUNDED";
    default:
      return "PENDING";
  }
}

/** Motivos de recusa mais comuns, em texto para o cliente (a tela põe o ponto final). O código vem do banco emissor. */
const DENIAL_REASONS: Record<string, string> = {
  "05": "O banco não autorizou a compra. Fale com o banco ou tente outro cartão",
  "51": "Saldo ou limite insuficiente",
  "54": "Cartão vencido",
  "57": "Este cartão não permite este tipo de compra",
  "78": "Cartão bloqueado. Desbloqueie com o banco ou tente outro cartão",
  "82": "Dados do cartão inválidos. Confira o número, a validade e o código de segurança",
  N7: "Código de segurança inválido",
};

export function cieloDenialReason(code: string | undefined): string {
  return (code && DENIAL_REASONS[code]) || "O pagamento não foi autorizado";
}

const onlyDigits = (text: string) => text.replace(/\D/g, "");

/** A Cielo aceita só letras sem acento, números e espaço no nome que vai para a fatura. */
const plain = (text: string, max: number) =>
  text
    .normalize("NFD")
    .replace(/[^\w ]/g, "")
    .replace(/_/g, "")
    .trim()
    .slice(0, max);

export class CieloPaymentProvider implements PaymentProvider {
  readonly name = "cielo";
  // Boleto na Cielo depende de convênio próprio com o banco; a loja não oferece.
  readonly supportsBoleto = false;
  private oauth: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: CieloConfig,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  private get hosts() {
    return HOSTS[this.config.environment];
  }

  /** Chamada à API de vendas, com as credenciais da loja. */
  private call(url: string, init: RequestInit = {}): Promise<unknown> {
    return this.request(url, { ...init, headers: { MerchantKey: this.config.merchantKey } });
  }

  private async request(url: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          MerchantId: this.config.merchantId,
          ...init.headers,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new CieloError("A Cielo não respondeu.");
    }
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // resposta sem JSON: tratada abaixo pelo status
    }
    if (!response.ok) {
      const first = Array.isArray(body) ? (body[0] as { Code?: number; Message?: string }) : null;
      throw new CieloError(
        `Cielo respondeu ${response.status}${first ? `: ${first.Code} ${first.Message}` : ""}`,
      );
    }
    return body;
  }

  private async sale(order: OrderForPayment, payment: Record<string, unknown>) {
    const cpf = onlyDigits(order.customerCpf ?? "");
    const body = (await this.call(`${this.hosts.api}/1/sales/`, {
      method: "POST",
      body: JSON.stringify({
        MerchantOrderId: plain(order.number, 50),
        Customer: {
          Name: plain(order.customerName, 255) || "Cliente",
          ...(cpf.length === 11 ? { Identity: cpf, IdentityType: "CPF" } : {}),
          Email: order.customerEmail,
        },
        Payment: { Amount: order.amountCents, ...payment },
      }),
    })) as { Payment?: CieloPayment } | null;
    const result = body?.Payment;
    const externalId = result?.PaymentId ?? result?.Paymentid;
    if (!result || !externalId) throw new CieloError("A Cielo não devolveu o pagamento.");
    return { result, externalId, raw: body as Record<string, unknown> };
  }

  async createPixCharge(
    order: OrderForPayment,
    options: { expirationMinutes: number },
  ): Promise<PixChargeResult> {
    const { result, externalId, raw } = await this.sale(order, { Type: "Pix" });
    const image = result.QrCodeBase64Image ?? result.QrcodeBase64Image;
    if (!result.QrCodeString || !image)
      throw new CieloError(`A Cielo não gerou o Pix: ${result.ReturnMessage ?? "sem motivo"}`);
    return {
      externalId,
      status: mapCieloStatus(result),
      pixPayload: result.QrCodeString,
      pixQrCodeDataUrl: `data:image/png;base64,${image}`,
      pixExpiresAt: new Date(this.now() + options.expirationMinutes * 60_000),
      // A imagem do QR Code já está no campo próprio; não precisa ir duas vezes para o banco.
      raw: {
        ...raw,
        Payment: Object.fromEntries(
          Object.entries(result).filter(([key]) => !/^qrcodebase64image$/i.test(key)),
        ),
      },
    };
  }

  async createCardCharge(
    order: OrderForPayment,
    card: CardToken,
    installments: number,
  ): Promise<CardChargeResult> {
    const { result, externalId, raw } = await this.sale(order, {
      Type: "CreditCard",
      Installments: installments,
      // Captura na hora: a venda aprovada já é cobrada.
      Capture: true,
      ...(this.config.softDescriptor
        ? { SoftDescriptor: plain(this.config.softDescriptor, 13) }
        : {}),
      CreditCard: { PaymentToken: card.token },
    });
    const status = mapCieloStatus(result);
    return {
      externalId,
      status,
      cardBrand: card.brand,
      cardLast4: result.CreditCard?.CardNumber?.slice(-4) || card.last4,
      failureReason: status === "FAILED" ? cieloDenialReason(result.ReturnCode) : null,
      raw,
    };
  }

  async createBoleto(): Promise<BoletoResult> {
    throw new CieloError("Boleto não está disponível com a Cielo.");
  }

  async getStatus(externalId: string): Promise<ProviderPaymentStatus> {
    const url = `${this.hosts.query}/1/sales/${encodeURIComponent(externalId)}`;
    const body = (await this.call(url)) as { Payment?: CieloPayment } | null;
    if (!body?.Payment) throw new CieloError("Pagamento não encontrado na Cielo.");
    return mapCieloStatus(body.Payment);
  }

  /** Cancelamento total ou parcial. No Pix, a Cielo só devolve se houver saldo na conta Pix dela. */
  async refund(externalId: string, amountCents: number): Promise<RefundResult> {
    try {
      const body = (await this.call(
        `${this.hosts.api}/1/sales/${encodeURIComponent(externalId)}/void?amount=${amountCents}`,
        { method: "PUT" },
      )) as { Status?: number; ReasonCode?: number } | null;
      const status = body?.Status ?? -1;
      return {
        // Na devolução parcial o status continua 2 (pago). A Cielo também responde 200 com status 2
        // quando nega a devolução (Pix sem saldo): o que diferencia é o ReasonCode, 0 quando aceita.
        ok: status === 10 || status === 11 || (status === 2 && body?.ReasonCode === 0),
        raw: (body ?? {}) as Record<string, unknown>,
      };
    } catch (error) {
      return { ok: false, raw: { error: error instanceof Error ? error.message : "erro" } };
    }
  }

  /**
   * O aviso da Cielo não é assinado e traz só o identificador do pagamento. A loja confere o
   * cabeçalho secreto cadastrado no site da Cielo e busca o status na API: o corpo nunca é a verdade.
   */
  async parseWebhook(request: Request): Promise<WebhookEvent> {
    const expected = Buffer.from(this.config.webhookSecret ?? "");
    const received = Buffer.from(
      request.headers.get(CIELO_WEBHOOK_HEADER) ??
        request.headers.get(CIELO_WEBHOOK_HEADER_LEGACY) ??
        "",
    );
    if (
      expected.length === 0 ||
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    )
      throw new WebhookSignatureError("Aviso da Cielo sem o cabeçalho esperado");

    // Ao salvar a URL, a Cielo faz uma chamada de teste e só aceita o cadastro se receber 200.
    let payload: { PaymentId?: unknown; ChangeType?: unknown } | null = null;
    try {
      payload = JSON.parse(await request.text());
    } catch {
      // corpo vazio ou sem JSON: tratado abaixo
    }
    if (typeof payload?.PaymentId !== "string" || !/^[0-9a-f-]{36}$/i.test(payload.PaymentId))
      throw new WebhookIgnoredError("Aviso sem identificador de pagamento");
    return {
      externalId: payload.PaymentId,
      status: await this.getStatus(payload.PaymentId),
      raw: payload as Record<string, unknown>,
    };
  }

  private async oauthToken(): Promise<string> {
    if (this.oauth && this.oauth.expiresAt > this.now()) return this.oauth.token;
    const { clientId, clientSecret } = this.config;
    if (!clientId || !clientSecret)
      throw new CieloError("Credenciais da tokenização do cartão não configuradas.");
    let response: Response;
    try {
      response = await this.fetcher(this.hosts.oauth, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new CieloError("A Cielo não respondeu.");
    }
    const body = (await response.json().catch(() => null)) as {
      access_token?: string;
      expires_in?: number;
    } | null;
    if (!response.ok || !body?.access_token)
      throw new CieloError(`Cielo recusou as credenciais da tokenização (${response.status}).`);
    // Renova um minuto antes de vencer.
    this.oauth = {
      token: body.access_token,
      expiresAt: this.now() + Math.max((body.expires_in ?? 600) - 60, 30) * 1000,
    };
    return this.oauth.token;
  }

  /** Token de uso único (vale 20 minutos e um cartão) para o navegador enviar o cartão à Cielo. */
  async cardTokenization(): Promise<CardTokenization> {
    const body = (await this.request(this.hosts.sopToken, {
      method: "POST",
      headers: { Authorization: `Bearer ${await this.oauthToken()}` },
    })) as { AccessToken?: string } | null;
    if (!body?.AccessToken) throw new CieloError("A Cielo não liberou a tokenização do cartão.");
    return { kind: "cielo", url: this.hosts.sopCard, accessToken: body.AccessToken };
  }
}
