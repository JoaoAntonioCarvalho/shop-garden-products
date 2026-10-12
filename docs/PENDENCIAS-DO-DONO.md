# Pendências do dono da loja

Tudo o que depende de você para o site ir ao ar. Cada item diz onde trocar. A maior parte também pode ser alterada pelo painel, em Configurações, sem mexer no código.

A lista de marcações `TODO(dono)` e `TODO(integracao)` do código está no fim.

## Dados da empresa

Razão social, CNPJ e endereço já estão preenchidos em produção (Admin > Configurações). Conferir se o endereço está completo, com cidade, estado e CEP.

Razão social, CNPJ e endereço são exigidos no rodapé pelo Decreto 7.962/2013.

## Contatos

Respondidos pela dona em 11/10/2026 e gravados em produção.

| Item                   | Valor atual                                                        | Onde trocar                      |
| ---------------------- | ------------------------------------------------------------------ | -------------------------------- |
| WhatsApp               | 5511955817159, exibido como (11) 95581-7159 (confirmado)           | `whatsapp`, `phoneDisplay`       |
| E-mail                 | contato@netshopgarden.com.br (**pendente**, ver abaixo)            | `email` e `EMAIL_FROM` no `.env` |
| Horário de atendimento | Segunda a sexta, das 9h às 17h. Sábado, das 9h às 14h30            | `businessHours`                  |
| Instagram              | https://www.instagram.com/netshopgarden                            | `instagram`                      |
| Endereço (rodapé)      | Av. República do Líbano, 789, sala 1, Ibirapuera, São Paulo, SP    | `address`                        |
| Retirada na loja       | Av. dos Bandeirantes, 5900, Shopping Garden, São Paulo, até as 18h | Admin > Frete, regra `retirada`  |

- [x] **E-mail de atendimento:** `netshopgarden@gmail.com` (corrigido pela dona em 11/10/2026; o `.br` do final era engano). É também o e-mail que recebe os avisos internos.

## Regras comerciais

Confirmadas pela dona em 11/10/2026.

| Item                    | Valor atual                                                            | Onde trocar                              |
| ----------------------- | ---------------------------------------------------------------------- | ---------------------------------------- |
| Desconto no Pix         | 5%                                                                     | `pixDiscountPercent`                     |
| Parcelamento            | até 6x sem juros, parcela mínima de R$ 50                              | `maxInstallments`, `minInstallmentCents` |
| Frete grátis            | a partir de R$ 399                                                     | `freeShippingThresholdCents`             |
| Embalagem para presente | não há; a opção foi desligada. Cartão com mensagem continua, sem custo | `giftWrapEnabled`                        |
| Entrega no mesmo dia    | não há; regras desligadas                                              | `sameDay`, Admin > Frete                 |
| Cupom de boas-vindas    | `BEMVINDO5`, 5% na primeira compra                                     | `welcomeCoupon`, Admin > Cupons          |
| Bandeiras de cartão     | as que a Cielo aceita                                                  | contrato da Cielo                        |
| Feriados sem entrega    | feriados nacionais                                                     | Admin > Frete > Feriados                 |

## Entrega: o que falta

A dona explicou o funcionamento em 11/10/2026. Já está no site: retirada na loja ligada (inclusive para produto que não é entregue no CEP do cliente), entrega própria de segunda a sexta com data a partir de 3 dias depois do pedido, e os textos de Entrega, Trocas e Ajuda.

- [ ] **Tabela de frete da entrega própria por região.** O site antigo tinha uma faixa de valor para cada região. Hoje há uma regra única de exemplo (R$ 19,90 na Grande São Paulo). Trazer a tabela (print do painel da FastCommerce serve) para cadastrar em Admin > Frete, uma regra por faixa de CEP.
- [ ] **Regras dos Correios do site antigo.** Pegar na FastCommerce o contrato, os serviços e as regras usadas. Os valores do envio nacional no site ainda são de exemplo.
- [x] **Jadlog:** a dona não tem mais os dados de acesso. Produtos volumosos (os marcados "só Jadlog") ficam com entrega própria na Grande São Paulo e retirada; fora dela, o site manda falar pelo WhatsApp. Os 7 que estavam como "todo o Brasil, só Jadlog" passaram a "só entrega local" em 11/10/2026.
- [x] **Prazo de separação:** a confirmação do pedido e o e-mail de pagamento aprovado dizem "Temos até 3 dias úteis para separar e enviar o seu pedido" (texto em Admin > Configurações, "Aviso de prazo na confirmação do pedido"). A escolha de data da entrega própria continua, a partir de 3 dias.
- [x] **Devolução por desistência:** decisão da dona em 11/10/2026: seguir a lei. No arrependimento em 7 dias, o envio de volta é por conta da loja (página de Trocas e FAQ).

