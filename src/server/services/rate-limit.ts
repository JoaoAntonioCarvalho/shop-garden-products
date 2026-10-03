import "server-only";
import { db } from "@/lib/db";

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

/** Interface do limitador, para trocar a implementação sem mudar quem usa. */
export interface RateLimiter {
  hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

/**
 * Limitador baseado no banco, com janela fixa. Serve para o volume de uma loja e funciona com
 * várias instâncias do servidor.
 */
// TODO(integracao): trocar por Redis/Upstash em produção com muito tráfego.
class DatabaseRateLimiter implements RateLimiter {
  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const windowMs = windowSeconds * 1000;
    const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
    const row = await db.rateLimitHit.upsert({
      where: { key_windowStart: { key, windowStart } },
      create: { key, windowStart },
      update: { count: { increment: 1 } },
      select: { count: true },
    });
    const retryAfterSeconds = Math.ceil((windowStart.getTime() + windowMs - Date.now()) / 1000);
    return {
      allowed: row.count <= limit,
      remaining: Math.max(0, limit - row.count),
      retryAfterSeconds,
    };
  }
}

const limiter: RateLimiter = new DatabaseRateLimiter();

/** Limites por ação: [máximo de tentativas, janela em segundos]. */
export const RATE_LIMITS = {
  login: [5, 15 * 60],
  signup: [5, 60 * 60],
  passwordReset: [5, 60 * 60],
  tracking: [10, 15 * 60],
  publicForm: [8, 10 * 60],
  search: [60, 60],
  coupon: [20, 10 * 60],
  cep: [30, 60],
} as const;

export async function rateLimit(
  action: keyof typeof RATE_LIMITS,
  identifier: string,
): Promise<RateLimitResult> {
  const [limit, windowSeconds] = RATE_LIMITS[action];
  return limiter.hit(`${action}:${identifier}`, limit, windowSeconds);
}

/** "Muitas tentativas. Tente de novo em 12 minutos." */
/** Zera o contador (depois de um login correto, para só as tentativas erradas contarem). */
export async function resetRateLimit(
  action: keyof typeof RATE_LIMITS,
  identifier: string,
): Promise<void> {
  await db.rateLimitHit.deleteMany({ where: { key: `${action}:${identifier}` } });
}

export function rateLimitMessage(result: RateLimitResult): string {
  const minutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
  return `Muitas tentativas. Tente de novo em ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`;
}

/** Apaga contadores de janelas antigas (chamado pela tarefa de limpeza). */
export async function purgeRateLimitHits(): Promise<number> {
  const result = await db.rateLimitHit.deleteMany({
    where: { windowStart: { lt: new Date(Date.now() - 86_400_000) } },
  });
  return result.count;
}
