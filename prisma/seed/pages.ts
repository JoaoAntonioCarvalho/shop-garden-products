import { db, log } from "./helpers";

/**
 * Páginas institucionais e FAQ. Os {{marcadores}} são preenchidos na exibição com a configuração
 * da loja (src/lib/template.ts), para que prazos, descontos e contatos nunca fiquem desatualizados.
 *
 * TODO(dono): todos os textos abaixo são rascunhos. Privacidade, cookies, termos e trocas são
 * MODELOS e precisam de revisão de um advogado antes de o site ir ao ar.
 */

const pages: Array<{
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
<h2>Entrega no mesmo dia em São Paulo</h2>
<p>Na capital, pedidos feitos até {{corte}}, de segunda a sábado, chegam no mesmo dia. Você também pode agendar a data e o período de entrega em toda a Grande São Paulo.</p>
<h2>Arranjos sob medida</h2>
<p>Se você procura algo que não está no site, fale com a gente pelo WhatsApp. Nossa equipe de floristas monta arranjos exclusivos e busca nas lojas a planta ou a peça que você precisa.</p>
<h2>Atendimento</h2>
<p>WhatsApp {{telefone}} e e-mail {{email}}. {{horario}}.</p>`,
  },
  {
    slug: "entrega",
    title: "Entrega e prazos",
    seoDescription:
      "Modalidades de entrega da Net Shop Garden: entrega no mesmo dia em São Paulo, entrega agendada na Grande SP e envio para todo o Brasil.",
    footerGroup: "ajuda",
    content: `<h2>Entrega hoje em São Paulo</h2>
<p>Para endereços na capital de São Paulo, pedidos com pagamento aprovado até {{corte}} são entregues no mesmo dia, até as 20h, de segunda a sábado. Em domingos e feriados não há entrega no mesmo dia.</p>
<h2>Entrega agendada na Grande São Paulo</h2>
<p>Você escolhe a data, nos próximos 14 dias úteis, e o período: manhã ou tarde. A entrega é feita por equipe própria. O frete é grátis para pedidos acima de {{freteGratis}}.</p>
<h2>Envio para todo o Brasil</h2>
<p>Vasos, cachepots, flores e plantas artificiais, objetos de decoração, aromas e itens de jardinagem seguem por transportadora para todas as regiões, nas modalidades econômica e expressa. O prazo e o valor aparecem ao informar o CEP no produto, na sacola ou no checkout. No envio econômico, o frete é grátis acima de {{freteGratis}}.</p>
<h2>Plantas vivas só na Grande São Paulo</h2>
<p>Plantas naturais, orquídeas e arranjos naturais são entregues apenas na Grande São Paulo. O tempo de viagem por transportadora compromete a qualidade da planta, e preferimos não arriscar.</p>
<h2>Prazo de entrega</h2>
<p>O prazo começa a contar depois da aprovação do pagamento. Pagamentos por Pix e cartão são aprovados em minutos. Boletos podem levar até três dias úteis.</p>
<h2>Se não houver ninguém para receber</h2>
<p>Nas entregas locais, nosso entregador liga para o telefone informado. Se não conseguir contato, o pedido volta para a loja e combinamos uma nova data pelo WhatsApp. A segunda tentativa pode ter custo de frete.</p>
<h2>Acompanhe o pedido</h2>
<p>Você recebe um e-mail a cada mudança de status e pode consultar a qualquer momento em <a href="/rastreio">Rastrear pedido</a>.</p>`,
  },
  {
    slug: "trocas-e-devolucoes",
    title: "Trocas e devoluções",
    seoDescription:
      "Como funciona a troca e a devolução de produtos na Net Shop Garden: arrependimento, avaria no transporte e plantas vivas.",
    footerGroup: "ajuda",
    content: `<p><em>MODELO: revisar com advogado antes de publicar.</em></p>
<h2>Direito de arrependimento</h2>
<p>Você pode desistir da compra em até 7 dias corridos depois do recebimento, conforme o artigo 49 do Código de Defesa do Consumidor. O produto deve ser devolvido sem uso, na embalagem original. Devolvemos o valor pago, incluindo o frete, pelo mesmo meio de pagamento.</p>
<h2>Produto com avaria</h2>
<p>Se o produto chegar quebrado, trincado ou diferente do pedido, envie fotos da peça e da embalagem em até 48 horas pelo WhatsApp {{telefone}} ou pelo e-mail {{email}}. Fazemos a troca ou a devolução do valor, sem custo para você.</p>
<h2>Plantas vivas</h2>
<p>Plantas são seres vivos e sofrem com o transporte e a mudança de ambiente. Se a planta chegar danificada ou em mau estado, envie fotos em até 48 horas e fazemos a substituição. Depois desse prazo, o desenvolvimento da planta depende dos cuidados em casa, por isso não fazemos troca por murcha, queda de flores ou falta de adaptação. Pela natureza perecível do produto, o direito de arrependimento pode ter condições específicas.</p>
<h2>Arranjos sob medida</h2>
<p>Arranjos feitos por encomenda são produzidos especialmente para você. Só aceitamos devolução em caso de defeito ou divergência em relação ao que foi combinado.</p>
<h2>Como solicitar</h2>
<ol><li>Fale com a gente pelo WhatsApp ou pelo e-mail, informando o número do pedido.</li><li>Envie fotos, se for o caso.</li><li>Combinamos a coleta ou a postagem, sem custo quando o motivo for avaria ou erro nosso.</li><li>Depois de receber e conferir o produto, fazemos a troca ou o reembolso em até 10 dias úteis.</li></ol>`,
  },
  {
    slug: "pagamentos",
    title: "Pagamentos",
    seoDescription:
      "Formas de pagamento da Net Shop Garden: Pix com desconto, cartão de crédito parcelado sem juros e boleto.",
    footerGroup: "ajuda",
    content: `<h2>Pix</h2>
<p>Pagando com Pix você tem {{descontoPix}}% de desconto sobre o valor dos produtos. O código fica disponível por {{expiracaoPix}} minutos depois de fazer o pedido, e a aprovação é imediata.</p>
<h2>Cartão de crédito</h2>
<p>Aceitamos Visa, Mastercard, Elo, American Express e Hipercard, em até {{parcelas}}x sem juros, com parcela mínima de {{parcelaMinima}}.</p>
<h2>Boleto</h2>
<p>O boleto vence em 3 dias úteis e a compensação pode levar até 3 dias úteis. Por isso, ele não está disponível para entrega no mesmo dia, para entregas agendadas com data próxima e para pedidos com plantas vivas.</p>
<h2>Cupons</h2>
<p>O cupom é informado na sacola. Vale um cupom por pedido. O desconto do cupom é aplicado antes do desconto do Pix.</p>
<h2>Segurança</h2>
<p>Os dados do cartão são enviados diretamente à operadora de pagamento e não ficam armazenados na loja.</p>`,
  },
  {
    slug: "privacidade",
    title: "Política de privacidade",
    seoDescription:
      "Como a Net Shop Garden coleta, usa e protege os seus dados pessoais, conforme a LGPD.",
    footerGroup: "institucional",
    content: `<p><em>MODELO: revisar com advogado antes de publicar.</em></p>
<p>Esta política explica como a {{nome}} ({{razaoSocial}}, CNPJ {{cnpj}}) trata os seus dados pessoais, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>
<h2>Dados que coletamos</h2>
<ul><li><strong>Cadastro e compra:</strong> nome, e-mail, CPF, telefone, endereços e histórico de pedidos.</li><li><strong>Pagamento:</strong> os dados do cartão são enviados diretamente à operadora de pagamento. Guardamos apenas a bandeira e os quatro últimos dígitos.</li><li><strong>Navegação:</strong> páginas visitadas, origem da visita e dados de dispositivo, quando você aceita os cookies de análise.</li><li><strong>Comunicação:</strong> e-mail e WhatsApp, quando você se cadastra para receber novidades.</li></ul>
<h2>Para que usamos</h2>
<ul><li>Processar e entregar os pedidos (execução de contrato).</li><li>Emitir documentos fiscais e cumprir obrigações legais.</li><li>Enviar novidades e ofertas, somente com o seu consentimento.</li><li>Melhorar o site e medir resultados, com o seu consentimento para cookies de análise e de marketing.</li><li>Prevenir fraudes (legítimo interesse).</li></ul>
<h2>Com quem compartilhamos</h2>
<p>Compartilhamos apenas o necessário com: operadora de pagamento, transportadoras e entregadores, ferramentas de análise e de anúncios (quando você consente) e autoridades, quando a lei exige. Não vendemos dados pessoais.</p>
<h2>Por quanto tempo guardamos</h2>
<p>Dados de pedidos são mantidos pelo prazo exigido pela legislação fiscal. Dados de marketing são mantidos até você cancelar o consentimento. Ao excluir a conta, seus dados pessoais são anonimizados e os pedidos são preservados, sem identificação, pelo prazo legal.</p>
<h2>Seus direitos</h2>
<p>Você pode confirmar se tratamos seus dados, acessar, corrigir, baixar uma cópia, pedir a exclusão e retirar o consentimento a qualquer momento. Na área do cliente, em Privacidade, você baixa os seus dados e solicita a exclusão da conta. Em todo e-mail de novidades há um link para cancelar o recebimento em um clique.</p>
<h2>Encarregado de dados</h2>
<p>Para falar sobre privacidade, escreva para {{email}}. [Nome do encarregado a definir.]</p>`,
  },
  {
    slug: "cookies",
    title: "Política de cookies",
    seoDescription:
      "Quais cookies a Net Shop Garden usa, para quê, e como alterar as suas preferências.",
    footerGroup: "institucional",
    content: `<p><em>MODELO: revisar com advogado antes de publicar.</em></p>
<p>Cookies são pequenos arquivos guardados no seu navegador. Usamos três tipos.</p>
<h2>Necessários</h2>
<p>Mantêm a sacola, o login e as suas preferências de consentimento. Sem eles o site não funciona, por isso ficam sempre ativos.</p>
<h2>Análise</h2>
<p>Ajudam a entender como o site é usado: páginas mais visitadas, buscas e etapas da compra. Só são ativados se você aceitar.</p>
<h2>Marketing</h2>
<p>Permitem medir o resultado de anúncios e mostrar ofertas relacionadas ao que você viu. Só são ativados se você aceitar.</p>
<h2>Como alterar a sua escolha</h2>
<p>Use o link "Preferências de cookies", no rodapé de qualquer página, para aceitar, recusar ou personalizar. A escolha fica guardada por 12 meses.</p>`,
  },
  {
    slug: "termos",
    title: "Termos de uso",
    seoDescription: "Condições de uso do site e de compra na Net Shop Garden.",
    footerGroup: "institucional",
    content: `<p><em>MODELO: revisar com advogado antes de publicar.</em></p>
<p>Este site é operado por {{razaoSocial}}, CNPJ {{cnpj}}, com endereço em {{endereco}}. Ao comprar, você concorda com as condições abaixo.</p>
<h2>Produtos e preços</h2>
<p>As fotos são ilustrativas. Plantas são seres vivos e variam em forma, tamanho e número de flores. Peças artesanais podem ter pequenas diferenças de cor e acabamento. Os preços valem para compras no site e podem mudar sem aviso; o valor que vale é o exibido no momento da confirmação do pedido.</p>
<h2>Pedido</h2>
<p>O pedido é confirmado depois da aprovação do pagamento. Podemos cancelar pedidos em caso de erro evidente de preço, indisponibilidade de estoque ou suspeita de fraude, com reembolso integral.</p>
<h2>Entrega</h2>
<p>Os prazos e as regiões atendidas estão em <a href="/entrega">Entrega e prazos</a>. É responsabilidade do cliente informar o endereço correto e garantir que haja alguém para receber.</p>
<h2>Trocas e devoluções</h2>
<p>As regras estão em <a href="/trocas-e-devolucoes">Trocas e devoluções</a>.</p>
<h2>Conta</h2>
<p>Você é responsável por manter a senha em sigilo e pelos pedidos feitos na sua conta.</p>
<h2>Privacidade</h2>
<p>O tratamento de dados pessoais segue a <a href="/privacidade">Política de privacidade</a>.</p>
<h2>Contato</h2>
<p>WhatsApp {{telefone}} e e-mail {{email}}. {{horario}}.</p>`,
  },
];

const faq: Array<[group: string, question: string, answer: string]> = [
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
    "Vocês entregam no mesmo dia?",
    "Sim, na capital de São Paulo, para pedidos com pagamento aprovado até {{corte}}, de segunda a sábado.",
  ],
  [
    "Entrega",
    "Plantas são entregues fora de São Paulo?",
    "Não. Plantas vivas, orquídeas e arranjos naturais são entregues apenas na Grande São Paulo. Os demais produtos seguem para todo o Brasil.",
  ],
  [
    "Entrega",
    "Posso agendar a entrega?",
    "Sim. Na Grande São Paulo você escolhe a data e o período, manhã ou tarde.",
  ],
  [
    "Entrega",
    "A partir de que valor o frete é grátis?",
    "Acima de {{freteGratis}}, na entrega agendada da Grande São Paulo e no envio econômico para o restante do Brasil.",
  ],
  [
    "Entrega",
    "Posso enviar como presente?",
    "Sim. Na sacola, inclua um cartão com a sua mensagem, sem custo, e, se quiser, a embalagem para presente por {{embalagemPresente}}. No checkout, informe o nome e o telefone de quem vai receber.",
  ],
  [
    "Pagamento",
    "Quais são as formas de pagamento?",
    "Pix com {{descontoPix}}% de desconto, cartão de crédito em até {{parcelas}}x sem juros e boleto.",
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
    "Pagamento",
    "Por que o boleto não aparece para o meu pedido?",
    "O boleto não está disponível para entrega no mesmo dia, para entregas agendadas em menos de três dias úteis e para pedidos com plantas vivas, porque a compensação demora.",
  ],
  [
    "Trocas",
    "O produto chegou quebrado. O que eu faço?",
    "Envie fotos da peça e da embalagem em até 48 horas pelo WhatsApp {{telefone}}. Fazemos a troca ou devolvemos o valor, sem custo.",
  ],
  [
    "Trocas",
    "Posso devolver se me arrepender?",
    "Sim, em até 7 dias corridos depois de receber, com o produto sem uso e na embalagem original.",
  ],
  [
    "Trocas",
    "A planta chegou murcha. Vocês trocam?",
    "Sim, se você avisar com fotos em até 48 horas depois da entrega.",
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
