import { revalidateTag } from "next/cache";

/**
 * Invalida tags de cache. Fora de uma requisição do Next (testes, scripts, seed) não há cache
 * para invalidar, então a falha é ignorada.
 */
export function invalidate(...tags: string[]): void {
  for (const tag of tags) {
    try {
      // "max": quem está na página vê o dado anterior enquanto o novo é carregado.
      revalidateTag(tag, "max");
    } catch {
      // Sem contexto de requisição.
    }
  }
}
