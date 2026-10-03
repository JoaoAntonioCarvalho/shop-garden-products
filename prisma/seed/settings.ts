import type { Prisma } from "../../src/generated/prisma/client";
import { dateOnly, db, log } from "./helpers";
import { ensureMedia } from "./products";

// Todos os valores e faixas deste arquivo são EXEMPLOS, editáveis no admin.
// TODO(dono): confirmar preços, prazos e faixas de CEP do frete.

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function nationalHolidays(year: number): Array<{ date: Date; name: string }> {
  const goodFriday = easter(year);
  goodFriday.setDate(goodFriday.getDate() - 2);
  const fixed: Array<[number, number, string]> = [
    [1, 1, "Confraternização Universal"],
    [4, 21, "Tiradentes"],
    [5, 1, "Dia do Trabalho"],
    [9, 7, "Independência do Brasil"],
    [10, 12, "Nossa Senhora Aparecida"],
    [11, 2, "Finados"],
    [11, 15, "Proclamação da República"],
    [11, 20, "Dia da Consciência Negra"],
    [12, 25, "Natal"],
  ];
  return [
    ...fixed.map(([month, day, name]) => ({ date: new Date(year, month - 1, day), name })),
    { date: goodFriday, name: "Sexta-feira Santa" },
  ];
}

export async function seedShipping() {
  const regions: Array<
    [
      digit: string,
      label: string,
      econDays: [number, number],
      econBase: number,
      exprDays: [number, number],
      exprBase: number,
    ]
  > = [
    ["0", "Grande São Paulo", [2, 4], 1890, [1, 2], 2990],
    ["1", "Interior de São Paulo", [3, 5], 2290, [1, 3], 3490],
    ["2", "Rio de Janeiro e Espírito Santo", [4, 7], 2790, [2, 3], 4290],
    ["3", "Minas Gerais", [4, 7], 2790, [2, 3], 4290],
    ["4", "Bahia e Sergipe", [6, 10], 3490, [3, 5], 5490],
    ["5", "Nordeste", [7, 12], 3990, [3, 6], 6290],
    ["6", "Norte e Nordeste", [8, 15], 4490, [4, 7], 6990],
    ["7", "Centro-Oeste e Norte", [6, 10], 3690, [3, 5], 5690],
    ["8", "Paraná e Santa Catarina", [4, 7], 2790, [2, 3], 4290],
    ["9", "Rio Grande do Sul", [5, 8], 2990, [2, 4], 4590],
  ];

  const rules: Prisma.ShippingRuleCreateInput[] = [
    {
      name: "Entrega hoje",
      code: "entrega-hoje",
      method: "SAME_DAY",
      cepStart: "01000000",
      cepEnd: "05999999",
      baseFeeCents: 2990,
      cutoffTime: "14:00",
      weekdays: [1, 2, 3, 4, 5, 6],
      allowsLocalOnlyProducts: true,
      description: "Receba hoje até 20h.",
      position: 0,
    },
    {
      name: "Entrega hoje",
      code: "entrega-hoje-leste",
      method: "SAME_DAY",
      cepStart: "08000000",
      cepEnd: "08499999",
      baseFeeCents: 2990,
      cutoffTime: "14:00",
      weekdays: [1, 2, 3, 4, 5, 6],
      allowsLocalOnlyProducts: true,
      description: "Receba hoje até 20h.",
      position: 1,
    },
    {
      name: "Entrega agendada",
      code: "agendada-grande-sp",
      method: "LOCAL_SCHEDULED",
      cepStart: "01000000",
      cepEnd: "09999999",
      baseFeeCents: 1990,
      usesStoreFreeThreshold: true,
      minDays: 1,
      maxDays: 14,
      weekdays: [1, 2, 3, 4, 5, 6],
      allowsLocalOnlyProducts: true,
      description: "Você escolhe a data e o período, manhã ou tarde.",
      position: 2,
    },
    ...regions.flatMap(([digit, label, econDays, econBase, exprDays, exprBase], index) => [
      {
        name: "Envio econômico",
        code: `economico-${digit}`,
        method: "NATIONAL_ECONOMY" as const,
        cepStart: `${digit}0000000`,
        cepEnd: `${digit}9999999`,
        baseFeeCents: econBase,
        feePerKgCents: 350,
        usesStoreFreeThreshold: true,
        minDays: econDays[0],
        maxDays: econDays[1],
        weekdays: [1, 2, 3, 4, 5],
        description: `Transportadora, ${label}.`,
        position: 10 + index,
      },
      {
        name: "Envio expresso",
        code: `expresso-${digit}`,
        method: "NATIONAL_EXPRESS" as const,
        cepStart: `${digit}0000000`,
        cepEnd: `${digit}9999999`,
        baseFeeCents: exprBase,
        feePerKgCents: 600,
        minDays: exprDays[0],
        maxDays: exprDays[1],
        weekdays: [1, 2, 3, 4, 5],
        description: `Transportadora expressa, ${label}.`,
        position: 30 + index,
      },
    ]),
    {
      name: "Retirada na loja",
      code: "retirada",
      method: "PICKUP",
      cepStart: "00000000",
      cepEnd: "99999999",
      baseFeeCents: 0,
      allowsLocalOnlyProducts: true,
      description: "Retire no endereço da loja, em horário comercial.",
      isActive: false,
      position: 50,
    },
  ];

  for (const rule of rules) {
    await db.shippingRule.upsert({ where: { code: rule.code }, create: rule, update: {} });
  }
  log("Regras de frete", rules.length);

  const year = new Date().getFullYear();
  const holidays = [...nationalHolidays(year), ...nationalHolidays(year + 1)];
  await db.holiday.createMany({
    data: holidays.map((h) => ({ date: dateOnly(h.date), name: h.name })),
    skipDuplicates: true,
  });
  log("Feriados", holidays.length);
}