## Equipe

- [x] Acessos criados em 11/10/2026: `katia` (dona, papel Administrador) e `staffnet` (equipe, papel Equipe: pedidos, clientes, estoque e preço; sem configurações, frete, usuários nem auditoria). Na tela de entrada basta digitar o nome de usuário: o site completa `@netshopgarden.com.br`. Com senha compartilhada, a auditoria não distingue quem da equipe fez cada alteração. Falta trocar a senha do usuário "Administrador" inicial.
- [ ] Estoque: a dona controla direto no site, em Admin > Estoque (ajuste por produto, em lote e inventário).

## Textos a revisar

- Slogan e texto da parceria com o Shopping Garden (`tagline`, `partnerClaim`): confirmar se continuam válidos.

## Textos a revisar (rascunhos criados no seed)

- **Texto de SEO e FAQ de cada categoria principal** (`prisma/seed/categories.ts`, ou Admin > Categorias): rascunhos escritos para pessoas, sem listas de palavras-chave. Revisar o conteúdo e o tom.
- **Páginas institucionais** (`prisma/seed/pages.ts`, ou Admin > Páginas): Sobre, Entrega e prazos, Pagamentos.
- **Textos jurídicos** (Trocas e devoluções, Política de privacidade, Política de cookies, Termos de uso): versão completa escrita em 10/10/2026 e publicada (`prisma/seed/legal-pages.ts`, ou Admin > Páginas). Não foi revisada por advogado: a revisão continua recomendada. Pontos que dependem da resposta da dona: prazo de 48 horas para avisar avaria e planta em mau estado, reembolso em até 10 dias úteis, cobrança de nova entrega, substituição de itens de arranjo, compra só por maiores de 18 anos. Como a loja é microempresa, a política indica um canal de atendimento em vez de um encarregado de dados (Resolução CD/ANPD 2/2022).
- **Perguntas frequentes da página de Ajuda** (Admin > Ajuda).
- **Texto "Sobre a Net Shop Garden" da home** (Admin > Home).
- **Linha Carol Costa:** a coleção recebeu em 11/10/2026 os 105 produtos ativos com a marca "Carol Costa" (vinda do XML do site antigo). A lista do site antigo não pôde ser lida (firewall): conferir se bate.

## Logo e fotos

- Logo definitivo: hoje é um logotipo em texto. O site antigo bloqueia o download automático: salvar a imagem do logo em `data-privada/` para trocar `public/brand/logo.svg` e o componente `Logo`.
- **Fotos dos produtos:** vieram do site antigo. Muitas têm a marca d'água "PhotoGrid" no canto, fundos diferentes e enquadramento desigual. As 34 da fila "A revisar" já foram refeitas no padrão novo (fundo branco, 4:5, produto centralizado); o mesmo tratamento pode ser aplicado ao catálogo inteiro.
- **Imagens de categorias, ocasiões, coleções e banners:** em 11/10/2026 as ilustrações de teste foram trocadas por composições com fotos de produtos da loja. Podem ser substituídas por fotos em ambiente em Admin > Categorias e Admin > Banners. A seção "A loja online do Shopping Garden" pede uma foto real do Shopping Garden.
- **Depoimentos:** seção desligada, por decisão da dona.
- **Cupons:** só existe `BEMVINDO5` (5% na primeira compra). Os outros foram apagados em 11/10/2026, a pedido da dona.
- **Categorias sem produto** (13) saíram do menu; voltam em Admin > Categorias quando receberem produtos.
- **Nomes e descrições revisados em lote** em 11/10/2026 (`pnpm texts`): caixa alta, acentos, unidades, "enviamos para todo Brasil" fora do nome, prazo de "02 dias úteis" trocado por 3 e o título repetido no começo da descrição removido. O texto original está em `scripts/data/textos-originais.json` (`pnpm texts originais` desfaz). Os códigos do produtor (MDPT15, MDCA21) ficaram nos nomes.
- Fotos do hero (2400 × 1050 no desktop e 1200 × 1500 no celular), das categorias e das ocasiões de presente.

