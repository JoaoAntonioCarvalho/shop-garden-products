# Integrações

O que está simulado, e o passo a passo para ligar o serviço real. Em todos os casos a troca acontece atrás de uma interface, sem mexer nas páginas.

## 1. Gateway de pagamento

**Hoje:** `PAYMENT_PROVIDER=mock`, em `src/server/providers/payment/mock.ts`. Gera Pix (código e QR), tokeniza o cartão no navegador e emite boleto, tudo de mentira.

**Interface:** `src/server/providers/payment/types.ts` (`PaymentProvider`): criar a cobrança, consultar, estornar e validar o webhook.

**Para ligar um gateway (Mercado Pago, Pagar.me, Stripe, Asaas...):**

1. Crie `src/server/providers/payment/<gateway>.ts` implementando `PaymentProvider`.
2. Registre em `src/server/providers/payment/index.ts` e acrescente o nome ao `PAYMENT_PROVIDER` em `src/lib/env.ts`.
3. **Cartão:** troque a tokenização de `src/components/store/checkout/card-form.tsx` pelo SDK do gateway. O número, a validade e o CVV continuam sem passar pelo servidor da loja; só o token é enviado.
4. **Webhook:** aponte o gateway para `/api/webhooks/payments/<gateway>`. O provider valida a assinatura; `applyPaymentEvent` já é idempotente e cuida de status, estoque e e-mails.
5. Guarde as chaves em variáveis de ambiente do servidor, nunca com `NEXT_PUBLIC_` (a chave pública do SDK é a única exceção).
6. Libere os domínios do gateway na CSP (`next.config.ts`).
7. Teste no ambiente de homologação do gateway: aprovado, recusado, Pix expirado, estorno e webhook repetido.

O simulador de pagamento some sozinho em produção.

## 2. Frete por transportadora

**Padrão:** `SHIPPING_PROVIDER=mock`. As opções vêm das regras de **Frete e entrega** do painel (faixa de CEP, valor por peso, prazo).

**Interface:** `src/server/providers/shipping/types.ts` (`ShippingProvider.quote`).

### Correios (pronto, falta ligar)

`SHIPPING_PROVIDER=correios` liga preço, prazo e rastreio pelas APIs dos Correios (`api.correios.com.br`: token, preço, prazo e rastro). O código está em `src/server/providers/shipping/correios/` e foi escrito a partir da descrição oficial das APIs (`/token/v3/api-docs`, `/preco/v3/api-docs`, `/prazo/v3/api-docs`, `/srorastro/v3/api-docs`). **Ainda não rodou com credenciais reais**: os testes usam respostas simuladas. A primeira ligação deve ser feita em homologação (`CORREIOS_BASE_URL=https://apihom.correios.com.br`).

**O que é preciso ter:**

1. Contrato com os Correios, com cartão de postagem. Sem contrato, estas APIs não autorizam preço nem rastreio.
2. Usuário do Meu Correios e um código de acesso às APIs, gerado no portal Correios API (cws.correios.com.br). Não é a senha de login.
3. As APIs de preço, prazo e rastro liberadas para o cartão de postagem.
4. Os códigos de serviço do contrato. Os padrões são `03298` (PAC) e `03220` (SEDEX); confira no contrato e ajuste `CORREIOS_SERVICE_ECONOMY` e `CORREIOS_SERVICE_EXPRESS` se forem outros.

As variáveis estão em `.env.example` (`CORREIOS_*`). Com `SHIPPING_PROVIDER=correios`, usuário, código de acesso, cartão de postagem e CEP de origem são obrigatórios e a aplicação não sobe sem eles.

**Como funciona:**

- As regras de **Frete e entrega** continuam mandando no que é da loja: onde cada modalidade é oferecida, entrega hoje, entrega agendada, retirada, frete grátis e itens só locais.
- Nas modalidades nacionais, o valor e o prazo da regra são trocados pelos dos Correios: "econômico" usa o PAC e "expresso" usa o SEDEX. Ao prazo dos Correios soma-se `CORREIOS_HANDLING_DAYS` (dias úteis para separar e postar).
- Frete grátis continua sendo decisão da loja: o cliente paga zero e o valor dos Correios fica como valor original.
- O pacote é estimado pelo peso da variação e pelas medidas do produto (largura, profundidade, altura), com 4 cm de folga. Sem medidas, usa 20 × 20 × 20 cm; sem peso, 300 g. **Cadastre peso e medidas reais**, senão a cotação sai errada.
- Se os Correios estiverem fora do ar ou a autenticação falhar, vale a tabela do painel, para o checkout não parar. Mantenha a tabela com valores realistas.
- Se os Correios responderem que o serviço não atende o envio (CEP, peso, medidas acima de 100 cm por lado ou 200 cm na soma), a modalidade não é oferecida.
- A mesma cotação é reaproveitada por 10 minutos, na memória do servidor.

**Rastreio:**

- Quando o código de rastreio do pedido é dos Correios (duas letras, nove dígitos, duas letras), a movimentação aparece na página do pedido, na área do cliente e no painel.
- A tarefa agendada `rastreio-correios` (a cada 2 horas, em `/api/cron/rastreio-correios`) confere os pedidos enviados e marca como entregues os que têm o evento de entrega. O cliente recebe o e-mail de pedido entregue.

**O que ainda não faz:** gerar a etiqueta e o código de rastreio (API de pré-postagem). Hoje a equipe posta pelo sistema dos Correios e digita o código ao marcar o pedido como enviado.

### Outra transportadora (Melhor Envio, Frenet...)

1. Crie o provider implementando `quote()`, no modelo do `CorreiosShippingProvider`.
2. Registre em `src/server/providers/shipping/index.ts` e acrescente o nome em `SHIPPING_PROVIDER` (`src/lib/env.ts`).

## 3. E-mail

**Hoje:** SMTP por Nodemailer; em desenvolvimento, Mailpit.

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
