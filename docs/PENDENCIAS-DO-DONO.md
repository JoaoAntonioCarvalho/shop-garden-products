# Pendências do dono da loja

Tudo o que depende de você para o site ir ao ar. Cada item diz onde trocar. A maior parte também pode ser alterada pelo painel, em Configurações, sem mexer no código.

A lista de marcações `TODO(dono)` e `TODO(integracao)` do código está no fim.

## Dados da empresa

| Item              | Valor atual          | Onde trocar                                                          |
| ----------------- | -------------------- | -------------------------------------------------------------------- |
| Razão social      | [RAZÃO SOCIAL]       | `src/config/store.config.ts` → `legalName`, ou Admin > Configurações |
| CNPJ              | [00.000.000/0001-00] | `cnpj`                                                               |
| Endereço completo | [Endereço completo]  | `address`                                                            |

Razão social, CNPJ e endereço são exigidos no rodapé pelo Decreto 7.962/2013.

## Contatos

| Item                   | Valor atual                                                                    | Onde trocar                      |
| ---------------------- | ------------------------------------------------------------------------------ | -------------------------------- |
| WhatsApp               | 5511955817159, exibido como (11) 95581-7159                                    | `whatsapp`, `phoneDisplay`       |
| E-mail                 | contato@netshopgarden.com.br (sugestão em domínio próprio; precisa ser criado) | `email` e `EMAIL_FROM` no `.env` |
| Horário de atendimento | Segunda a sexta, das 9h às 17h (confirmar sábado)                              | `businessHours`                  |
| Instagram              | [URL]                                                                          | `instagram`                      |

## Regras comerciais

Todos os valores abaixo são exemplos.

| Item                            | Valor atual                                         | Onde trocar                              |
| ------------------------------- | --------------------------------------------------- | ---------------------------------------- |
| Desconto no Pix                 | 5%                                                  | `pixDiscountPercent`                     |
| Parcelamento                    | até 6x sem juros, parcela mínima de R$ 30           | `maxInstallments`, `minInstallmentCents` |
| Frete grátis                    | acima de R$ 299, entrega local e econômica nacional | `freeShippingThresholdCents`             |
| Embalagem para presente         | R$ 15                                               | `giftWrapPriceCents`                     |
| Entrega no mesmo dia            | pedidos até 14h, segunda a sábado, capital de SP    | `sameDay`                                |
| Cupom de boas-vindas            | BEMVINDO10, 10% na primeira compra                  | `welcomeCoupon`                          |
| Preços e faixas de CEP do frete | exemplos                                            | Admin > Frete                            |
| Feriados sem entrega            | feriados nacionais                                  | Admin > Frete > Feriados                 |

## Textos a revisar

- Slogan e texto da parceria com o Shopping Garden (`tagline`, `partnerClaim`): confirmar se continuam válidos.

## Textos a revisar (rascunhos criados no seed)

- **Texto de SEO e FAQ de cada categoria principal** (`prisma/seed/categories.ts`, ou Admin > Categorias): rascunhos escritos para pessoas, sem listas de palavras-chave. Revisar o conteúdo e o tom.
- **Páginas institucionais** (`prisma/seed/pages.ts`, ou Admin > Páginas): Sobre, Entrega e prazos, Pagamentos.
- **MODELO: revisar com advogado** antes de publicar: Trocas e devoluções, Política de privacidade, Política de cookies, Termos de uso. Na política de privacidade falta o nome do encarregado de dados.
- **Perguntas frequentes da página de Ajuda** (Admin > Ajuda).
- **Texto "Sobre a Net Shop Garden" da home** (Admin > Home).
- **Linha Carol Costa:** confirmar a descrição da coleção e quais produtos fazem parte dela.

## Logo e fotos

- Logo definitivo: hoje é um logotipo em texto. Trocar `public/brand/logo.svg` e o componente `Logo`.
- **Fotos reais dos produtos: é a melhoria de maior impacto visual.** Hoje todas as imagens são ilustrações de teste geradas pelo seed. Padrão recomendado: fundo branco, luz natural, proporção 4:5, e uma foto em ambiente para cada produto de destaque. Enviar por Admin > Produtos > Imagens.
- Fotos do hero (2400 × 1050 no desktop e 1200 × 1500 no celular), das categorias e das ocasiões de presente.

## Decisões de negócio

- **Rodar `pnpm db:reset` no banco de desenvolvimento.** O comando apaga e recria o banco local. O Prisma não deixa um agente rodá-lo sem o seu consentimento explícito, então ele ficou para você. Migrações e seed foram validados do zero em um banco descartável (2,4 s; 160 produtos, 250 pedidos). O banco de desenvolvimento atual ainda tem os dados do seed anterior (285 pedidos e algumas descrições curtas), que só mudam quando ele for recriado.
- Cupom `FRETEGRATIS`: hoje vale para a entrega agendada na Grande SP, acima de R$ 150. Confirmar.
- Preços, prazos e faixas de CEP de todas as regras de frete são exemplos (`prisma/seed/settings.ts`, ou Admin > Frete).

- **Carol Costa:** confirmar se o nome pode ser usado na coleção "Linha Carol Costa" e quais produtos fazem parte dela.
- **Boleto:** hoje não é oferecido para plantas vivas, entrega hoje e entrega agendada em menos de 3 dias úteis. Confirmar.
- **Embalagem para presente e mensagem do cartão:** confirmar se a loja oferece e o preço.
- **Retirada na loja:** a regra existe, desligada. Ligar em Admin > Frete se houver retirada.
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

## Integrações a contratar

| Integração               | Situação hoje                           | O que falta                                                 |
| ------------------------ | --------------------------------------- | ----------------------------------------------------------- |
| Gateway de pagamento     | Simulado (Pix, cartão, boleto)          | Escolher o gateway e implementar o provider                 |
| Transportadora           | Simulada, pelas regras de Admin > Frete | Contratar (Melhor Envio, Correios) e implementar o provider |
| E-mail transacional      | SMTP local (Mailpit)                    | Contratar um SMTP e configurar o domínio                    |
| Armazenamento de imagens | Pasta local                             | Bucket S3 ou R2 em produção                                 |
| Nota fiscal              | Não há                                  | Emissor (Bling, Tiny, NFe.io) e NCM dos produtos            |
| WhatsApp Business API    | Links e mensagens copiadas à mão        | Só se quiser mensagens automáticas                          |

O passo a passo de cada uma está em `docs/INTEGRACOES.md`.

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

| Onde                                                | O quê                                             |
| --------------------------------------------------- | ------------------------------------------------- |
| `src/server/providers/payment/index.ts` e `mock.ts` | Registrar o provider do gateway real              |
| `src/components/store/checkout/card-form.tsx`       | Trocar a tokenização simulada pelo SDK do gateway |
| `src/server/providers/shipping/index.ts`            | Cotação real de frete                             |
| `src/server/providers/email/index.ts`               | Envio por API (Resend, SES), se não for usar SMTP |
| `src/server/services/rate-limit.ts`                 | Redis ou Upstash, para tráfego alto               |
