# Registro de decisões

Formato: data, decisão, motivo.

## 2026-10-03 — Versões das bibliotecas

Conferidas no registro do npm antes do setup.

- **Prisma 7.10 em vez da tag `latest`.** A tag `latest` do pacote `prisma` aponta para `8.0.0-rc.19`, uma versão candidata. A última estável é a 7.10.0 (tag `prev`, mesma versão do `@prisma/client`). A especificação pede versões estáveis.
- **Auth.js: `next-auth@beta` (5.0.0-beta.32).** A especificação pede NextAuth v5. A tag `latest` do pacote ainda é a v4; a v5 continua publicada como beta. É a versão recomendada pela documentação do Auth.js para o App Router.
- **pnpm 12.8.1** instalado via corepack (não havia pnpm na máquina).
- **Node 22.22.2** (o que está instalado).

## 2026-10-03 — Execução

- **Docker Desktop foi iniciado por mim** porque o daemon estava parado e a fase 0 exige Postgres e Mailpit.
- **Outro projeto do dono (`meuacessor`) sobe junto com o Docker Desktop** e ocupa as portas 3000 e 3001 em `127.0.0.1`. Não mexi nesses contêineres.

## 2026-10-03 — Fase 0

- **Porta 3100 em vez de 3000.** A 3000 está ocupada pelo projeto `meuacessor` (acima). `pnpm dev` e `pnpm start` usam `--port 3100` e `APP_URL` aponta para `http://localhost:3100`. Para voltar à 3000, trocar nos scripts do `package.json` e no `.env`.
- **Next.js 16.3: `src/proxy.ts` em vez de `src/middleware.ts`.** O Next 16 renomeou a convenção `middleware` para `proxy` (função exportada `proxy`, runtime Node.js). Tudo o que a especificação atribui ao middleware (proteção de rotas, redirecionamentos legados, captura de UTM) fica em `src/proxy.ts`.
- **Next.js 16: APIs de requisição assíncronas** (`cookies()`, `headers()`, `params`, `searchParams`) e `revalidateTag(tag, perfil)` com segundo argumento obrigatório; em server actions do admin usar `updateTag(tag)` para a alteração aparecer na hora.
- **Next.js 16: `next build` não roda mais o lint.** O lint roda só por `pnpm lint`.
- **A documentação do Next que vale é a que vem no pacote**, em `node_modules/next/dist/docs/` (ver `AGENTS.md`). Consultar antes de usar uma API do framework.
- **TypeScript 6.0 em vez da 7.0.** O `typescript-eslint` (usado pelo `eslint-config-next`) só aceita TypeScript abaixo da 6.1.
- **ESLint 9 em vez da 10**, que é o que o `create-next-app` 16.3 instala com o `eslint-config-next`.
- **Prisma 7: arquivo de configuração `prisma7.config.ts`** (nome gerado pelo `prisma init` da 7.10), gerador `prisma-client` com saída em `src/generated/prisma` (fora do git, gerado no `postinstall`) e conexão por driver adapter (`@prisma/adapter-pg`). O Prisma 7 não carrega o `.env` sozinho: o arquivo de configuração e os scripts importam `dotenv/config`.
- **`prisma migrate reset` não roda mais o seed automaticamente no Prisma 7**, por isso `db:reset` chama `pnpm db:seed` em seguida.
- **Banco `netshopgarden_test`** criado pelo `docker/postgres-init.sql` para os testes que precisam de Postgres (estoque e concorrência).
- **Rota `/api/health`** (faz `SELECT 1`), usada pelo Playwright para saber quando o servidor está pronto.
- **Dependências entram na fase em que são usadas** (shadcn, Tiptap, Recharts, Auth.js etc.), não todas na fase 0.

## 2026-10-03 — Fase 1

