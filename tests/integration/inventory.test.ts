import { hasTestDatabase, unique } from "./setup";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  adjustStock,
  commitSale,
  InsufficientStockError,
  releaseReservation,
  reserveStock,
  returnToStock,
  StockAdjustmentError,
} from "@/server/services/inventory";

const createdProducts: string[] = [];
const createdOrders: string[] = [];

async function createVariant(stock: number) {
  const sku = unique("INT");
  const product = await db.product.create({
    data: {
      name: `Produto de integração ${sku}`,
      slug: sku.toLowerCase(),
      sku,
      status: "ACTIVE",
      productType: "POT",
      isSample: true,
      variants: {
        create: { name: "Padrão", sku: `${sku}-01`, priceCents: 10000, stockOnHand: stock },
      },
    },
    include: { variants: true },
  });
  createdProducts.push(product.id);
  return product.variants[0];
}

async function createOrder(variantId: string, quantity: number) {
  const key = unique("pedido");
  const order = await db.order.create({
    data: {
      number: key,
      accessToken: key,
      idempotencyKey: key,
      customerName: "Teste",
      customerEmail: "teste@example.com",
      shippingAddress: {},
      paymentMethod: "PIX",
      subtotalCents: 10000 * quantity,
      totalCents: 10000 * quantity,
      shippingMethodCode: "teste",
      shippingMethodName: "Teste",
      isSample: true,
      items: {
        create: {
          variantId,
          productName: "Produto",
          sku: "X",
          unitPriceCents: 10000,
          quantity,
          totalCents: 10000 * quantity,
        },
      },
    },
  });
  createdOrders.push(order.id);
  return order;
}

const stockOf = (id: string) =>
  db.productVariant.findUniqueOrThrow({
    where: { id },
    select: { stockOnHand: true, stockReserved: true },
  });
const movementsOf = (variantId: string) =>
  db.inventoryMovement.findMany({
    where: { variantId },
    orderBy: { createdAt: "asc" },
    select: { type: true, quantity: true, stockOnHandAfter: true, stockReservedAfter: true },
  });

