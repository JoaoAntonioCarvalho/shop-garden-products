# Pendências do dono da loja

Tudo o que depende de você para o site ir ao ar. Cada item diz onde trocar. A maior parte também pode ser alterada pelo painel, em Configurações, sem mexer no código.

Este arquivo é completado ao longo do projeto. A lista final de marcações `TODO(dono)` e `TODO(integracao)` do código entra no fim.

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

- **Confirmar a execução do `pnpm db:reset`.** O comando apaga e recria o banco de desenvolvimento. O Prisma não deixa um agente rodá-lo sem o seu consentimento explícito. O seed já foi validado sem ele, mas duas correções do seed (30% dos produtos com variações e descrições com no mínimo 300 caracteres) só entram quando o banco for recriado.
- Cupom `FRETEGRATIS`: hoje vale para a entrega agendada na Grande SP, acima de R$ 150. Confirmar.
- Preços, prazos e faixas de CEP de todas as regras de frete são exemplos (`prisma/seed/settings.ts`, ou Admin > Frete).

## Integrações a contratar

## Dados da base antiga

A base antiga de clientes e assinantes **não** deve ser importada para disparos de marketing sem uma campanha de reconfirmação de consentimento (LGPD). Arquivos de importação com dados reais ficam somente na pasta `data-privada/`, que não entra no repositório.
