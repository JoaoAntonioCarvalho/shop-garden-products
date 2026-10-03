import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  InvalidTransitionError,
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  timelineSteps,
  wasPaid,
  type OrderStatusCode,
} from "@/server/services/order-status";

const valid: Array<[OrderStatusCode, OrderStatusCode]> = [
  ["PENDING_PAYMENT", "PAID"],
  ["PENDING_PAYMENT", "CANCELED"],
  ["PENDING_PAYMENT", "EXPIRED"],
  ["PAID", "PREPARING"],
  ["PAID", "CANCELED"],
  ["PREPARING", "READY_FOR_PICKUP"],
  ["PREPARING", "SHIPPED"],
  ["PREPARING", "OUT_FOR_DELIVERY"],
  ["PREPARING", "CANCELED"],
  ["READY_FOR_PICKUP", "DELIVERED"],
  ["SHIPPED", "DELIVERED"],
  ["SHIPPED", "RETURNED"],
  ["OUT_FOR_DELIVERY", "DELIVERED"],
  ["OUT_FOR_DELIVERY", "PREPARING"],
  ["DELIVERED", "RETURNED"],
];

describe("máquina de estados do pedido", () => {
  it.each(valid)("permite %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it("recusa todas as outras transições", () => {
    const allowed = new Set(valid.map(([from, to]) => `${from}>${to}`));
    let checked = 0;
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        if (allowed.has(`${from}>${to}`)) continue;
        expect(canTransition(from, to), `${from} → ${to}`).toBe(false);
        expect(() => assertTransition(from, to)).toThrow(InvalidTransitionError);
        checked++;
      }
    }
    expect(checked).toBe(ORDER_STATUSES.length ** 2 - valid.length);
  });

  it("a tabela não tem transições além das da especificação", () => {
    const total = Object.values(ORDER_TRANSITIONS).reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(valid.length);
  });

  it("cancelado, expirado e devolvido são finais", () => {
    for (const status of ["CANCELED", "EXPIRED", "RETURNED"] as const) {
      expect(ORDER_TRANSITIONS[status]).toEqual([]);
      expect(() => assertTransition(status, "PAID")).toThrow(/não pode mais mudar de status/);
    }
  });

  it("a mensagem de erro diz o que é possível", () => {
    expect(() => assertTransition("PENDING_PAYMENT", "DELIVERED")).toThrow(
      'Um pedido "Aguardando pagamento" não pode ir para "Entregue". Próximos status possíveis: Pagamento aprovado, Cancelado, Pagamento não realizado.',
    );
  });

  it("identifica pedidos que já foram pagos", () => {
    expect(wasPaid("PENDING_PAYMENT")).toBe(false);
    expect(wasPaid("EXPIRED")).toBe(false);
    expect(wasPaid("PREPARING")).toBe(true);
  });

  it("monta a linha do tempo conforme a entrega", () => {
    expect(timelineSteps("transport")[3]).toBe("SHIPPED");
    expect(timelineSteps("local")[3]).toBe("OUT_FOR_DELIVERY");
    expect(timelineSteps("pickup")[3]).toBe("READY_FOR_PICKUP");
  });
});
