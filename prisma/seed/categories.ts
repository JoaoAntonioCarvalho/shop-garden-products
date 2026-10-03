import type { IllustrationKind } from "../../scripts/generate-placeholders";

/**
 * Categorias da seção 8.1, com descrição curta, texto de SEO, FAQ e as URLs do site antigo.
 * Os textos são RASCUNHOS para revisão do dono (ver docs/PENDENCIAS-DO-DONO.md).
 */

export type FilterGroup = "plantas" | "vasos" | "artificiais" | "jardinagem";

export type SeedCategory = {
  name: string;
  slug: string;
  description: string;
  legacyPaths: string[];
  illustration: IllustrationKind;
  filters: FilterGroup[];
  isSecondary?: boolean;
  showOnHome?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  seoContent?: string;
  faq?: Array<{ pergunta: string; resposta: string }>;
  children?: SeedCategory[];
};

export const seedCategories: SeedCategory[] = [
  {
    name: "Plantas naturais",
    slug: "plantas-naturais",
    description:
      "Orquídeas, folhagens, flores em vasos, suculentas e temperos escolhidos no Shopping Garden e entregues com embalagem própria na Grande São Paulo.",
    legacyPaths: ["/decoracao/plantas-naturais"],
    illustration: "leaf",
    filters: ["plantas"],
    showOnHome: true,
    seoTitle: "Plantas naturais com entrega em São Paulo",
    seoDescription:
      "Orquídeas, folhagens, flores em vasos, suculentas e temperos com curadoria Shopping Garden. Entrega no mesmo dia em São Paulo.",
    seoContent: `<h2>Plantas naturais escolhidas uma a uma</h2>
<p>Cada planta da Net Shop Garden sai do Shopping Garden, centro de jardinagem de São Paulo desde 1999. Antes de seguir para a sua casa, ela é conferida por quem cuida de plantas todos os dias: folhas firmes, raízes saudáveis e substrato na umidade certa.</p>
<p>Trabalhamos com orquídeas, folhagens para ambientes internos, flores em vasos, cactos, suculentas e ervas para a cozinha. Em cada página você encontra a ficha botânica da planta, com luz ideal, frequência de rega, porte na entrega e se ela é segura para pets.</p>
<h2>Como escolher a planta certa para o seu espaço</h2>
<p>Comece pela luz. Observe o cômodo ao longo do dia: se o sol bate direto por algumas horas, cactos, suculentas e ervas vão bem. Se o ambiente é claro, mas sem sol direto, orquídeas, zamioculcas e jiboias são boas escolhas. Para cantos com pouca luz, prefira espada-de-são-jorge e lírio-da-paz.</p>
<p>Depois pense na rotina. Quem viaja com frequência ou está começando se dá melhor com plantas de nível de cuidado fácil, que toleram alguns dias sem rega. Use o filtro de nível de cuidado para ver só essas opções.</p>
<h3>Plantas e animais de estimação</h3>
<p>Algumas espécies comuns em decoração são tóxicas quando mastigadas por cães e gatos. Na ficha botânica indicamos quando a planta é segura e quando precisa ficar fora do alcance. O filtro "pet friendly" mostra apenas as seguras.</p>
<h2>Entrega de plantas vivas</h2>
<p>Plantas naturais são entregues na Grande São Paulo, por equipe própria, em embalagem que protege vaso, hastes e folhas. Em pedidos feitos até o horário de corte, a entrega acontece no mesmo dia na capital. Você também pode agendar a data e o período que preferir.</p>
<p>Não enviamos plantas vivas por transportadora para outras regiões, porque o tempo de viagem compromete a qualidade. Para outros estados, veja nossas flores e plantas artificiais, vasos e cachepots.</p>`,
    faq: [
      {
        pergunta: "Plantas naturais são entregues fora de São Paulo?",
        resposta:
          "Não. Plantas vivas, orquídeas e arranjos naturais são entregues apenas na Grande São Paulo, por equipe própria. Vasos, cachepots, artificiais e itens de jardinagem seguem para todo o Brasil.",
      },
      {
        pergunta: "Como a planta chega na minha casa?",
        resposta:
          "Em embalagem própria, com proteção para o vaso, as hastes e as folhas. A planta chega pronta para ficar no lugar que você escolheu, com orientações de cuidado.",
      },
      {
        pergunta: "A planta que eu receber é igual à da foto?",
        resposta:
          "Plantas são seres vivos e cada uma tem sua forma. Enviamos uma planta do mesmo porte e padrão de qualidade da foto, com pequenas variações naturais de folhas e flores.",
      },
      {
        pergunta: "Quais plantas são mais fáceis de cuidar?",
        resposta:
          "Zamioculca, espada-de-são-jorge, jiboia e suculentas toleram bem alguns dias sem rega e se adaptam a ambientes internos. Use o filtro de nível de cuidado para ver as opções fáceis.",
      },
      {
        pergunta: "Posso receber no mesmo dia?",
        resposta:
          "Sim, na capital de São Paulo, para pedidos feitos até o horário de corte informado na página do produto, de segunda a sábado.",
      },
    ],
    children: [
      {
        name: "Orquídeas",
        slug: "orquideas",
        description:
          "Phalaenopsis, Cymbidium e Dendrobium em flor, selecionadas no Shopping Garden. Entrega no mesmo dia em São Paulo.",
        legacyPaths: ["/decoracao/orquideas-naturais-86355227"],
        illustration: "orchid",
        filters: ["plantas"],
        showOnHome: true,
        seoTitle: "Orquídeas naturais com entrega hoje em São Paulo",
        seoDescription:
          "Orquídeas Phalaenopsis, Cymbidium e Dendrobium em flor, com curadoria Shopping Garden e entrega no mesmo dia em São Paulo.",
        seoContent: `<h2>Orquídeas em flor, prontas para presentear</h2>
<p>A orquídea é a planta mais pedida da Net Shop Garden, e por um bom motivo: floresce por semanas, ocupa pouco espaço e fica bem em qualquer ambiente. Selecionamos cada vaso no Shopping Garden, escolhendo plantas com hastes firmes, botões ainda por abrir e folhas sem manchas, para que a floração dure mais na sua casa.</p>
<h2>Qual orquídea escolher</h2>
<p>A Phalaenopsis, conhecida como orquídea borboleta, é a mais indicada para dentro de casa. Gosta de luz indireta e de regas espaçadas, e costuma florir de novo no ano seguinte. A versão com duas hastes tem mais flores e presença em mesas e aparadores.</p>
<p>O Cymbidium tem hastes longas com muitas flores e prefere ambientes mais frescos e bem iluminados, como varandas cobertas. O Dendrobium forma cachos de flores menores ao longo do caule e aprecia bastante claridade.</p>
<h3>Como cuidar depois que as flores caem</h3>
<p>Quando a floração termina, a planta continua viva e saudável. Corte a haste seca acima do segundo nó, mantenha a rega semanal e deixe o vaso perto de uma janela iluminada. Com adubo próprio para orquídeas a cada quinze dias, novas hastes costumam surgir em alguns meses.</p>
<h2>Entrega e embalagem</h2>
<p>As orquídeas viajam em embalagem que mantém as hastes presas e protegidas. Na capital de São Paulo, pedidos feitos até o horário de corte chegam no mesmo dia. Se for presente, inclua um cartão com a sua mensagem na sacola, sem custo.</p>`,
        faq: [
          {
            pergunta: "Orquídea precisa de sol direto?",
            resposta:
              "Não. A maioria prefere luz indireta, perto de uma janela bem iluminada. Sol direto nas horas mais quentes queima as folhas.",
          },
          {
            pergunta: "De quanto em quanto tempo devo regar?",
            resposta:
              "Em geral a cada 5 a 7 dias, quando o substrato estiver seco ao toque. Evite deixar água acumulada no cachepot.",
          },
          {
            pergunta: "A orquídea chega com flores abertas?",
            resposta:
              "Sim. Enviamos plantas em flor, com parte dos botões ainda fechados, para que a floração dure mais tempo com você.",
          },
          {
            pergunta: "Orquídea é tóxica para gatos e cachorros?",
            resposta:
              "A Phalaenopsis é considerada segura para pets. Mesmo assim, o ideal é manter a planta fora do alcance para que as flores não sejam mordidas.",
          },
          {
            pergunta: "A orquídea floresce de novo?",
            resposta:
              "Sim. Com luz indireta, rega regular e adubação, ela costuma voltar a florir uma vez por ano.",
          },
        ],
      },
      {
        name: "Plantas ornamentais",
        slug: "plantas-ornamentais",
        description:
          "Folhagens para dentro de casa: zamioculca, costela-de-adão, jiboia, espada-de-são-jorge e outras de fácil cuidado.",
        legacyPaths: ["/decoracao/plantas-17881412"],
        illustration: "leaf",
        filters: ["plantas"],
      },
      {
        name: "Flores em vasos",
        slug: "flores-em-vasos",
        description:
          "Kalanchoe, antúrio, violeta e mini rosa em vasos, para dar cor à casa ou presentear.",
        legacyPaths: ["/decoracao/flores-79302615"],
        illustration: "flower",
        filters: ["plantas"],
      },
      {
        name: "Cactos e suculentas",
        slug: "cactos-e-suculentas",
        description:
          "Suculentas, cactos e composições em vasos de cerâmica. Pouca rega, muita luz e quase nenhum trabalho.",
        legacyPaths: ["/decoracao/cactus"],
        illustration: "cactus",
        filters: ["plantas"],
      },
      {
        name: "Ervas e temperos",
        slug: "ervas-e-temperos",
        description:
          "Manjericão, alecrim, hortelã e kits de horta para ter tempero fresco na janela da cozinha.",
        legacyPaths: ["/decoracao/ervas-e-temperos"],
        illustration: "herb",
        filters: ["plantas"],
      },
      {
        name: "Caixarias",
        slug: "caixarias",
        description:
          "Caixas e caixotes de madeira com composições de suculentas e ervas, prontos para decorar ou presentear.",
        legacyPaths: ["/decoracao/caixarias"],
        illustration: "herb",
        filters: ["plantas"],
      },
    ],
  },
  {
    name: "Arranjos",
    slug: "arranjos",
    description:
      "Arranjos montados à mão com orquídeas, flores e folhagens, e arranjos artificiais para decoração duradoura.",
    legacyPaths: [
      "/decoracao/arranjos-44071597",
      "/landing-arranjos-artificiais.html",
      "/mobile-arranjos-artificiais.html",
    ],
    illustration: "arrangement",
    filters: ["plantas", "artificiais"],
    showOnHome: true,
    seoTitle: "Arranjos de flores e orquídeas para casa e presente",
    seoDescription:
      "Arranjos naturais e artificiais montados à mão, para centro de mesa, recepção e presente. Arranjos sob medida pelo WhatsApp.",
    seoContent: `<h2>Arranjos montados à mão</h2>
<p>Um arranjo bem feito muda a mesa, a recepção ou a sala de quem recebe. Os arranjos da Net Shop Garden são montados por floristas do Shopping Garden, que combinam orquídeas, flores, folhagens e recipientes de cerâmica, vidro e madeira.</p>
<h2>Arranjos naturais e artificiais</h2>
<p>Os arranjos naturais usam plantas e flores vivas e são entregues na Grande São Paulo, no mesmo dia para pedidos feitos até o horário de corte. São a escolha para presentear em datas especiais e para eventos.</p>
<p>Os arranjos artificiais usam flores e folhagens de toque realista. Não precisam de rega nem de luz, mantêm a aparência por anos e podem ser enviados para todo o Brasil. Funcionam bem em escritórios, consultórios, casas de praia e ambientes com pouca claridade.</p>
<h3>Como escolher o tamanho</h3>
<p>Para centro de mesa de jantar, prefira arranjos baixos, que não atrapalham a conversa. Para aparadores e recepções, os arranjos altos, com hastes de orquídea, criam mais presença. Em cada página informamos altura e largura para você conferir se cabe no espaço.</p>
<h2>Arranjos sob medida</h2>
<p>Se você imagina algo específico, com determinada cor, tamanho ou recipiente, montamos um arranjo exclusivo. Envie a ideia pelo WhatsApp, com fotos de referência se tiver, e retornamos com sugestões e orçamento.</p>`,
    faq: [
      {
        pergunta: "Vocês montam arranjos sob medida?",
        resposta:
          "Sim. Conte pelo WhatsApp a ocasião, as cores e o orçamento. Nossa equipe envia sugestões e o prazo de montagem.",
      },
      {
        pergunta: "Quanto tempo dura um arranjo natural?",
        resposta:
          "Arranjos com orquídeas plantadas duram semanas em flor e a planta continua viva depois. Arranjos de flores cortadas duram de 5 a 10 dias com troca de água.",
      },
      {
        pergunta: "Arranjos naturais são enviados para outros estados?",
        resposta:
          "Não. Arranjos naturais são entregues apenas na Grande São Paulo. Arranjos artificiais seguem para todo o Brasil.",
      },
      {
        pergunta: "Posso incluir um cartão com mensagem?",
        resposta:
          "Sim. Na sacola, marque a opção de cartão e escreva sua mensagem. O cartão é gratuito.",
      },
    ],
    children: [
      {
        name: "Arranjos artificiais",
        slug: "arranjos-artificiais",
        description:
          "Arranjos prontos com flores e plantas artificiais de toque realista, em vasos de cerâmica, vidro e madeira.",
        legacyPaths: ["/decoracao/arranjos-artificiais"],
        illustration: "arrangement",
        filters: ["artificiais"],
      },
    ],
  },
  {
    name: "Vasos",
    slug: "vasos",
    description:
      "Vasos de cerâmica, barro, porcelana, vidro, fibra de coco e polietileno, em vários tamanhos, para áreas internas e externas.",
    legacyPaths: [
      "/decoracao/vasos",
      "/landingVasos.html",
      "/mobile-Vasos.html",
      "/vasos-resumo.html",
      "/landing-vasos-para-jardins.html",
      "/mobile-vasos-para-jardins.html",
    ],
    illustration: "pot",
    filters: ["vasos"],
    showOnHome: true,
    seoTitle: "Vasos para plantas: cerâmica, porcelana, vidro e mais",
    seoDescription:
      "Vasos de cerâmica, barro, porcelana, vidro, fibra de coco e polietileno para plantas e decoração, com medidas detalhadas.",
    seoContent: `<h2>O vaso certo para cada planta</h2>
<p>O vaso influencia a saúde da planta tanto quanto a rega. Materiais porosos, como barro e cerâmica sem esmalte, deixam a terra respirar e secam mais rápido, o que agrada cactos, suculentas e ervas. Vasos esmaltados, de porcelana, vidro ou polietileno retêm a umidade por mais tempo e combinam com folhagens tropicais.</p>
<h2>Como escolher o tamanho</h2>
<p>Ao trocar uma planta de vaso, escolha um recipiente com diâmetro de boca dois a quatro centímetros maior que o atual. Vaso grande demais acumula água e pode apodrecer as raízes. Em cada produto informamos altura, diâmetro da boca, diâmetro da base e capacidade em litros.</p>
<h3>Furo de drenagem</h3>
<p>Para plantar direto no vaso, prefira modelos com furo de drenagem e use uma camada de argila expandida no fundo. Vasos sem furo funcionam como cachepot: a planta fica no vaso de cultivo, dentro da peça decorativa.</p>
<h2>Vasos para áreas externas</h2>
<p>Em varandas e jardins, o vaso precisa resistir a sol, chuva e variação de temperatura. Polietileno e materiais reciclados são leves e não trincam. Cerâmica vitrificada e barro também vão bem, desde que o vaso tenha drenagem. Use o filtro de uso externo para ver as opções.</p>
<h2>Envio de peças frágeis</h2>
<p>Vasos de cerâmica, porcelana e vidro são embalados um a um, com proteção contra impacto. Se a peça chegar com avaria, envie fotos em até 48 horas e fazemos a troca.</p>`,
    faq: [
      {
        pergunta: "Qual a diferença entre vaso e cachepot?",
        resposta:
          "O vaso tem furo de drenagem e recebe a planta com terra. O cachepot é uma peça decorativa, sem furo, que recebe o vaso de cultivo dentro.",
      },
      {
        pergunta: "Como sei se a planta cabe no vaso?",
        resposta:
          "Compare o diâmetro da boca informado na ficha técnica com o do vaso atual. O novo deve ter de 2 a 4 cm a mais.",
      },
      {
        pergunta: "Vaso de barro pode ficar na chuva?",
        resposta:
          "Pode. O barro é poroso e escurece quando molhado, o que é natural. Mantenha o furo de drenagem livre para a água escoar.",
      },
      {
        pergunta: "Os vasos são enviados para todo o Brasil?",
        resposta: "Sim. Vasos e cachepots seguem com embalagem reforçada para todas as regiões.",
      },
      {
        pergunta: "O vaso acompanha prato?",
        resposta: "Só quando indicado na descrição. Pratos avulsos estão em Acessórios para vasos.",
      },
    ],
    children: [
      {
        name: "Cerâmica e barro",
        slug: "ceramica-e-barro",
        description:
          "Vasos de barro tradicional e de cerâmica vitrificada ou esmaltada, com furo de drenagem.",
        legacyPaths: [
          "/decoracao/vasos-ceramica",
          "/landingVasosCeramica.html",
          "/mobile-VasosCeramica.html",
          "/VasosCeramica.html",
        ],
        illustration: "pot",
        filters: ["vasos"],
      },
      {
        name: "Porcelana",
        slug: "porcelana",
        description: "Vasos de porcelana branca e com detalhes dourados, para flores e folhagens.",
        legacyPaths: ["/landingVasosPorcelana.html", "/mobile-VasosPorcelana.html"],
        illustration: "pot",
        filters: ["vasos"],
      },
      {
        name: "Vidro",
        slug: "vidro",
        description:
          "Vasos de vidro cilíndricos e para pendurar, ideais para flores, terrários e plantas aéreas.",
        legacyPaths: ["/landingVasosVidros.html", "/mobile-VasosVidros.html"],
        illustration: "cachepot",
        filters: ["vasos"],
      },
      {
        name: "Fibra de coco",
        slug: "fibra-de-coco",
        description:
          "Vasos e placas de fibra de coco para orquídeas, samambaias e jardins verticais.",
        legacyPaths: [
          "/decoracao/vasos-fibra-coco",
          "/landingVasosFibraDeCoco.html",
          "/mobile-VasosFibraDeCoco.html",
        ],
        illustration: "pot",
        filters: ["vasos"],
      },
      {
        name: "Plástico",
        slug: "plastico",
        description:
          "Vasos e jardineiras de plástico, leves e resistentes, para o cultivo do dia a dia.",
        legacyPaths: [
          "/decoracao/plastico-76250857",
          "/landingVasosDePlastico.html",
          "/mobile-VasosDePlastico.html",
        ],
        illustration: "pot",
        filters: ["vasos"],
      },
      {
        name: "Polietileno e reciclados",
        slug: "polietileno-e-reciclados",
        description:
          "Vasos grandes de polietileno e de material reciclado, leves e resistentes ao sol e à chuva.",
        legacyPaths: [
          "/decoracao/vasos-material-reciclado",
          "/landingVasosReciclados.html",
          "/mobile-VasosReciclados.html",
        ],
        illustration: "pot",
        filters: ["vasos"],
      },
      {
        name: "Vasos decorativos",
        slug: "vasos-decorativos",
        description:
          "Vasos de vidro Murano e de cerâmica texturizada para usar como peça de decoração, com ou sem flores.",
        legacyPaths: [
          "/flores-artificiais-vasos-para-decoracao",
          "/landingVasosDecorativos.html",
          "/mobile-VasosDecorativos.html",
          "/landing-vasos-decorativos.html",
          "/mobile-vasos-decorativos.html",
        ],
        illustration: "cachepot",
        filters: ["vasos"],
      },
      {
        name: "Acessórios para vasos",
        slug: "acessorios",
        description: "Pratos, suportes de ferro e ganchos para apoiar e pendurar vasos.",
        legacyPaths: ["/decoracao/acessorios-vasos-plantas"],
        illustration: "pot",
        filters: ["vasos"],
      },
    ],
  },
  {
    name: "Cachepots",
    slug: "cachepots",
    description:
      "Cachepots de cerâmica, porcelana, metal, vidro, madeira e cestaria para vestir o vaso da sua planta.",
    legacyPaths: [
      "/decoracao/cachepot",
      "/cachepot.html",
      "/mobile-cachepot.html",
      "/cachepots-resumo.html",
      "/linktopCachepot.html",
    ],
    illustration: "cachepot",
    filters: ["vasos"],
    showOnHome: true,
    seoTitle: "Cachepots de cerâmica, porcelana, metal e cestaria",
    seoDescription:
      "Cachepots para plantas em cerâmica, porcelana, metal, vidro, madeira e cestaria, com medidas detalhadas e envio para todo o Brasil.",
    seoContent: `<h2>Para que serve um cachepot</h2>
<p>O cachepot é a peça que veste o vaso. A planta continua no recipiente de cultivo, com furo de drenagem, e o cachepot fica por fora, escondendo o plástico e combinando com a decoração. Isso permite trocar a planta de lugar ou de estilo sem replantar.</p>
<h2>Como escolher o cachepot</h2>
<p>Meça o vaso de cultivo: diâmetro da boca e altura. O cachepot deve ter boca um a dois centímetros maior e altura igual ou um pouco maior, para que o vaso não apareça. Todas as medidas estão na ficha técnica de cada produto.</p>
<p>Cerâmica e porcelana têm acabamento mais nobre e peso que dá estabilidade a plantas altas. Metal e alumínio são leves e combinam com ambientes contemporâneos. Madeira e cestaria trazem textura natural e pedem um prato ou forro interno para não entrar em contato com a água.</p>
<h3>Cachepots autoirrigáveis</h3>
<p>Os modelos autoirrigáveis têm um reservatório na base e um sistema que leva a água às raízes aos poucos. São úteis para quem viaja ou esquece a rega, e funcionam bem com ervas, violetas e folhagens.</p>
<h2>Cuidados no uso</h2>
<p>Depois de regar, espere a água escorrer antes de devolver o vaso ao cachepot, ou retire o excesso que ficar no fundo. Água parada é a causa mais comum de raízes apodrecidas e de mosquitos.</p>`,
    faq: [
      {
        pergunta: "Posso plantar direto no cachepot?",
        resposta:
          "Não é o ideal, porque ele não tem furo de drenagem. Mantenha a planta no vaso de cultivo e coloque-o dentro do cachepot.",
      },
      {
        pergunta: "Como escolher o tamanho do cachepot?",
        resposta:
          "A boca do cachepot deve ser 1 a 2 cm maior que a do vaso de cultivo, e a altura igual ou um pouco maior.",
      },
      {
        pergunta: "Cachepot de cestaria pode molhar?",
        resposta:
          "Evite. Use um prato dentro do cesto e retire o vaso para regar. A umidade constante escurece e enfraquece a fibra.",
      },
      {
        pergunta: "Como funciona o cachepot autoirrigável?",
        resposta:
          "Ele tem um reservatório de água na base. Você abastece pelo bocal e a planta absorve aos poucos, por até duas semanas.",
      },
    ],
    children: [
      {
        name: "Autoirrigáveis",
        slug: "autoirrigaveis",
        description: "Cachepots com reservatório de água, para regar com menos frequência.",
        legacyPaths: ["/decoracao/autoirrigavel"],
        illustration: "cachepot",
        filters: ["vasos"],
      },
      {
        name: "Cerâmica",
        slug: "ceramica",
        description: "Cachepots de cerâmica lisa, texturizada e em mosaico.",
        legacyPaths: [
          "/decoracao/cachepot-ceramica",
          "/cachepotCeramica.html",
          "/cachepots-ceramica.html",
          "/landingCachepotCeramica.html",
          "/mobile-CachepotCeramica.html",
          "/linktopCachepotCeramica.html",
        ],
        illustration: "cachepot",
        filters: ["vasos"],
      },
      {
        name: "Porcelana",
        slug: "porcelana",
        description: "Cachepots de porcelana branca e decorada, de acabamento delicado.",
        legacyPaths: ["/landingCachepotPorcelana.html", "/mobile-CachepotPorcelana.html"],
        illustration: "cachepot",
        filters: ["vasos"],
      },
      {
        name: "Metal e alumínio",
        slug: "metal-e-aluminio",
        description: "Cachepots de alumínio escovado e metal pintado, leves e duráveis.",
        legacyPaths: [
          "/decoracao/cachepot-metal-aluminio",
          "/cachepot-aluminio.html",
          "/cachepotAluminio.html",
          "/landingCachepotAlumino.html",
          "/mobile-CachepotAlumino.html",
          "/linktopCachepotMetal.html",
        ],
        illustration: "cachepot",
        filters: ["vasos"],
      },
      {
        name: "Vidro",
        slug: "vidro",
        description: "Cachepots de vidro transparente e colorido, para orquídeas e composições.",
        legacyPaths: ["/decoracao/cachepot-vidro", "/linktopCachepotVidro.html"],
        illustration: "cachepot",
        filters: ["vasos"],
      },
      {
        name: "Madeira",
        slug: "madeira",
        description: "Cachepots de madeira de demolição e de reflorestamento, com textura natural.",
        legacyPaths: [
          "/decoracao/cachepot-madeira",
          "/cachepotMadeira.html",
          "/landingCachepotMadeira.html",
          "/mobile-CachepotMadeira.html",
          "/linktopCachepotMadeira.html",
        ],
        illustration: "cachepot",
        filters: ["vasos"],
      },
      {
        name: "Cestaria",
        slug: "cestaria",
        description: "Cestos de fibras naturais para vestir vasos de folhagens.",
        legacyPaths: ["/decoracao/cestaria-56907290", "/linktopCachepotCestaria.html"],
        illustration: "cachepot",
        filters: ["vasos"],
      },
      {
        name: "Plástico",
        slug: "plastico",
        description: "Cachepots de plástico com acabamento fosco, leves e fáceis de limpar.",
        legacyPaths: ["/landingCachepotPlastico.html", "/mobile-CachepotPlastico.html"],
        illustration: "cachepot",
        filters: ["vasos"],
      },
    ],
  },
  {
    name: "Flores e plantas artificiais",
    slug: "flores-e-plantas-artificiais",
    description:
      "Flores, folhagens, buquês e vasos montados com plantas artificiais de toque realista, enviados para todo o Brasil.",
    legacyPaths: [
      "/decoracao/flores-artificiais",
      "/linktopFloresArtificiais.html",
      "/ltArtificiais.html",
      "/landing-flores-artificiais-porque-sao-tao-amadas.html",
      "/mobile-flores-artificiais-porque-sao-tao-amadas.html",
      "/landing-flores-artificiais-como-limpar.html",
      "/mobile-flores-artificiais-como-limpar.html",
      "/landing-flores-artificiais-como-fixar-no-vaso.html",
      "/mobile-flores-artificiais-como-fixar-no-vaso.html",
      "/landing-flores-artificiais-arranjos-para-eventos-casamentos-e-outras-ocasioes.html",
      "/mobile-flores-artificiais-arranjos-para-eventos-casamentos-e-outras-ocasioes.html",
    ],
    illustration: "flower",
    filters: ["artificiais"],
    showOnHome: true,
    seoTitle: "Flores e plantas artificiais de toque realista",
    seoDescription:
      "Flores, folhagens e buquês artificiais com aparência natural, para decoração e eventos. Envio para todo o Brasil.",
    seoContent: `<h2>Plantas artificiais que parecem naturais</h2>
<p>As flores e plantas artificiais evoluíram muito. Os materiais atuais reproduzem a textura das pétalas, as nervuras das folhas e até as pequenas imperfeições de uma planta de verdade. Selecionamos peças de toque realista, que convencem de perto e não desbotam com facilidade.</p>
<p>Elas resolvem situações em que uma planta viva não iria bem: ambientes sem luz natural, casas que ficam fechadas por longos períodos, escritórios, consultórios e decoração de eventos.</p>
<h2>Como limpar flores artificiais</h2>
<p>A limpeza é simples. Para o pó do dia a dia, use um secador de cabelo no modo frio ou um pincel macio. A cada dois ou três meses, passe um pano levemente úmido nas folhas maiores. Evite produtos químicos e não deixe as peças expostas ao sol direto, que acelera o desbotamento.</p>
<h2>Como fixar as flores no vaso</h2>
<p>Para montar seu próprio arranjo, use espuma floral seca no fundo do vaso e espete as hastes, começando pelas mais altas no centro. Cubra a espuma com musgo, pedras ou casca de pinus. Em vasos de vidro transparente, as hastes podem ficar soltas, apoiadas umas nas outras.</p>
<h3>Buquês e arranjos para eventos</h3>
<p>Buquês artificiais são usados em casamentos, ensaios fotográficos e formaturas, porque ficam prontos com antecedência e viram lembrança. Para decoração de mesas e cerimônias, os vasos já montados economizam tempo de produção.</p>
<h2>Envio para todo o Brasil</h2>
<p>Diferente das plantas vivas, as artificiais seguem por transportadora para todas as regiões, em embalagem que preserva o formato das hastes.</p>`,
    faq: [
      {
        pergunta: "Como limpar flores artificiais?",
        resposta:
          "Passe um pano seco ou use o secador no modo frio para tirar o pó. A cada poucos meses, um pano levemente úmido nas folhas maiores.",
      },
      {
        pergunta: "Flores artificiais desbotam?",
        resposta:
          "Com o tempo, se ficarem expostas ao sol direto. Em ambientes internos, mantêm a cor por anos.",
      },
      {
        pergunta: "As plantas artificiais acompanham vaso?",
        resposta:
          "Depende do produto. A ficha técnica informa se a peça acompanha vaso ou se vem só com a haste.",
      },
      {
        pergunta: "Vocês entregam artificiais fora de São Paulo?",
        resposta: "Sim. Flores e plantas artificiais são enviadas para todo o Brasil.",
      },
      {
        pergunta: "Como fixar as hastes no vaso?",
        resposta:
          "Use espuma floral seca no fundo do vaso, espete as hastes e cubra com musgo ou pedras decorativas.",
      },
    ],
    children: [
      {
        name: "Plantas e flores artificiais",
        slug: "plantas-e-flores",
        description: "Hastes, folhagens e plantas artificiais em vaso, com aparência natural.",
        legacyPaths: [
          "/decoracao/plantas-artificiais-77187746",
          "/landing-plantas-artificiais-e-folhagens.html",
          "/mobile-plantas-artificiais-e-folhagens.html",
        ],
        illustration: "leaf",
        filters: ["artificiais"],
      },
      {
        name: "Buquês",
        slug: "buques",
        description:
          "Buquês de rosas, peônias e flores do campo artificiais, para decorar e presentear.",
        legacyPaths: [
          "/landing-buque.html",
          "/mobile-buque.html",
          "/landing-flores-artificiais-como-montar-um-buque.html",
          "/mobile-flores-artificiais-como-montar-um-buque.html",
        ],
        illustration: "flower",
        filters: ["artificiais"],
      },
      {
        name: "Vasos com flores artificiais",
        slug: "vasos-com-flores",
        description: "Vasos e cachepots já montados com flores artificiais, prontos para usar.",
        legacyPaths: [
          "/landing-vasos-de-flores-artificiais-para-decoracao.html",
          "/mobile-vasos-de-flores-artificiais-para-decoracao.html",
          "/MiBAstArtRosa.html",
        ],
        illustration: "arrangement",
        filters: ["artificiais"],
      },
    ],
  },
  {
    name: "Decoração e aromas",
    slug: "decoracao-e-aromas",
    description:
      "Objetos de decoração, aromas L'Envie e peças da Linha Conceito para completar os ambientes da casa.",
    legacyPaths: ["/decoracao/objetos-de-decoracao"],
    illustration: "candle",
    filters: ["vasos"],
    seoTitle: "Objetos de decoração e aromas para casa",
    seoDescription:
      "Porta-velas, bandejas, terrários, difusores, velas aromáticas e peças de design para decorar e perfumar a casa.",
    seoContent: `<h2>Detalhes que completam o ambiente</h2>
<p>Depois das plantas e dos vasos, são os detalhes que dão personalidade à casa. Reunimos objetos que conversam com o universo botânico: porta-velas de vidro e ferro, bandejas para compor aparadores, terrários de vidro e peças de cerâmica feitas à mão.</p>
<h2>Aromas L'Envie</h2>
<p>A linha L'Envie traz difusores de varetas, home sprays e velas aromáticas em fragrâncias que combinam com ambientes cheios de verde. O difusor perfuma de forma contínua e discreta, bom para sala e lavabo. O home spray dá um resultado imediato antes de receber visitas. A vela cria clima no fim do dia.</p>
<h3>Como usar o difusor de varetas</h3>
<p>Coloque as varetas no frasco e vire-as depois de uma hora, para que absorvam a fragrância. Repita uma vez por semana para renovar o aroma. Quanto mais varetas, mais intenso o perfume. Mantenha o frasco longe de sol direto e de correntes de ar.</p>
<h2>Linha Conceito</h2>
<p>A Linha Conceito reúne peças de design em pequenas tiragens: esculturas de cerâmica e vasos esculturais que funcionam como objeto de arte, com ou sem plantas. São boas opções de presente para casa nova.</p>
<h2>Presentes</h2>
<p>Velas, difusores e objetos de decoração podem ser enviados para todo o Brasil, com embalagem para presente e cartão com a sua mensagem.</p>`,
    faq: [
      {
        pergunta: "Quanto tempo dura um difusor de varetas?",
        resposta:
          "Em média de 45 a 60 dias para um frasco de 250 ml, variando com a quantidade de varetas e a ventilação do ambiente.",
      },
      {
        pergunta: "As velas aromáticas são seguras perto de plantas?",
        resposta:
          "Sim, desde que a chama fique a uma distância segura das folhas. Nunca deixe a vela acesa sem alguém por perto.",
      },
      {
        pergunta: "Os objetos de decoração são enviados para todo o Brasil?",
        resposta: "Sim, com embalagem reforçada para peças frágeis.",
      },
      {
        pergunta: "Posso pedir embalagem para presente?",
        resposta:
          "Sim. Na sacola, marque a embalagem para presente e, se quiser, inclua um cartão com a sua mensagem.",
      },
    ],
    children: [
      {
        name: "Objetos de decoração",
        slug: "objetos-de-decoracao",
        description: "Porta-velas, bandejas, terrários e peças para compor mesas e aparadores.",
        legacyPaths: [],
        illustration: "candle",
        filters: ["vasos"],
      },
      {
        name: "Aromas L'Envie",
        slug: "aromas-lenvie",
        description: "Difusores de varetas, home sprays e velas aromáticas da L'Envie.",
        legacyPaths: ["/decoracao/aromas-77161807"],
        illustration: "candle",
        filters: [],
      },
      {
        name: "Linha Conceito",
        slug: "linha-conceito",
        description: "Esculturas de cerâmica e vasos esculturais em pequenas tiragens.",
        legacyPaths: ["/decoracao/linha-conceito"],
        illustration: "cachepot",
        filters: ["vasos"],
      },
    ],
  },
  {
    name: "Jardinagem",
    slug: "jardinagem",
    description:
      "Ferramentas, adubos, substratos, defensivos e irrigação para cuidar das plantas em casa, na varanda e no jardim.",
    legacyPaths: [
      "/decoracao/jardinagem",
      "/landing-jardinagem.html",
      "/landingMeuPrimeiroJardim.html",
      "/mobile-MeuPrimeiroJardim.html",
      "/landing-jardim-suspenso.html",
      "/mobile-jardim-suspenso.html",
    ],
    illustration: "tool",
    filters: ["jardinagem"],
    isSecondary: true,
    seoTitle: "Jardinagem: ferramentas, adubos, substratos e irrigação",
    seoDescription:
      "Ferramentas, adubos, substratos, defensivos e irrigação para cuidar das suas plantas, com envio para todo o Brasil.",
    seoContent: `<h2>O que você precisa para cuidar das plantas</h2>
<p>Cuidar bem de uma planta depende de poucas coisas: substrato adequado, adubação regular, rega na medida e ferramentas que facilitam o trabalho. Aqui estão os itens usados pela equipe do Shopping Garden no dia a dia.</p>
<h2>Meu primeiro jardim</h2>
<p>Para começar, um conjunto básico resolve: pá estreita para plantar, tesoura de poda, luvas e um regador de bico fino. Some um saco de terra vegetal, argila expandida para a drenagem e um adubo de uso geral, como o NPK 10-10-10.</p>
<h3>Como transplantar uma planta</h3>
<p>Regue a planta um dia antes. Forre o fundo do novo vaso com manta de drenagem e uma camada de argila expandida. Retire a planta com o torrão inteiro, acomode no centro e complete com substrato, sem cobrir o caule. Regue e mantenha à meia-sombra por uma semana.</p>
<h2>Substrato e adubo para cada planta</h2>
<p>Orquídeas pedem substrato arejado, com casca de pinus e fibra. Suculentas e cactos precisam de mistura arenosa, que seca rápido. Folhagens tropicais gostam de terra rica em matéria orgânica. Adube na primavera e no verão, quando a planta cresce mais.</p>
<h2>Jardim suspenso e irrigação</h2>
<p>Em varandas pequenas, placas de fibra de coco, suportes e vasos de parede criam um jardim vertical. Para manter a rega em dia, um pulverizador ajuda nas plantas menores e uma mangueira leve resolve áreas maiores.</p>
<h2>Pragas</h2>
<p>Cochonilhas e pulgões aparecem em qualquer jardim. O óleo de neem é uma opção natural: dilua conforme o rótulo e aplique no fim da tarde, repetindo após uma semana.</p>`,
    faq: [
      {
        pergunta: "Qual adubo usar em plantas de vaso?",
        resposta:
          "O NPK 10-10-10 serve para a maioria das folhagens. Orquídeas e suculentas têm adubos próprios, com proporções adequadas.",
      },
      {
        pergunta: "Com que frequência devo adubar?",
        resposta:
          "Na primavera e no verão, a cada 15 a 30 dias, conforme o rótulo. No outono e no inverno, reduza ou suspenda.",
      },
      {
        pergunta: "Para que serve a argila expandida?",
        resposta:
          "Forma uma camada de drenagem no fundo do vaso, evitando que as raízes fiquem encharcadas.",
      },
      {
        pergunta: "Óleo de neem faz mal para pets?",
        resposta:
          "Usado na diluição indicada e depois de seco, é considerado de baixo risco. Mantenha os animais afastados durante a aplicação.",
      },
      {
        pergunta: "Os produtos de jardinagem são enviados para todo o Brasil?",
        resposta: "Sim. Ferramentas, adubos, substratos e acessórios seguem para todas as regiões.",
      },
    ],
    children: [
      {
        name: "Ferramentas e acessórios",
        slug: "ferramentas-e-acessorios",
        description: "Tesouras de poda, pás, garfos e luvas para plantar, podar e transplantar.",
        legacyPaths: [
          "/decoracao/ferramentas-para-jardinagem",
          "/landing-jardinagem-enxada.html",
          "/landing-jardinagem-garfo.html",
          "/landing-jardinagem-pa.html",
          "/landing-jardinagem-tesoura-de-poda.html",
          "/landing-jardinagem-luvas-de-jardinagem.html",
          "/landing-jardinagem-ferramenta-de-transplantar.html",
          "/landing-jardinagem-como-transplantar.html",
        ],
        illustration: "tool",
        filters: ["jardinagem"],
        isSecondary: true,
      },
      {
        name: "Adubos e fertilizantes",
        slug: "adubos-e-fertilizantes",
        description: "Adubos minerais e orgânicos para folhagens, flores, orquídeas e hortas.",
        legacyPaths: [
          "/decoracao/adubos-fertilizantes",
          "/landing-jardinagem-adubos-e-fertilizantes.html",
        ],
        illustration: "bag",
        filters: ["jardinagem"],
        isSecondary: true,
      },
      {
        name: "Substratos",
        slug: "substratos",
        description: "Substratos para orquídeas, suculentas e uso geral, e terra vegetal.",
        legacyPaths: ["/decoracao/substratos-69965762", "/landing-jardinagem-substratos.html"],
        illustration: "bag",
        filters: ["jardinagem"],
        isSecondary: true,
      },
      {
        name: "Produtos para plantio",
        slug: "produtos-para-plantio",
        description: "Argila expandida, manta de drenagem e itens para montar vasos e canteiros.",
        legacyPaths: ["/decoracao/produtos-para-plantio-50213259"],
        illustration: "bag",
        filters: ["jardinagem"],
        isSecondary: true,
      },
      {
        name: "Defensivos",
        slug: "defensivos",
        description: "Óleo de neem e produtos para controlar pragas e doenças das plantas.",
        legacyPaths: [
          "/decoracao/defensivos-61774844",
          "/landing-jardinagem-inseticidas-e-repelentes.html",
        ],
        illustration: "watering",
        filters: ["jardinagem"],
        isSecondary: true,
      },
      {
        name: "Irrigação",
        slug: "irrigacao",
        description: "Regadores, pulverizadores e mangueiras para regar na medida certa.",
        legacyPaths: [
          "/decoracao/jardim-irrigacao",
          "/landing-jardinagem-irrigacao-mangueira-regador.html",
          "/landing-jardinagem-irrigacao-pulverizador.html",
        ],
        illustration: "watering",
        filters: ["jardinagem"],
        isSecondary: true,
      },
    ],
  },
];
