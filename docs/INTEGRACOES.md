# Integrações

O que está simulado, e o passo a passo para ligar o serviço real. Em todos os casos a troca acontece atrás de uma interface, sem mexer nas páginas.

## 1. Gateway de pagamento

**Hoje em produção:** `PAYMENT_PROVIDER=cielo` (desde 10/10/2026, com a loja em modo manutenção). **Em desenvolvimento:** `PAYMENT_PROVIDER=mock`, em `src/server/providers/payment/mock.ts`. Gera Pix (código e QR), tokeniza o cartão no navegador e emite boleto, tudo de mentira. O simulador de pagamento some sozinho em produção.

**Interface:** `src/server/providers/payment/types.ts` (`PaymentProvider`): criar a cobrança, consultar, estornar, validar o aviso e preparar a tokenização do cartão.

### Cielo (escrita, falta ligar)

`src/server/providers/payment/cielo.ts` usa a **API E-commerce Cielo** (a antiga Cielo 3.0): Pix e cartão de crédito dentro do site. Não há boleto: com a Cielo ligada, a opção aparece como indisponível.

Conferido em 10/10/2026 no ambiente de testes da Cielo, com as credenciais públicas da documentação: Pix gerado, cartão aprovado e recusado pelo checkout no navegador, consulta, aviso e devolução. No mesmo dia, com as credenciais de produção da loja: a API respondeu, o Silent Order Post emitiu o token de acesso do cartão e um Pix de R$ 1,00 foi gerado. O Pix foi pago e a consulta devolveu "pago". A devolução desse Pix foi negada pela Cielo por falta de saldo na conta Pix, com resposta 200 e status 2: o provider só considera devolvido com status 10 ou 11, ou status 2 com `ReasonCode` 0. **Ainda não houve venda no cartão em produção, nem aviso de pagamento recebido.**

**O que a loja precisa ter na Cielo.** O link de pagamento que a loja usa hoje é outro produto e não serve para cobrar dentro do site. É preciso pedir à Cielo:

1. A habilitação da **API E-commerce Cielo** para o CNPJ. Ela gera o `MerchantId` e a `MerchantKey`.
2. O **Pix** liberado nesse cadastro (no site da Cielo: Meu Cadastro > Autorizações > PIX).
3. As credenciais do **Silent Order Post** (`ClientId` e `ClientSecret`), que permitem trocar o cartão por um token no navegador. Elas aparecem em E-commerce > Credenciais só depois que o suporte a desenvolvedores vincula o serviço à conta.
4. Opcional, mas recomendado: antifraude e autenticação 3DS, que reduzem contestação de compra.

**Variáveis** (`.env.example`): `PAYMENT_PROVIDER=cielo`, `CIELO_ENV` (`sandbox` ou `production`), `CIELO_MERCHANT_ID`, `CIELO_MERCHANT_KEY`, `CIELO_CLIENT_ID`, `CIELO_CLIENT_SECRET`, `CIELO_WEBHOOK_SECRET` e, se quiser, `CIELO_SOFT_DESCRIPTOR` (nome na fatura, até 13 caracteres). Com `PAYMENT_PROVIDER=cielo`, a loja não sobe sem as cinco primeiras.

**Aviso de pagamento.** No site da Cielo, cadastre a URL de notificação `https://<domínio>/api/webhooks/payments/cielo` e um cabeçalho `webhooksecret` (o painel da Cielo só aceita letras no nome) com o mesmo valor de `CIELO_WEBHOOK_SECRET` (um texto longo e aleatório). O aviso da Cielo não é assinado e traz só o identificador: a loja confere o cabeçalho e busca o status na API.

**Como funciona.**

- **Cartão:** o formulário pede ao servidor um token de acesso de uso único e envia o cartão direto do navegador para a Cielo, que devolve um token de pagamento. Número, validade e CVV não passam pelo servidor da loja. A venda é capturada na hora.
- **Pix:** a confirmação chega pelo aviso. Antes de expirar um Pix, a loja pergunta à Cielo se ele foi pago.
- **Gateway fora do ar:** o pedido é criado, fica com pagamento não aprovado e a página dele oferece nova tentativa.
- **Devolução:** Admin > Pedido > Reembolsar chama o cancelamento da Cielo. No Pix, a Cielo só devolve se houver saldo na conta Pix.

**O que falta conferir com a conta real.**

