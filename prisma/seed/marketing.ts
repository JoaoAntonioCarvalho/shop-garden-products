import { randomBytes } from "node:crypto";
import type { LeadSource, Prisma } from "../../src/generated/prisma/client";
import { normalizeText } from "../../src/lib/slug";
import type { SeededCustomer } from "./customers";
import {
  addMinutes,
  createRng,
  daysAgo,
  db,
  faker,
  intBetween,
  log,
  pad,
  pick,
  weighted,
} from "./helpers";
import type { SeededVariant } from "./products";

const CONSENT_TEXT =
  "Aceito receber novidades e ofertas da Net Shop Garden por e-mail e, se informado, por WhatsApp. Posso cancelar quando quiser.";

export async function seedMarketing(customers: SeededCustomer[], variants: SeededVariant[]) {
  const rng = createRng(77);
  const now = new Date();

  if ((await db.lead.count({ where: { isSample: true } })) === 0) {
    const leads: Prisma.LeadCreateManyInput[] = [];
    for (let i = 0; i < 120; i++) {
      // Um terço dos leads são clientes, para o indicador de conversão de lead em compra.
      const customer = i % 3 === 0 ? customers[(i * 5) % customers.length] : null;
      const name = customer?.name ?? faker.person.fullName();
      const source: LeadSource = weighted(rng, [
        ["POPUP", 50],
        ["FOOTER", 25],
        ["CHECKOUT", 15],
        ["ACCOUNT", 10],
      ] as const);
      const createdAt = daysAgo(intBetween(rng, 0, 110), now);
      const confirmed = rng() < 0.7;
      leads.push({
        id: `seed-lead-${pad(i + 1, 3)}`,
        email: customer?.email ?? `lead.${pad(i + 1, 3)}@example.com`,
        name: rng() < 0.6 ? name : null,
        whatsapp: rng() < 0.35 ? `119${pad(intBetween(rng, 40000000, 99999999), 8)}` : null,
        source,
        consentText: CONSENT_TEXT,
        consentAt: createdAt,
        ipHash: randomBytes(16).toString("hex"),
        utm: weighted(rng, [
          [{ source: "instagram", medium: "social" }, 30],
          [{ source: "google", medium: "cpc" }, 25],
          [{ source: "google", medium: "organic" }, 25],
          [{}, 20],
        ] as const),
        couponIssued: source === "POPUP" || source === "FOOTER" ? "BEMVINDO10" : null,
        confirmedAt: confirmed ? addMinutes(createdAt, intBetween(rng, 2, 600)) : null,
        unsubscribedAt: rng() < 0.05 ? addMinutes(createdAt, 20000) : null,
        unsubscribeToken: randomBytes(18).toString("hex"),
        isSample: true,
        createdAt,
      });
    }
    await db.lead.createMany({ data: leads });
    log("Leads", leads.length);
  }

  if ((await db.productRequest.count({ where: { isSample: true } })) === 0) {
    const requests = [
      [
        "Procuro um vaso de cerâmica azul de aproximadamente 60 cm de altura para a entrada do prédio.",
        "R$ 500 a R$ 1.000",
        "NEW",
      ],
      [
        "Gostaria de um arranjo de orquídeas brancas para um casamento, cerca de 12 mesas.",
        "Acima de R$ 2.000",
        "IN_PROGRESS",
      ],
      ["Vocês têm bonsai de jabuticabeira? Quero dar de presente.", "R$ 200 a R$ 500", "QUOTED"],
      [
        "Preciso de 20 cachepots iguais de alumínio para um evento corporativo.",
        "R$ 1.000 a R$ 2.000",
        "NEW",
      ],
      [
        "Estou atrás de uma samambaia chifre-de-veado grande, para parede.",
        "R$ 200 a R$ 500",
        "CLOSED",
      ],
    ] as const;
    await db.productRequest.createMany({
      data: requests.map(([description, budgetRange, status], i) => ({
        id: `seed-solicitacao-${i + 1}`,
        name: faker.person.fullName(),
        email: `solicitacao.${i + 1}@example.com`,
        whatsapp: `119${pad(intBetween(rng, 40000000, 99999999), 8)}`,
        description,
        budgetRange,
        status,
        isSample: true,
        createdAt: daysAgo(i * 3 + 1, now),
      })),
    });

    const contacts = [
      ["Dúvida sobre entrega", "Vocês entregam em Alphaville no sábado?", null, "NEW"],
      [
        "Troca de produto",
        "O cachepot chegou com uma lasca na borda. Como faço a troca?",
        "NSG-000120",
        "NEW",
      ],
      [
        "Nota fiscal",
        "Preciso da nota fiscal em nome da empresa. É possível?",
        "NSG-000098",
        "READ",
      ],
      [
        "Cuidados com orquídea",
        "As flores da minha orquídea caíram. Ela vai florir de novo?",
        null,
        "ANSWERED",
      ],
      [
        "Parceria",
        "Sou paisagista e gostaria de saber sobre condições para profissionais.",
        null,
        "CLOSED",
      ],
    ] as const;
    await db.contactMessage.createMany({
      data: contacts.map(([subject, message, orderNumber, status], i) => ({
        id: `seed-contato-${i + 1}`,
        name: faker.person.fullName(),
        email: `contato.${i + 1}@example.com`,
        phone: `119${pad(intBetween(rng, 40000000, 99999999), 8)}`,
        subject,
        message,
        orderNumber,
        status,
        isSample: true,
        createdAt: daysAgo(i * 2, now),
      })),
    });
    log("Solicitações e contatos", "5 + 5");
  }

  if ((await db.cart.count({ where: { isSample: true } })) === 0) {
    const pool = variants.filter((v) => v.targetStock >= 5);
    for (let i = 0; i < 10; i++) {
      const customer = customers[(i * 7 + 3) % customers.length];
      const lastActivityAt = addMinutes(now, -(180 + i * 700));
      await db.cart.create({
        data: {
          id: `seed-carrinho-${pad(i + 1, 2)}`,
          token: randomBytes(24).toString("hex"),
          userId: i % 2 === 0 ? customer.id : null,
          email: customer.email,
          status: "ABANDONED",
          utm: { source: pick(rng, ["google", "instagram"]), medium: "cpc" },
          lastActivityAt,
          expiresAt: daysAgo(-30, lastActivityAt),
          isSample: true,
          createdAt: addMinutes(lastActivityAt, -25),
          items: {
            create: Array.from(
              new Map(
                Array.from({ length: intBetween(rng, 1, 3) }, () => pick(rng, pool)).map((v) => [
                  v.id,
                  v,
                ]),
              ).values(),
            ).map((variant) => ({ variantId: variant.id, quantity: 1 })),
          },
        },
      });
    }
    log("Carrinhos abandonados", 10);
  }

  if ((await db.searchLog.count()) === 0) {
    const searches: Array<[term: string, results: number, count: number]> = [
      ["orquídea", 9, 148],
      ["orquidea branca", 4, 96],
      ["vaso de cerâmica", 12, 81],
      ["cachepot", 34, 77],
      ["suculenta", 8, 64],
      ["arranjo", 8, 58],
      ["zamioculca", 1, 51],
      ["vaso grande", 6, 44],
      ["presente", 0, 39],
      ["costela de adão", 2, 37],
      ["flores artificiais", 6, 33],
      ["adubo", 4, 29],
      ["jiboia", 1, 27],
      ["bonsai", 0, 26],
      ["vela aromática", 1, 22],
      ["terrário", 2, 20],
      ["samambaia", 1, 19],
      ["girassol", 0, 17],
      ["substrato", 3, 16],
      ["vaso autoirrigável", 4, 15],
      ["tesoura de poda", 1, 12],
      ["bromélia", 0, 11],
      ["lavanda", 2, 11],
      ["cesta de café da manhã", 0, 9],
      ["cacto", 3, 9],
      ["palmeira", 0, 8],
      ["difusor", 2, 8],
      ["buquê", 4, 7],
      ["rosa do deserto", 0, 6],
      ["regador", 2, 6],
    ];
    await db.searchLog.createMany({
      data: searches.map(([term, resultsCount, count], i) => ({
        term: normalizeText(term),
        resultsCount,
        count,
        lastSearchedAt: addMinutes(now, -(i * 190 + 20)),
      })),
    });
    log("Buscas registradas", searches.length);
  }
}

