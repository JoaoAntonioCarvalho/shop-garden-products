# Manual do painel administrativo

Para quem cuida da loja no dia a dia. Não é preciso conhecimento técnico.

O painel fica em `/admin`. Entre com o seu e-mail e a sua senha na página **Entrar** da loja. Se esqueceu a senha, use "Esqueci a senha" na mesma página.

## Quem pode o quê

Há dois papéis:

- **Administrador**: acesso completo.
- **Equipe**: pedidos (ver, mudar status, rastreio, notas, imprimir, pedido manual), estoque, imagens dos produtos, avaliações, leads, solicitações e contatos. A equipe não altera preços, não exclui, não exporta dados de clientes, não faz estorno e não vê custo, margem, configurações, frete, usuários e auditoria.

O menu só mostra o que o seu papel permite.

## O dia a dia em 5 passos

1. Abra o **Dashboard** e olhe o bloco **Atenção agora**: Pix perto de expirar, pedidos pagos sem preparo, estoque baixo, avaliações e mensagens esperando resposta.
2. Veja **Entregas de hoje** e avance cada pedido conforme a expedição anda.
3. Em **Pedidos**, filtre por "Entrega hoje" ou "Atrasados" quando precisar.
4. Responda **Solicitações** e **Contatos**.
5. Modere as **Avaliações** pendentes.

## Pedidos

- A lista tem busca (número, nome, e-mail, CPF, telefone) e filtros. Os filtros ficam no endereço da página: dá para salvar nos favoritos ou mandar o link para um colega.
- Clique no número para abrir o pedido. No topo ficam os botões do próximo passo: **Iniciar preparação**, **Marcar como enviado** (pede transportadora e código de rastreio), **Saiu para entrega**, **Marcar como entregue**.
- **Cancelar pedido** pede o motivo e pergunta se é para estornar o pagamento e devolver os itens ao estoque. Estorno só o administrador faz.
- **Linha do tempo**: tudo o que aconteceu com o pedido (status, pagamentos, e-mails, notas).
- **Notas internas**: só a equipe vê.
- **CPF**: aparece mascarado. "Mostrar" revela e fica registrado na auditoria.
- **Imprimir**: lista de separação, etiqueta de envio e cartão de presente (A6).
- **Em massa**: marque vários pedidos e mude o status de todos. Os que não podem mudar são listados e ignorados.

### Pedido manual (venda pelo WhatsApp, telefone ou loja)

**Pedidos › Criar pedido manual**. Busque o cliente ou digite os dados de um novo, adicione os produtos, informe o CEP e escolha a entrega (ou "Valor combinado", ou "Venda na loja"). Escolha o pagamento:

- **Pix já recebido**, **Cartão na maquininha**, **Dinheiro**: o pedido nasce pago.
- **Gerar Pix** e **Link de pagamento**: o pedido nasce aguardando pagamento, e o cliente recebe o link por e-mail se você marcar a opção.

O pedido manual baixa o estoque e entra nos relatórios com o canal escolhido (WhatsApp é o padrão). Ajustar o preço unitário é só para administrador e exige um motivo.

## Produtos

- **Novo produto** abre o formulário em abas: Geral, Variações, Imagens, Ficha, Entrega, SEO, Relacionados e Histórico. O produto nasce como rascunho.
- **Qualidade do cadastro** (0 a 100), na lateral: mostra o que falta (3 imagens, texto alternativo, descrição com mais de 300 caracteres, descrição curta, ficha, peso e dimensões, SEO, categoria). Publicar com menos de 60 pede confirmação.
- **Variações**: defina as opções (por exemplo, Tamanho: P, M, G) e clique em **Gerar combinações**. Cada variação tem SKU, preço, estoque e peso.
- **Imagens**: arraste os arquivos (JPG, PNG ou WebP, até 10 MB). Arraste para ordenar, marque a capa e escreva o texto alternativo, que é obrigatório para publicar.
- **Mudar o endereço (slug)** de um produto publicado cria sozinho o redirecionamento do endereço antigo.
- **Edição rápida** na lista: preço e estoque da primeira variação.
- **Em massa**: publicar, arquivar, mover de categoria, adicionar a coleção, tags, reajuste de preços em % (com prévia), ligar ou desligar "Entrega hoje" e excluir. Produto que já foi vendido não é excluído: é arquivado.
- **Duplicar**: cria uma cópia em rascunho, com "(cópia)" no nome e estoque zerado.
- **Ver prévia**: mostra o rascunho como ele vai ficar na loja (só para quem está logado no painel).

### Importar produtos por planilha

**Produtos › Importar CSV**. Aceita a exportação do site antigo e o modelo do painel ("Baixar modelo CSV"). Etapas: enviar o arquivo, conferir as colunas, ligar as categorias do arquivo às categorias da loja, ver a prévia com os erros de cada linha e importar como rascunho ou publicado. Produto com código já cadastrado é atualizado.

### Remover os produtos de teste

A loja vem com produtos, pedidos e clientes de teste, marcados com o selo **Teste**. Quando o catálogo real estiver cadastrado: **Produtos › Remover todos os produtos de teste**, digite `REMOVER TESTES` e confirme. Sai tudo o que é de teste, e nada do que é real é alterado. No fim aparece o relatório do que foi apagado.

## Categorias e coleções

- **Categorias**: arraste para mudar a ordem. Para mudar a categoria pai, arraste até um dos destinos tracejados que aparecem durante o arrasto ("mover para dentro de" ou "virar categoria principal") e confirme: o endereço muda e o antigo passa a redirecionar. Os interruptores ligam e desligam na hora (ativa, no menu, na home). Abra a categoria para editar texto de SEO, perguntas frequentes, filtros e, se preferir, a categoria pai.
- **Coleções**: vitrines. A **manual** tem produtos escolhidos e ordenados por você; a **por regra** se atualiza sozinha (novidades, mais vendidos, promoção, tag ou categoria).

