# Especificação, parte 2: categorias, regras de negócio, loja e conta (seções 8, 9, 10, 11)

## 8.1 Árvore de categorias e URLs antigas

Caminho novo = `/categoria/` + path. Todas as URLs antigas viram `Redirect` 301. Negrito = categoria principal.

| Categoria                        | path                                            | URLs antigas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Plantas naturais**             | `plantas-naturais`                              | `/decoracao/plantas-naturais`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Orquídeas                        | `plantas-naturais/orquideas`                    | `/decoracao/orquideas-naturais-86355227`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Plantas ornamentais              | `plantas-naturais/plantas-ornamentais`          | `/decoracao/plantas-17881412`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Flores em vasos                  | `plantas-naturais/flores-em-vasos`              | `/decoracao/flores-79302615`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Cactos e suculentas              | `plantas-naturais/cactos-e-suculentas`          | `/decoracao/cactus`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Ervas e temperos                 | `plantas-naturais/ervas-e-temperos`             | `/decoracao/ervas-e-temperos`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Caixarias                        | `plantas-naturais/caixarias`                    | `/decoracao/caixarias`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Arranjos**                     | `arranjos`                                      | `/decoracao/arranjos-44071597`, `/landing-arranjos-artificiais.html`, `/mobile-arranjos-artificiais.html`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Arranjos artificiais             | `arranjos/arranjos-artificiais`                 | `/decoracao/arranjos-artificiais`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Vasos**                        | `vasos`                                         | `/decoracao/vasos`, `/landingVasos.html`, `/mobile-Vasos.html`, `/vasos-resumo.html`, `/landing-vasos-para-jardins.html`, `/mobile-vasos-para-jardins.html`                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Cerâmica e barro                 | `vasos/ceramica-e-barro`                        | `/decoracao/vasos-ceramica`, `/landingVasosCeramica.html`, `/mobile-VasosCeramica.html`, `/VasosCeramica.html`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Porcelana                        | `vasos/porcelana`                               | `/landingVasosPorcelana.html`, `/mobile-VasosPorcelana.html`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Vidro                            | `vasos/vidro`                                   | `/landingVasosVidros.html`, `/mobile-VasosVidros.html`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Fibra de coco                    | `vasos/fibra-de-coco`                           | `/decoracao/vasos-fibra-coco`, `/landingVasosFibraDeCoco.html`, `/mobile-VasosFibraDeCoco.html`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Plástico                         | `vasos/plastico`                                | `/decoracao/plastico-76250857`, `/landingVasosDePlastico.html`, `/mobile-VasosDePlastico.html`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Polietileno e reciclados         | `vasos/polietileno-e-reciclados`                | `/decoracao/vasos-material-reciclado`, `/landingVasosReciclados.html`, `/mobile-VasosReciclados.html`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Vasos decorativos                | `vasos/vasos-decorativos`                       | `/flores-artificiais-vasos-para-decoracao`, `/landingVasosDecorativos.html`, `/mobile-VasosDecorativos.html`, `/landing-vasos-decorativos.html`, `/mobile-vasos-decorativos.html`                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Acessórios para vasos            | `vasos/acessorios`                              | `/decoracao/acessorios-vasos-plantas`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Cachepots**                    | `cachepots`                                     | `/decoracao/cachepot`, `/cachepot.html`, `/mobile-cachepot.html`, `/cachepots-resumo.html`, `/linktopCachepot.html`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Autoirrigáveis                   | `cachepots/autoirrigaveis`                      | `/decoracao/autoirrigavel`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Cerâmica                         | `cachepots/ceramica`                            | `/decoracao/cachepot-ceramica`, `/cachepotCeramica.html`, `/cachepots-ceramica.html`, `/landingCachepotCeramica.html`, `/mobile-CachepotCeramica.html`, `/linktopCachepotCeramica.html`                                                                                                                                                                                                                                                                                                                                                                                                              |
| Porcelana                        | `cachepots/porcelana`                           | `/landingCachepotPorcelana.html`, `/mobile-CachepotPorcelana.html`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Metal e alumínio                 | `cachepots/metal-e-aluminio`                    | `/decoracao/cachepot-metal-aluminio`, `/cachepot-aluminio.html`, `/cachepotAluminio.html`, `/landingCachepotAlumino.html`, `/mobile-CachepotAlumino.html`, `/linktopCachepotMetal.html`                                                                                                                                                                                                                                                                                                                                                                                                              |
| Vidro                            | `cachepots/vidro`                               | `/decoracao/cachepot-vidro`, `/linktopCachepotVidro.html`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Madeira                          | `cachepots/madeira`                             | `/decoracao/cachepot-madeira`, `/cachepotMadeira.html`, `/landingCachepotMadeira.html`, `/mobile-CachepotMadeira.html`, `/linktopCachepotMadeira.html`                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Cestaria                         | `cachepots/cestaria`                            | `/decoracao/cestaria-56907290`, `/linktopCachepotCestaria.html`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Plástico                         | `cachepots/plastico`                            | `/landingCachepotPlastico.html`, `/mobile-CachepotPlastico.html`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Flores e plantas artificiais** | `flores-e-plantas-artificiais`                  | `/decoracao/flores-artificiais`, `/linktopFloresArtificiais.html`, `/ltArtificiais.html`, `/landing-flores-artificiais-porque-sao-tao-amadas.html`, `/mobile-flores-artificiais-porque-sao-tao-amadas.html`, `/landing-flores-artificiais-como-limpar.html`, `/mobile-flores-artificiais-como-limpar.html`, `/landing-flores-artificiais-como-fixar-no-vaso.html`, `/mobile-flores-artificiais-como-fixar-no-vaso.html`, `/landing-flores-artificiais-arranjos-para-eventos-casamentos-e-outras-ocasioes.html`, `/mobile-flores-artificiais-arranjos-para-eventos-casamentos-e-outras-ocasioes.html` |
| Plantas e flores artificiais     | `flores-e-plantas-artificiais/plantas-e-flores` | `/decoracao/plantas-artificiais-77187746`, `/landing-plantas-artificiais-e-folhagens.html`, `/mobile-plantas-artificiais-e-folhagens.html`                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Buquês                           | `flores-e-plantas-artificiais/buques`           | `/landing-buque.html`, `/mobile-buque.html`, `/landing-flores-artificiais-como-montar-um-buque.html`, `/mobile-flores-artificiais-como-montar-um-buque.html`                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Vasos com flores artificiais     | `flores-e-plantas-artificiais/vasos-com-flores` | `/landing-vasos-de-flores-artificiais-para-decoracao.html`, `/mobile-vasos-de-flores-artificiais-para-decoracao.html`, `/MiBAstArtRosa.html`                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Decoração e aromas**           | `decoracao-e-aromas`                            | `/decoracao/objetos-de-decoracao`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Objetos de decoração             | `decoracao-e-aromas/objetos-de-decoracao`       | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Aromas L'Envie                   | `decoracao-e-aromas/aromas-lenvie`              | `/decoracao/aromas-77161807`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Linha Conceito                   | `decoracao-e-aromas/linha-conceito`             | `/decoracao/linha-conceito`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Jardinagem** (secundária)      | `jardinagem`                                    | `/decoracao/jardinagem`, `/landing-jardinagem.html`, `/landingMeuPrimeiroJardim.html`, `/mobile-MeuPrimeiroJardim.html`, `/landing-jardim-suspenso.html`, `/mobile-jardim-suspenso.html`                                                                                                                                                                                                                                                                                                                                                                                                             |
| Ferramentas e acessórios         | `jardinagem/ferramentas-e-acessorios`           | `/decoracao/ferramentas-para-jardinagem`, `/landing-jardinagem-enxada.html`, `/landing-jardinagem-garfo.html`, `/landing-jardinagem-pa.html`, `/landing-jardinagem-tesoura-de-poda.html`, `/landing-jardinagem-luvas-de-jardinagem.html`, `/landing-jardinagem-ferramenta-de-transplantar.html`, `/landing-jardinagem-como-transplantar.html`                                                                                                                                                                                                                                                        |
| Adubos e fertilizantes           | `jardinagem/adubos-e-fertilizantes`             | `/decoracao/adubos-fertilizantes`, `/landing-jardinagem-adubos-e-fertilizantes.html`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Substratos                       | `jardinagem/substratos`                         | `/decoracao/substratos-69965762`, `/landing-jardinagem-substratos.html`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Produtos para plantio            | `jardinagem/produtos-para-plantio`              | `/decoracao/produtos-para-plantio-50213259`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Defensivos                       | `jardinagem/defensivos`                         | `/decoracao/defensivos-61774844`, `/landing-jardinagem-inseticidas-e-repelentes.html`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Irrigação                        | `jardinagem/irrigacao`                          | `/decoracao/jardim-irrigacao`, `/landing-jardinagem-irrigacao-mangueira-regador.html`, `/landing-jardinagem-irrigacao-pulverizador.html`                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Menu principal, nesta ordem: Plantas naturais, Orquídeas (atalho para a subcategoria), Arranjos, Vasos, Cachepots, Flores e plantas artificiais, Decoração e aromas, Jardinagem, Presentes (ocasiões), Novidades (coleção).

