import { hasTestDatabase, unique } from "./setup";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { setEmailProvider } from "@/server/providers/email";
import type { EmailMessage } from "@/server/providers/email/types";
import { reserveStock } from "@/server/services/inventory";
import { InvalidTransitionError } from "@/server/services/order-status";
import { transitionOrder } from "@/server/services/orders";
import { applyPaymentEvent, expireOverduePayments } from "@/server/services/payments";

const sent: EmailMessage[] = [];
setEmailProvider({ send: async (message) => void sent.push(message) });

const created = { products: [] as string[], orders: [] as string[], coupons: [] as string[] };

async function createPendingOrder(
  options: { stock?: number; quantity?: number; withCoupon?: boolean; pixExpired?: boolean } = {},
) {
  const { stock = 5, quantity = 2, withCoupon = false, pixExpired = false } = options;
  const key = unique("ORD");
  const product = await db.product.create({
    data: {
      name: `Vaso de teste ${key}`,
      slug: key.toLowerCase(),
      sku: key,
      status: "ACTIVE",
      productType: "POT",
      isSample: true,
      variants: {
        create: { name: "Padrão", sku: `${key}-01`, priceCents: 10000, stockOnHand: stock },
      },
    },
    include: { variants: true },
  });
  created.products.push(product.id);
  const variant = product.variants[0];

  const coupon = withCoupon
    ? await db.coupon.create({ data: { code: key, type: "PERCENT", value: 10 } })
    : null;
  if (coupon) created.coupons.push(coupon.id);

  const externalId = `mock_${key}`;
  const order = await db.order.create({
    data: {
      number: key,
      accessToken: key,
      idempotencyKey: key,
      customerName: "Marina Teste",
      customerEmail: "marina@example.com",
      shippingAddress: {
        street: "Rua A",
        number: "1",
        city: "São Paulo",
        state: "SP",
        cep: "01310100",
      },
      paymentMethod: "PIX",
      subtotalCents: 10000 * quantity,
      discountCents: coupon ? 1000 * quantity : 0,
      totalCents: (coupon ? 9000 : 10000) * quantity,
      couponId: coupon?.id,
      couponCode: coupon?.code,
      shippingMethodCode: "economico-0",
      shippingMethodName: "Envio econômico",
      isSample: true,
      items: {
        create: {
          variantId: variant.id,
          productId: product.id,
          productName: product.name,
          sku: variant.sku,
          unitPriceCents: 10000,
          quantity,
          totalCents: 10000 * quantity,
        },
      },
      payments: {
        create: {
          provider: "mock",
          method: "PIX",
          amountCents: 10000 * quantity,
          externalId,
          pixPayload: "000201MOCK",
          pixExpiresAt: new Date(Date.now() + (pixExpired ? -60_000 : 30 * 60_000)),
        },
      },
    },
  });
  created.orders.push(order.id);
  await db.$transaction((tx) => reserveStock(tx, [{ variantId: variant.id, quantity }], order.id));
  return { order, variant, coupon, externalId };
}

const stockOf = (id: string) =>
  db.productVariant.findUniqueOrThrow({
    where: { id },
    select: { stockOnHand: true, stockReserved: true },
  });