describe.skipIf(!hasTestDatabase)("estoque (contra o Postgres de teste)", () => {
  afterAll(async () => {
    await db.order.deleteMany({ where: { id: { in: createdOrders } } });
    await db.product.deleteMany({ where: { id: { in: createdProducts } } });
    await db.$disconnect();
  });

  it("reserva, depois baixa no pagamento", async () => {
    const variant = await createVariant(5);
    const order = await createOrder(variant.id, 2);

    await db.$transaction((tx) =>
      reserveStock(tx, [{ variantId: variant.id, quantity: 2 }], order.id),
    );
    expect(await stockOf(variant.id)).toEqual({ stockOnHand: 5, stockReserved: 2 });

    await db.$transaction((tx) => commitSale(tx, order.id));
    expect(await stockOf(variant.id)).toEqual({ stockOnHand: 3, stockReserved: 0 });

    expect(await movementsOf(variant.id)).toEqual([
      { type: "RESERVE", quantity: 2, stockOnHandAfter: 5, stockReservedAfter: 2 },
      { type: "SALE", quantity: -2, stockOnHandAfter: 3, stockReservedAfter: 0 },
    ]);
    const product = await db.product.findUniqueOrThrow({
      where: { id: variant.productId },
      select: { totalAvailable: true },
    });
    expect(product.totalAvailable).toBe(3);
  });

  it("libera a reserva quando o pedido é cancelado ou expira antes do pagamento", async () => {
    const variant = await createVariant(4);
    const order = await createOrder(variant.id, 3);
    await db.$transaction((tx) =>
      reserveStock(tx, [{ variantId: variant.id, quantity: 3 }], order.id),
    );
    await db.$transaction((tx) => releaseReservation(tx, order.id));
    expect(await stockOf(variant.id)).toEqual({ stockOnHand: 4, stockReserved: 0 });
    expect((await movementsOf(variant.id)).map((m) => m.type)).toEqual(["RESERVE", "RELEASE"]);
  });

  it("devolve ao estoque no cancelamento após o pagamento", async () => {
    const variant = await createVariant(2);
    const order = await createOrder(variant.id, 2);
    await db.$transaction((tx) =>
      reserveStock(tx, [{ variantId: variant.id, quantity: 2 }], order.id),
    );
    await db.$transaction((tx) => commitSale(tx, order.id));
    expect(await stockOf(variant.id)).toEqual({ stockOnHand: 0, stockReserved: 0 });
    await db.$transaction((tx) => returnToStock(tx, order.id, null, "Cliente desistiu"));
    expect(await stockOf(variant.id)).toEqual({ stockOnHand: 2, stockReserved: 0 });
  });

  it("sem estoque suficiente, nada é reservado e o erro diz o item e o disponível", async () => {
    const enough = await createVariant(10);
    const short = await createVariant(1);
    const order = await createOrder(enough.id, 1);

    const attempt = db.$transaction((tx) =>
      reserveStock(
        tx,
        [
          { variantId: enough.id, quantity: 2, name: "Vaso grande" },
          { variantId: short.id, quantity: 3, name: "Vaso Terracota M" },
        ],
        order.id,
      ),
    );
    await expect(attempt).rejects.toBeInstanceOf(InsufficientStockError);
    await expect(attempt).rejects.toThrow(
      "Vaso Terracota M: temos só 1 unidade em estoque, e você pediu 3.",
    );
    expect(await stockOf(enough.id)).toEqual({ stockOnHand: 10, stockReserved: 0 });
    expect(await stockOf(short.id)).toEqual({ stockOnHand: 1, stockReserved: 0 });
    expect(await movementsOf(enough.id)).toEqual([]);
  });

  it("concorrência: duas reservas simultâneas da última unidade, só uma tem sucesso", async () => {
    const variant = await createVariant(1);
    const [orderA, orderB] = await Promise.all([
      createOrder(variant.id, 1),
      createOrder(variant.id, 1),
    ]);

    const results = await Promise.allSettled(
      [orderA, orderB].map((order) =>
        db.$transaction((tx) =>
          reserveStock(
            tx,
            [{ variantId: variant.id, quantity: 1, name: "Última orquídea" }],
            order.id,
          ),
        ),
      ),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(InsufficientStockError);
    expect((rejected[0].reason as Error).message).toBe("Última orquídea acabou de esgotar.");
    expect(await stockOf(variant.id)).toEqual({ stockOnHand: 1, stockReserved: 1 });
  });

  it("concorrência: dez pedidos disputando três unidades, exatamente três passam", async () => {
    const variant = await createVariant(3);
    const orders = await Promise.all(Array.from({ length: 10 }, () => createOrder(variant.id, 1)));
    const results = await Promise.allSettled(
      orders.map((order) =>
        db.$transaction((tx) =>
          reserveStock(tx, [{ variantId: variant.id, quantity: 1 }], order.id),
        ),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(await stockOf(variant.id)).toEqual({ stockOnHand: 3, stockReserved: 3 });
  });

  it("ajustes manuais: entrada, saída, perda e inventário, com motivo obrigatório", async () => {
    const variant = await createVariant(10);
    const run = (adjustment: Parameters<typeof adjustStock>[1]) =>
      db.$transaction((tx) => adjustStock(tx, adjustment));

    await run({
      kind: "IN",
      variantId: variant.id,
      quantity: 5,
      reason: "Recebimento de mercadoria",
      userId: null,
    });
    await run({
      kind: "OUT",
      variantId: variant.id,
      quantity: 2,
      reason: "Uso em vitrine",
      userId: null,
    });
    await run({
      kind: "LOSS",
      variantId: variant.id,
      quantity: 1,
      reason: "Quebrou na expedição",
      userId: null,
    });
    expect((await stockOf(variant.id)).stockOnHand).toBe(12);

    await run({
      kind: "ADJUSTMENT",
      variantId: variant.id,
      newCount: 9,
      reason: "Contagem de inventário",
      userId: null,
    });
    expect((await stockOf(variant.id)).stockOnHand).toBe(9);
    expect((await movementsOf(variant.id)).map((m) => [m.type, m.quantity])).toEqual([
      ["IN", 5],
      ["OUT", -2],
      ["LOSS", -1],
      ["ADJUSTMENT", -3],
    ]);

    await expect(
      run({ kind: "IN", variantId: variant.id, quantity: 1, reason: "  ", userId: null }),
    ).rejects.toBeInstanceOf(StockAdjustmentError);
  });

  it("não deixa o estoque ficar abaixo do reservado", async () => {
    const variant = await createVariant(3);
    const order = await createOrder(variant.id, 2);
    await db.$transaction((tx) =>
      reserveStock(tx, [{ variantId: variant.id, quantity: 2 }], order.id),
    );
    await expect(
      db.$transaction((tx) =>
        adjustStock(tx, {
          kind: "OUT",
          variantId: variant.id,
          quantity: 2,
          reason: "Saída",
          userId: null,
        }),
      ),
    ).rejects.toThrow(/abaixo do que está reservado/);
    expect(await stockOf(variant.id)).toEqual({ stockOnHand: 3, stockReserved: 2 });
  });
});
