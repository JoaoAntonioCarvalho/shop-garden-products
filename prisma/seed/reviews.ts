import type { Prisma } from "../../src/generated/prisma/client";
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

const texts: Record<number, Array<[title: string, body: string]>> = {
  5: [
    [
      "Chegou linda",
      "Veio muito bem embalada, com as folhas intactas. Está na sala e todo mundo elogia.",
    ],
    [
      "Superou a expectativa",
      "A qualidade é a mesma da loja física. Recebi no mesmo dia, dentro do horário informado.",
    ],
    [
      "Presente perfeito",
      "Mandei de presente para minha mãe e ela ficou emocionada com o cartão. Recomendo.",
    ],
    [
      "Acabamento impecável",
      "O acabamento é muito bonito ao vivo, mais do que na foto. As medidas batem com a descrição.",
    ],
    [
      "Entrega rápida e cuidadosa",
      "O entregador foi atencioso e o produto veio protegido peça por peça. Nenhum arranhão.",
    ],
    [
      "Compraria de novo",
      "Já é a terceira compra. Sempre chega no prazo e exatamente como descrito na ficha.",
    ],
    [
      "Ótimo custo-benefício",
      "Produto firme, bem feito e do tamanho certo para o meu espaço. A ficha técnica ajudou a escolher.",
    ],
    [
      "Atendimento excelente",
      "Tirei uma dúvida pelo WhatsApp antes de comprar e responderam em minutos. Produto ótimo.",
    ],
  ],
  4: [
    [
      "Muito bom",
      "Gostei bastante. Só achei um pouco menor do que imaginava, mas as medidas estavam na descrição.",
    ],
    [
      "Bonito e bem embalado",
      "Chegou em perfeito estado. A entrega atrasou meia hora em relação à janela, nada grave.",
    ],
    [
      "Recomendo",
      "Boa qualidade. A cor é um pouco mais escura do que na foto, mas ficou ótima no ambiente.",
    ],
    [
      "Bom produto",
      "Cumpre o que promete. Tiraria uma estrela só porque a embalagem para presente poderia ser mais caprichada.",
    ],
    [
      "Satisfeita com a compra",
      "Planta saudável e com vários botões. Uma das folhas veio com a ponta amassada.",
    ],
  ],
  3: [
    ["Razoável", "O produto é bom, mas demorou mais do que eu esperava para chegar."],
    [
      "Esperava mais",
      "Bonito, porém mais simples ao vivo do que nas fotos. Pelo preço, achei mediano.",
    ],
    [
      "Atende",
      "Funciona para o que eu precisava. A caixa chegou um pouco amassada, o produto estava inteiro.",
    ],
  ],
  2: [
    [
      "Veio com avaria",
      "Uma das peças chegou lascada na borda. Entrei em contato e estão resolvendo a troca.",
    ],
    [
      "Não era o que eu esperava",
      "O tamanho é bem menor do que parece na foto. Deveria ter conferido as medidas.",
    ],
  ],
  1: [
    ["Chegou quebrado", "A peça chegou trincada. Mandei as fotos e estou aguardando a troca."],
    ["Decepcionada", "As flores chegaram murchas depois de dois dias. Esperava mais durabilidade."],
  ],
};

const replies = [
  "Obrigada pelo carinho! Ficamos felizes que tenha chegado tudo certo. Equipe Net Shop Garden.",
  "Agradecemos a avaliação. Já anotamos a sua observação para melhorar a embalagem.",
  "Sentimos muito pelo ocorrido. Nossa equipe já entrou em contato para fazer a troca sem custo.",
  "Que bom saber! As medidas ficam sempre na ficha técnica para ajudar na escolha. Volte sempre.",
];

export async function seedReviews() {
  if ((await db.review.count({ where: { isSample: true } })) > 0) {
    log("Avaliações", "já existem, mantidas");
    return;
  }
  const rng = createRng(120);
  const now = new Date();
  const data: Prisma.ReviewCreateManyInput[] = [];

  // Avaliações de compra verificada: saem de itens de pedidos entregues.
  const delivered = await db.orderItem.findMany({
    where: { order: { status: "DELIVERED", isSample: true }, productId: { not: null } },
    orderBy: { id: "asc" },
    select: {
      productId: true,
      orderId: true,
      order: {
        select: {
          userId: true,
          customerName: true,
          shippingCity: true,
          shippingState: true,
          deliveredAt: true,
        },
      },
    },
  });
  const seen = new Set<string>();
  const verified = delivered.filter((item) => {
    const key = `${item.productId}:${item.order.userId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const products = await db.product.findMany({
    where: { isSample: true },
    orderBy: { sku: "asc" },
    select: { id: true },
  });

  for (let i = 0; i < 120; i++) {
    const rating = weighted(rng, [
      [5, 58],
      [4, 26],
      [3, 9],
      [2, 4],
      [1, 3],
    ] as const);
    const [title, body] = pick(rng, texts[rating]);
    const source =
      i < 85 && verified.length ? verified[Math.floor((i * verified.length) / 85)] : null;
    const createdAt = source?.order.deliveredAt
      ? addMinutes(source.order.deliveredAt, intBetween(rng, 600, 12000))
      : daysAgo(intBetween(rng, 2, 110), now);
    const firstName = source
      ? source.order.customerName.split(" ")[0]
      : faker.person.firstName("female");
    const lastInitial = source
      ? (source.order.customerName.split(" ").pop()?.[0] ?? "")
      : faker.person.lastName()[0];
    const status = i < 10 ? "PENDING" : i === 10 || i === 11 ? "REJECTED" : "APPROVED";
    const withReply = status === "APPROVED" && (rating <= 2 || rng() < 0.12);

    data.push({
      id: `seed-avaliacao-${pad(i + 1, 3)}`,
      productId: source?.productId ?? pick(rng, products).id,
      userId: source?.order.userId ?? null,
      orderId: source?.orderId ?? null,
      authorName: `${firstName} ${lastInitial}.`,
      authorCity: source
        ? `${source.order.shippingCity}, ${source.order.shippingState}`
        : pick(rng, ["São Paulo, SP", "Campinas, SP", "Rio de Janeiro, RJ", "Curitiba, PR"]),
      rating,
      title,
      body,
      status,
      isVerifiedPurchase: Boolean(source),
      rejectionReason: status === "REJECTED" ? "Texto sem relação com o produto" : null,
      adminReply: withReply
        ? rating <= 2
          ? replies[2]
          : pick(rng, [replies[0], replies[1], replies[3]])
        : null,
      repliedAt: withReply ? addMinutes(createdAt > now ? now : createdAt, 900) : null,
      isSample: true,
      createdAt: createdAt > now ? addMinutes(now, -intBetween(rng, 30, 3000)) : createdAt,
    });
  }

  await db.review.createMany({ data });
  log("Avaliações", `${data.length} (10 pendentes)`);
}