## Decisões de negócio

- **Rodar `pnpm db:reset` no banco de desenvolvimento.** O comando apaga e recria o banco local. O Prisma não deixa um agente rodá-lo sem o seu consentimento explícito, então ele ficou para você. Migrações e seed foram validados do zero em um banco descartável (2,4 s; 160 produtos, 250 pedidos). O banco de desenvolvimento atual ainda tem os dados do seed anterior (285 pedidos e algumas descrições curtas), que só mudam quando ele for recriado.
- Cupom `FRETEGRATIS`: hoje vale para a entrega agendada na Grande SP, acima de R$ 150. Confirmar.
- Preços, prazos e faixas de CEP de todas as regras de frete são exemplos (`prisma/seed/settings.ts`, ou Admin > Frete).

- **Carol Costa:** confirmar se o nome pode ser usado na coleção "Linha Carol Costa" e quais produtos fazem parte dela.
- **Boleto:** hoje não é oferecido para plantas vivas, entrega hoje e entrega agendada em menos de 3 dias úteis. Confirmar.
- **Modo manutenção, cupom de boas-vindas e textos do pop-up:** revisar em Admin > Configurações antes de divulgar o site.

## Antes de ir ao ar

1. Preencher razão social, CNPJ e endereço (obrigatórios no rodapé).
2. Criar o e-mail em domínio próprio e configurar o SMTP com SPF e DKIM.
3. Revisar com advogado: privacidade, cookies, termos e trocas. Informar o nome do encarregado de dados.
4. Cadastrar o catálogo real (Admin > Produtos > Importar CSV aceita a exportação do site antigo) e enviar as fotos.
5. Conferir os redirecionamentos do site antigo em Admin > Redirecionamentos > Testar URL, com uma amostra das URLs mais acessadas (Google Search Console).
6. Remover os dados de teste (Admin > Produtos > Remover todos os produtos de teste).
7. Contratar e ligar o gateway de pagamento (`docs/INTEGRACOES.md`). Sem isso a loja não recebe.
8. Trocar a senha do administrador e convidar a equipe (Admin > Usuários).
9. Agendar as tarefas (`README.md`, "Tarefas agendadas") e definir `CRON_SECRET`.
10. Informar os IDs do Google Analytics e do pixel da Meta, se for usar (Admin > Configurações).

## Catálogo do site antigo

- [ ] Exportar os produtos no painel da FastCommerce, com todas as colunas (inclusive as de imagem), e colocar o arquivo em `data-privada/`. Com ele: `pnpm import:legacy data-privada/arquivo.csv --previa` para conferir e, sem `--previa`, para gravar.
- [ ] Conferir se as fotos do site antigo podem ser baixadas pelo endereço que vem no arquivo. Se o servidor de imagens bloquear, será preciso um arquivo com as fotos.
- [ ] Revisar os produtos em Admin > Curadoria. Em 10/10/2026: 1.031 na loja, 90 na lixeira e **34 na fila "A revisar"** (quase toda a categoria Fibra de coco e os vasos Japi), que ficam lá por decisão da dona.
- [x] Os 3 produtos mantidos sem foto (`409203`, `481618` e `523929`) foram para a lixeira em 10/10/2026. Dá para restaurar em Admin > Curadoria > Lixeira.
- [ ] **Informar o estoque real.** Em 10/10/2026 todos os produtos receberam 10 unidades, como valor provisório para a loja poder vender. Ajustar em Admin > Estoque, ou decidir se a quantidade virá do Bling.
- [x] Redirecionamentos dos 1.031 produtos publicados gravados em produção em 10/10/2026. Se algum produto da fila "A revisar" for publicado depois, rodar de novo `pnpm import:legacy data-privada/prod/xml-products.xml --redirecionamentos`.
- [ ] Criar o repositório privado no GitHub e passar o endereço, para o envio do código e a ligação com a Vercel.

## Integrações a contratar