const orderOf = (id: string) =>
  db.order.findUniqueOrThrow({
    where: { id },
    include: {
      payments: { include: { refunds: true } },
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });

describe.skipIf(!hasTestDatabase)("pedido e pagamento (contra o Postgres de teste)", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { entityId: { in: created.orders } } });
    await db.emailLog.deleteMany({ where: { orderId: { in: created.orders } } });
    await db.order.deleteMany({ where: { id: { in: created.orders } } });
    await db.coupon.deleteMany({ where: { id: { in: created.coupons } } });
    await db.product.deleteMany({ where: { id: { in: created.products } } });
    await db.$disconnect();
  });

  it("webhook de pagamento aprovado: pedido pago, estoque baixado, cupom contado e e-mails enviados", async () => {
    const { order, variant, coupon, externalId } = await createPendingOrder({ withCoupon: true });
    expect(await stockOf(variant.id)).toEqual({ stockOnHand: 5, stockReserved: 2 });
    // O uso do cupom só conta quando o pedido é pago.
    expect((await db.coupon.findUniqueOrThrow({ where: { id: coupon!.id } })).usageCount).toBe(0);

    const result = await applyPaymentEvent({ externalId, status: "PAID", raw: {} });
    expect(result).toEqual({ handled: true, orderNumber: order.number });

    const paid = await orderOf(order.id);
    expect(paid.status).toBe("PAID");
    expect(paid.paymentStatus).toBe("PAID");
    expect(paid.paidAt).not.toBeNull();
    expect(paid.payments[0].status).toBe("PAID");
    expect(await stockOf(variant.id)).toEqual({ stockOnHand: 3, stockReserved: 0 });
    expect((await db.coupon.findUniqueOrThrow({ where: { id: coupon!.id } })).usageCount).toBe(1);
    expect(await db.couponRedemption.count({ where: { orderId: order.id } })).toBe(1);
    expect(paid.statusHistory.map((h) => [h.fromStatus, h.toStatus])).toEqual([
      ["PENDING_PAYMENT", "PAID"],
    ]);
    expect(
      await db.auditLog.count({ where: { entityId: order.id, action: "order.status_change" } }),
    ).toBe(1);

    expect(sent.map((message) => message.subject)).toEqual([
      `Pagamento aprovado: pedido ${order.number}`,
      expect.stringContaining(`Novo pedido pago: ${order.number}`),
    ]);
    expect(await db.emailLog.count({ where: { orderId: order.id, status: "SENT" } })).toBe(2);
  });

  it("o mesmo evento duas vezes não baixa o estoque de novo", async () => {
    const { order, variant, externalId } = await createPendingOrder();
    await applyPaymentEvent({ externalId, status: "PAID", raw: {} });
    await applyPaymentEvent({ externalId, status: "PAID", raw: {} });
    expect(await stockOf(variant.id)).toEqual({ stockOnHand: 3, stockReserved: 0 });
    expect((await orderOf(order.id)).statusHistory).toHaveLength(1);
    expect(sent).toHaveLength(2);
  });

  it("evento de cobrança desconhecida é ignorado", async () => {
    expect(
      await applyPaymentEvent({ externalId: "mock_nao_existe", status: "PAID", raw: {} }),
    ).toEqual({ handled: false });
  });

  it("pedido segue de pago até entregue, com rastreio, e o histórico registra cada passo", async () => {
    const { order, externalId } = await createPendingOrder();
    await applyPaymentEvent({ externalId, status: "PAID", raw: {} });
    await transitionOrder(order.id, "PREPARING", { userId: null, notifyCustomer: true });
    await transitionOrder(order.id, "SHIPPED", {
      trackingCode: "BR123456789",
      carrier: "Transportadora",
      notifyCustomer: true,
    });
    await transitionOrder(order.id, "DELIVERED", { notifyCustomer: true });

    const delivered = await orderOf(order.id);
    expect(delivered.status).toBe("DELIVERED");
    expect(delivered.trackingCode).toBe("BR123456789");
    expect(delivered.preparedAt && delivered.shippedAt && delivered.deliveredAt).toBeTruthy();
    expect(delivered.statusHistory.map((h) => h.toStatus)).toEqual([
      "PAID",
      "PREPARING",
      "SHIPPED",
      "DELIVERED",
    ]);
    expect(sent.map((message) => message.subject)).toEqual(
      expect.arrayContaining([
        `Pedido ${order.number} em preparação`,
        `Pedido ${order.number} enviado`,
        `Pedido ${order.number} entregue`,
      ]),
    );
    expect(sent.find((message) => message.subject.includes("enviado"))?.text).toContain(
      "BR123456789",
    );
  });

  it("transição inválida é recusada e nada muda", async () => {
    const { order, variant } = await createPendingOrder();
    await expect(transitionOrder(order.id, "DELIVERED")).rejects.toBeInstanceOf(
      InvalidTransitionError,
    );
    expect((await orderOf(order.id)).status).toBe("PENDING_PAYMENT");
    expect(await stockOf(variant.id)).toEqual({ stockOnHand: 5, stockReserved: 2 });
  });

  it("cancelamento antes do pagamento libera a reserva", async () => {
    const { order, variant } = await createPendingOrder();
    await transitionOrder(order.id, "CANCELED", { note: "Cliente desistiu" });
    const canceled = await orderOf(order.id);
    expect(canceled.status).toBe("CANCELED");
    expect(canceled.paymentStatus).toBe("CANCELED");
    expect(canceled.cancelReason).toBe("Cliente desistiu");
    expect(canceled.payments[0].status).toBe("CANCELED");
    expect(await stockOf(variant.id)).toEqual({ stockOnHand: 5, stockReserved: 0 });
  });

  it("cancelamento após o pagamento: estorna, devolve ao estoque quando marcado e desfaz o uso do cupom", async () => {
    const { order, variant, coupon, externalId } = await createPendingOrder({ withCoupon: true });
    await applyPaymentEvent({ externalId, status: "PAID", raw: {} });
    await transitionOrder(order.id, "CANCELED", { note: "Endereço fora da área", restock: true });

    const canceled = await orderOf(order.id);
    expect(canceled.paymentStatus).toBe("REFUNDED");
    expect(canceled.payments[0].status).toBe("REFUNDED");
    expect(canceled.payments[0].refunds).toHaveLength(1);
    expect(canceled.payments[0].refunds[0].amountCents).toBe(canceled.payments[0].amountCents);
    expect(await stockOf(variant.id)).toEqual({ stockOnHand: 5, stockReserved: 0 });
    expect((await db.coupon.findUniqueOrThrow({ where: { id: coupon!.id } })).usageCount).toBe(0);
  });

  it("cancelamento após o pagamento sem devolução ao estoque mantém a baixa", async () => {
    const { order, variant, externalId } = await createPendingOrder();
    await applyPaymentEvent({ externalId, status: "PAID", raw: {} });
    await transitionOrder(order.id, "CANCELED", { note: "Produto avariado", restock: false });
    expect(await stockOf(variant.id)).toEqual({ stockOnHand: 3, stockReserved: 0 });
  });

  it("Pix vencido expira o pedido, libera a reserva e avisa o cliente", async () => {
    const { order, variant } = await createPendingOrder({ pixExpired: true });
    expect(await expireOverduePayments(order.id)).toBe(1);
    const expired = await orderOf(order.id);
    expect(expired.status).toBe("EXPIRED");
    expect(expired.payments[0].status).toBe("EXPIRED");
    expect(await stockOf(variant.id)).toEqual({ stockOnHand: 5, stockReserved: 0 });
    expect(sent.map((message) => message.subject)).toEqual([
      `O Pix do pedido ${order.number} expirou`,
    ]);
    // Um pagamento que chega depois da expiração não reabre o pedido.
    await applyPaymentEvent({
      externalId: expired.payments[0].externalId!,
      status: "PAID",
      raw: {},
    });
    expect((await orderOf(order.id)).status).toBe("EXPIRED");
  });

  it("pagamento recusado mantém o pedido aguardando e avisa o cliente", async () => {
    const { order, variant, externalId } = await createPendingOrder();
    await applyPaymentEvent({
      externalId,
      status: "FAILED",
      failureReason: "Saldo insuficiente",
      raw: {},
    });
    const failed = await orderOf(order.id);
    expect(failed.status).toBe("PENDING_PAYMENT");
    expect(failed.paymentStatus).toBe("FAILED");
    expect(await stockOf(variant.id)).toEqual({ stockOnHand: 5, stockReserved: 2 });
    expect(sent[0].subject).toBe(`O pagamento do pedido ${order.number} não foi aprovado`);
  });
});