## 8.2 Coleções

| Coleção             | Caminho                      | Regra                                     | URL antiga                                           |
| ------------------- | ---------------------------- | ----------------------------------------- | ---------------------------------------------------- |
| Novidades           | `/colecao/novidades`         | publicados nos últimos 45 dias ou `isNew` | `/listaprodutos.asp?avancada=true&Adicional1=238944` |
| Linha Carol Costa   | `/colecao/linha-carol-costa` | manual                                    | `/listaprodutos.asp?avancada=true&Adicional1=232116` |
| Mais vendidos       | `/colecao/mais-vendidos`     | `salesCount30d`                           | —                                                    |
| Arranjos sob medida | `/colecao/sob-medida`        | explicação + botão de WhatsApp + produtos | —                                                    |

## 8.3 Redirecionamentos

- Tabela `Redirect` com todos os pares acima (301). O proxy consulta com cache em memória (atualizado a cada poucos minutos ou invalidado pelo admin) e incrementa `hits` sem atrasar a resposta.
- Regras por padrão: `/listaprodutos.asp?...&Texto=xxx` → `/busca?q=xxx`; `...Adicional1=ID` → coleção mapeada, senão `/colecao/novidades`; `/track.asp...` → `/rastreio`; `/cadastro.asp...` → `/conta`; `?IDLoja=...&mob=true` → mesma página sem esses parâmetros; `/QuemSomos.htm` → `/sobre`; `/Ajuda.htm` → `/ajuda`; `/Depoimentos.htm` e `/Depoimentos2020.htm` → `/avaliacoes`; produto antigo sem mapa → `/busca?q=` com termos do caminho.
- Admin gerencia redirecionamentos e vê "404 mais acessados" (`NotFoundLog`), criando redirecionamento com um clique.