- **Prazo do Pix.** A loja expira o Pix no prazo de Admin > Configurações (hoje 20 minutos), mas não foi encontrado na documentação como dizer esse prazo à Cielo. Se o cliente pagar um QR Code depois de a loja ter expirado o pedido, o dinheiro entra e o pedido continua expirado: a equipe precisa reativar ou devolver à mão. Perguntar à Cielo qual é o prazo do QR Code e como configurá-lo.
- **Devolução de Pix** pelo mesmo cancelamento do cartão: a documentação diz que é pela API, sem detalhar. Testar com um Pix real.
- **Parcelamento:** as parcelas sem juros da loja precisam estar liberadas no cadastro da Cielo.
- Um pedido real de cada tipo, com devolução, antes de divulgar.

### Outro gateway

1. Crie `src/server/providers/payment/<gateway>.ts` implementando `PaymentProvider`.
2. Registre em `src/server/providers/payment/index.ts` e acrescente o nome ao `PAYMENT_PROVIDER` em `src/lib/env.ts`.
3. **Cartão:** acrescente o tipo de tokenização em `CardTokenization` e trate-o em `src/components/store/checkout/card-form.tsx`. O número, a validade e o CVV continuam sem passar pelo servidor da loja.
4. **Aviso:** aponte o gateway para `/api/webhooks/payments/<gateway>`. `applyPaymentEvent` já é idempotente e cuida de status, estoque e e-mails.
5. Guarde as chaves em variáveis de ambiente do servidor, nunca com `NEXT_PUBLIC_`.
6. Libere os domínios do gateway na CSP (`next.config.ts`).

## 2. Frete por transportadora

**Padrão:** `SHIPPING_PROVIDER=mock`. As opções vêm das regras de **Frete e entrega** do painel (faixa de CEP, valor por peso, prazo).

**Transportadoras prontas, desligadas:** Correios e Jadlog. `SHIPPING_PROVIDER` aceita uma lista: `correios`, `jadlog` ou `correios,jadlog`. As variáveis estão em `.env.example`. Com alguma transportadora ligada, as credenciais dela e `SHIPPING_ORIGIN_CEP` são obrigatórios e a aplicação não sobe sem eles.

**Nenhuma das duas rodou com credenciais reais.** Os testes usam respostas simuladas. A primeira ligação precisa ser acompanhada, com pedidos de teste.

### Como funciona com transportadora ligada

- As regras de **Frete e entrega** continuam mandando no que é da loja: onde cada modalidade é oferecida, entrega hoje, entrega agendada, retirada, frete grátis e itens só locais.
- Nas modalidades nacionais ("econômico" e "expresso"), o valor e o prazo da regra são trocados pelos da transportadora **mais barata** entre as que podem levar a sacola (no empate, a mais rápida). O nome da transportadora entra no nome da opção, por exemplo "Envio econômico (Jadlog)", e vai gravado no pedido: a equipe sabe por onde despachar.
- **Produto "só Jadlog"** (campo "Transportadora no envio nacional", na aba Entrega do produto): com um desses na sacola, só a Jadlog é consultada e o pedido inteiro vai por ela. Serve para volumosos e plantas que os Correios não aceitam. O pedido no painel mostra um aviso.
- Pacote acima do limite dos Correios (100 cm por lado ou 200 cm na soma) também vai só pela Jadlog, sem precisar marcar o produto.
- Ao prazo da transportadora soma-se `SHIPPING_HANDLING_DAYS` (dias úteis para separar e postar).
- Frete grátis continua sendo decisão da loja: o cliente paga zero e o valor da transportadora fica como valor original.
- O pacote é estimado pelo peso da variação e pelas medidas do produto (largura, profundidade, altura), com 4 cm de folga. Sem medidas, usa 20 × 20 × 20 cm; sem peso, 300 g. **Cadastre peso e medidas reais**, senão a cotação sai errada.
- Transportadora fora do ar ou autenticação recusada: usa a outra; se nenhuma responder, vale a tabela do painel, para o checkout não parar. Mantenha a tabela com valores realistas.
- Se todas responderem que não atendem o envio (CEP, peso, medidas), a modalidade não é oferecida.
- A mesma cotação é reaproveitada por 10 minutos, na memória do servidor.

