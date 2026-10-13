/**
 * Conversão dos relatórios do site antigo (clientes e pedidos) para o formato desta loja.
 * Só funções puras: quem grava no banco é `scripts/import-legacy-customers.ts`.
 */
import { normalizeCep } from "@/lib/validators/cep";
import { isValidCpf, onlyDigits } from "@/lib/validators/cpf";

export type LegacyRow = Record<string, string>;

/** Prefixo do número dos pedidos do site antigo: ANT-25934. */
export const LEGACY_ORDER_PREFIX = "ANT-";
export const isLegacyOrderNumber = (number: string) => /^ANT-\d{1,9}$/.test(number);

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (value: string) =>
  value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&(lt|gt|quot|apos);/g, (_, name: string) => ENTITIES[name])
    .replace(/&amp;/g, "&");

/** Lê um relatório em XML: <registro><campo nome="..." valor="..."/></registro>. */
export function parseLegacyReport(xml: string): LegacyRow[] {
  const rows: LegacyRow[] = [];
  for (const record of xml.matchAll(/<registro>([\s\S]*?)<\/registro>/g)) {
    const row: LegacyRow = {};
    for (const field of record[1].matchAll(/nome="([^"]*)"\s+valor="([^"]*)"/g))
      row[decode(field[1])] = decode(field[2]).trim();
    rows.push(row);
  }
  return rows;
}

/** "31/12/2023 14:05:09" no horário de São Paulo (UTC-3). */
export function legacyDate(value: string | undefined): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/.exec(
    value?.trim() ?? "",
  );
  if (!match) return null;
  const [, day, month, year, hour = "12", minute = "00", second = "00"] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "1234.50" ou "1234,5" em centavos. */