## 8.4 SEO das categorias (seed)

Por categoria principal: descrição curta (até 200), texto de 250 a 450 palavras com H2/H3 e sem lista de palavras-chave, FAQ de 4 a 6 perguntas reais ("Orquídea precisa de sol direto?", "Qual a diferença entre vaso e cachepot?", "Como limpar flores artificiais?", "Plantas naturais são entregues fora de São Paulo?"). Marcar como rascunho para revisão nas pendências do dono. Aproveitar os temas úteis das landings antigas: como limpar e fixar artificiais, como transplantar, jardim suspenso, como escolher vasos decorativos.

## 9. Regras de negócio (serviços puros em `src/server/services/`, com testes)

### 9.1 Preço

- Efetivo: `promoPriceCents` dentro de `promoStartsAt`/`promoEndsAt`, senão `priceCents`.
- "De": `compareAtPriceCents` (ou `priceCents` com promoção ativa), só se maior que o efetivo. Percentual arredondado para baixo.
- Pix: efetivo menos `pixDiscountPercent`; meio centavo arredonda para cima.
- Parcelas: até `maxInstallments` sem juros respeitando `minInstallmentCents`. "ou 6x de R$ 41,50 sem juros". Se só couber 1, só o preço à vista.
- Única função `getPriceDisplay(variant, settings)` para card, produto, sacola e checkout.

### 9.2 Cupons (validar nesta ordem, mensagem específica em cada)

1. Existe e está ativo: "Este cupom não existe. Confira se digitou corretamente."
2. Período: "Este cupom expirou em 10/09/2026."
3. Limite total.
4. Limite por cliente (userId ou e-mail).
5. Primeira compra: nenhum pedido pago anterior para o e-mail ou CPF.
6. Subtotal mínimo: "Faltam R$ 32,00 para usar este cupom."
7. Categorias e produtos: desconto só nos itens elegíveis.

Um cupom por pedido. Cupom antes do Pix. Com `combinableWithPix` falso, aplica o maior e mostra qual. `FREE_SHIPPING` só zera métodos elegíveis (não o mesmo dia, salvo configuração). Uso só conta quando o pedido é pago; cancelamento estorna.

### 9.3 Estoque