| Integração               | Situação hoje                         | O que falta                                        |
| ------------------------ | ------------------------------------- | -------------------------------------------------- |
| Gateway de pagamento     | Cielo ligada na loja publicada        | Aviso de pagamento e teste do cartão (ver abaixo)  |
| Transportadora           | Correios e Jadlog prontos, desligados | Credenciais de cada uma (ver abaixo)               |
| E-mail transacional      | Nenhum em produção                    | Criar conta no Resend e configurar o domínio       |
| Armazenamento de imagens | Pasta local                           | Bucket S3 ou R2 em produção                        |
| Nota fiscal              | Não há                                | Ligar ao Bling, que a loja já usa (ver abaixo)     |
| Etiquetas e rastreio     | Código de rastreio digitado no pedido | Depende da transportadora ou do Bling (ver abaixo) |
| WhatsApp Business API    | Links e mensagens copiadas à mão      | Só se quiser mensagens automáticas                 |

O passo a passo de cada uma está em `docs/INTEGRACOES.md`.

### Para ligar a Cielo

O pagamento dentro do site (Pix e cartão) está escrito. Em 10/10/2026 as credenciais de produção da loja foram conferidas na Cielo: a API E-commerce respondeu, o Silent Order Post emitiu o token do cartão e um Pix de R$ 1,00 foi gerado. Desde 10/10/2026 a loja publicada cobra pela Cielo de verdade (`PAYMENT_PROVIDER=cielo` na Vercel); com o modo manutenção ligado, só a equipe logada chega ao checkout.

- [x] **API E-commerce Cielo** habilitada, com `MerchantId` e `MerchantKey`.
- [x] **Pix** autorizado no cadastro (desde 06/08/2024).
- [x] Credenciais do **Silent Order Post** (`ClientId` e `ClientSecret`).
- [x] Nome na fatura do cartão: "NETSHOPGARDEN".
- [x] Pix de teste de R$ 1,00 pago e confirmado pela Cielo (10/10/2026).
- [x] Rede de segurança: com a página do pedido aberta, a loja consulta a Cielo e confirma o Pix mesmo sem o aviso (11/10/2026).
- [ ] Devolução do Pix: a Cielo negou a devolução do teste por falta de saldo na conta Pix ("Merchant with insufficient balance for return"). A dona perguntou à Cielo em 11/10/2026; aguardando resposta. Enquanto isso, devolução de pedido pago com Pix pode aparecer como "falhou" no painel e precisa ser feita por transferência.
- [ ] Fazer uma compra de teste com cartão de verdade e devolver.
- [ ] Novas `MerchantKey` e `ClientSecret` geradas pelo dev em 11/10/2026: falta colocá-las no `.env.vercel` e na Vercel (Settings > Environment Variables: `CIELO_MERCHANT_KEY`, `CIELO_CLIENT_SECRET`) e publicar de novo. Trocar também `CIELO_WEBHOOK_SECRET`, que apareceu na conversa.
- [x] Parcelamento: até 6x sem juros, parcela mínima de R$ 50 (confirmado pela dona). A taxa do parcelamento é da loja.
- [ ] Validade do QR Code do Pix: pela documentação da Cielo, o padrão é 24 horas na integração nova (`Provider: "Cielo2"`, campo `Payment.QrCode.Expiration`, em segundos) e 2 horas na antiga. A loja expira o pedido em 20 minutos e hoje não envia esse campo: quem pagar depois disso tem o pedido expirado e o dinheiro na conta. Enviar o campo e conferir no Pix de teste (não há ambiente de testes para o Pix novo).
- [ ] Antifraude e 3DS (opcionais): o antifraude é contratado à parte (ClearSale ou CyberSource), só para cartão e sem garantia contra chargeback. O 3DS 2.0 é pedido à Cielo para Visa e Mastercard, exige integração no site e passa a fraude autenticada para o banco emissor. Os preços não são públicos: pedir à Cielo.
- [x] URL de notificação na Cielo salva em 11/10/2026, com o endereço da Vercel e o cabeçalho `webhooksecret` (o painel só aceita letras no nome). A Cielo pede cerca de 30 minutos para valer. Trocar a URL quando o domínio definitivo entrar (`docs/INTEGRACOES.md`, seção 1).
- [ ] Depois da URL salva: comprar com Pix e conferir que o pedido muda para pago sozinho.

Boleto deixa de ser oferecido com a Cielo.

