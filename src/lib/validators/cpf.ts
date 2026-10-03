export const onlyDigits = (value: string) => value.replace(/\D/g, "");

/** "12345678909" → "123.456.789-09". Aceita valor parcial, para uso em máscara. */
export function formatCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

/** Exibição mascarada no admin: "***.456.789-**". */
export function maskCpf(value: string): string {
  const d = onlyDigits(value);
  if (d.length !== 11) return "***";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

function checkDigit(digits: string, length: number): number {
  let sum = 0;
  for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i);
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

export function isValidCpf(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  return checkDigit(d, 9) === Number(d[9]) && checkDigit(d, 10) === Number(d[10]);
}

/** Gera um CPF válido a partir de 9 dígitos base. Usado pelo seed e por testes. */
export function generateCpf(base9: string): string {
  const base = onlyDigits(base9).padStart(9, "0").slice(0, 9);
  const d1 = checkDigit(base, 9);
  const d2 = checkDigit(base + d1, 10);
  return `${base}${d1}${d2}`;
}