/** Notas e média das avaliações aprovadas, vendas dos últimos 30 dias, menor preço e disponível. */
export async function recomputeAggregates() {
  await db.$executeRawUnsafe(`
    UPDATE "Product" p SET "ratingAverage" = COALESCE(r.avg, 0), "ratingCount" = COALESCE(r.count, 0)
    FROM (SELECT p2.id, ROUND(AVG(rv.rating)::numeric, 2)::float AS avg, COUNT(rv.id)::int AS count
          FROM "Product" p2 LEFT JOIN "Review" rv ON rv."productId" = p2.id AND rv.status = 'APPROVED'
          GROUP BY p2.id) r
    WHERE r.id = p.id`);
  await db.$executeRawUnsafe(`
    UPDATE "Product" p SET "salesCount30d" = COALESCE(s.qty, 0)
    FROM (SELECT p2.id, SUM(oi.quantity)::int AS qty
          FROM "Product" p2
          LEFT JOIN "OrderItem" oi ON oi."productId" = p2.id
          LEFT JOIN "Order" o ON o.id = oi."orderId" AND o."paidAt" >= NOW() - INTERVAL '30 days'
            AND o.status NOT IN ('CANCELED', 'EXPIRED', 'RETURNED', 'PENDING_PAYMENT')
          WHERE o.id IS NOT NULL OR oi.id IS NULL
          GROUP BY p2.id) s
    WHERE s.id = p.id`);
  await db.$executeRawUnsafe(`
    UPDATE "Product" p SET "minPriceCents" = COALESCE(v.min_price, 0), "totalAvailable" = COALESCE(v.available, 0)
    FROM (SELECT "productId",
            MIN(CASE WHEN "promoPriceCents" IS NOT NULL AND "promoPriceCents" < "priceCents"
                      AND ("promoStartsAt" IS NULL OR "promoStartsAt" <= NOW())
                      AND ("promoEndsAt" IS NULL OR "promoEndsAt" >= NOW())
                     THEN "promoPriceCents" ELSE "priceCents" END) AS min_price,
            SUM(GREATEST("stockOnHand" - "stockReserved", 0))::int AS available
          FROM "ProductVariant" WHERE "isActive" GROUP BY "productId") v
    WHERE v."productId" = p.id`);
  log("Agregados dos produtos", "ok");
}