- Criação do pedido: transação interativa, `SELECT ... FOR UPDATE` nas variantes via `$queryRaw`, confere disponível, incrementa `stockReserved`, movimento `RESERVE`. Se faltar em qualquer item, nada é reservado e a mensagem indica item e quantidade disponível.
- Pago: `stockOnHand -= q`, `stockReserved -= q`, `SALE`.
- Cancelado ou expirado antes de pagar: `stockReserved -= q`, `RELEASE`.
- Cancelado após pagar, com devolução marcada pelo admin: `stockOnHand += q`, `RETURN`.
- Ajuste manual: `IN`, `OUT`, `ADJUSTMENT`, `LOSS`, motivo obrigatório.
- Disponível ≤ `lowStockThreshold`: alerta. Disponível 0: "Esgotado" com "Avise-me quando chegar" (cria `Lead` com origem e produto).
- Sacola não reserva. Ao abrir a sacola e no checkout revalida; se ajustar, avisa o que mudou.
- Teste de concorrência obrigatório: duas criações simultâneas para a última unidade, só uma vence.

### 9.4 Frete (mock)

```ts
interface ShippingProvider {
  quote(input: {
    cep: string;
    items: Array<{
      variantId: string;
      quantity: number;
      weightGrams: number;
      sameDayEligible: boolean;
      deliveryScope: "LOCAL_ONLY" | "NATIONAL";
    }>;
    subtotalCents: number;
    now: Date;
  }): Promise<ShippingOption[]>;
}
type ShippingOption = {
  code: string;
  name: string;
  priceCents: number;
  originalPriceCents: number;
  isFree: boolean;
  minDays: number;
  maxDays: number;
  deliveryDate?: string;
  requiresScheduling: boolean;
  availableDates?: string[];
  description: string;
};
```

- Entrega hoje (capital): CEP nas faixas, todos os itens `sameDayEligible`, antes do corte, dia de entrega, não feriado. Exemplo R$ 29,90. "Receba hoje até 20h".
- Agendada Grande SP: CEP 01000-000 a 09999-999. Data nos próximos 14 dias úteis (sem domingos e feriados) e período manhã ou tarde. Exemplo R$ 19,90; grátis acima do limite.
- Nacional econômico e expresso: qualquer CEP válido; base + valor por kg; prazo pela região (primeiro dígito do CEP). Indisponível com itens `LOCAL_ONLY`: "Plantas naturais, orquídeas e arranjos naturais são entregues apenas na Grande São Paulo. Remova esses itens para ver opções de envio para o seu CEP."
- Retirada na loja: opcional, desligada, grátis.
- Valores e faixas são exemplos editáveis (`TODO(dono)`).
- `/api/cep/[cep]`: ViaCEP com timeout de 3s e cache; falha não bloqueia (preenchimento manual).
- Calculadora no produto, na sacola e no checkout, mesmo serviço.

### 9.5 Status do pedido

| Status                            | Próximos                                                                |
| --------------------------------- | ----------------------------------------------------------------------- |
| `PENDING_PAYMENT`                 | `PAID`, `CANCELED`, `EXPIRED`                                           |
| `PAID`                            | `PREPARING`, `CANCELED` (estorno)                                       |
| `PREPARING`                       | `READY_FOR_PICKUP`, `SHIPPED`, `OUT_FOR_DELIVERY`, `CANCELED` (estorno) |
| `READY_FOR_PICKUP`                | `DELIVERED`                                                             |
| `SHIPPED`                         | `DELIVERED`, `RETURNED`                                                 |
| `OUT_FOR_DELIVERY`                | `DELIVERED`, `PREPARING`                                                |
| `DELIVERED`                       | `RETURNED`                                                              |
| `CANCELED`, `EXPIRED`, `RETURNED` | —                                                                       |

Única função `transitionOrder(orderId, toStatus, { userId, note, notifyCustomer })`: valida, aplica efeitos (estoque, cupom, pagamento, datas), grava `OrderStatusHistory` e `AuditLog`, envia e-mail se `notifyCustomer`. Transição inválida lança erro claro; coberto por testes.

### 9.6 Pagamentos (mock)

```ts
interface PaymentProvider {
  createPixCharge(order: OrderForPayment): Promise<PixChargeResult>;
  createCardCharge(
    order: OrderForPayment,
    card: CardToken,
    installments: number,
  ): Promise<CardChargeResult>;
  createBoleto(order: OrderForPayment): Promise<BoletoResult>;
  getStatus(externalId: string): Promise<PaymentStatus>;
  refund(externalId: string, amountCents: number): Promise<RefundResult>;
  parseWebhook(request: Request): Promise<WebhookEvent>;
}
```