export async function seedCoupons(categoryIds: Map<string, string>) {
  const now = new Date();
  const day = 86_400_000;
  const coupons: Array<Prisma.CouponUncheckedCreateInput & { categoryPath?: string }> = [
    {
      code: "BEMVINDO10",
      description: "10% na primeira compra",
      type: "PERCENT",
      value: 10,
      firstPurchaseOnly: true,
      perCustomerLimit: 1,
    },
    {
      code: "NETSHOPGARDENBEMVINDO",
      description: "Cupom de boas-vindas do site antigo, mantido ativo",
      type: "PERCENT",
      value: 10,
      firstPurchaseOnly: true,
      perCustomerLimit: 1,
    },
    {
      code: "FRETEGRATIS",
      description: "Frete grátis na Grande SP acima de R$ 150",
      type: "FREE_SHIPPING",
      minSubtotalCents: 15000,
    },
    {
      code: "PRIMAVERA15",
      description: "15% em plantas naturais",
      type: "PERCENT",
      value: 15,
      startsAt: new Date(now.getTime() - 10 * day),
      endsAt: new Date(now.getTime() + 50 * day),
      categoryPath: "plantas-naturais",
    },
    {
      code: "INVERNO20",
      description: "Cupom expirado, para testar a mensagem de erro",
      type: "PERCENT",
      value: 20,
      startsAt: new Date(now.getTime() - 90 * day),
      endsAt: new Date(now.getTime() - 23 * day),
    },
    {
      code: "ESGOTADO50",
      description: "Cupom com limite de uso atingido, para testar a mensagem de erro",
      type: "FIXED",
      value: 5000,
      usageLimit: 20,
      usageCount: 20,
    },
    {
      code: "MAES25",
      description: "R$ 25 de desconto acima de R$ 250, não acumula com o desconto do Pix",
      type: "FIXED",
      value: 2500,
      minSubtotalCents: 25000,
      combinableWithPix: false,
    },
  ];

  for (const { categoryPath, ...data } of coupons) {
    const categories = categoryPath
      ? {
          connect: (
            await db.category.findMany({
              where: { OR: [{ path: categoryPath }, { path: { startsWith: `${categoryPath}/` } }] },
              select: { id: true },
            })
          ).map((c) => ({ id: c.id })),
        }
      : undefined;
    await db.coupon.upsert({
      where: { code: data.code },
      create: { ...data, categories },
      update: {},
    });
  }
  void categoryIds;
  log("Cupons", coupons.length);
}

