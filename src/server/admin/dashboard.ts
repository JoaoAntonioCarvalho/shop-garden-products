import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { addDaysToKey, zonedParts } from "@/lib/dates";
import { db } from "@/lib/db";
import type { Period } from "./periods";

/** Pedido conta como venda quando foi pago e não foi cancelado nem devolvido. */
const SOLD = Prisma.sql`o."paidAt" IS NOT NULL AND o.status NOT IN ('CANCELED', 'RETURNED', 'EXPIRED')`;

type Range = { from: Date; to: Date };

async function summary({ from, to }: Range) {
  const [sales] = await db.$queryRaw<
    Array<{
      revenue: bigint | null;
      orders: bigint;
      items: bigint | null;
      cost: bigint | null;
      costed: bigint | null;
    }>
  >`
    SELECT SUM(o."totalCents") AS revenue, COUNT(*) AS orders,
      (SELECT SUM(i.quantity) FROM "OrderItem" i JOIN "Order" o2 ON o2.id = i."orderId"
        WHERE o2."paidAt" BETWEEN ${from} AND ${to} AND o2.status NOT IN ('CANCELED', 'RETURNED', 'EXPIRED')) AS items,
      SUM(o."costCents") FILTER (WHERE o."costCents" IS NOT NULL) AS cost,
      SUM(o."totalCents" - o."shippingCents") FILTER (WHERE o."costCents" IS NOT NULL) AS costed
    FROM "Order" o WHERE ${SOLD} AND o."paidAt" BETWEEN ${from} AND ${to}`;
  const [pending, payments, customers, leads, carts] = await Promise.all([
    db.order.aggregate({
      where: { status: "PENDING_PAYMENT", createdAt: { gte: from, lte: to } },
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
    db.payment.groupBy({
      by: ["status"],
      where: {
        createdAt: { gte: from, lte: to },
        status: { in: ["PAID", "REFUNDED", "FAILED", "EXPIRED"] },
      },
      _count: { _all: true },
    }),
    db.user.count({ where: { role: "CUSTOMER", createdAt: { gte: from, lte: to } } }),
    db.lead.count({
      where: { createdAt: { gte: from, lte: to }, source: { not: "BACK_IN_STOCK" } },
    }),
    db.$queryRaw<Array<{ count: bigint; value: bigint | null }>>`
      SELECT COUNT(DISTINCT c.id) AS count, SUM(ci.quantity * v."priceCents") AS value
      FROM "Cart" c JOIN "CartItem" ci ON ci."cartId" = c.id JOIN "ProductVariant" v ON v.id = ci."variantId"
      WHERE c.status IN ('ACTIVE', 'ABANDONED') AND c.email IS NOT NULL
        AND c."lastActivityAt" BETWEEN ${from} AND ${to} AND c."lastActivityAt" < NOW() - INTERVAL '2 hours'`,
  ]);
  const approved = payments
    .filter((p) => p.status === "PAID" || p.status === "REFUNDED")
    .reduce((sum, p) => sum + p._count._all, 0);
  const attempted = payments.reduce((sum, p) => sum + p._count._all, 0);
  const revenue = Number(sales.revenue ?? 0);
  const orders = Number(sales.orders);
  return {
    revenueCents: revenue,
    paidOrders: orders,
    averageTicketCents: orders ? Math.round(revenue / orders) : 0,
    itemsSold: Number(sales.items ?? 0),
    pendingOrders: pending._count._all,
    pendingCents: pending._sum.totalCents ?? 0,
    approvalRate: attempted ? Math.round((approved / attempted) * 1000) / 10 : null,
    newCustomers: customers,
    newLeads: leads,
    abandonedCarts: Number(carts[0]?.count ?? 0),
    abandonedCents: Number(carts[0]?.value ?? 0),
    /** Margem bruta estimada: faturamento dos produtos menos o custo, nos pedidos com custo cadastrado. */
    marginCents: sales.cost !== null ? Number(sales.costed ?? 0) - Number(sales.cost) : null,
  };
}

async function revenueByDay({ from, to }: Range) {
  const rows = await db.$queryRaw<Array<{ day: string; revenue: bigint }>>`
    SELECT to_char(o."paidAt" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS day, SUM(o."totalCents") AS revenue
    FROM "Order" o WHERE ${SOLD} AND o."paidAt" BETWEEN ${from} AND ${to} GROUP BY 1`;
  return new Map(rows.map((row) => [row.day, Number(row.revenue)]));
}

export async function getDashboard(period: Period) {
  const current = { from: period.from, to: period.to };
  const previous = { from: period.previousFrom, to: period.previousTo };
  const today = zonedParts(new Date()).dateKey;
  const todayDate = new Date(`${today}T00:00:00Z`);

  const [
    now,
    before,
    days,
    previousDays,
    byMethod,
    byChannel,
    bySource,
    byCategory,
    topProducts,
    topCustomers,
    deliveries,
    attention,
  ] = await Promise.all([
    summary(current),
    summary(previous),
    revenueByDay(current),
    revenueByDay(previous),
    db.$queryRaw<Array<{ key: string; orders: bigint; revenue: bigint }>>`
      SELECT o."paymentMethod"::text AS key, COUNT(*) AS orders, SUM(o."totalCents") AS revenue
      FROM "Order" o WHERE ${SOLD} AND o."paidAt" BETWEEN ${period.from} AND ${period.to} GROUP BY 1 ORDER BY 3 DESC`,
    db.$queryRaw<Array<{ key: string; orders: bigint; revenue: bigint }>>`
      SELECT o.channel::text AS key, COUNT(*) AS orders, SUM(o."totalCents") AS revenue
      FROM "Order" o WHERE ${SOLD} AND o."paidAt" BETWEEN ${period.from} AND ${period.to} GROUP BY 1 ORDER BY 3 DESC`,
    db.$queryRaw<Array<{ key: string; orders: bigint; revenue: bigint }>>`
      SELECT COALESCE(o."utmSource", 'direto') || COALESCE(' / ' || o."utmMedium", '') AS key, COUNT(*) AS orders, SUM(o."totalCents") AS revenue
      FROM "Order" o WHERE ${SOLD} AND o."paidAt" BETWEEN ${period.from} AND ${period.to} GROUP BY 1 ORDER BY 3 DESC LIMIT 8`,
    db.$queryRaw<Array<{ key: string; revenue: bigint }>>`
      SELECT COALESCE(parent.name, c.name, 'Sem categoria') AS key, SUM(i."totalCents") AS revenue
      FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
      LEFT JOIN "Product" p ON p.id = i."productId" LEFT JOIN "Category" c ON c.id = p."primaryCategoryId" LEFT JOIN "Category" parent ON parent.id = c."parentId"
      WHERE ${SOLD} AND o."paidAt" BETWEEN ${period.from} AND ${period.to} GROUP BY 1 ORDER BY 2 DESC`,
    db.$queryRaw<Array<{ name: string; sku: string; quantity: bigint; revenue: bigint }>>`
      SELECT i."productName" AS name, MIN(i.sku) AS sku, SUM(i.quantity) AS quantity, SUM(i."totalCents") AS revenue
      FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
      WHERE ${SOLD} AND o."paidAt" BETWEEN ${period.from} AND ${period.to} GROUP BY 1 ORDER BY 3 DESC, 4 DESC LIMIT 10`,
    db.$queryRaw<
      Array<{ id: string | null; name: string; email: string; orders: bigint; revenue: bigint }>
    >`
      SELECT MAX(o."userId") AS id, MAX(o."customerName") AS name, o."customerEmail" AS email, COUNT(*) AS orders, SUM(o."totalCents") AS revenue
      FROM "Order" o WHERE ${SOLD} AND o."paidAt" BETWEEN ${period.from} AND ${period.to} GROUP BY o."customerEmail" ORDER BY 5 DESC LIMIT 10`,
    db.order.findMany({
      where: {
        deliveryDate: todayDate,
        status: { in: ["PAID", "PREPARING", "OUT_FOR_DELIVERY", "READY_FOR_PICKUP"] },
      },
      orderBy: [{ deliveryWindow: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        number: true,
        status: true,
        customerName: true,
        recipientName: true,
        deliveryWindow: true,
        shippingMethodName: true,
        shippingMethodCode: true,
        shippingAddress: true,
        giftMessage: true,
      },
    }),
    getAttention(),
  ]);

  // Série diária, com o período anterior alinhado dia a dia.
  const series = Array.from({ length: period.days }, (_, index) => {
    const key = addDaysToKey(period.fromKey, index);
    const previousKey = addDaysToKey(zonedParts(period.previousFrom).dateKey, index);
    return {
      day: key.slice(5).split("-").reverse().join("/"),
      atual: (days.get(key) ?? 0) / 100,
      anterior: (previousDays.get(previousKey) ?? 0) / 100,
    };
  });
  const toChart = (rows: Array<{ key: string; orders?: bigint; revenue: bigint }>) =>
    rows.map((row) => ({
      name: row.key,
      pedidos: Number(row.orders ?? 0),
      faturamento: Number(row.revenue) / 100,
    }));

  return {
    now,
    before,
    series,
    byMethod: toChart(byMethod),
    byChannel: toChart(byChannel),
    bySource: toChart(bySource),
    byCategory: toChart(byCategory),
    topProducts: topProducts.map((row) => ({
      name: row.name,
      sku: row.sku,
      quantity: Number(row.quantity),
      revenueCents: Number(row.revenue),
    })),
    topCustomers: topCustomers.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      orders: Number(row.orders),
      revenueCents: Number(row.revenue),
    })),
    deliveries,
    attention,
  };
}

