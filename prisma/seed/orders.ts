import { randomBytes } from "node:crypto";
import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from "../../src/generated/prisma/client";
import { percentOf } from "../../src/lib/money";
import type { SeededCustomer } from "./customers";
import {
  addMinutes,
  chunk,
  createRng,
  dateOnly,
  daysAgo,
  db,
  intBetween,
  log,
  pad,
  pick,
  weighted,
  type Rng,
} from "./helpers";
import type { SeededVariant } from "./products";

const WINDOW_DAYS = 120;
const TOTAL_ORDERS = 250;

/** Datas comemorativas: os 6 dias anteriores têm mais pedidos. */
function commemorativeDates(year: number): Date[] {
  const nthSunday = (month: number, n: number) => {
    const first = new Date(year, month, 1);
    return new Date(year, month, 1 + ((7 - first.getDay()) % 7) + (n - 1) * 7);
  };
  return [
    new Date(year, 2, 8), // Dia da Mulher
    nthSunday(4, 2), // Dia das Mães
    new Date(year, 5, 12), // Dia dos Namorados
    nthSunday(7, 2), // Dia dos Pais
    new Date(year, 8, 22), // Primavera
    new Date(year, 9, 15), // Dia do Professor
    new Date(year, 11, 24), // Natal
  ];
}

function dayWeight(date: Date, peaks: Date[]): number {
  let weight = date.getDay() === 0 ? 0.6 : 1;
  for (const peak of peaks) {
    const diff = (peak.getTime() - date.getTime()) / 86_400_000;
    if (diff >= 0 && diff <= 6) weight += 3.5 - diff * 0.4;
  }
  return weight;
}

type Utm = { source: string | null; medium: string | null; campaign: string | null };
const utmOptions: ReadonlyArray<readonly [Utm, number]> = [
  [{ source: "google", medium: "organic", campaign: null }, 30],
  [{ source: "google", medium: "cpc", campaign: "orquideas-sp" }, 20],
  [{ source: "instagram", medium: "social", campaign: "primavera" }, 18],
  [{ source: "email", medium: "newsletter", campaign: "novidades" }, 10],
  [{ source: null, medium: null, campaign: null }, 22], // direto
];

const giftMessages = [
  "Feliz aniversário! Que seu novo ano seja cheio de flores.",
  "Obrigada por tudo. Com carinho.",
  "Parabéns pela casa nova! Que ela seja cheia de vida.",
  "Para alegrar o seu dia. Um abraço apertado.",
  "Com todo o meu amor.",
];

type Draft = {
  index: number;
  createdAt: Date;
  customer: SeededCustomer;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  deliveryToday: boolean;
};

function statusFor(rng: Rng, ageDays: number, method: PaymentMethod): OrderStatus {
  if (ageDays < 0.05 && method !== "CREDIT_CARD")
    return weighted(rng, [
      ["PENDING_PAYMENT", 60],
      ["PAID", 40],
    ] as const);
  if (ageDays < 1)
    return weighted(rng, [
      ["PAID", 45],
      ["PREPARING", 40],
      ["OUT_FOR_DELIVERY", 15],
    ] as const);
  if (ageDays < 3)
    return weighted(rng, [
      ["PREPARING", 20],
      ["SHIPPED", 25],
      ["OUT_FOR_DELIVERY", 10],
      ["DELIVERED", 45],
    ] as const);
  if (ageDays < 8)
    return weighted(rng, [
      ["SHIPPED", 12],
      ["DELIVERED", 80],
      ["CANCELED", 4],
      ["EXPIRED", 4],
    ] as const);
  return weighted(rng, [
    ["DELIVERED", 88],
    ["CANCELED", 5],
    ["EXPIRED", 5],
    ["RETURNED", 2],
  ] as const);
}