- **Paleta padrão do Tailwind desligada** (`--color-*: initial` no `@theme`). Só existem os tokens da marca, o que impede cores fora do design system. Os tokens do admin (shadcn) serão mapeados para os mesmos tokens na fase 6.
- **Borda dos campos de formulário em `moss-500`, não em `line`.** A cor `line` sobre branco não atinge 3:1, exigido para contorno de controles (WCAG 1.4.11). `line` fica para divisores.
- **`Select`, `Checkbox`, `Radio` e `Switch` são controles nativos estilizados**, não Radix. São acessíveis sem JavaScript e melhores no celular. Radix é usado onde há comportamento complexo: modal, gaveta, acordeão, abas, dica, aviso e mega menu (`NavigationMenu`, que já entrega atraso de 150ms, teclado e `aria-expanded`).
- **Cabeçalho fixo sem JavaScript.** A linha principal (logo, busca, ícones) tem 64px e fica fixa; a barra superior e a linha de categorias rolam com a página. É a "versão compacta de 64px" da especificação, sem ouvir o evento de rolagem.
- **Ícones de pagamento são um componente React** (`src/components/store/icons.tsx`), não arquivos em `public/brand`, porque precisam herdar a cor do texto (creme no rodapé). São desenhos próprios e neutros.
- **Ícone do WhatsApp é um desenho próprio em traço fino**; o `lucide-react` não tem ícones de marcas.
- **Nome científico no card de produto usa Inter itálico 13px**, porque a regra da tipografia proíbe Cormorant abaixo de 22px. Na ficha botânica e na legenda do hero é Cormorant itálico (20px e 22px).
- **`Skeleton` não tem animação**, seguindo a regra de animação só em resposta a ação do usuário.
- **Parcela exibida é o preço dividido pelo número de parcelas, arredondado ao centavo mais próximo.**
- **`ShippingCalculator`, `CouponField` e `NewsletterForm` recebem server actions por propriedade.** O cálculo nunca acontece no navegador; as ações reais entram nas fases 4 e 7. A página `/dev/design-system` usa ações de demonstração.
- **Ações do card de produto (adicionar e favoritar) são registradas por `registerCardActions`**, para o card não depender dos módulos de carrinho e favoritos (fases 4 e 5).
- **`src/config/category-tree.ts` guarda a árvore de categorias** (nome e slug). Alimenta o menu enquanto o catálogo não vem do banco e será a base do seed.
- **`scripts/screenshots.ts`** tira screenshots em 390, 768 e 1440 px e avisa de estouro horizontal e erros no console. Usado nas revisões visuais.
- **`pnpm typecheck` roda `next typegen` antes do `tsc`**, porque o Next 16 gera os tipos de rota (`LayoutProps`, `PageProps`).
- **Prettier com `tailwindStylesheet`** apontando para `globals.css`, para o plugin do Tailwind ordenar as classes conhecendo os tokens da marca.

## 2026-10-03 — Fase 2

- **`prisma migrate reset` exige consentimento explícito do dono.** O Prisma detecta que foi chamado por um agente e recusa a ação destrutiva. Não contornei. O seed foi validado com `pnpm db:seed` em banco recém-migrado e vazio (20s) e rodado de novo para conferir a idempotência (1,3s, nada duplicado). `pnpm db:reset` continua sendo o comando documentado para humanos.
- **Campos acrescentados ao modelo da especificação**, todos para cumprir requisitos de outras seções:
  - `Product.searchText` (texto de busca sem acento, com índice `pg_trgm`), `minPriceCents` e `totalAvailable` (desnormalizados para ordenar e filtrar listagens com poucas consultas), `subtype`, `includesPot`, `cleaningCare` (filtros e ficha técnica de artificiais).
  - `Order.shippingCity`/`shippingState` (relatório por região), `costCents` e `OrderItem.unitCostCents` (margem), `manualPaymentLabel` (pedido manual), `purchaseTrackedAt` (evento `purchase` uma única vez), `cartId`.
  - `OrderNote` (notas internas com autor e data), `NotFoundLog`, `SearchLog`, `RateLimitHit`.
  - `Lead.productId`/`variantId`/`notifiedAt` e origem `BACK_IN_STOCK` ("Avise-me"), `confirmTokenHash` e `unsubscribeToken` (double opt-in e descadastro em um clique).
  - `Cart.checkoutData` (dados do checkout em andamento, nunca cartão), `shippingCep`, `contactedAt`, `recoveryEmailSentAt`.
  - `Banner` com segundo botão e legenda científica; `HomeSection.key` e `body`, e tipos `FEATURED_CATEGORIES`, `BENEFITS`, `ABOUT` (a home da seção 10.2 tem essas seções); `Collection.content` e `legacyPaths`; `Coupon.appliesToSameDay` e `batch`; `ShippingRule.usesStoreFreeThreshold` e `description`; `User.isActive`; `EmailVerificationToken.newEmail`.