- Pix: payload fictício (prefixo `000201`, id do pedido e texto `MOCK`), QR com `qrcode`, expira em `pixExpirationMinutes`, começa `PENDING`.
- Cartão: formulário no navegador gera token simulado `mock_tok_...` só com bandeira e últimos 4. Número, validade e CVV nunca vão ao servidor. Luhn, bandeira por prefixo e validade no cliente. Final `0000` aprovado, `0002` recusado por saldo, `0005` recusado por suspeita de fraude (documentar na tela fora de produção e no README). `// TODO(integracao): substituir pelo SDK de tokenização do gateway`.
- Boleto: linha digitável fictícia, vencimento em 3 dias úteis, página `/pedido/[numero]/boleto` com "Documento de teste, sem valor".
- Webhook `/api/webhooks/payments/[provider]` com HMAC.
- Simulador (`ENABLE_PAYMENT_SIMULATOR=true`, fora de produção): bloco "Ambiente de teste" na confirmação com "Simular Pix pago", "Simular pagamento recusado", "Simular expiração", chamando o webhook.
- Admin: "Marcar como pago manualmente" em Pix pendente, com observação obrigatória e auditoria.
- Boleto indisponível com "Entrega hoje", com agendada em menos de 3 dias úteis e com perecíveis; mostrar o motivo.

### 9.7 E-mails (React Email, fundo creme, cabeçalho musgo, botão vinho, versão texto, teste de renderização; todo envio grava `EmailLog`)

1. Pedido recebido (instruções de Pix ou boleto). 2. Pagamento aprovado. 3. Pagamento recusado (link para tentar de novo). 4. Pix expirado (link para refazer com a mesma sacola). 5. Em preparação. 6. Enviado (rastreio) ou saiu para entrega. 7. Entregue (convite para avaliar cada item). 8. Cancelado. 9. Boas-vindas com cupom e link de confirmação (double opt-in). 10. Criação de conta e verificação de e-mail. 11. Redefinição de senha. 12. Produto de volta ao estoque. 13. Carrinho abandonado (manual pelo admin, ou job desligado). 14. Internos: novo pedido pago, nova solicitação, nova mensagem de contato, resumo diário de estoque baixo.

## 10. Loja

Cada página: skeleton, vazio, erro, metadados, eventos de analytics.

### 10.1 Layout global

- **Barra superior** (`moss-700`, creme, 36px, 13px): até três mensagens (banner `TOP_BAR` ou configuração), lado a lado no desktop, uma por vez no mobile com troca manual. Padrão: "Entrega hoje em São Paulo para pedidos até 14h", "5% de desconto no Pix", "Frete grátis na Grande SP acima de R$ 299" (valores da configuração).
- **Cabeçalho** (`cream-50`, borda `line`, fixo, versão compacta 64px): logo em texto (Cormorant 600 `moss-700` com folha SVG de traço fino; `public/brand/logo.svg` e componente `Logo`); busca central com placeholder "Buscar orquídeas, vasos, arranjos..."; conta (menu "Entrar", "Criar conta" ou "Meus pedidos", "Favoritos", "Sair"), favoritos com contador, sacola com contador vinho que abre o mini-carrinho; menu principal abaixo.
- **Mega menu**: abre no hover com 150ms ou por clique e teclado (Enter, setas, Esc); fecha com atraso. Subcategorias em colunas, "Ver tudo em [categoria]", imagem editorial com legenda. `aria-expanded`, foco gerenciado.
- **Menu mobile**: botão à esquerda, logo ao centro, sacola à direita, busca abaixo. Gaveta com categorias em acordeão, conta, rastreio, ajuda, WhatsApp, redes.
- **Busca com sugestões**: a partir de 2 caracteres, debounce 250ms, até 6 produtos (miniatura, nome, preço) e 3 categorias; `unaccent` + `pg_trgm` em nome, nome científico, tags, SKU, categoria; Enter vai a `/busca?q=`; grava `SearchLog`.
- **Mini-carrinho** (gaveta direita no desktop, inferior no mobile): itens com miniatura, nome, variante, preço, quantidade, remover; barra "Faltam R$ 45,10 para frete grátis na Grande SP"; subtotal, preço no Pix, "Ver sacola" e "Finalizar compra". Ao adicionar: abre com "Adicionado à sacola" e 2 complementares.
- **WhatsApp flutuante**: canto inferior direito, musgo, texto "Fale com a gente" no desktop. Mensagens: home "Olá! Vim pelo site e gostaria de ajuda."; produto "Olá! Tenho uma dúvida sobre [nome] ([URL])." com `?utm_source=site&utm_medium=whatsapp_button&utm_content=[página]` na URL; sacola "Olá! Estou finalizando uma compra e tenho uma dúvida.". Oculto no checkout. Evento `whatsapp_click` com posição.
- **Rodapé** (`moss-700`, creme; faixa `moss-900`): newsletter "Receba novidades e 10% na primeira compra" (e-mail, WhatsApp opcional, consentimento obrigatório com link para a privacidade). Colunas: Loja; Ajuda (Ajuda, Entrega e prazos, Trocas e devoluções, Pagamentos, Rastrear pedido, Não encontrou o que procura?); Institucional (Sobre, Avaliações, Política de privacidade, Política de cookies, Termos de uso); Atendimento (WhatsApp, e-mail, horário). Pagamentos em SVG monocromático creme, desenhados (Pix, Visa, Mastercard, Elo, American Express, Hipercard, boleto). Faixa inferior: razão social, CNPJ, endereço, "Parceira oficial de e-commerce do Shopping Garden", ano. Link "Preferências de cookies".
- **Cookies**: barra inferior com "Aceitar todos", "Recusar opcionais", "Personalizar" (necessários; análise; marketing). 12 meses. Scripts só após consentimento.
- **Pop-up de boas-vindas**: uma vez a cada 14 dias, após 25s ou 50% de rolagem ou intenção de saída no desktop. Nunca em checkout, sacola, conta e institucionais. Desktop: modal com foto à esquerda; mobile: folha inferior até 70%. "Ganhe 10% na primeira compra", e-mail, WhatsApp opcional, consentimento, "Quero meu cupom". Depois mostra o código com "Copiar código" e avisa do e-mail. Cria `Lead` com consentimento e UTM. Fecha por Esc, botão e clique fora; foco preso.