export async function seedContentBlocks(categoryIds: Map<string, string>) {
  const media = await ensureMedia([
    {
      name: "hero-orquideas-desktop",
      kind: "orchid",
      label: "Orquídea borboleta",
      alt: "Ilustração de teste de uma orquídea Phalaenopsis branca em flor",
      width: 2400,
      height: 1050,
    },
    {
      name: "hero-orquideas-mobile",
      kind: "orchid",
      label: "Orquídea borboleta",
      alt: "Ilustração de teste de uma orquídea Phalaenopsis branca em flor",
      width: 1200,
      height: 1500,
    },
    {
      name: "hero-arranjos-desktop",
      kind: "arrangement",
      label: "Arranjo de orquídeas",
      alt: "Ilustração de teste de um arranjo de flores em vaso",
      width: 2400,
      height: 1050,
      variation: 2,
    },
    {
      name: "hero-arranjos-mobile",
      kind: "arrangement",
      label: "Arranjo de orquídeas",
      alt: "Ilustração de teste de um arranjo de flores em vaso",
      width: 1200,
      height: 1500,
      variation: 2,
    },
    {
      name: "banner-categoria-orquideas",
      kind: "orchid",
      label: "Orquídeas em flor",
      alt: "Ilustração de teste de orquídeas em flor",
      width: 2400,
      height: 1050,
      variation: 1,
    },
    {
      name: "heranca-shopping-garden",
      kind: "leaf",
      label: "Shopping Garden, desde 1999",
      alt: "Ilustração de teste representando o Shopping Garden",
      width: 1200,
      height: 1500,
      variation: 2,
    },
    {
      name: "newsletter",
      kind: "herb",
      label: "Novidades da loja",
      alt: "",
      width: 1200,
      height: 1500,
    },
    ...(
      ["aniversario", "agradecimento", "casa-nova", "condolencias", "datas-especiais"] as const
    ).map((slug, index) => ({
      name: `ocasiao-${slug}`,
      kind: (["flower", "orchid", "leaf", "arrangement", "candle"] as const)[index],
      label: ["Aniversário", "Agradecimento", "Casa nova", "Condolências", "Datas especiais"][
        index
      ],
      alt: `Ilustração de teste da ocasião ${["Aniversário", "Agradecimento", "Casa nova", "Condolências", "Datas especiais"][index]}`,
      width: 1200,
      height: 1500,
      variation: index % 3,
    })),
  ]);

  // Banners. Os textos da barra superior usam {{marcadores}} preenchidos com a configuração da loja.
  if ((await db.banner.count()) === 0) {
    await db.banner.createMany({
      data: [
        {
          placement: "HOME_HERO",
          title: "Plantas, orquídeas e arranjos escolhidos a dedo, entregues hoje em São Paulo.",
          subtitle: "Curadoria Shopping Garden desde 1999.",
          ctaLabel: "Ver orquídeas",
          ctaUrl: "/categoria/plantas-naturais/orquideas",
          secondaryCtaLabel: "Pedir arranjo sob medida",
          secondaryCtaType: "WHATSAPP",
          secondaryWhatsappMessage: "Olá! Vim pelo site e quero pedir um arranjo sob medida.",
          imageDesktopId: media.get("hero-orquideas-desktop"),
          imageMobileId: media.get("hero-orquideas-mobile"),
          imageCaption: "Orquídea borboleta",
          imageCaptionScientific: "Phalaenopsis amabilis",
          utmCampaign: "hero-orquideas",
          position: 0,
        },
        {
          placement: "HOME_HERO",
          title: "Arranjos montados à mão para a sua ocasião.",
          subtitle: "Conte a ideia pelo WhatsApp e receba sugestões da nossa equipe de floristas.",
          ctaLabel: "Ver arranjos",
          ctaUrl: "/categoria/arranjos",
          secondaryCtaLabel: "Pedir arranjo sob medida",
          secondaryCtaType: "WHATSAPP",
          secondaryWhatsappMessage: "Olá! Vim pelo site e quero pedir um arranjo sob medida.",
          imageDesktopId: media.get("hero-arranjos-desktop"),
          imageMobileId: media.get("hero-arranjos-mobile"),
          imageCaption: "Arranjo de orquídeas",
          imageCaptionScientific: "Phalaenopsis amabilis",
          utmCampaign: "hero-arranjos",
          position: 1,
        },
        {
          placement: "TOP_BAR",
          title: "Entrega hoje em São Paulo para pedidos até {{corte}}",
          position: 0,
        },
        { placement: "TOP_BAR", title: "{{descontoPix}}% de desconto no Pix", position: 1 },
        {
          placement: "TOP_BAR",
          title: "Frete grátis na Grande SP acima de {{freteGratis}}",
          position: 2,
        },
        {
          placement: "CATEGORY_TOP",
          title: "Orquídeas em flor, entregues hoje em São Paulo",
          subtitle: "Para pedidos feitos até {{corte}}, de segunda a sábado.",
          imageDesktopId: media.get("banner-categoria-orquideas"),
          imageMobileId: media.get("banner-categoria-orquideas"),
          imageCaption: "Orquídea borboleta",
          imageCaptionScientific: "Phalaenopsis hybrid",
          categoryId: categoryIds.get("plantas-naturais/orquideas"),
          position: 0,
        },
      ],
    });
  }

  const occasions = [
    ["Aniversário", "aniversario", "Flores e plantas para comemorar mais um ano."],
    ["Agradecimento", "agradecimento", "Um gesto para dizer obrigado."],
    ["Casa nova", "casa-nova", "Plantas e peças para dar vida ao novo endereço."],
    [
      "Condolências",
      "condolencias",
      "Arranjos e orquídeas para expressar carinho em momentos difíceis.",
    ],
    [
      "Datas especiais",
      "datas-especiais",
      "Dia das Mães, Dia dos Namorados, Natal e outras datas.",
    ],
  ] as const;
  for (const [index, [name, slug, description]] of occasions.entries()) {
    await db.occasion.upsert({
      where: { slug },
      create: {
        name,
        slug,
        description,
        tag: slug,
        imageId: media.get(`ocasiao-${slug}`),
        position: index,
      },
      update: {},
    });
  }

  const novidades = await db.collection.findUnique({
    where: { slug: "novidades" },
    select: { id: true },
  });
  const sections: Prisma.HomeSectionCreateInput[] = [
    {
      key: "diferenciais",
      type: "BENEFITS",
      title: "Por que comprar na Net Shop Garden",
      position: 0,
    },
    {
      key: "categorias",
      type: "FEATURED_CATEGORIES",
      title: "Compre por categoria",
      position: 1,
      limit: 6,
    },
    { key: "mais-vendidos", type: "BESTSELLERS", title: "Mais vendidos", position: 2, limit: 8 },
    {
      key: "presentes",
      type: "OCCASIONS",
      title: "Para presentear",
      subtitle: "Incluímos um cartão com a sua mensagem, sem custo.",
      position: 3,
    },
    {
      key: "heranca",
      type: "HERITAGE",
      title: "A loja online do Shopping Garden",
      body: "Somos a loja online do Shopping Garden, centro de jardinagem e decoração de São Paulo desde 1999. Cada planta e cada peça passa pela curadoria de quem trabalha com isso há mais de duas décadas.",
      sourceId: media.get("heranca-shopping-garden"),
      position: 4,
    },
    {
      key: "novidades",
      type: "NEW_ARRIVALS",
      title: "Novidades",
      sourceId: novidades?.id,
      position: 5,
      limit: 4,
    },
    {
      key: "avaliacoes",
      type: "TESTIMONIALS",
      title: "O que dizem os clientes",
      position: 6,
      limit: 3,
    },
    {
      key: "jardinagem",
      type: "SECONDARY_CATEGORY",
      title: "Para quem cuida do jardim",
      sourceId: categoryIds.get("jardinagem"),
      position: 7,
    },
    {
      key: "newsletter",
      type: "NEWSLETTER",
      title: "Receba novidades e {{descontoBoasVindas}}% na primeira compra",
      sourceId: media.get("newsletter"),
      position: 8,
    },
    {
      key: "sobre",
      type: "ABOUT",
      title: "Sobre a Net Shop Garden",
      // TODO(dono): revisar o texto institucional da home.
      body: "<p>A Net Shop Garden é a loja online do Shopping Garden, centro de jardinagem e decoração que funciona em São Paulo desde 1999, com três lojas físicas e mais de vinte mil itens. Aqui você encontra orquídeas, plantas naturais, arranjos, vasos, cachepots, flores artificiais e objetos de decoração escolhidos pela mesma equipe que atende nas lojas.</p><p>Na capital paulista, pedidos feitos até o horário de corte chegam no mesmo dia, em embalagem própria para plantas e peças frágeis. Para presentear, incluímos um cartão com a sua mensagem.</p><p>Se você procura algo que não está no site, fale com a gente pelo WhatsApp. Montamos arranjos sob medida e buscamos nas lojas a peça que você precisa.</p><p>Vasos, cachepots, artificiais, decoração e itens de jardinagem seguem para todo o Brasil. Plantas vivas e arranjos naturais são entregues na Grande São Paulo, por equipe própria, para chegarem em perfeito estado.</p>",
      position: 9,
    },
  ];
  for (const section of sections) {
    await db.homeSection.upsert({ where: { key: section.key }, create: section, update: {} });
  }

  if ((await db.testimonial.count()) === 0) {
    await db.testimonial.createMany({
      data: [
        {
          authorName: "Mariana S.",
          authorCity: "São Paulo, SP",
          rating: 5,
          source: "site",
          body: "Pedi uma orquídea de manhã e chegou à tarde, linda e muito bem embalada. Minha mãe adorou o cartão escrito à mão.",
        },
        {
          authorName: "Ricardo A.",
          authorCity: "São Paulo, SP",
          rating: 5,
          source: "Google",
          body: "Atendimento pelo WhatsApp rápido e atencioso. Montaram um arranjo exatamente como eu tinha imaginado para a recepção do escritório.",
        },
        {
          authorName: "Patrícia L.",
          authorCity: "Rio de Janeiro, RJ",
          rating: 5,
          source: "site",
          body: "Comprei dois cachepots de cerâmica e vieram protegidos peça por peça. Chegaram perfeitos e antes do prazo.",
        },
        {
          authorName: "Helena M.",
          authorCity: "Santo André, SP",
          rating: 4,
          source: "WhatsApp",
          body: "A zamioculca chegou maior do que eu esperava. A entrega agendada funcionou no horário combinado.",
        },
        {
          authorName: "Fernando C.",
          authorCity: "São Paulo, SP",
          rating: 5,
          source: "Google",
          body: "Já conhecia o Shopping Garden e a loja online mantém a mesma qualidade das plantas. Virei cliente.",
        },
        {
          authorName: "Beatriz R.",
          authorCity: "Belo Horizonte, MG",
          rating: 5,
          source: "site",
          body: "As flores artificiais são muito realistas. Todo mundo que visita pergunta se a orquídea é de verdade.",
        },
      ].map((t, position) => ({ ...t, position, isSample: true })),
    });
  }
  log("Banners, ocasiões, home, depoimentos", "ok");
}
