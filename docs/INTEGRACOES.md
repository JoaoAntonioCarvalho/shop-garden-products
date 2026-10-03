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

**Hoje:** `SHIPPING_PROVIDER=mock`. As opções vêm das regras de **Frete e entrega** do painel (faixa de CEP, valor por peso, prazo). A entrega local (hoje e agendada) continua por essas regras mesmo com uma transportadora ligada.

**Interface:** `src/server/providers/shipping/types.ts` (`ShippingProvider.quote`).

**Para ligar (Melhor Envio, Correios, Frenet...):**

1. Crie o provider implementando `quote()`: recebe CEP, itens (peso, dimensões) e subtotal, e devolve as opções.
2. Registre em `src/server/providers/shipping/index.ts`. `src/server/services/shipping.ts` continua aplicando frete grátis, itens só locais e feriados.
3. Cadastre peso e dimensões reais nos produtos: a nota de qualidade do cadastro aponta os que faltam.
4. Etiquetas e rastreio automático ficam fora desta versão. Hoje o código de rastreio é digitado no pedido.

## 3. E-mail

**Hoje:** SMTP por Nodemailer; em desenvolvimento, Mailpit.

**Produção:** qualquer SMTP transacional (Amazon SES, Resend, Brevo, Postmark). Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `EMAIL_FROM`, e publique SPF, DKIM e DMARC no domínio. Para usar uma API em vez de SMTP, implemente `EmailProvider` em `src/server/providers/email`.

E-mail marketing em massa não faz parte da loja. Para campanhas, exporte os leads com consentimento ativo (**Leads › Exportar CSV**) para uma ferramenta própria, que precisa respeitar o descadastro.

## 4. Armazenamento de imagens

`STORAGE_DRIVER=s3` com `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` e `S3_PUBLIC_URL`. Funciona com Amazon S3, Cloudflare R2 e MinIO. Em desenvolvimento, `docker compose --profile storage up -d` sobe um MinIO.

Ao migrar de `local` para `s3`, copie a pasta `uploads/` para o bucket mantendo os caminhos.

## 5. Nota fiscal

Fora do escopo. O ponto de encaixe é a transição para `PAID` em `src/server/services/orders.ts` (depois do commit, junto dos e-mails): chamar o emissor (Bling, Tiny, NFe.io, eNotas) com os dados do pedido. O pedido já guarda CPF, endereço, itens com SKU e valores em centavos. Faltaria cadastrar NCM e origem nos produtos.

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
