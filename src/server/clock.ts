import { cookies } from "next/headers";

/** Cookie que os testes e2e usam para fixar o horário (por exemplo, antes do horário de corte). */
export const TEST_NOW_COOKIE = "nsg_test_now";

/**
 * Horário atual da requisição. Fora de produção, os testes e2e podem fixá-lo com o cookie
 * nsg_test_now (data em ISO), para testar entrega no mesmo dia de forma determinística.
 * Em produção o cookie é ignorado.
 */
export async function requestNow(): Promise<Date> {
  if (process.env.NODE_ENV === "production") return new Date();
  try {
    const raw = (await cookies()).get(TEST_NOW_COOKIE)?.value;
    if (raw) {
      const parsed = new Date(decodeURIComponent(raw));
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  } catch {
    // Fora de uma requisição.
  }
  return new Date();
}
