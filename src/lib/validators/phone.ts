import { onlyDigits } from "./cpf";

/** "11955817159" → "(11) 95581-7159"; fixo "1133334444" → "(11) 3333-4444". Aceita valor parcial. */
export function formatPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Telefone brasileiro com DDD: 10 dígitos (fixo) ou 11 (celular começando com 9). */
export function isValidPhone(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 10 && d.length !== 11) return false;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11) return false;
  if (d.length === 11 && d[2] !== "9") return false;
  return !/^(\d)\1+$/.test(d);
}

export function isValidMobile(value: string): boolean {
  return onlyDigits(value).length === 11 && isValidPhone(value);
}

/** Dígitos com o código do país, como o wa.me espera: "11955817159" → "5511955817159". */
export function toWhatsappNumber(value: string): string {
  const d = onlyDigits(value);
  return d.startsWith("55") && d.length > 11 ? d : `55${d}`;
}
