import "server-only";
import { db } from "@/lib/db";
import { getCorreiosClient, getJadlogClient } from "@/server/providers/shipping";
import {
  CarrierUnavailableError,
  type TrackingEvent,
} from "@/server/providers/shipping/carriers/types";
import { isDeliveredEvent } from "@/server/providers/shipping/correios/client";
import { transitionOrder } from "./orders";

/** Código de objeto dos Correios: duas letras, nove dígitos, duas letras. */
const CORREIOS_CODE = /^[A-Z]{2}\d{9}[A-Z]{2}$/;
/** Número de rastreamento ou shipmentId da Jadlog: só dígitos. */
const JADLOG_CODE = /^\d{9,14}$/;

/** De qual transportadora é o código de rastreio do pedido, pelo formato. */
export function carrierOfTrackingCode(
  code: string | null | undefined,
): "correios" | "jadlog" | null {
  const clean = (code ?? "").trim().toUpperCase();
  if (CORREIOS_CODE.test(clean)) return "correios";
  if (JADLOG_CODE.test(clean)) return "jadlog";
  return null;
}

export type CarrierTracking = {
  carrier: "Correios" | "Jadlog";
  events: TrackingEvent[];
  delivered: boolean;
  /** Mensagem quando não há eventos (objeto ainda não postado, por exemplo). */
  message: string | null;
};

const CACHE_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; value: CarrierTracking }>();

/**
 * Eventos de rastreio da transportadora para mostrar no pedido. Devolve null quando a
 * transportadora do código não está ligada, o formato não é reconhecido ou a consulta falhou:
 * a página segue sem os eventos.
 */
export async function getCarrierTracking(
  trackingCode: string | null | undefined,
  { fresh = false }: { fresh?: boolean } = {},
): Promise<CarrierTracking | null> {
  const carrier = carrierOfTrackingCode(trackingCode);
  if (!carrier || !trackingCode) return null;
  const code = trackingCode.trim().toUpperCase();
  const cached = cache.get(code);
  if (!fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  try {
    let value: CarrierTracking;
    if (carrier === "correios") {
      const client = getCorreiosClient();
      if (!client) return null;
      const result = await client.track(code);
      value = result.ok
        ? {
            carrier: "Correios",
            events: result.events,
            delivered: result.events.some(isDeliveredEvent),
            message: null,
          }
        : { carrier: "Correios", events: [], delivered: false, message: result.error };
    } else {
      const client = getJadlogClient();
      if (!client) return null;
      const result = await client.track(code);
      value = result.ok
        ? { carrier: "Jadlog", events: result.events, delivered: result.delivered, message: null }
        : { carrier: "Jadlog", events: [], delivered: false, message: result.error };
    }
    if (cache.size >= 500) cache.clear();
    cache.set(code, { at: Date.now(), value });
    return value;
  } catch (error) {
    if (!(error instanceof CarrierUnavailableError)) throw error;
    console.error(`[rastreio] ${carrier} indisponível: ${error.message}`);
    return null;
  }
}

const SYNC_BATCH = 100;
// As APIs aceitam poucas requisições por segundo.
const SYNC_INTERVAL_MS = 400;

/**
 * Confere os pedidos enviados por transportadora ligada e marca como entregues os que já têm o
 * evento de entrega. A mudança passa por transitionOrder, então grava histórico e manda o e-mail.
 */
export async function syncCarrierDeliveries(): Promise<{
  checked: number;
  delivered: number;
  enabled: boolean;
}> {
  if (!getCorreiosClient() && !getJadlogClient())
    return { checked: 0, delivered: 0, enabled: false };
  const orders = await db.order.findMany({
    where: { status: "SHIPPED", trackingCode: { not: null } },
    orderBy: { updatedAt: "asc" },
    take: SYNC_BATCH,
    select: { id: true, trackingCode: true },
  });
  let checked = 0;
  let delivered = 0;
  for (const order of orders) {
    if (!carrierOfTrackingCode(order.trackingCode)) continue;
    if (checked > 0) await new Promise((resolve) => setTimeout(resolve, SYNC_INTERVAL_MS));
    const tracking = await getCarrierTracking(order.trackingCode, { fresh: true });
    // Transportadora desligada ou fora do ar: este pedido fica para a próxima execução.
    if (!tracking) continue;
    checked++;
    if (!tracking.delivered) continue;
    await transitionOrder(order.id, "DELIVERED", {
      note: `Entrega confirmada pelo rastreio da transportadora (${tracking.carrier})`,
    });
    delivered++;
  }
  return { checked, delivered, enabled: true };
}
