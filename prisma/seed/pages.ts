import { db, log } from "./helpers";
import { legalPages } from "./legal-pages";

/**
 * Páginas institucionais e FAQ. Os {{marcadores}} são preenchidos na exibição com a configuração
 * da loja (src/lib/template.ts), para que prazos, descontos e contatos nunca fiquem desatualizados.
 *
 * TODO(dono): os textos abaixo são rascunhos. Trocas, privacidade, cookies e termos ficam em
 * legal-pages.ts e ainda não foram revisados por advogado.
 */

export const pages: Array<{
  slug: string;
  title: string;
  seoDescription: string;
  footerGroup: string;
  content: string;
}> = [
  {
    slug: "sobre",
    title: "Sobre a Net Shop Garden",
    seoDescription:
      "Conheça a Net Shop Garden, loja online do Shopping Garden, centro de jardinagem e decoração de São Paulo desde 1999.",
    footerGroup: "institucional",
    content: `<p>A {{nome}} é a loja online do Shopping Garden, centro de jardinagem e decoração que funciona em São Paulo desde 1999. São três lojas físicas e mais de vinte mil itens, entre plantas, vasos, cachepots, flores artificiais e objetos para a casa.</p>
<h2>Curadoria de quem trabalha com plantas</h2>
<p>Tudo o que está no site passa pelas mãos da equipe do Shopping Garden. As plantas são escolhidas uma a uma no dia do envio: folhas firmes, raízes saudáveis e, no caso das orquídeas, botões ainda por abrir, para a floração durar mais na sua casa. Os vasos e cachepots são selecionados pelo acabamento e conferidos antes de embalar.</p>
<h2>Embalagem própria para plantas e peças frágeis</h2>
<p>Plantas viajam em embalagem que protege o vaso, as hastes e as folhas. Peças de cerâmica, porcelana e vidro são embaladas individualmente, com proteção contra impacto. Se algo chegar com avaria, resolvemos.</p>
<h2>Entrega própria e retirada na loja</h2>
<p>Em São Paulo, a entrega é feita por equipe própria, em até 3 dias úteis, e você também pode retirar o pedido no Shopping Garden. Vasos, objetos e itens de jardinagem seguem pelos Correios e por transportadora para o restante do Brasil. Os detalhes estão em <a href="/entrega">Entrega e prazos</a>.</p>
<h2>Arranjos sob medida</h2>
<p>Se você procura um arranjo diferente dos que estão no site, fale com a gente pelo WhatsApp. O arranjo é combinado e pago por lá, e a montagem começa depois do pagamento.</p>
<h2>Atendimento</h2>
<p>WhatsApp {{telefone}} e e-mail {{email}}. {{horario}}.</p>`,
  },
  {
    slug: "entrega",
    title: "Entrega e prazos",
    seoDescription:
      "Modalidades de entrega da Net Shop Garden: entrega própria na Grande São Paulo, retirada na loja e envio para todo o Brasil.",
    footerGroup: "ajuda",
    content: `<h2>Entrega própria em São Paulo</h2>
<p>Na Grande São Paulo, a entrega é feita por equipe própria. Você escolhe a data no checkout, a partir de 3 dias úteis depois do pedido: é o tempo de separar e conferir cada item. As entregas acontecem de segunda a sexta, em horário comercial, e avisamos você antes de sair. O valor depende da região e aparece ao informar o CEP.</p>
<h2>Retirada na loja</h2>
<p>Você pode retirar o pedido sem custo no Shopping Garden: {{enderecoRetirada}}. {{retirada}}</p>
<h2>Envio para todo o Brasil</h2>
<p>Vasos, cachepots, flores e plantas artificiais, objetos de decoração, aromas e itens de jardinagem seguem pelos Correios. Peças mais volumosas vão por transportadora (Jadlog). O prazo e o valor aparecem ao informar o CEP no produto, na sacola ou no checkout.</p>
<h2>Frete grátis</h2>
<p>O frete é grátis em pedidos a partir de {{freteGratis}}, nas modalidades indicadas ao informar o CEP.</p>
<h2>Produtos que não seguem pelos Correios</h2>
<p>Plantas naturais, orquídeas, arranjos naturais e itens pesados ou muito volumosos, como sacos de terra de 25 kg, não são enviados pelos Correios nem por transportadora. Para esses produtos há duas opções: entrega própria, nas regiões atendidas, ou retirada na loja. Se o seu CEP não for atendido, fale com a gente pelo WhatsApp {{telefone}}.</p>
<h2>Prazo de entrega</h2>
<p>O prazo começa a contar depois da aprovação do pagamento. Pagamentos por Pix e cartão são aprovados em minutos.</p>
<h2>Se não houver ninguém para receber</h2>
<p>Nas entregas próprias, falamos com você pelo telefone informado antes de sair. Se não houver ninguém para receber, o pedido volta para a loja e combinamos uma nova data pelo WhatsApp. A segunda tentativa pode ter custo de frete.</p>
<h2>Acompanhe o pedido</h2>
<p>Você recebe um e-mail a cada mudança de status e pode consultar a qualquer momento em <a href="/rastreio">Rastrear pedido</a>.</p>`,
  },
  {
    slug: "pagamentos",
    title: "Pagamentos",
    seoDescription:
      "Formas de pagamento da Net Shop Garden: Pix com desconto e cartão de crédito parcelado sem juros.",
    footerGroup: "ajuda",
    content: `<h2>Pix</h2>
<p>Pagando com Pix você tem {{descontoPix}}% de desconto sobre o valor dos produtos. O código fica disponível por {{expiracaoPix}} minutos depois de fazer o pedido, e a aprovação é imediata.</p>
<h2>Cartão de crédito</h2>
<p>Aceitamos as principais bandeiras, em até {{parcelas}}x sem juros, com parcela mínima de {{parcelaMinima}}.</p>
<h2>Cupons</h2>
<p>O cupom é informado na sacola. Vale um cupom por pedido. O desconto do cupom é aplicado antes do desconto do Pix.</p>
<h2>Segurança</h2>
<p>Os dados do cartão são enviados diretamente à operadora de pagamento e não ficam armazenados na loja. A {{nome}} nunca pede senha ou código de segurança do cartão por mensagem.</p>`,
  },
  ...legalPages,
];

