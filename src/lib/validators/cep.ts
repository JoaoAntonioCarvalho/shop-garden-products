import { onlyDigits } from "./cpf";

/** "01310100" → "01310-100". Aceita valor parcial. */
export function formatCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function isValidCep(value: string): boolean {
  const d = onlyDigits(value);
  return d.length === 8 && d !== "00000000";
}

/** CEP só com dígitos, ou null se inválido. */
export function normalizeCep(value: string): string | null {
  const d = onlyDigits(value);
  return isValidCep(d) ? d : null;
}

/** Comparação lexicográfica funciona porque os CEPs têm sempre 8 dígitos. */
export function isCepInRange(cep: string, start: string, end: string): boolean {
  const d = onlyDigits(cep);
  return d >= onlyDigits(start) && d <= onlyDigits(end);
}