- **Garantias no banco, por SQL na migração:** `stockOnHand >= 0`, `stockReserved >= 0` e `stockReserved <= stockOnHand`; nota da avaliação entre 1 e 5; quantidade do item do carrinho maior que zero. Mesmo com um erro na aplicação, o banco recusa estoque negativo.
- **Função `f_unaccent`** (versão imutável de `unaccent`) e sequência `order_number_seq` criadas na migração inicial.
- **Textos com `{{marcadores}}`** (`{{corte}}`, `{{descontoPix}}`, `{{freteGratis}}`, `{{telefone}}`...) em páginas, FAQ, banners e seções da home. São preenchidos na exibição com a configuração da loja, para que nenhum prazo, desconto ou contato fique escrito no conteúdo.
- **Marcas fictícias nos produtos de jardinagem de teste** (Verdejar, Terra Viva, Folha Nova), para não atribuir produtos inventados a fabricantes reais. L'Envie, Linha Conceito e Linha Carol Costa vêm da especificação.
- **Storage S3 sem SDK:** `src/server/providers/storage/s3.ts` assina as requisições com SigV4 usando só `node:crypto` e `fetch`. Funciona com S3, R2 e MinIO e não acrescenta dependência.
- **Imagens placeholder em `uploads/amostra/`**, geradas uma vez e reaproveitadas nas execuções seguintes do seed. O `next/image` usa a versão de 1600 px como origem.
- **Logins de teste:** `cliente@example.com` / `Cliente@123` e `expedicao@example.com` / `Equipe@123`. O admin usa `ADMIN_EMAIL` e `ADMIN_PASSWORD` do `.env`; a senha só é gravada na criação.
- **Seed não sobrescreve o que já existe** (categorias, páginas, cupons, regras de frete usam `upsert` com `update: {}`), para não desfazer edições do admin.

## 2026-10-03 — Fase 3

- **Cache com `unstable_cache` e tags, sem Cache Components.** O Next 16 recomenda a diretiva `use cache`, mas ela exige ligar `cacheComponents`, que muda o modelo de renderização do app inteiro. A especificação aceita `unstable_cache` com tags, que continua disponível. Tags: `settings`, `categories`, `catalog`, `home`, `pages` e `product:[slug]`. No Next 16, `revalidateTag` pede um segundo argumento (perfil); nas ações do admin usar `updateTag`.
- **`unstable_cache` devolve datas como texto.** As funções em cache retornam objetos simples, com datas em ISO; quem consome converte.
- **Listagens filtram e ordenam em memória sobre um índice leve em cache.** `getCatalogIndex()` carrega uma linha enxuta por produto ativo (uma consulta, em cache, renovada a cada 5 minutos ou quando o admin altera o catálogo). Categoria, coleção, busca e vitrines filtram, ordenam, contam facetas e paginam em funções puras (`catalog-filters.ts`, com testes) e só então buscam os cards da página (uma consulta, sem cache, para o estoque estar certo). Cada listagem faz no máximo 2 consultas. Serve bem até dezenas de milhares de produtos; acima disso, mover os filtros para SQL.
- **Busca:** `searchText` normalizado (nome, nome científico, nome popular, tags, SKU, categoria, material, marca) com `pg_trgm`. Cada palavra do termo precisa aparecer por trecho exato ou por `word_similarity >= 0.45`. "orquidia branca" encontra orquídeas brancas.
- **Produto arquivado mostra "Este produto não está mais disponível" com produtos parecidos**, com `noindex`, em vez de responder 410. Mantém o visitante na loja. Produto em rascunho responde 404; a pré-visualização para o admin entra na fase 6.
- **Hero com `<picture>` e `getImageProps`**, para o celular baixar só a imagem 4:5 e o desktop só a 16:7.
- **Texto do hero sobre um painel creme sólido** no desktop e abaixo da foto no celular: contraste garantido com qualquer imagem.
- **Grade de categorias da home em 12 colunas:** orquídeas ocupa metade e duas linhas; ao lado, duas categorias em cima e três embaixo.
- **Filtros navegam a cada mudança** (`router.replace` sem rolar a página). O estado vive só na URL, no formato da especificação (`?preco=50-150&material=ceramica&ordem=menor-preco&pagina=2`).
- **Botões "Adicionar à sacola" e "Comprar agora" e a calculadora de frete do produto** recebem as ações do carrinho na fase 4.
- **"Escrever avaliação"** aponta para `/conta/avaliar/[slug]`, criado na fase 5 (exige login ou link do e-mail).
- **Limite de requisições baseado no banco** (`RateLimitHit`, janela fixa), atrás da interface `RateLimiter`.

