import { onlyDigits } from "./cpf";

export type CardBrand = "visa" | "mastercard" | "elo" | "amex" | "hipercard" | "unknown";

export const cardBrandLabels: Record<CardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  elo: "Elo",
  amex: "American Express",
  hipercard: "Hipercard",
  unknown: "Cartão",
};

// Elo e Hipercard vêm antes porque seus prefixos colidem com os de Visa e Mastercard.
const brandPatterns: Array<[CardBrand, RegExp]> = [
  [
    "elo",
    /^(4011(78|79)|43(1274|8935)|45(1416|7393|763[12])|50(4175|6699|67\d{2}|9\d{3})|627780|63(6297|6368)|65(0[0-5]\d|16[5-7]|50[0-5]))/,
  ],
  ["hipercard", /^(606282|3841)/],
  ["amex", /^3[47]/],
  ["mastercard", /^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/],
  ["visa", /^4/],
];

export function detectCardBrand(number: string): CardBrand {
  const d = onlyDigits(number);
  for (const [brand, pattern] of brandPatterns) if (pattern.test(d)) return brand;
  return "unknown";
}

export function passesLuhn(number: string): boolean {
  const d = onlyDigits(number);
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

/** "4111111111111111" → "4111 1111 1111 1111"; Amex em 4-6-5. Aceita valor parcial. */
export function formatCardNumber(value: string): string {
  const d = onlyDigits(value).slice(0, 19);
  if (detectCardBrand(d) === "amex") {
    return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(" ");
  }
  return d.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** "1228" → "12/28". Aceita valor parcial. */
export function formatCardExpiry(value: string): string {
  const d = onlyDigits(value).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

/** Validade no formato MM/AA; válida até o último dia do mês informado. */
export function isValidCardExpiry(value: string, now: Date = new Date()): boolean {
  const d = onlyDigits(value);
  if (d.length !== 4) return false;
  const month = Number(d.slice(0, 2));
  const year = 2000 + Number(d.slice(2));
  if (month < 1 || month > 12) return false;
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (year < currentYear || (year === currentYear && month < currentMonth)) return false;
  return year <= currentYear + 20;
}

export function isValidCvv(value: string, brand: CardBrand): boolean {
  const d = onlyDigits(value);
  return brand === "amex" ? d.length === 4 : d.length === 3;
}