export function legacyCents(value: string | undefined): number {
  const number = Number((value ?? "").trim().replace(",", "."));
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

const PARTICLES = new Set(["de", "da", "do", "das", "dos", "e"]);

/** Nomes vinham em caixa alta ou toda em minúsculas: "MARIA DA SILVA" vira "Maria da Silva". */
export function legacyName(value: string | undefined): string {
  const name = (value ?? "").replace(/\s+/g, " ").trim();
  if (!name || (name !== name.toUpperCase() && name !== name.toLowerCase())) return name;
  return name
    .toLowerCase()
    .split(" ")
    .map((word, index) =>
      index > 0 && PARTICLES.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

/** Telefone só com dígitos (DDD + número), ou null quando não dá para aproveitar. */
export function legacyPhone(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    const digits = onlyDigits(value ?? "").replace(/^0+/, "");
    if (digits.length === 10 || digits.length === 11) return digits;
  }
  return null;
}

const UF = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO";
const STATES = new Set(UF.split(" "));

export type LegacyAddress = {
  recipientName: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
};

/** Endereço completo (CEP, rua, cidade e estado válidos) ou null. `suffix` é " Pedido" nos campos do pedido. */
export function legacyAddress(
  row: LegacyRow,
  recipientName: string,
  suffix = "",
): LegacyAddress | null {
  const field = (name: string) => (row[`${name}${suffix}`] ?? "").replace(/\s+/g, " ").trim();
  const cep = normalizeCep(field("CEP"));
  const street = field("Logradouro") || field("Endereço");
  const state = field("Estado").toUpperCase();
  const city = field("Cidade");
  if (!cep || !street || !city || !STATES.has(state)) return null;
  return {
    recipientName,
    cep,
    street,
    number: field("Endereço número") || "s/n",
    complement: field("Endereço complemento") || null,
    district: field("Bairro"),
    city,
    state,
  };
}

export type LegacyCustomer = {
  email: string;
  name: string;
  phone: string | null;
  cpf: string | null;
  birthDate: Date | null;
  createdAt: Date;
  address: LegacyAddress | null;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Cliente do relatório de clientes. `fallbackName` é o nome usado no último pedido, quando o cadastro não tem. */
export function buildLegacyCustomer(row: LegacyRow, fallbackName = ""): LegacyCustomer | null {
  const email = (row["E-mail"] ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return null;
  const name =
    legacyName(row["Contato"]) ||
    legacyName(row["Empresa"]) ||
    legacyName(fallbackName) ||
    "Cliente";
  const document = onlyDigits(row["CNPJ/CPF"] ?? "");
  const birth = legacyDate(row["Data Nasc"]);
  return {
    email,
    name,
    phone: legacyPhone(row["Celular"], row["Telefone"]),
    // CNPJ não cabe no campo de CPF da conta; fica só nos pedidos.
    cpf: document.length === 11 && isValidCpf(document) ? document : null,
    birthDate:
      birth && birth.getUTCFullYear() > 1900
        ? new Date(`${birth.toISOString().slice(0, 10)}T00:00:00Z`)
        : null,
    createdAt: legacyDate(row["Cadastro em"]) ?? new Date(),
    address: legacyAddress(row, name),
  };
}

type OrderStatus = "DELIVERED" | "PAID" | "CANCELED" | "EXPIRED";
type PaymentStatus = "PAID" | "CANCELED" | "EXPIRED";

const RECENT_MS = 30 * 86_400_000;

/**
 * Situação do pedido antigo. "Remetido" é pedido concluído. A loja deixou de marcar "Remetido"
 * em 2024, então "Liberado" e "Aprovado" com mais de 30 dias também contam como concluídos.
 * "Novo" é pedido que nunca foi pago.
 */
export function mapLegacyStatus(
  status: string,
  createdAt: Date,
  now: Date,
): { status: OrderStatus; paymentStatus: PaymentStatus } {
  if (status === "Cancelado") return { status: "CANCELED", paymentStatus: "CANCELED" };
  if (status === "Novo") return { status: "EXPIRED", paymentStatus: "EXPIRED" };
  if (status !== "Remetido" && now.getTime() - createdAt.getTime() < RECENT_MS)
    return { status: "PAID", paymentStatus: "PAID" };
  return { status: "DELIVERED", paymentStatus: "PAID" };
}

export function mapLegacyPayment(label: string): {
  method: "CREDIT_CARD" | "BOLETO" | "MANUAL";
  manualLabel: string | null;
} {
  if (/cart[aã]o/i.test(label)) return { method: "CREDIT_CARD", manualLabel: null };
  if (/boleto/i.test(label)) return { method: "BOLETO", manualLabel: null };
  return { method: "MANUAL", manualLabel: label || "Pagamento no site antigo" };
}

function mapLegacyShipping(row: LegacyRow): { code: string; name: string } {
  const note = row["Obs Frete"] ?? "";
  if (/bandeirantes|salim farah|retira/i.test(note))
    return { code: "retirada-legado", name: "Retirada na loja" };
  if (row["Obj SEDEX"]) return { code: "economico-legado", name: "Correios" };
  return { code: "legado", name: "Entrega" };
}

export type LegacyOrderItem = {
  sku: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
};

export type LegacyOrder = {
  number: string;
  legacyStatus: string;
  email: string;
  customerName: string;
  customerPhone: string | null;
  customerDocument: string | null;
  shippingAddress: LegacyAddress | { recipientName: string };
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: "CREDIT_CARD" | "BOLETO" | "MANUAL";
  manualPaymentLabel: string | null;
  installments: number;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  couponCode: string | null;
  shippingMethodCode: string;
  shippingMethodName: string;
  trackingCode: string | null;
  customerNotes: string | null;
  createdAt: Date;
  items: LegacyOrderItem[];
};

/** Um pedido a partir das linhas do relatório de pedidos com itens (uma linha por item). */
export function buildLegacyOrder(rows: LegacyRow[], now: Date): LegacyOrder | null {
  const head = rows[0];
  const createdAt = legacyDate(head?.["Feito em"]);
  const email = (head?.["E-mail"] ?? "").trim().toLowerCase();
  if (!head || !createdAt || !/^\d+$/.test(head["Núm"] ?? "") || !EMAIL.test(email)) return null;

  const items = rows.map((row) => {
    const quantity = Math.max(1, Number.parseInt(row["Qtd"] ?? "1", 10) || 1);
    const unitPriceCents = legacyCents(row["Preço unit"]);
    const variant = [row["Esp1"], row["Esp2"], row["Esp3"]].filter(Boolean).join(", ");
    return {
      sku: row["Ref. Produto"] || `antigo-${row["IDProduto"] ?? "0"}`,
      productName: row["Nome Produto"] || "Produto",
      variantName: variant || null,
      quantity,
      unitPriceCents,
      totalCents: unitPriceCents * quantity,
    };
  });
  const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
  const shippingCents = legacyCents(head["Frete"]);
  // "Total sem frete" já vem com o desconto aplicado.
  const afterDiscount = legacyCents(head["Total sem frete"]);
  const discountCents = Math.max(0, subtotalCents - afterDiscount);
  const customerName = legacyName(head["Nome"]) || legacyName(head["Empresa"]) || "Cliente";
  const recipientName = legacyName(head["Nome Pedido"]) || customerName;
  const payment = mapLegacyPayment(head["Pagamento"] ?? "");
  const shipping = mapLegacyShipping(head);
  const document = onlyDigits(head["CPF/CNPJ"] ?? "");

  return {
    number: `${LEGACY_ORDER_PREFIX}${head["Núm"]}`,
    legacyStatus: head["Status"] ?? "",
    email,
    customerName,
    customerPhone: legacyPhone(head["Celular"], head["Telefone"]),
    customerDocument: document.length === 11 || document.length === 14 ? document : null,
    shippingAddress: legacyAddress(head, recipientName, " Pedido") ??
      legacyAddress(head, recipientName) ?? { recipientName },
    ...mapLegacyStatus(head["Status"] ?? "", createdAt, now),
    paymentMethod: payment.method,
    manualPaymentLabel: payment.manualLabel,
    installments: Math.max(1, Number.parseInt(head["Parcelas"] ?? "1", 10) || 1),
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents: Math.max(0, afterDiscount) + shippingCents,
    couponCode: discountCents > 0 ? head["CodCupom"]?.toUpperCase() || null : null,
    shippingMethodCode: shipping.code,
    shippingMethodName: shipping.name,
    trackingCode: head["Obj SEDEX"] || null,
    customerNotes: head["Msg cliente"] || null,
    createdAt,
    items,
  };
}