## 2026-10-03 — Fase 4

- **Uma única conta de totais** (`computeTotals`) para sacola, checkout e criação do pedido. O cupom entra antes do Pix; o desconto do Pix incide sobre os produtos (subtotal menos cupom), nunca sobre frete e embalagem.
- **Cupom que não acumula com Pix:** pagando por Pix vale o maior dos dois descontos, e o checkout mostra os dois valores e qual foi aplicado. No cartão e no boleto o cupom vale normalmente.
- **Cupom de frete grátis vale para a entrega agendada** (Grande SP). Para a entrega no mesmo dia só com `appliesToSameDay`. Não zera o envio por transportadora.
- **O cupom por categoria vale para as subcategorias.**
- **Sacola no banco, com cookie httpOnly `nsg_cart`.** Não reserva estoque: ao abrir a sacola, o mini-carrinho e o checkout a disponibilidade é revalidada e os ajustes são avisados.
- **Estado da sacola no navegador:** um `CartProvider` com o contador e a gaveta; todo cálculo vem das server actions.
- **`placeOrder` recalcula tudo no servidor** (preço, cupom, frete, estoque) e compara com o total que o cliente viu. Qualquer diferença interrompe o envio e lista o que mudou. A chave de idempotência nasce ao abrir a revisão.
- **Reserva de estoque e criação do pedido na mesma transação**, com `SELECT ... FOR UPDATE` nas variantes, sempre em ordem de id para evitar deadlock.
- **`transitionOrder` bloqueia a linha do pedido** antes de validar a transição: webhook e admin simultâneos entram em fila. Estorno no gateway, cache e e-mails acontecem depois do commit; uma falha neles não desfaz o status.
- **Cartão aprovado passa pelo mesmo caminho do webhook** (`applyPaymentEvent`), que é idempotente. Um pagamento encerrado só pode mudar para estornado: um Pix pago depois da expiração não reabre o pedido.
- **Troca de meio de pagamento em nova tentativa recalcula o total** (o desconto do Pix depende do meio).
- **Expiração de Pix e boleto:** além da tarefa agendada (fase 6), a página e a API de status do pedido expiram a cobrança vencida na hora da consulta.
- **Webhook do mock assinado com HMAC-SHA256** usando `PAYMENT_WEBHOOK_SECRET` ou, na falta, `AUTH_SECRET`. O simulador faz uma chamada HTTP real ao webhook.
- **Cartões de teste válidos pelo algoritmo de Luhn:** 4000 0000 0002 0000 (aprovado), 4000 0000 0000 0002 (saldo), 4000 0000 0007 0005 (fraude). Qualquer outro final é aprovado.
- **Calendário da entrega agendada é um grupo de opções** com as 14 datas disponíveis, em vez de um calendário de mês: acessível por teclado e sem datas inválidas para escolher.
- **Evento `purchase` uma única vez:** o servidor marca `purchaseTrackedAt` na primeira exibição da confirmação e só nessa vez envia os dados do evento.
- **E-mail nunca derruba a compra:** `sendEmail` grava `EmailLog` (enviado ou falhou) e não lança erro.
- **ViaCEP com cache em memória de 24h e tempo limite de 3s.** Falha ou `VIACEP_ENABLED=false` só desligam o autopreenchimento.
- **Relógio fixável nos testes e2e:** fora de produção, o cookie `nsg_test_now` fixa o horário das cotações e do pedido, para testar a entrega no mesmo dia antes do corte. Em produção é ignorado (`src/server/clock.ts`).
- **Testes de integração** rodam contra o banco `netshopgarden_test` (migrações aplicadas por `migrate deploy` no início) e substituem `next/cache` e `server-only` por módulos vazios.
- **Login dentro do checkout e "Mover para favoritos"** entram na fase 5, com a autenticação. Hoje o checkout avisa quando o e-mail já tem conta e oferece o link para entrar.