**Rastreio:** a movimentação aparece na página do pedido, na área do cliente e no painel. A transportadora é reconhecida pelo formato do código (Correios: duas letras, nove dígitos, duas letras; Jadlog: só dígitos). A tarefa `rastreio-transportadoras` (a cada 2 horas, em `/api/cron/rastreio-transportadoras`) marca como entregues os pedidos com evento de entrega e o cliente recebe o e-mail.

**O que ainda não faz:** gerar etiqueta e código de rastreio (pré-postagem dos Correios, inclusão de pedido na Jadlog). A equipe despacha pelo sistema da transportadora e digita o código ao marcar o pedido como enviado.

### Correios

Código em `src/server/providers/shipping/correios/`, escrito a partir da descrição oficial das APIs (`api.correios.com.br/{token,preco,prazo,srorastro}/v3/api-docs`). Homologação: `CORREIOS_BASE_URL=https://apihom.correios.com.br`.

1. Contrato com os Correios, com cartão de postagem. Sem contrato, estas APIs não autorizam preço nem rastreio.
2. Usuário do Meu Correios e um código de acesso às APIs, gerado no portal Correios API (cws.correios.com.br). Não é a senha de login.
3. As APIs de preço, prazo e rastro liberadas para o cartão de postagem.
4. Os códigos de serviço do contrato. Os padrões são `03298` (PAC) e `03220` (SEDEX), postos de memória: confira no contrato.

### Jadlog

Código em `src/server/providers/shipping/jadlog/`, escrito a partir do documento "Integração JADLOG" versão 2.3 (agosto de 2025): simulador de frete (`POST /embarcador/api/frete/valor`) e consulta de tracking (`POST prd-traffic.jadlogtech.com.br/embarcador/api/tracking/consultar`).

1. Peça à franquia Jadlog que atende a loja os dados de acesso da API: token, código do cliente e conta corrente (se for correntista). Preencha `JADLOG_TOKEN`, `JADLOG_CNPJ` e, se houver, `JADLOG_ACCOUNT` e `JADLOG_CONTRACT`.
2. Modalidades: `JADLOG_MODALITY_ECONOMY` (padrão 3, .Package; para volumosos a Jadlog costuma usar 4, Rodoviário) e `JADLOG_MODALITY_EXPRESS` (vazio por padrão; 0 é o Expresso). Sem código no expresso, a Jadlog só cota o econômico. **A tabela de modalidades do manual não pôde ser lida** (é uma imagem): os códigos acima vêm de memória e precisam ser confirmados com a Jadlog.
3. O peso enviado é o maior entre o real e o cubado: volume ÷ 3333 nas modalidades rodoviárias e ÷ 6000 nas aéreas. Esses divisores também vêm de memória.
4. O token vai no cabeçalho `Authorization` com o prefixo `Bearer`. O manual mostra só `Authorization: <token>`; se a Jadlog entregar o token já com o prefixo, ele é mantido.
5. Rastreio: o código digitado no pedido pode ser o número de rastreamento (CT-e) ou o shipmentId; a consulta tenta os dois. A entrega é reconhecida pelo status `ENTREGUE` (de memória; confirmar no primeiro pedido real).

### Outra transportadora (Melhor Envio, Frenet...)

Implemente a interface `Carrier` (`src/server/providers/shipping/carriers/types.ts`), registre em `src/server/providers/shipping/index.ts` e acrescente o nome em `SHIPPING_PROVIDER` (`src/lib/env.ts`).

## 3. E-mail

**Hoje:** SMTP por Nodemailer; em desenvolvimento, Mailpit.

**Recomendado para esta loja: Resend**, por SMTP (`smtp.resend.com`, porta 465, usuário `resend`, senha = chave de API). O plano gratuito cobre 3.000 e-mails por mês e 100 por dia, e um pedido gera de 3 a 5 e-mails. Ele só envia: para receber em `contato@`, a loja precisa de uma caixa de entrada à parte (Zoho Mail tem plano gratuito com domínio próprio; Google Workspace é pago).

**Produção:** qualquer SMTP transacional (Amazon SES, Resend, Brevo, Postmark). Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `EMAIL_FROM`, e publique SPF, DKIM e DMARC no domínio. Para usar uma API em vez de SMTP, implemente `EmailProvider` em `src/server/providers/email`.

E-mail marketing em massa não faz parte da loja. Para campanhas, exporte os leads com consentimento ativo (**Leads › Exportar CSV**) para uma ferramenta própria, que precisa respeitar o descadastro.