### 10.2 Home (seções configuráveis por `HomeSection` e `Banner`, nesta ordem)

1. Hero editorial: foto em largura total (16:7 desktop, 4:5 mobile), texto em HTML. Título "Plantas, orquídeas e arranjos escolhidos a dedo, entregues hoje em São Paulo." Subtítulo "Curadoria Shopping Garden desde 1999." Botões "Ver orquídeas" e "Pedir arranjo sob medida" (WhatsApp). Legenda em ficha botânica reduzida. Mais de um banner: setas e indicadores manuais.
2. Diferenciais: quatro itens em linha sem cards (entrega hoje em São Paulo; embalagem própria para plantas e peças frágeis; 5% de desconto no Pix; curadoria Shopping Garden). Rolagem horizontal no mobile.
3. Categorias em destaque: grade assimétrica de 6 (Orquídeas maior, duas linhas; Plantas naturais, Arranjos, Vasos, Cachepots, Flores e plantas artificiais). Nome em Cormorant sobre faixa creme na base.
4. Mais vendidos: 8 produtos (vendas de 30 dias; sem dados, destaques). 4 colunas no desktop, rolagem no mobile. "Ver todos".
5. Para presentear: Aniversário, Agradecimento, Casa nova, Condolências, Datas especiais → `/presentes/[ocasiao]`. "Incluímos um cartão com a sua mensagem, sem custo."
6. Herança Shopping Garden: foto grande e texto em prosa: "Somos a loja online do Shopping Garden, centro de jardinagem e decoração de São Paulo desde 1999. Cada planta e cada peça passa pela curadoria de quem trabalha com isso há mais de duas décadas." Botão "Conheça a nossa história".
7. Novidades: 4 produtos.
8. Avaliações: 3 depoimentos com nota, nome e cidade, média geral e total. "Ver todas as avaliações".
9. Para quem cuida do jardim: faixa compacta com subcategorias de Jardinagem em lista com ícones.
10. Newsletter com foto botânica. Oculta para quem já se cadastrou (cookie).
11. Sobre a Net Shop Garden: até 150 palavras visíveis e "Ler mais".

### 10.3 Categoria (`/categoria/[...path]`) e coleção (`/colecao/[slug]`)

Breadcrumb com JSON-LD; H1, descrição, chips de subcategorias com contagem; banner `CATEGORY_TOP`; contagem, ordenação (Relevância, Mais vendidos, Menor preço, Maior preço, Novidades, Melhor avaliados) e "Filtrar" no mobile. Filtros por `filtersConfig`:

- Todos: faixa de preço (slider + campos), em estoque, entrega hoje, em promoção, avaliação mínima.
- Plantas: luminosidade, ambiente, pet friendly, nível de cuidado, porte.
- Vasos e cachepots: material, cor, altura (faixas), diâmetro da boca (faixas), furo de drenagem, uso.
- Artificiais: tipo (planta, flor, buquê, arranjo), com ou sem vaso, cor.
- Jardinagem: tipo de produto, marca.

Filtros na URL (`?preco=50-150&material=ceramica&ordem=menor-preco&pagina=2`); com filtros: `noindex, follow` e canonical para a categoria. Grade 2/3/4 colunas, 24 por página, paginação numerada. Vazio: "Nenhum produto com esses filtros", "Limpar filtros", sugestões. Depois: texto de SEO e FAQ em acordeão com JSON-LD `FAQPage`.