### Para ligar o e-mail

A chave do Resend está no `.env.vercel` (variáveis `SMTP_*`). A chave só envia e-mails: o domínio precisa ser cadastrado pelo site do Resend.

- [x] Criar a conta no Resend e trazer a chave de API.
- [ ] No Resend, em Domains, adicionar `netshopgarden.com.br` (região São Paulo) e copiar os registros de DNS.
- [ ] Publicar esses registros no DNS do domínio. Eles ficam em subdomínios (`send` e `resend._domainkey`) e não mexem no e-mail atual.
- [ ] Colocar as variáveis `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `EMAIL_FROM` na Vercel e publicar de novo.

A loja já tem caixas de e-mail no domínio, hospedadas na Locaweb (registros MX). O Resend só envia os e-mails automáticos; as respostas dos clientes continuam chegando na Locaweb.

### Domínio e DNS

O domínio `netshopgarden.com.br` está no registro.br, mas o DNS é servido pela Rumo (`buzios.rumo.com.br` e `leblon.rumo.com.br`), a empresa do site antigo. Registros vistos em 10/10/2026: site em `201.20.10.204`, e-mail na Locaweb (4 registros MX, `pop`, `smtp`, `imap`, `mail`, `webmail`, `autodiscover`), SPF com Locaweb, Rumo e Dinamize, e `innlink` apontando para a Dinamize (newsletter).

Decisão do dono em 10/10/2026: passar o DNS para o registro.br, sem depender da Rumo, e hospedar na Vercel no plano Pro. A zona nova, montada pelos registros públicos:

| Tipo  | Nome                   | Valor                                                                             |
| ----- | ---------------------- | --------------------------------------------------------------------------------- |
| A     | (raiz)                 | `201.20.10.204` até a virada; depois, o valor que a Vercel indicar                |
| CNAME | `www`                  | `netshopgarden.com.br` até a virada; depois, o valor que a Vercel indicar         |
| MX    | (raiz)                 | `mx.a`, `mx.b` e `mx.core.locaweb.com.br` (prioridade 10), `mx.jk` (20)           |
| TXT   | (raiz)                 | `v=spf1 mx include:_spf.locaweb.com.br include:innlink.netshopgarden.com.br ~all` |
| CNAME | `pop`                  | `mail.ita.locaweb.com.br`                                                         |
| CNAME | `smtp`, `imap`, `mail` | `pop.netshopgarden.com.br`                                                        |
| CNAME | `webmail`              | `webmail-seguro.com.br`                                                           |
| CNAME | `autodiscover`         | `autodiscover.email.locaweb.com.br`                                               |
| CNAME | `innlink`              | `netshopgarden.com.br.dnzdns.com` (Dinamize; tirar se não usar mais)              |
| TXT   | `resend._domainkey`    | chave DKIM mostrada no Resend                                                     |
| CNAME | `rsend`                | `rsend-sae1.forge.rmta.net`                                                       |
| CNAME | `send`                 | `send.forge.rmta.net`                                                             |
| TXT   | `_dmarc`               | `v=DMARC1; p=none;`                                                               |

- [ ] **No dia da virada** (decisão de 11/10/2026: não trocar antes, para o site novo entrar de uma vez): trocar para o DNS do registro.br e criar os registros acima, começando pelo A, pelo `www` e pelos quatro MX. O e-mail automático do site só funciona depois disso. Só os registros públicos foram vistos: se a Locaweb tiver uma chave DKIM própria, ela precisa ser copiada do painel da Locaweb.
- [ ] Passar a Vercel para o plano Pro antes de vender.
- [ ] Apontar o domínio para a hospedagem nova, definir `APP_URL`, trocar a URL de notificação na Cielo e desligar o modo manutenção.

### Para ligar os Correios

A integração de preço, prazo e rastreio está escrita e testada com respostas simuladas, mas nunca rodou com credenciais reais. Para ligar:

- [ ] Contrato com os Correios e número do cartão de postagem.
- [ ] Usuário do Meu Correios e código de acesso às APIs (gerado no portal Correios API).
- [ ] Liberar as APIs de preço, prazo e rastro para o cartão de postagem.
- [ ] Confirmar os códigos do PAC e do SEDEX do contrato (padrões: `03298` e `03220`).
- [ ] CEP de onde os pedidos são postados.
- [ ] Peso e medidas reais nos produtos (a cotação usa esses dados).
- [ ] Primeiro teste em homologação, depois produção. Passo a passo em `docs/INTEGRACOES.md`, seção 2.

### Para ligar a Jadlog

Também escrita e testada só com respostas simuladas. Para ligar:

- [ ] Pedir à franquia Jadlog os dados de acesso da API: token, código do cliente e conta corrente.
- [ ] Confirmar com a Jadlog o código das modalidades contratadas (econômico e, se houver, expresso) e o fator de cubagem.
- [ ] Marcar como "só Jadlog" os produtos que os Correios não aceitam (aba Entrega do produto) e, se forem plantas enviadas para fora da Grande São Paulo, mudar "Onde entrega" para todo o Brasil.
- [ ] Peso e medidas reais nesses produtos: na Jadlog o peso cubado pesa muito no preço de volumosos.

### Para lembrar: etiquetas e rastreio automático

O rastreio automático está feito para os Correios (movimentação no pedido e baixa automática de entregue), e entra em uso quando a integração for ligada. Continua faltando gerar a etiqueta: hoje a equipe posta pelo sistema dos Correios e digita o código de rastreio ao marcar o pedido como enviado. Para automatizar é preciso decidir por onde as etiquetas vão sair:

- [ ] Pelo Bling (se a nota fiscal for por ele, a logística do Bling gera a etiqueta e devolve o rastreio), ou
- [ ] Pela API de pré-postagem dos Correios, ligada direto à loja, ou por outro serviço de frete (Melhor Envio, Frenet).

Depois da escolha, o trabalho é gerar a etiqueta ao iniciar a preparação e gravar o código de rastreio no pedido sozinho.

### Para lembrar: nota fiscal pelo Bling

A loja antiga já emitia pelo Bling. O caminho recomendado é manter o Bling como emissor e ligar a loja nova a ele (roteiro em `docs/INTEGRACOES.md`, seção 5). Para isso o dono precisa trazer:

- [ ] Acesso à conta do Bling e confirmação de que o plano inclui a API.
- [ ] Cadastro do aplicativo no Bling (gera o client id e o client secret).
- [ ] Confirmar com a contabilidade que o certificado digital e a configuração fiscal no Bling estão em dia.
- [ ] Decidir quem manda no cadastro de produtos e no estoque: o Bling ou a loja. Os SKUs precisam ser iguais nos dois.
- [ ] NCM e origem de cada produto (se o Bling já tem, basta manter os SKUs iguais).

## Dados da base antiga

A base antiga de clientes e assinantes **não** deve ser importada para disparos de marketing sem uma campanha de reconfirmação de consentimento (LGPD). Arquivos de importação com dados reais ficam somente na pasta `data-privada/`, que não entra no repositório.

## Marcações no código

### `TODO(dono)`: valores e textos a confirmar

| Onde                                          | O quê                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/config/store.config.ts` (linhas 61 a 95) | Slogan, razão social, CNPJ, endereço, WhatsApp, telefone, e-mails, horário, Instagram, frase da parceria, desconto do Pix, parcelas, frete grátis, embalagem, entrega hoje (corte, dias, CEPs, hora limite), cupom de boas-vindas e texto de embalagem. Todos também editáveis em Admin > Configurações |
| `src/components/store/logo.tsx`               | Logo definitivo                                                                                                                                                                                                                                                                                         |
| `prisma/seed/pages.ts`                        | Textos das páginas institucionais; os jurídicos são modelos                                                                                                                                                                                                                                             |
| `prisma/seed/settings.ts`                     | Preços, prazos e faixas de CEP do frete; texto institucional da home                                                                                                                                                                                                                                    |

### `TODO(integracao)`: pontos de provedor real

| Onde                                     | O quê                                             |
| ---------------------------------------- | ------------------------------------------------- |
| `src/server/providers/payment/cielo.ts`  | Conferir o aviso de pagamento e o cartão          |
| `src/server/providers/shipping/index.ts` | Cotação real de frete                             |
| `src/server/providers/email/index.ts`    | Envio por API (Resend, SES), se não for usar SMTP |
| `src/server/services/rate-limit.ts`      | Redis ou Upstash, para tráfego alto               |