## Estoque

- A tabela mostra, por variação: em estoque, reservado (pedidos aguardando pagamento) e disponível.
- **Ajustar**: Entrada, Saída, Ajuste de inventário (você informa a contagem real) ou Perda. O motivo é obrigatório e fica no histórico.
- **Entrada em lote**: cole uma linha por item, `SKU;quantidade;motivo`, confira a prévia e aplique.
- **Contagem de inventário**: escolha a categoria, digite o que contou e veja as diferenças antes de aplicar.
- **Histórico**: todo movimento, com quem fez. **Valor em estoque** é só para administrador.
- Quando um produto sem estoque é reposto, quem pediu **Avise-me** recebe o e-mail "Chegou".

## Mídia

Biblioteca de imagens. Filtros: sem texto alternativo, não utilizadas, de teste. Clique na imagem para ver onde ela é usada, editar o texto alternativo e copiar o endereço. Imagem em uso não pode ser excluída.

## Clientes

- Lista com filtros (com ou sem pedidos, gasto, tempo sem comprar, estado, consentimento, aniversariantes).
- Na ficha: pedidos, total gasto, ticket médio, produtos mais comprados, endereços, consentimentos e notas internas.
- **Enviar link para redefinir senha**, **Exportar dados** e **Anonimizar** (apaga os dados pessoais e mantém os pedidos sem identificação; não dá para desfazer).
- **Pedidos LGPD**: fila dos pedidos de cópia ou exclusão de dados feitos pelos clientes. O prazo legal é de 15 dias.

## Carrinhos abandonados

Sacolas com e-mail, paradas há mais de 2 horas. Para cada uma: **Enviar e-mail de recuperação** (o link devolve a sacola ao cliente), **Copiar mensagem de WhatsApp** e **Marcar como contatado**. No topo ficam o valor parado e a taxa de recuperação.

## Cupons

O formulário mostra uma **prévia em linguagem simples** ("10% de desconto, válido na primeira compra, a partir de R$ 100,00, até 30/11/2026"). Abaixo fica o uso do cupom. **Gerar cupons únicos em lote** cria códigos de um uso só, com as regras de um cupom modelo, e deixa baixar a lista.

## Avaliações e depoimentos

- **Avaliações**: a fila abre nas pendentes. Aprovar, rejeitar (o motivo é interno), responder em público e corrigir erros de digitação (o texto anterior fica na auditoria).
- **Depoimentos**: frases sobre a loja, mostradas na home. Arraste para ordenar.
- No pedido entregue há o botão **Solicitar avaliação**.

## Marketing e conteúdo

- **Banners**: destaque da home, faixa secundária, topo de categoria e barra superior. O texto é sempre texto de verdade sobre um painel, nunca dentro da imagem. Dá para agendar início e fim. A prévia no fim do formulário acompanha o que você digita, em computador e celular, e avisa quando a foto do destaque é clara demais atrás do painel de texto.
- **Home**: arraste as seções para mudar a ordem e ligue ou desligue cada uma.
- **Ocasiões**, **Páginas** e **Ajuda (FAQ)**: cadastros simples. Nos textos, marcadores como `{{telefone}}`, `{{freteGratis}}`, `{{corte}}` e `{{descontoPix}}` são trocados pelos valores das Configurações.
- **Leads**: contatos captados com consentimento. A exportação traz só quem tem consentimento ativo.

## Frete e entrega

Regras por faixa de CEP (valor, prazo, dias, corte), **feriados** e um **simulador**: informe um CEP e um carrinho de exemplo para ver as opções que o cliente veria.

## Configurações

Dados da loja, regras comerciais (desconto do Pix, parcelas, frete grátis), entrega hoje, analytics, e-mail interno e **modo manutenção** (a loja mostra "Voltamos em breve"; a equipe logada continua vendo a loja). Salvar atualiza a loja na hora. **Enviar e-mail de teste** confere se os e-mails estão saindo.

## Usuários, redirecionamentos, auditoria, e-mails e tarefas

- **Usuários**: convide alguém pelo e-mail (a pessoa define a própria senha), mude o papel ou desative. A loja sempre mantém pelo menos um administrador ativo.
- **Redirecionamentos**: endereços antigos que levam aos novos. **Testar URL** mostra para onde um endereço vai. **Páginas não encontradas** lista os endereços que deram erro, com o botão para criar o redirecionamento.
- **Auditoria**: quem fez o quê, quando e o que mudou.
- **E-mails enviados**: abra para ver o conteúdo e reenviar.
- **Tarefas agendadas**: rotinas automáticas (expirar Pix e boleto, atualizar mais vendidos, marcar carrinhos abandonados, resumo de estoque baixo, limpeza). Cada uma tem a última execução e o botão **Executar agora**.

## Relatórios

Vendas por dia, semana e mês; por produto, variação e categoria; por canal e origem; por meio de pagamento; por entrega e região; cupons; clientes novos e recorrentes; leads; buscas (inclusive as sem resultado); giro de estoque e produtos parados; cadastro incompleto. Todos têm seletor de período e **Exportar CSV**.

## Dúvidas comuns

- **O cliente pagou o Pix e o pedido não mudou**: abra o pedido. Se o pagamento foi confirmado por fora, use **Marcar como pago**.
- **Vendi um produto na loja física**: faça um pedido manual com canal "Loja" e "Venda na loja, sem entrega", ou ajuste o estoque com "Saída".
- **Errei o estoque**: use "Ajuste de inventário" com a contagem certa e escreva o motivo.
- **Quero tirar um produto do ar sem apagar**: mude o status para Arquivado.