export async function seedOrders(customers: SeededCustomer[], variants: SeededVariant[]) {
  if ((await db.order.count({ where: { isSample: true } })) > 0) {
    log("Pedidos de teste", "já existem, mantidos");
    return;
  }

  const rng = createRng(250);
  const now = new Date();
  const peaks = [
    ...commemorativeDates(now.getFullYear()),
    ...commemorativeDates(now.getFullYear() - 1),
  ];
  const coupon = await db.coupon.findUnique({
    where: { code: "BEMVINDO10" },
    select: { id: true },
  });

  // Distribui os pedidos pelos dias conforme o peso de cada dia.
  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => daysAgo(WINDOW_DAYS - i, now));
  const weights = days.map((day) => dayWeight(day, peaks));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const drafts: Draft[] = [];
  const paymentMix = [
    ["PIX", 55],
    ["CREDIT_CARD", 40],
    ["BOLETO", 5],
  ] as const;

  // Arredondamento acumulado: a soma dos dias dá exatamente o total, sem depender de como cada dia arredonda.
  let cumulativeWeight = 0;
  let assigned = 0;
  days.forEach((day, dayIndex) => {
    cumulativeWeight += weights[dayIndex];
    const count = Math.round((cumulativeWeight / totalWeight) * (TOTAL_ORDERS - 8)) - assigned;
    assigned += count;
    for (let i = 0; i < count; i++) {
      const createdAt = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        intBetween(rng, 8, 21),
        intBetween(rng, 0, 59),
      );
      const method = weighted(rng, paymentMix);
      const ageDays = (now.getTime() - createdAt.getTime()) / 86_400_000;
      drafts.push({
        index: 0,
        createdAt,
        customer: pick(rng, customers),
        status: statusFor(rng, ageDays, method),
        paymentMethod: method,
        deliveryToday: false,
      });
    }
  });

  // Pedidos recentes: entregas de hoje (para o painel operacional) e Pix aguardando pagamento.
  const spCustomers = customers.filter((c) => c.region === "SP_CAPITAL");
  (["PAID", "PREPARING", "OUT_FOR_DELIVERY", "PAID"] as const).forEach((status, i) => {
    drafts.push({
      index: 0,
      createdAt: addMinutes(now, -(90 + i * 55)),
      customer: spCustomers[(i * 3) % spCustomers.length],
      status,
      paymentMethod: i === 1 ? "CREDIT_CARD" : "PIX",
      deliveryToday: true,
    });
  });
  for (let i = 0; i < 4; i++) {
    drafts.push({
      index: 0,
      createdAt: addMinutes(now, -(4 + i * 6)),
      customer: pick(rng, customers),
      status: "PENDING_PAYMENT",
      paymentMethod: i === 3 ? "BOLETO" : "PIX",
      deliveryToday: false,
    });
  }

  drafts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  drafts.forEach((draft, i) => (draft.index = i + 1));

  const nationalVariants = variants.filter((v) => !v.local && v.targetStock >= 5);
  const allVariants = variants.filter((v) => v.targetStock >= 5);
  const sold = new Map<string, number>();

  const orders: Prisma.OrderCreateManyInput[] = [];
  const items: Prisma.OrderItemCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const history: Prisma.OrderStatusHistoryCreateManyInput[] = [];
  const redemptions: Prisma.CouponRedemptionCreateManyInput[] = [];
  const movementDrafts: Array<{
    variantId: string;
    type: "SALE" | "RESERVE" | "RELEASE" | "RETURN";
    quantity: number;
    orderId: string;
    at: Date;
  }> = [];
  const firstOrderSeen = new Set<string>();

  for (const draft of drafts) {
    const { customer, createdAt, status } = draft;
    const id = `seed-pedido-${pad(draft.index, 4)}`;
    const isLocalCustomer = customer.region === "SP_CAPITAL" || customer.region === "GRANDE_SP";
    const pool = isLocalCustomer ? allVariants : nationalVariants;
    const itemCount = weighted(rng, [
      [1, 55],
      [2, 30],
      [3, 12],
      [4, 3],
    ] as const);
    const chosen = new Map<string, { variant: SeededVariant; quantity: number }>();
    while (chosen.size < itemCount) {
      const variant = pick(rng, pool);
      chosen.set(variant.id, {
        variant,
        quantity: variant.priceCents < 6000 && rng() < 0.4 ? 2 : 1,
      });
    }
    const lines = [...chosen.values()];
    const subtotalCents = lines.reduce((sum, l) => sum + l.variant.priceCents * l.quantity, 0);
    const costCents = lines.reduce((sum, l) => sum + l.variant.costCents * l.quantity, 0);
    const weightKg = lines.reduce((sum, l) => sum + l.variant.weightGrams * l.quantity, 0) / 1000;

    const channel = draft.deliveryToday
      ? "SITE"
      : weighted(rng, [
          ["SITE", 80],
          ["WHATSAPP", 20],
        ] as const);
    const utm: Utm =
      channel === "WHATSAPP"
        ? { source: "whatsapp", medium: "atendimento", campaign: null }
        : weighted(rng, utmOptions);

    const useCoupon = !firstOrderSeen.has(customer.id) && rng() < 0.3 && status !== "EXPIRED";
    firstOrderSeen.add(customer.id);
    const discountCents = useCoupon ? percentOf(subtotalCents, 10) : 0;
    const paymentMethod: PaymentMethod =
      channel === "WHATSAPP" && rng() < 0.5 ? "MANUAL" : draft.paymentMethod;
    const pixDiscountCents =
      paymentMethod === "PIX" ? percentOf(subtotalCents - discountCents, 5) : 0;

    const sameDay = draft.deliveryToday || (customer.region === "SP_CAPITAL" && rng() < 0.35);
    let shippingMethodCode: string;
    let shippingMethodName: string;
    let shippingCents: number;
    let deliveryDate: Date | null = null;
    let deliveryWindow: string | null = null;
    let estimatedFrom: Date | null = null;
    let estimatedTo: Date | null = null;
    if (sameDay) {
      shippingMethodCode = "entrega-hoje";
      shippingMethodName = "Entrega hoje";
      shippingCents = 2990;
      deliveryDate = dateOnly(draft.deliveryToday ? now : createdAt);
      deliveryWindow = "Até 20h";
    } else if (isLocalCustomer) {
      shippingMethodCode = "agendada-grande-sp";
      shippingMethodName = "Entrega agendada";
      shippingCents = subtotalCents >= 29900 ? 0 : 1990;
      deliveryDate = dateOnly(daysAgo(-intBetween(rng, 1, 4), createdAt));
      deliveryWindow = rng() < 0.5 ? "Manhã" : "Tarde";
    } else {
      const express = rng() < 0.25;
      const digit = customer.address.cep[0];
      shippingMethodCode = `${express ? "expresso" : "economico"}-${digit}`;
      shippingMethodName = express ? "Envio expresso" : "Envio econômico";
      shippingCents = express
        ? 4290 + Math.round(weightKg * 600)
        : subtotalCents >= 29900
          ? 0
          : 2790 + Math.round(weightKg * 350);
      estimatedFrom = dateOnly(daysAgo(-(express ? 2 : 4), createdAt));
      estimatedTo = dateOnly(daysAgo(-(express ? 4 : 8), createdAt));
    }

    const isGift = rng() < 0.22;
    const giftWrap = isGift && rng() < 0.5;
    const giftWrapCents = giftWrap ? 1500 : 0;
    const totalCents =
      subtotalCents - discountCents - pixDiscountCents + shippingCents + giftWrapCents;

    const wasPaid =
      !["PENDING_PAYMENT", "EXPIRED"].includes(status) && !(status === "CANCELED" && rng() < 0.5);
    const paidAt = wasPaid
      ? addMinutes(createdAt, paymentMethod === "BOLETO" ? 60 * 26 : intBetween(rng, 1, 12))
      : null;
    const reached = (target: OrderStatus[]) => target.includes(status);
    const preparedAt =
      paidAt &&
      reached([
        "PREPARING",
        "SHIPPED",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "RETURNED",
        "READY_FOR_PICKUP",
      ])
        ? addMinutes(paidAt, intBetween(rng, 20, 180))
        : null;
    const shippedAt =
      preparedAt && reached(["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "RETURNED"])
        ? addMinutes(preparedAt, intBetween(rng, 60, 300))
        : null;
    const deliveredAt =
      shippedAt && reached(["DELIVERED", "RETURNED"])
        ? addMinutes(
            shippedAt,
            sameDay || isLocalCustomer ? intBetween(rng, 60, 240) : intBetween(rng, 2, 6) * 1440,
          )
        : null;
    const canceledAt =
      status === "CANCELED"
        ? addMinutes(paidAt ?? createdAt, intBetween(rng, 30, 600))
        : status === "EXPIRED"
          ? addMinutes(createdAt, paymentMethod === "BOLETO" ? 3 * 1440 : 30)
          : null;

    const paymentStatus: PaymentStatus =
      status === "PENDING_PAYMENT"
        ? "PENDING"
        : status === "EXPIRED"
          ? "EXPIRED"
          : status === "CANCELED"
            ? wasPaid
              ? "REFUNDED"
              : "CANCELED"
            : status === "RETURNED"
              ? "REFUNDED"
              : "PAID";
    const usesTransport = !sameDay && !isLocalCustomer;

    orders.push({
      id,
      number: `NSG-${pad(draft.index, 6)}`,
      accessToken: randomBytes(24).toString("hex"),
      userId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      customerCpf: customer.cpf,
      shippingAddress: customer.address,
      shippingCity: customer.address.city,
      shippingState: customer.address.state,
      recipientName: isGift ? "Ana Paula Ribeiro" : null,
      recipientPhone: isGift ? "11988887777" : null,
      status,
      paymentStatus,
      paymentMethod,
      manualPaymentLabel:
        paymentMethod === "MANUAL"
          ? pick(rng, ["Pix já recebido", "Cartão na maquininha", "Dinheiro"])
          : null,
      installments:
        paymentMethod === "CREDIT_CARD"
          ? Math.max(1, Math.min(6, Math.floor(totalCents / 3000), intBetween(rng, 1, 6)))
          : 1,
      subtotalCents,
      discountCents,
      pixDiscountCents,
      shippingCents,
      giftWrapCents,
      totalCents,
      costCents,
      couponId: useCoupon ? coupon?.id : null,
      couponCode: useCoupon ? "BEMVINDO10" : null,
      shippingMethodCode,
      shippingMethodName,
      deliveryDate,
      deliveryWindow,
      estimatedDeliveryFrom: estimatedFrom,
      estimatedDeliveryTo: estimatedTo,
      trackingCode: usesTransport && shippedAt ? `TESTE${pad(draft.index, 9)}BR` : null,
      carrier: usesTransport && shippedAt ? "Transportadora de teste" : null,
      giftMessage: isGift ? pick(rng, giftMessages) : null,
      giftWrap,
      channel,
      utmSource: utm.source,
      utmMedium: utm.medium,
      utmCampaign: utm.campaign,
      idempotencyKey: `seed-${id}`,
      isSample: true,
      paidAt,
      preparedAt,
      shippedAt,
      deliveredAt,
      canceledAt,
      cancelReason:
        status === "CANCELED"
          ? pick(rng, [
              "Cliente desistiu da compra",
              "Endereço fora da área de entrega",
              "Pedido duplicado",
            ])
          : null,
      purchaseTrackedAt: paidAt,
      createdAt,
      updatedAt: deliveredAt ?? shippedAt ?? preparedAt ?? canceledAt ?? paidAt ?? createdAt,
    });

    lines.forEach((line, i) => {
      items.push({
        id: `${id}-item-${i + 1}`,
        orderId: id,
        variantId: line.variant.id,
        productId: line.variant.productId,
        productName: line.variant.productName,
        variantName: line.variant.name === "Padrão" ? null : line.variant.name,
        sku: line.variant.sku,
        imageUrl: line.variant.imageUrl,
        unitPriceCents: line.variant.priceCents,
        unitCostCents: line.variant.costCents,
        quantity: line.quantity,
        totalCents: line.variant.priceCents * line.quantity,
      });

      // Estoque: pedidos pagos baixam; pendentes reservam; cancelados e expirados devolvem.
      movementDrafts.push({
        variantId: line.variant.id,
        type: "RESERVE",
        quantity: line.quantity,
        orderId: id,
        at: createdAt,
      });
      if (status === "PENDING_PAYMENT") {
        // fica reservado
      } else if (!wasPaid) {
        movementDrafts.push({
          variantId: line.variant.id,
          type: "RELEASE",
          quantity: line.quantity,
          orderId: id,
          at: canceledAt ?? createdAt,
        });
      } else {
        movementDrafts.push({
          variantId: line.variant.id,
          type: "SALE",
          quantity: line.quantity,
          orderId: id,
          at: paidAt!,
        });
        if (status === "CANCELED" || status === "RETURNED") {
          movementDrafts.push({
            variantId: line.variant.id,
            type: "RETURN",
            quantity: line.quantity,
            orderId: id,
            at: canceledAt ?? deliveredAt ?? paidAt!,
          });
        } else {
          sold.set(line.variant.id, (sold.get(line.variant.id) ?? 0) + line.quantity);
        }
      }
    });

    const isPix = paymentMethod === "PIX";
    payments.push({
      id: `${id}-pagamento`,
      orderId: id,
      provider: paymentMethod === "MANUAL" ? "manual" : "mock",
      method: paymentMethod,
      status: paymentStatus,
      amountCents: totalCents,
      installments: orders[orders.length - 1].installments ?? 1,
      externalId: `mock_seed_${pad(draft.index, 4)}`,
      pixPayload: isPix
        ? `00020126580014BR.GOV.BCB.PIX0136MOCK-NSG-${pad(draft.index, 6)}5204000053039865802BR5915NET SHOP GARDEN6009SAO PAULO62070503***6304MOCK`
        : null,
      pixExpiresAt: isPix ? addMinutes(createdAt, 30) : null,
      boletoLine:
        paymentMethod === "BOLETO"
          ? `00190.00009 01234.567890 ${pad(draft.index, 5)}.000000 1 ${pad(totalCents, 14)}`
          : null,
      boletoDueDate: paymentMethod === "BOLETO" ? dateOnly(daysAgo(-3, createdAt)) : null,
      cardBrand: paymentMethod === "CREDIT_CARD" ? pick(rng, ["visa", "mastercard", "elo"]) : null,
      cardLast4: paymentMethod === "CREDIT_CARD" ? "0000" : null,
      createdAt,
      updatedAt: paidAt ?? canceledAt ?? createdAt,
    });

    const steps: Array<[OrderStatus | null, OrderStatus, Date | null]> = [
      [null, "PENDING_PAYMENT", createdAt],
      ["PENDING_PAYMENT", "PAID", paidAt],
      ["PAID", "PREPARING", preparedAt],
      ["PREPARING", usesTransport ? "SHIPPED" : "OUT_FOR_DELIVERY", shippedAt],
      [usesTransport ? "SHIPPED" : "OUT_FOR_DELIVERY", "DELIVERED", deliveredAt],
    ];
    let last: OrderStatus = "PENDING_PAYMENT";
    for (const [from, to, at] of steps) {
      if (!at) continue;
      history.push({
        orderId: id,
        fromStatus: from,
        toStatus: to,
        notifiedCustomer: to !== "PENDING_PAYMENT",
        createdAt: at,
      });
      last = to;
    }
    if (status === "CANCELED" || status === "EXPIRED" || status === "RETURNED") {
      history.push({
        orderId: id,
        fromStatus: last,
        toStatus: status,
        note:
          status === "EXPIRED"
            ? "Pagamento não realizado no prazo"
            : (orders[orders.length - 1].cancelReason ?? "Produto devolvido pelo cliente"),
        notifiedCustomer: true,
        createdAt: canceledAt ?? addMinutes(deliveredAt ?? createdAt, 4000),
      });
    }

    if (useCoupon && wasPaid && status !== "CANCELED" && coupon) {
      redemptions.push({
        couponId: coupon.id,
        orderId: id,
        userId: customer.id,
        email: customer.email,
        createdAt: paidAt!,
      });
    }
  }

  for (const batch of chunk(orders, 100)) await db.order.createMany({ data: batch });
  for (const batch of chunk(items, 200)) await db.orderItem.createMany({ data: batch });
  await db.payment.createMany({ data: payments });
  for (const batch of chunk(history, 300)) await db.orderStatusHistory.createMany({ data: batch });
  if (redemptions.length) {
    await db.couponRedemption.createMany({ data: redemptions });
    await db.coupon.update({
      where: { code: "BEMVINDO10" },
      data: { usageCount: redemptions.length },
    });
  }

  // Movimentos de estoque em ordem cronológica, partindo de um estoque inicial que, depois das
  // vendas, chega exatamente ao estoque atual de cada variante.
  const onHand = new Map(variants.map((v) => [v.id, v.targetStock + (sold.get(v.id) ?? 0)]));
  const reservedNow = new Map<string, number>();
  const start = daysAgo(WINDOW_DAYS + 5, now);
  const movements: Prisma.InventoryMovementCreateManyInput[] = variants
    .filter((v) => onHand.get(v.id)! > 0)
    .map((v) => ({
      variantId: v.id,
      type: "IN" as const,
      quantity: onHand.get(v.id)!,
      stockOnHandAfter: onHand.get(v.id)!,
      stockReservedAfter: 0,
      reason: "Estoque inicial (dados de teste)",
      createdAt: start,
    }));

  movementDrafts.sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const m of movementDrafts) {
    let hand = onHand.get(m.variantId)!;
    let res = reservedNow.get(m.variantId) ?? 0;
    let quantity = m.quantity;
    if (m.type === "RESERVE") res += m.quantity;
    if (m.type === "RELEASE") {
      res -= m.quantity;
      quantity = -m.quantity;
    }
    if (m.type === "SALE") {
      hand -= m.quantity;
      res -= m.quantity;
      quantity = -m.quantity;
    }
    if (m.type === "RETURN") hand += m.quantity;
    onHand.set(m.variantId, hand);
    reservedNow.set(m.variantId, res);
    movements.push({
      variantId: m.variantId,
      type: m.type,
      quantity,
      stockOnHandAfter: hand,
      stockReservedAfter: res,
      orderId: m.orderId,
      createdAt: m.at,
    });
  }
  for (const batch of chunk(movements, 500)) await db.inventoryMovement.createMany({ data: batch });

  // Estoque final. Devoluções de pedidos cancelados voltam para a prateleira.
  for (const variant of variants) {
    const hand = onHand.get(variant.id)!;
    const res = reservedNow.get(variant.id) ?? 0;
    if (hand !== variant.targetStock || res > 0) {
      await db.productVariant.update({
        where: { id: variant.id },
        data: { stockOnHand: hand, stockReserved: res },
      });
    }
  }

  await db.$executeRawUnsafe(`SELECT setval('order_number_seq', ${drafts.length})`);
  log(
    "Pedidos de teste",
    `${orders.length} (${items.length} itens, ${movements.length} movimentos de estoque)`,
  );
}
