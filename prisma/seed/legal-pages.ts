/**
 * Textos jurídicos da loja: trocas e devoluções, privacidade, cookies e termos.
 * Escritos em 10/10/2026 com base no Código de Defesa do Consumidor, no Decreto 7.962/2013,
 * na LGPD e no Marco Civil da Internet. Não foram revisados por advogado.
 *
 * TODO(dono): revisar com advogado e confirmar os pontos listados em docs/PENDENCIAS-DO-DONO.md
 * (prazos de avaria, taxa de reentrega, quem coleta a devolução).
 *
 * A loja é microempresa: pela Resolução CD/ANPD 2/2022, agente de pequeno porte não precisa
 * indicar encarregado de dados, mas precisa oferecer um canal de atendimento ao titular.
 */

export const LEGAL_UPDATED_AT = "10 de outubro de 2026";

const updated = `<p><em>Última atualização: ${LEGAL_UPDATED_AT}.</em></p>`;

export const legalPages: Array<{
  slug: string;
  title: string;
  seoDescription: string;
  footerGroup: string;
  content: string;
}> = [
  {
    slug: "trocas-e-devolucoes",
    title: "Trocas e devoluções",
    seoDescription:
      "Como funciona a troca e a devolução de produtos na Net Shop Garden: arrependimento, avaria no transporte, defeito e plantas vivas.",
    footerGroup: "ajuda",
    content: `${updated}
<p>Esta política vale para as compras feitas neste site e segue o Código de Defesa do Consumidor (Lei 8.078/1990) e o Decreto 7.962/2013. Ela não reduz nenhum direito que a lei garante a você.</p>
<h2>Confira o pedido na entrega</h2>
<p>Abra a embalagem assim que receber. Se a caixa estiver aberta, amassada ou molhada, se faltar algum item ou se o produto estiver quebrado, anote o problema no comprovante de entrega, quando houver, e fale com a gente no mesmo dia, de preferência com fotos da embalagem e do produto. Isso agiliza a solução e a apuração com a transportadora.</p>
<h2>Arrependimento da compra</h2>
<p>Você pode desistir da compra em até 7 dias corridos, contados do recebimento, sem precisar explicar o motivo (artigo 49 do Código de Defesa do Consumidor).</p>
<ul><li>Avise dentro do prazo, pelo WhatsApp {{telefone}} ou pelo e-mail {{email}}, com o número do pedido.</li><li>Devolva o produto sem uso, com todos os acessórios, manuais e brindes, na embalagem original ou em outra que o proteja no transporte.</li><li>Nós informamos como devolver, e o custo da devolução é nosso.</li><li>Devolvemos tudo o que você pagou, incluindo o frete, pelo mesmo meio de pagamento.</li></ul>
<p>O produto é conferido quando chega. Você responde por danos causados por uso, por falta de cuidados ou por embalagem inadequada na devolução, e o reembolso pode ser reduzido na medida desse dano.</p>
<h2>Plantas vivas, flores e arranjos naturais</h2>
<p>Plantas são seres vivos. Tamanho, formato, cor e número de flores e folhas variam de uma para outra e em relação às fotos, e essa variação não é defeito. É normal que a planta perca algumas folhas ou flores no transporte e nos primeiros dias no novo ambiente.</p>
<ul><li><strong>Chegou em mau estado:</strong> se a planta chegar quebrada, murcha, com pragas ou diferente do pedido, envie fotos em até 48 horas depois do recebimento. Fazemos a substituição ou devolvemos o valor, sem custo para você.</li><li><strong>Depois da entrega:</strong> a saúde da planta passa a depender de rega, luz, temperatura e adubação. Murcha, queda de flores, folhas amareladas ou morte por falta ou excesso de cuidados, por ataque de animais ou por local inadequado não são defeito do produto e não dão direito a troca.</li><li><strong>Arrependimento:</strong> se quiser desistir da compra de uma planta, avise o quanto antes, dentro dos 7 dias, e mantenha os cuidados indicados até a devolução. A planta precisa voltar viva e nas condições em que foi entregue.</li></ul>
<p>As orientações de cuidado estão na página de cada produto. Em caso de dúvida, fale com a gente antes de a planta sofrer.</p>
<h2>Arranjos e produtos feitos sob encomenda</h2>
<p>Arranjos montados a seu pedido, produtos personalizados e mensagens de cartão são feitos especialmente para você. Confira com atenção as escolhas antes de concluir o pedido. Depois que a produção começa, alterações dependem de disponibilidade. Em caso de defeito ou de diferença em relação ao que foi pedido, fazemos a correção, a troca ou a devolução do valor.</p>
<h2>Produto com defeito</h2>
<p>Se o produto apresentar defeito, você pode reclamar em até 30 dias, para produtos não duráveis (plantas, flores, adubos, substratos e aromas), ou em até 90 dias, para produtos duráveis (vasos, cachepots, peças de decoração e ferramentas), contados do recebimento. Para defeitos que não podiam ser percebidos na entrega, o prazo conta de quando o defeito aparecer.</p>
<p>Recebida a reclamação, analisamos o produto e resolvemos o problema em até 30 dias. Se isso não for possível, você escolhe entre a troca por outro igual, a devolução do valor pago ou o abatimento proporcional do preço.</p>
<p>Não são defeito: desgaste natural pelo uso ou pela exposição ao sol e à chuva, manchas e pátina próprias de cerâmica, barro, fibra e madeira, pequenas diferenças de cor, textura e medida em peças artesanais, e danos causados por queda, uso inadequado ou instalação incorreta.</p>
<h2>Produto errado ou incompleto</h2>
<p>Se você receber um produto diferente do pedido, ou se faltar algum item, avise em até 7 dias. Enviamos o produto certo ou devolvemos o valor, sem custo para você.</p>
<h2>Troca por outro produto</h2>
<p>Se quiser trocar um produto sem defeito por outro, dentro dos 7 dias do arrependimento, fale com a gente. A troca depende do estoque. Se houver diferença de preço, você paga ou recebe a diferença.</p>
<h2>Como pedir</h2>
<ol><li>Fale com a gente pelo WhatsApp {{telefone}} ou pelo e-mail {{email}}, informando o número do pedido e o motivo.</li><li>Envie fotos do produto e da embalagem, quando o motivo for avaria, defeito ou erro.</li><li>Aguarde as instruções. Não envie o produto antes de combinar a devolução: remessas sem aviso podem ser recusadas.</li><li>Depois de receber e conferir o produto, fazemos a troca ou o reembolso.</li></ol>
<h2>Reembolso</h2>
<ul><li><strong>Cartão de crédito:</strong> pedimos o estorno à operadora em até 10 dias úteis depois de conferir a devolução. O crédito aparece na fatura seguinte ou na posterior, conforme a data de fechamento e as regras do banco emissor.</li><li><strong>Pix:</strong> devolvemos na conta de origem ou em conta do titular da compra, em até 10 dias úteis depois de conferir a devolução.</li><li><strong>Cupons e descontos:</strong> o reembolso corresponde ao valor efetivamente pago. Cupons usados em pedidos devolvidos por arrependimento não são reativados.</li></ul>
<h2>Entrega não realizada</h2>
<p>Se a entrega não puder ser feita porque o endereço está errado ou incompleto, porque não há ninguém para receber ou porque o recebimento foi recusado sem motivo, o pedido volta para a loja. Combinamos uma nova entrega, que pode ter novo custo de frete, informado antes. No caso de plantas e flores, o tempo extra de transporte pode comprometer o produto, e a loja não responde pela perda causada por essa demora.</p>
<h2>Atendimento</h2>
<p>WhatsApp {{telefone}} e e-mail {{email}}. {{horario}}.</p>`,
  },
  {
    slug: "privacidade",
    title: "Política de privacidade",
    seoDescription:
      "Como a Net Shop Garden coleta, usa, compartilha e protege os seus dados pessoais, conforme a LGPD.",
    footerGroup: "institucional",
    content: `${updated}
<p>Esta política explica como a {{nome}} trata os seus dados pessoais, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018) e com o Marco Civil da Internet (Lei 12.965/2014).</p>
<h2>Quem é o responsável</h2>
<p>O controlador dos dados é {{razaoSocial}}, CNPJ {{cnpj}}, com endereço em {{endereco}}. Para qualquer assunto sobre privacidade, escreva para {{email}}.</p>
<h2>Dados que coletamos</h2>
<ul><li><strong>Cadastro e compra:</strong> nome, e-mail, CPF, telefone, endereços de entrega e de cobrança, e histórico de pedidos.</li><li><strong>Presentes:</strong> nome, endereço e telefone de quem vai receber, e a mensagem do cartão. Ao informar dados de outra pessoa, você declara que pode fazer isso.</li><li><strong>Pagamento:</strong> os dados do cartão são digitados em um formulário que os envia diretamente à operadora de pagamento. A loja não recebe nem guarda o número completo, a validade ou o código de segurança. Guardamos a bandeira, os quatro últimos dígitos e o resultado da transação.</li><li><strong>Atendimento:</strong> as mensagens que você envia por e-mail, formulário ou WhatsApp.</li><li><strong>Navegação:</strong> endereço IP, data e hora de acesso, tipo de dispositivo e navegador, páginas visitadas, buscas e origem da visita.</li><li><strong>Novidades:</strong> e-mail e, se você informar, WhatsApp, quando se cadastra para receber ofertas.</li></ul>
<p>Não pedimos dados sensíveis, como saúde, religião ou biometria. Não inclua esse tipo de informação nas mensagens.</p>
<h2>Para que usamos e com que base legal</h2>
<ul><li><strong>Processar o pedido, cobrar, entregar e atender você:</strong> execução do contrato de compra.</li><li><strong>Emitir nota fiscal e guardar registros exigidos por lei:</strong> cumprimento de obrigação legal.</li><li><strong>Prevenir fraudes e proteger a loja e os clientes:</strong> legítimo interesse e proteção do crédito.</li><li><strong>Avisar sobre o andamento do pedido e lembrar de uma sacola não concluída:</strong> execução do contrato e legítimo interesse.</li><li><strong>Enviar novidades e ofertas:</strong> consentimento, que você pode retirar a qualquer momento.</li><li><strong>Medir o uso do site e o resultado de anúncios:</strong> consentimento, dado no aviso de cookies.</li><li><strong>Defender direitos em processos e reclamações:</strong> exercício regular de direitos.</li></ul>
<h2>Com quem compartilhamos</h2>
<p>Compartilhamos apenas o necessário para cada finalidade, com:</p>
<ul><li>a operadora de pagamento (Cielo) e as instituições financeiras envolvidas na transação;</li><li>transportadoras, Correios e entregadores, que recebem nome, endereço e telefone para fazer a entrega;</li><li>prestadores de tecnologia que hospedam o site, o banco de dados e as imagens, e que enviam os e-mails;</li><li>sistema de emissão de nota fiscal e contabilidade;</li><li>ferramentas de análise e de anúncios, como Google e Meta, somente se você aceitar os cookies correspondentes;</li><li>autoridades públicas, quando houver obrigação legal ou ordem judicial.</li></ul>
<p>Não vendemos nem alugamos dados pessoais.</p>
<h2>Transferência para outros países</h2>
<p>Alguns prestadores de tecnologia mantêm servidores fora do Brasil. Nesses casos, os dados são transferidos com as garantias previstas na LGPD, como cláusulas contratuais de proteção de dados.</p>
<h2>Por quanto tempo guardamos</h2>
<ul><li><strong>Pedidos, pagamentos e documentos fiscais:</strong> pelo menos 5 anos, prazo das obrigações fiscais e das ações de consumo.</li><li><strong>Registros de acesso ao site:</strong> 6 meses, como determina o Marco Civil da Internet.</li><li><strong>Cadastro:</strong> enquanto a conta existir. Ao excluir a conta, os dados pessoais são anonimizados e os pedidos são preservados sem identificação, pelo prazo legal.</li><li><strong>Novidades:</strong> até você cancelar o recebimento.</li><li><strong>Sacola não concluída:</strong> por tempo limitado, e depois é apagada automaticamente.</li></ul>
<h2>Seus direitos</h2>
<p>Você pode, a qualquer momento e sem custo: confirmar se tratamos os seus dados, acessá-los, corrigir dados incompletos ou desatualizados, pedir a anonimização, o bloqueio ou a eliminação de dados desnecessários, pedir a portabilidade, saber com quem compartilhamos, retirar o consentimento e se opor a um tratamento que considere irregular.</p>
<ul><li>Na área do cliente, em Privacidade, você baixa uma cópia dos seus dados e pede a exclusão da conta.</li><li>Em todo e-mail de novidades há um link para cancelar o recebimento em um clique.</li><li>No rodapé, em Preferências de cookies, você muda a sua escolha sobre cookies.</li><li>Para os demais pedidos, escreva para {{email}}. Respondemos em até 15 dias. Podemos pedir uma confirmação de identidade para proteger a sua conta.</li></ul>
<p>Alguns dados não podem ser apagados enquanto a lei exigir a sua guarda, como os de pedidos e notas fiscais. Se você considerar que o seu pedido não foi atendido, pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>
<h2>Segurança</h2>
<p>O site usa conexão criptografada, as senhas são guardadas de forma irreversível, o acesso aos dados é restrito à equipe que precisa deles e as alterações feitas no painel ficam registradas. Nenhum sistema é totalmente imune a incidentes. Se ocorrer um incidente que possa trazer risco ou dano relevante a você, avisaremos você e a ANPD, como a lei determina.</p>
<p>A {{nome}} nunca pede senha, código de segurança do cartão ou pagamento por links enviados por mensagem. Na dúvida, confirme pelo WhatsApp {{telefone}}.</p>
<h2>Menores de idade</h2>
<p>As compras são destinadas a maiores de 18 anos. Não coletamos intencionalmente dados de crianças e adolescentes. Se você é responsável por um menor que nos forneceu dados, escreva para {{email}} para que sejam apagados.</p>
<h2>Sites de terceiros</h2>
<p>O site pode ter links para redes sociais e outros sites. Cada um tem a sua própria política, e a {{nome}} não responde pelas práticas deles.</p>
<h2>Cookies</h2>
<p>O uso de cookies está explicado na <a href="/cookies">Política de cookies</a>.</p>
<h2>Mudanças nesta política</h2>
<p>Esta política pode ser atualizada. A data no início da página indica a versão em vigor. Mudanças relevantes são avisadas no site ou por e-mail.</p>`,
  },
  {
    slug: "cookies",
    title: "Política de cookies",
    seoDescription:
      "Quais cookies a Net Shop Garden usa, para quê, por quanto tempo, e como alterar as suas preferências.",
    footerGroup: "institucional",
    content: `${updated}
<p>Cookies são pequenos arquivos guardados no seu navegador. Eles permitem que o site lembre da sua sacola e do seu login e, se você autorizar, ajudam a medir o uso do site e o resultado de anúncios.</p>
<h2>Necessários</h2>
<p>Sem eles o site não funciona, por isso ficam sempre ativos e não dependem de consentimento.</p>
<ul><li><strong>Sacola (nsg_cart):</strong> guarda os produtos que você escolheu.</li><li><strong>Login:</strong> mantém a sua sessão depois de entrar na conta e protege os formulários contra envios falsos.</li><li><strong>Preferências de cookies (nsg_consent):</strong> guarda a sua escolha sobre cookies por 12 meses.</li><li><strong>Avisos do site (nsg_lead):</strong> lembra que você já viu ou fechou o convite para receber novidades, para não mostrar de novo.</li></ul>
<h2>Análise</h2>
<p>Ajudam a entender como o site é usado: páginas mais visitadas, buscas e etapas da compra. Só são ativados se você aceitar. Quando ativos, podem ser definidos por ferramentas como o Google Analytics.</p>
<h2>Marketing</h2>
<p>Permitem saber de qual anúncio ou campanha veio a visita, medir o resultado de anúncios e mostrar ofertas relacionadas ao que você viu. Incluem o registro da origem da visita (nsg_utm, por 30 dias) e, quando ativos, cookies de ferramentas como o pixel da Meta. Só são usados para análise e anúncios se você aceitar.</p>
<h2>Como alterar a sua escolha</h2>
<p>Use o link "Preferências de cookies", no rodapé de qualquer página, para aceitar, recusar ou personalizar. Você pode mudar de ideia quando quiser.</p>
<p>Também é possível apagar ou bloquear cookies nas configurações do navegador. Se bloquear os cookies necessários, a sacola e o login deixam de funcionar.</p>
<h2>Mais informações</h2>
<p>O tratamento de dados pessoais está explicado na <a href="/privacidade">Política de privacidade</a>. Dúvidas: {{email}}.</p>`,
  },
  {
    slug: "termos",
    title: "Termos de uso",
    seoDescription: "Condições de uso do site e de compra na Net Shop Garden.",
    footerGroup: "institucional",
    content: `${updated}
<p>Este site é operado por {{razaoSocial}}, CNPJ {{cnpj}}, com endereço em {{endereco}}. Ao navegar, criar uma conta ou comprar, você concorda com estes termos, com a <a href="/privacidade">Política de privacidade</a> e com a política de <a href="/trocas-e-devolucoes">Trocas e devoluções</a>. Estes termos não reduzem os direitos garantidos pelo Código de Defesa do Consumidor.</p>
<h2>Quem pode comprar</h2>
<p>Pessoas maiores de 18 anos, com CPF válido, e empresas com CNPJ válido. Os dados informados no cadastro e no pedido devem ser verdadeiros, completos e atualizados. A loja pode recusar ou cancelar cadastros e pedidos com dados falsos ou de terceiros usados sem autorização.</p>
<h2>Conta e senha</h2>
<p>A senha é pessoal. Você é responsável por mantê-la em sigilo e pelos pedidos feitos na sua conta. Se suspeitar de uso indevido, troque a senha e avise a loja.</p>
<h2>Produtos e fotos</h2>
<p>Descrevemos os produtos com o máximo de cuidado. As fotos são ilustrativas: as cores podem variar conforme a tela, e objetos usados na composição da foto não acompanham o produto, salvo quando a descrição disser o contrário.</p>
<ul><li><strong>Plantas e flores:</strong> são seres vivos. Tamanho, formato, cor e número de flores e folhas variam de uma para outra e conforme a época do ano. As medidas informadas são aproximadas.</li><li><strong>Peças artesanais e de materiais naturais:</strong> cerâmica, barro, fibra, madeira e vidro soprado podem ter pequenas diferenças de cor, textura, peso e medida.</li><li><strong>Substituição:</strong> se uma flor, uma folhagem ou um vaso de um arranjo não estiver disponível, podemos substituir por outro de mesmo padrão, valor e estilo, mantendo a proposta do arranjo. Quando a mudança for relevante, avisamos antes.</li></ul>
<p>As orientações de cuidado e as informações sobre plantas tóxicas para animais e crianças são gerais. A loja não responde por danos causados por uso diferente do indicado, por ingestão de plantas ou por falta de cuidados depois da entrega.</p>
<h2>Preços, ofertas e cupons</h2>
<ul><li>Os preços valem para compras neste site e podem mudar sem aviso. Vale o preço exibido na confirmação do pedido.</li><li>Ofertas valem pelo prazo anunciado ou enquanto durar o estoque.</li><li>Cupons são pessoais, valem um por pedido, não se somam a outros cupons e não são convertidos em dinheiro. O uso indevido ou fraudulento leva ao cancelamento do cupom e do pedido.</li><li>Se um produto for anunciado com erro evidente de preço ou de descrição, muito diferente do valor de mercado, a loja pode cancelar o pedido e devolver integralmente o valor pago.</li></ul>
<h2>Pedido e pagamento</h2>
<p>O pedido só é confirmado depois da aprovação do pagamento. Até lá, os produtos ficam reservados por tempo limitado. As formas de pagamento estão em <a href="/pagamentos">Pagamentos</a>.</p>
<p>A loja pode cancelar um pedido, com devolução integral do valor pago, quando o pagamento não for aprovado ou for contestado, quando houver indício de fraude, quando os dados estiverem incorretos e não for possível falar com você, ou quando o produto ficar indisponível por falha de estoque. Neste último caso, você pode escolher outro produto equivalente em vez do reembolso.</p>
<p>A análise do pagamento é feita pela operadora e pelo banco emissor do cartão. A loja não tem acesso ao motivo de uma recusa.</p>
<h2>Entrega</h2>
<p>As modalidades, os prazos e as regiões atendidas estão em <a href="/entrega">Entrega e prazos</a>. O prazo começa a contar depois da aprovação do pagamento e é uma estimativa quando a entrega depende de transportadora ou dos Correios.</p>
<ul><li>É sua responsabilidade informar o endereço completo e correto e garantir que haja alguém para receber. Porteiros, familiares e outras pessoas no endereço podem receber em seu nome.</li><li>Se a entrega não puder ser feita por endereço incorreto, ausência ou recusa, a nova entrega pode ter novo custo de frete.</li><li>Confira o pedido ao receber. Embalagem aberta ou danificada deve ser anotada no comprovante de entrega e comunicada à loja no mesmo dia.</li><li>Atrasos causados por greve, enchente, bloqueio de vias, restrição de circulação ou outro fato fora do controle da loja e da transportadora não geram indenização. Nesses casos, avisamos e combinamos a solução.</li></ul>
<h2>Presentes</h2>
<p>Em pedidos para presente, a entrega é feita a quem estiver no endereço informado. A loja não garante entrega em horário exato nem que o presenteado esteja no local. Confira o texto do cartão antes de concluir o pedido.</p>
<h2>Trocas, devoluções e garantia</h2>
<p>As regras estão em <a href="/trocas-e-devolucoes">Trocas e devoluções</a>.</p>
<h2>Uso do site</h2>
<p>Não é permitido usar o site para fins ilegais, tentar acessar áreas restritas, copiar dados em massa por meios automatizados, interferir no funcionamento do site ou fazer pedidos em nome de terceiros sem autorização. A loja pode bloquear o acesso de quem descumprir estas regras.</p>
<h2>Propriedade intelectual</h2>
<p>A marca, o nome {{nome}}, os textos, as fotos e o projeto visual do site pertencem à loja ou são usados com autorização. Não podem ser copiados ou reproduzidos sem autorização por escrito.</p>
<h2>Avaliações e mensagens</h2>
<p>Avaliações de produtos e mensagens enviadas à loja devem ser verdadeiras e respeitosas. A loja pode deixar de publicar ou remover conteúdo ofensivo, ilegal, com dados pessoais de terceiros ou sem relação com o produto.</p>
<h2>Disponibilidade do site</h2>
<p>Trabalhamos para manter o site no ar e seguro, mas ele pode ficar indisponível por manutenção ou por falha de terceiros. A loja não responde por problemas no seu dispositivo ou na sua conexão.</p>
<h2>Comunicações</h2>
<p>Os avisos sobre o pedido são enviados para o e-mail e o telefone informados na compra. Mantenha os dados atualizados e confira a caixa de spam.</p>
<h2>Mudanças nestes termos</h2>
<p>Estes termos podem ser atualizados. Vale para cada compra a versão em vigor na data do pedido, indicada no início da página.</p>
<h2>Lei e foro</h2>
<p>Estes termos seguem a lei brasileira. Antes de qualquer medida, fale com a gente: a maior parte dos problemas se resolve pelo atendimento. Fica eleito o foro do domicílio do consumidor para resolver questões ligadas a compras neste site.</p>
<h2>Contato</h2>
<p>WhatsApp {{telefone}} e e-mail {{email}}. {{horario}}.</p>`,
  },
];