### 10.4 Card de produto

Foto 4:5 em branco; hover troca para a segunda foto. Até dois selos por prioridade: Esgotado, Promoção (-15%), Entrega hoje, Novo, Últimas unidades. Coração com `aria-label` e `aria-pressed`. Nome (Inter 15px, 2 linhas), nome científico em itálico, nota e contagem, preço, "de" riscado, "R$ X no Pix" em `moss-700`. Uma variante disponível: botão discreto "Adicionar"; várias: "Escolher opções". Card inteiro clicável por pseudo-elemento.

### 10.5 Produto (`/produto/[slug]`)

Desktop: galeria ~58% à esquerda, informações sticky à direita. Mobile: carrossel e depois informações.

1. Breadcrumb. 2. Galeria: miniaturas verticais, tela cheia com zoom, teclado, fotos por variante, `next/image` com `sizes`, primeira com prioridade. 3. Título H1, nome científico, nota com link, SKU. 4. Preço: "de" e percentual, atual, "R$ X no Pix (5% de desconto)", "ou 6x de R$ Y sem juros". 5. Variantes: botões, esgotadas desabilitadas e riscadas, amostra de cor. 6. Quantidade, "Adicionar à sacola", "Comprar agora". 7. Disponibilidade: "Em estoque", "Últimas 2 unidades", "Esgotado" com "Avise-me quando chegar". 8. Entrega hoje: "Peça nas próximas 2h14min e receba hoje em São Paulo" (calculado no cliente após hidratar; corte, dias, feriados). 9. Calculadora de frete; "Não sei meu CEP" (Correios, nova aba). 10. "Vai presentear? Inclua um cartão com sua mensagem no carrinho, sem custo." 11. WhatsApp com nome e URL. 12. Ficha botânica ou técnica. 13. Acordeões: Descrição, Cuidados, Entrega e embalagem, Trocas e devoluções. 14. Combina com: até 4 (`relatedProductIds`; senão planta → cachepots e substratos; vaso → plantas; arranjo → arranjos da mesma faixa). 15. Avaliações: resumo, distribuição, lista paginada (nome, cidade, data, nota, texto, "Compra verificada", resposta), formulário para logados ou por link do e-mail; tudo entra pendente. 16. Vistos recentemente: até 6 (`localStorage` com tratamento de erro). 17. Barra fixa no mobile com preço e "Adicionar à sacola". 18. JSON-LD `Product` (offers, aggregateRating, review, brand, sku, imagens) e `BreadcrumbList`. 19. Arquivado: 410 ou "Este produto não está mais disponível" com similares (registrar decisão). Rascunho: 404 ao público; admin vê com faixa "Pré-visualização".

### 10.6 Busca (`/busca?q=`)

Grade e filtros da categoria. "Resultados para "termo"" com contagem. Sem resultados: "Não encontramos "termo"", termos parecidos, categorias populares e formulário "Não encontrou o que procura? Conte para a gente que buscamos para você" (`ProductRequest`). `noindex`.

### 10.7 Presentes (`/presentes`, `/presentes/[ocasiao]`)

Ocasiões e produtos `isGiftable` pela tag. Destaque para cartão grátis, embalagem para presente e entrega no mesmo dia.

### 10.8 Sacola (`/carrinho`)

Itens (foto, nome, variante, preço, quantidade, total, remover com "Desfazer" por 5s, "Mover para favoritos"); avisos de estoque ("A quantidade de Vaso Terracota M foi ajustada para 2, que é o que temos disponível"); frete grátis; "Incluir cartão com mensagem" (grátis, 240 caracteres com contador) e "Embalagem para presente"; cupom; estimativa de frete; resumo (subtotal, desconto, frete ou "Calcule acima", total, total no Pix); "Finalizar compra" e "Continuar comprando"; "Complete com" (4). Vazia: mensagem, "Ver mais vendidos", categorias.

### 10.9 Checkout (`/checkout`)

Layout próprio: logo (confirma saída se houver dados), "Compra segura" discreta com cadeado, ajuda por WhatsApp. Desktop: etapas 65% e resumo fixo. Mobile: resumo recolhível ("Ver resumo: R$ 289,90"). Etapa concluída vira resumo com "Alterar".

