import "server-only";
import { db } from "@/lib/db";
import {
  CorreiosUnavailableError,
  isDeliveredEvent,
  type CorreiosTrackingEvent,
} from "@/server/providers/shipping/correios/client";
import { getCorreiosClient } from "@/server/providers/shipping";
import { transitionOrder } from "./orders";

/** Código de objeto dos Correios: duas letras, nove dígitos, duas letras. */
const CORREIOS_CODE = /^[A-Z]{2}\d{9}[A-Z]{2}$/;
export const isCorreiosCode = (code: string | null | undefined): code is string =>
  CORREIOS_CODE.test((code ?? "").trim().toUpperCase());

export type CarrierTracking = {
  events: CorreiosTrackingEvent[];
  delivered: boolean;
  /** Mensagem quando não há eventos (objeto ainda não postado, por exemplo). */
  message: string | null;
};

const CACHE_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; value: CarrierTracking }>();

/**
 * Eventos de rastreio da transportadora para mostrar no pedido. Devolve null quando não há
 * integração ligada, o código não é dos Correios ou a consulta falhou: a página segue sem os eventos.
 */
export async function getCarrierTracking(
  trackingCode: string | null | undefined,
  { fresh = false }: { fresh?: boolean } = {},
): Promise<CarrierTracking | null> {
  const client = getCorreiosClient();
  if (!client || !isCorreiosCode(trackingCode)) return null;
  const code = trackingCode.trim().toUpperCase();
  const cached = cache.get(code);
  if (!fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  try {
    const result = await client.track(code);
    const value: CarrierTracking = result.ok
      ? { events: result.events, delivered: result.events.some(isDeliveredEvent), message: null }
      : { events: [], delivered: false, message: result.error };
    if (cache.size >= 500) cache.clear();
    cache.set(code, { at: Date.now(), value });
    return value;
  } catch (error) {
    if (!(error instanceof CorreiosUnavailableError)) throw error;
    console.error(`[correios] rastreio indisponível: ${error.message}`);
    return null;
  }
}

const SYNC_BATCH = 100;
// A API aceita poucas requisições por segundo.
const SYNC_INTERVAL_MS = 400;

/**
 * Confere os pedidos enviados pelos Correios e marca como entregues os que já têm o evento de
 * entrega. A mudança passa por transitionOrder, então grava histórico e manda o e-mail de entrega.
 */
export async function syncCarrierDeliveries(): Promise<{
  checked: number;
  delivered: number;
  enabled: boolean;
}> {
  if (!getCorreiosClient()) return { checked: 0, delivered: 0, enabled: false };
  const orders = await db.order.findMany({
    where: { status: "SHIPPED", trackingCode: { not: null } },
    orderBy: { updatedAt: "asc" },
    take: SYNC_BATCH,
    select: { id: true, trackingCode: true },
  });
  let checked = 0;
  let delivered = 0;
  for (const order of orders) {
    if (!isCorreiosCode(order.trackingCode)) continue;
    if (checked > 0) await new Promise((resolve) => setTimeout(resolve, SYNC_INTERVAL_MS));
    const tracking = await getCarrierTracking(order.trackingCode, { fresh: true });
    // Correios fora do ar: para aqui e tenta de novo na próxima execução.
    if (!tracking) break;
    checked++;
    if (!tracking.delivered) continue;
    await transitionOrder(order.id, "DELIVERED", {
      note: "Entrega confirmada pelo rastreio dos Correios",
    });
    delivered++;
  }
  return { checked, delivered, enabled: true };
}
