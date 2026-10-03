/** Dinheiro é sempre inteiro em centavos. Formatação para BRL só acontece aqui, na apresentação. */

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 4150 → "R$ 41,50" */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

/** Como formatBRL, mas sem centavos quando o valor é redondo: 29900 → "R$ 299". Para frases curtas. */
export function formatBRLShort(cents: number): string {
  if (cents % 100 !== 0) return formatBRL(cents);
  return brl.format(cents / 100).replace(/,00$/, "");
}

/** 4150 → "41,50" (sem o símbolo, para campos de formulário e CSV). */
export function formatCentsPlain(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converte texto digitado em reais para centavos. Aceita "1.234,56", "1234,56", "1234.56" e "R$ 12".
 * Devolve null quando não é um valor válido.
 */
export function parseBRLToCents(input: string): number | null {
  const cleaned = input.replace(/[R$\s]/g, "");
  if (!cleaned) return null;
  let normalized = cleaned;
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  }
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/** Percentual de um valor em centavos; meio centavo arredonda para cima. */
export function percentOf(cents: number, percent: number): number {
  return Math.floor((cents * percent + 50) / 100);
}

/** Centavos para reais como número, usado só nos eventos de analytics. */
export function centsToReais(cents: number): number {
  return Math.round(cents) / 100;
}