/** "Atenção agora": o que precisa de ação da equipe. */
export async function getAttention() {
  const soon = new Date(Date.now() + 10 * 60_000);
  const dayAgo = new Date(Date.now() - 86_400_000);
  const [
    pixExpiring,
    paidWaiting,
    lowStock,
    pendingReviews,
    newRequests,
    unreadContacts,
    dataRequests,
  ] = await Promise.all([
    db.payment.count({
      where: { method: "PIX", status: "PENDING", pixExpiresAt: { gte: new Date(), lte: soon } },
    }),
    db.order.count({ where: { status: "PAID", paidAt: { lt: dayAgo } } }),
    db.$queryRaw<Array<{ low: bigint; zero: bigint }>>`
      SELECT COUNT(*) FILTER (WHERE v."stockOnHand" - v."stockReserved" > 0 AND v."stockOnHand" - v."stockReserved" <= v."lowStockThreshold") AS low,
             COUNT(*) FILTER (WHERE v."stockOnHand" - v."stockReserved" <= 0) AS zero
      FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId" WHERE v."isActive" AND p.status = 'ACTIVE'`,
    db.review.count({ where: { status: "PENDING" } }),
    db.productRequest.count({ where: { status: "NEW" } }),
    db.contactMessage.count({ where: { status: "NEW" } }),
    db.dataRequest.count({ where: { status: "OPEN" } }),
  ]);
  return {
    pixExpiring,
    paidWaiting,
    lowStock: Number(lowStock[0]?.low ?? 0),
    zeroStock: Number(lowStock[0]?.zero ?? 0),
    pendingReviews,
    newRequests,
    unreadContacts,
    dataRequests,
  };
}