## 4. Armazenamento de imagens

`STORAGE_DRIVER=s3` com `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` e `S3_PUBLIC_URL`. Funciona com Amazon S3, Cloudflare R2 e MinIO. Em desenvolvimento, `docker compose --profile storage up -d` sobe um MinIO.

Ao migrar de `local` para `s3`, copie a pasta `uploads/` para o bucket mantendo os caminhos.

## 5. Nota fiscal

Ainda não há emissão. A loja antiga emitia pelo Bling, e o caminho recomendado é continuar com ele: a configuração fiscal, o certificado digital e o cadastro com NCM já estão lá, e a contabilidade já conhece. A loja não emite nota; ela manda o pedido para o Bling, que emite.

**Como ligar ao Bling (API v3, OAuth 2):**

1. Cadastre um aplicativo na conta do Bling para obter client id e client secret. Guarde em variáveis de servidor (nunca `NEXT_PUBLIC_`) e guarde o refresh token no banco, renovando o access token quando vencer.
2. Crie um provider de nota fiscal atrás de uma interface (como os de pagamento e frete), com `sendOrder(order)` e `getInvoice(orderId)`.
3. Ponto de encaixe: a transição para `PAID` em `src/server/services/orders.ts`, depois do commit, junto dos e-mails. Envie o pedido de venda ao Bling com cliente (nome, CPF, endereço), itens por SKU, frete e desconto, em centavos convertidos para reais. Falha no envio não pode desfazer o pagamento: registre e tente de novo por uma tarefa agendada (`src/server/jobs.ts`).
4. A emissão da nota pode ser automática no Bling ou por um clique da equipe lá. Receba o retorno (webhook do Bling ou consulta periódica) e grave no pedido o número da nota, a chave e o link do DANFE, para mostrar no painel e na área do cliente.
5. Os SKUs das variações da loja precisam ser os mesmos códigos dos produtos no Bling. Decida qual dos dois manda no estoque; se for o Bling, some uma sincronização de saldo.
6. Etiquetas: a logística do Bling (Correios, Melhor Envio e outras) gera a etiqueta e o código de rastreio a partir do mesmo pedido. Trazer esse código de volta resolve a pendência de etiquetas e rastreio automático.

Confira na documentação atual do Bling os nomes dos endpoints, os limites de requisição e se o plano contratado inclui a API. Alternativas, se a loja sair do Bling: Tiny (Olist), que é um ERP parecido, ou um emissor puro por API (NFe.io, eNotas, Focus NFe), que exige cadastrar NCM, origem e regras fiscais na própria loja.

## 6. WhatsApp Business API

Hoje a loja usa links `wa.me` com mensagem pronta, e o painel copia mensagens para a equipe enviar à mão. Para mensagens automáticas (pedido confirmado, saiu para entrega, carrinho abandonado) é preciso a API oficial, por um provedor (Twilio, Zenvia, 360dialog) ou direto na Meta, com modelos de mensagem aprovados e o consentimento de WhatsApp do cliente, que a loja já registra separado do de e-mail. O encaixe é o mesmo dos e-mails: `src/server/services/emails.ts` é chamado em cada evento do pedido.

## 7. Analytics e conversões

**Pronto:** camada de eventos em `src/lib/analytics/events.ts` (`track`), com os eventos de e-commerce do GA4. Informe o ID do GA4 e do pixel da Meta em **Configurações › Analytics**. Os scripts só carregam depois do consentimento.

**Documentado, não implementado:**

- **API de Conversões da Meta:** enviar `Purchase` do servidor, na transição para `PAID`, com `event_id` igual ao do pixel (o número do pedido) para deduplicar, e e-mail e telefone em SHA-256. Só para pedidos de clientes que aceitaram cookies de marketing.
- **Conversões do Google Ads:** importar a conversão `purchase` do GA4 ou usar conversões otimizadas. O `gclid` já é capturado e gravado no pedido.

## 8. Limite de requisições

Hoje usa a tabela `RateLimitHit`. Para tráfego alto ou várias instâncias, implemente a interface `RateLimiter` de `src/server/services/rate-limit.ts` com Redis ou Upstash.

## 9. Consulta de CEP

ViaCEP, com cache em memória e tempo limite de 3 segundos. Se cair, o cliente preenche o endereço à mão. `VIACEP_ENABLED=false` desliga.