1. **Identificação**: e-mail primeiro; se tem conta, "Entrar para usar seus endereços salvos" ou "Continuar sem entrar". Nome, CPF, celular. "Quero receber novidades e ofertas por e-mail" desmarcada. E-mail salvo no carrinho.
2. **Entrega**: endereço salvo ou novo; CEP com autopreenchimento; "É um presente para outra pessoa" (nome e telefone); opções da 9.4; agendada com calendário acessível e período; aviso de `LOCAL_ONLY` com botão de remover itens.
3. **Pagamento**: Pix padrão "Pague R$ 275,40 no Pix (economize R$ 14,50)"; cartão (número com bandeira, nome, validade, CVV, parcelas); boleto com motivo quando indisponível.
4. **Revisão**: tudo, mais "Li e aceito os termos de uso e a política de trocas" obrigatório. "Fazer pedido" com carregamento e bloqueio de duplo clique.

Técnico: Zod no cliente e no servidor. Server action: recarrega carrinho, recalcula preço, valida cupom, recalcula frete, reserva estoque, cria pedido com snapshots, cria cobrança, grava UTM e canal, converte o carrinho, redireciona. Idempotência gerada ao abrir a revisão. Divergência (preço, cupom, estoque, frete) interrompe e mostra o que mudou. Eventos `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`. Dados do formulário persistem no carrinho (nunca cartão).

### 10.10 Confirmação (`/pedido/[numero]?token=...`)

Acesso por `accessToken` ou conta; sem token pede o e-mail. "Pedido NSG-000123 recebido". Pix pendente: QR grande, "Copiar código Pix" ("Código copiado"), contagem regressiva, 3 passos, verificação a cada 5s, troca para "Pagamento aprovado". Cartão: aprovado, ou motivo e "Tentar outro pagamento" (nova cobrança, mesmo pedido). Boleto: linha com copiar, "Abrir boleto", prazo. Linha do tempo. Resumo. Sem conta: "Crie sua senha para acompanhar seus pedidos". WhatsApp "Enviar dúvida sobre o pedido NSG-000123". Bloco "Ambiente de teste".

### 10.11 Rastreio (`/rastreio`)

Número e e-mail → status, linha do tempo, rastreio com link, previsão. Limite por IP.

### 10.12 Institucionais (editáveis; jurídicos marcados "MODELO: revisar com advogado")

`/sobre` (curadoria, parceria, embalagem, atendimento); `/entrega` (modalidades, regiões, prazos, corte, agendada, plantas só na Grande SP, ausência); `/trocas-e-devolucoes` (7 dias, art. 49 CDC; avaria com fotos em 48h; plantas vivas); `/pagamentos`; `/ajuda` (FAQ por grupo: Pedidos, Entrega, Pagamento, Trocas, Cuidados com plantas; busca; `FAQPage`); `/contato` (nome, e-mail, telefone, pedido opcional, assunto, mensagem); `/avaliacoes`; `/solicitar-produto` (descrição, orçamento, foto opcional, contato); `/privacidade`, `/cookies`, `/termos`. 404 com busca, categorias e mais vendidos. 500 objetiva.

### 10.13 Microcopy

Próximo, elegante, direto; voz ativa; sentence case. Botões dizem o que acontece e mantêm o nome ("Adicionar à sacola" → "Adicionado à sacola"). Erros explicam e orientam, sem desculpas nem termos técnicos: "Este CEP não foi encontrado. Confira os números ou preencha o endereço manualmente." Vazio convida: "Você ainda não tem favoritos. Toque no coração dos produtos para guardá-los aqui." Proibido: "Seja bem-vindo", "Clique aqui", "Submit", caixa alta, exclamações em excesso, "a melhor loja", "100% seguro".

## 11. Autenticação e conta

- Rotas: `/entrar`, `/criar-conta`, `/esqueci-a-senha`, `/redefinir-senha/[token]`, `/verificar-email/[token]`.
- Criar conta: nome, e-mail, senha (mínimo 8, indicador de força), celular opcional, consentimento desmarcado. Conta funciona antes da verificação, com aviso.
- Login: 5 tentativas por e-mail e IP a cada 15 minutos, sem revelar se o e-mail existe.
- Redefinição: token de uso único, hash, 1 hora.
- Login mescla o carrinho anônimo (soma quantidades, respeita estoque).
- Papel verificado no proxy e dentro de cada server action e route handler do admin.
- `/conta`: Visão geral; Pedidos (lista, detalhe, "Pagar agora", "Comprar novamente", "Avaliar produtos", "Preciso de ajuda"); Endereços; Favoritos; Dados pessoais (trocar e-mail exige senha e nova verificação); Senha; Comunicação (opt-in/out com data); Privacidade ("Baixar meus dados" em JSON; "Excluir minha conta" cria `DataRequest`, admin processa, dados anonimizados e pedidos mantidos por obrigação fiscal).