export const faq: Array<[group: string, question: string, answer: string]> = [
  [
    "Pedidos",
    "Como acompanho o meu pedido?",
    "Você recebe um e-mail a cada mudança de status. Também pode consultar em Rastrear pedido, com o número do pedido e o e-mail da compra, ou na área do cliente.",
  ],
  [
    "Pedidos",
    "Posso alterar ou cancelar um pedido?",
    "Sim, enquanto ele não estiver em preparação. Fale com a gente pelo WhatsApp {{telefone}} informando o número do pedido.",
  ],
  [
    "Pedidos",
    "Preciso criar conta para comprar?",
    "Não. Você pode comprar como convidado e, se quiser, criar uma senha depois para acompanhar os pedidos.",
  ],
  [
    "Pedidos",
    "Vocês emitem nota fiscal?",
    "Sim. A nota fiscal é enviada por e-mail depois da aprovação do pagamento.",
  ],
  [
    "Entrega",
    "Plantas são entregues fora de São Paulo?",
    "Não. Plantas vivas, orquídeas e arranjos naturais são entregues por equipe própria nas regiões atendidas ou retirados na loja. Se o seu CEP não for atendido, fale com a gente pelo WhatsApp {{telefone}}. Os demais produtos seguem para todo o Brasil.",
  ],
  [
    "Entrega",
    "Posso agendar a entrega?",
    "Sim. Na entrega própria da Grande São Paulo você escolhe a data no checkout, a partir de 3 dias úteis depois do pedido, de segunda a sexta.",
  ],
  [
    "Entrega",
    "Posso retirar na loja?",
    "Sim, sem custo, no Shopping Garden: {{enderecoRetirada}}. {{retirada}}",
  ],
  [
    "Pedidos",
    "Vocês fazem arranjos sob encomenda?",
    "Pelo site, não. Para um arranjo diferente dos que estão na loja, fale com a gente pelo WhatsApp {{telefone}}: combinamos por lá, e a montagem começa depois do pagamento.",
  ],
  [
    "Entrega",
    "A partir de que valor o frete é grátis?",
    "Em pedidos a partir de {{freteGratis}}, nas modalidades indicadas ao informar o CEP.",
  ],
  [
    "Entrega",
    "Posso enviar como presente?",
    "Sim. Os arranjos já saem da loja embalados para presentear. Na sacola, você pode incluir um cartão com a sua mensagem, sem custo; depois de fechar o pedido, avise a gente também pelo WhatsApp. No checkout, informe o nome e o telefone de quem vai receber.",
  ],
  [
    "Pagamento",
    "Quais são as formas de pagamento?",
    "Pix com {{descontoPix}}% de desconto e cartão de crédito em até {{parcelas}}x sem juros.",
  ],
  [
    "Pagamento",
    "O Pix expira?",
    "Sim. O código vale por {{expiracaoPix}} minutos. Se expirar, você pode gerar um novo na página do pedido.",
  ],
  [
    "Pagamento",
    "Como uso um cupom de desconto?",
    "Digite o código no campo de cupom da sacola. Vale um cupom por pedido.",
  ],
  [
    "Trocas",
    "O produto chegou quebrado. O que eu faço?",
    "Fale com a gente pelo WhatsApp {{telefone}} em até 48 horas, com fotos da peça e da embalagem. Resolvemos da melhor forma: troca ou devolução do valor.",
  ],
  [
    "Trocas",
    "Posso devolver se me arrepender?",
    "Sim, em até 7 dias corridos depois de receber, com o produto sem uso e na embalagem original. Fale com a gente pelo WhatsApp ou pelo e-mail antes de enviar: combinamos a devolução, e o envio de volta é por nossa conta. No caso de plantas, entre em contato o quanto antes.",
  ],
  [
    "Trocas",
    "A planta chegou murcha. Vocês trocam?",
    "Fale com a gente pelo WhatsApp {{telefone}} ou pelo e-mail {{email}}, com fotos, em até 48 horas depois da entrega. Resolvemos da melhor forma.",
  ],
  [
    "Cuidados com plantas",
    "Com que frequência devo regar?",
    "Depende da espécie. A ficha botânica de cada planta traz a frequência indicada. Na dúvida, toque a terra: regue só quando estiver seca.",
  ],
  [
    "Cuidados com plantas",
    "Minha orquídea perdeu as flores. Ela morreu?",
    "Não. A queda das flores é natural depois de algumas semanas. Corte a haste seca, mantenha a rega e a luz indireta, e ela volta a florir.",
  ],
  [
    "Cuidados com plantas",
    "Quais plantas são seguras para pets?",
    "Use o filtro pet friendly nas categorias de plantas. Na ficha botânica indicamos quando a planta é tóxica para cães e gatos.",
  ],
  [
    "Cuidados com plantas",
    "Quando devo trocar a planta de vaso?",
    "Quando as raízes começarem a sair pelos furos ou a planta parar de crescer. Escolha um vaso de 2 a 4 cm a mais de diâmetro.",
  ],
];

export async function seedPages() {
  for (const page of pages) {
    await db.page.upsert({
      where: { slug: page.slug },
      create: { ...page, seoTitle: page.title, isPublished: true, showInFooter: true },
      update: {},
    });
  }
  await db.faqItem.createMany({
    data: faq.map(([group, question, answer], position) => ({ group, question, answer, position })),
    skipDuplicates: true,
  });
  log("Páginas institucionais e FAQ", `${pages.length} + ${faq.length}`);
}
