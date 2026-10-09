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

## 2026-10-03 — Fase 5

- **Sessão em JWT com o papel, mas o papel é conferido no banco a cada requisição** (`getCurrentUser`). Rebaixar ou desativar um usuário vale na hora, sem esperar o token expirar.
- **Proteção em três camadas:** `src/proxy.ts` barra `/conta` e `/admin` sem sessão; cada página chama `requireAccountUser`; cada server action chama `requireUser`.
- **Pedidos feitos como convidado só entram na conta depois de o e-mail ser confirmado** (ou depois de redefinir a senha pelo link do e-mail). Sem isso, alguém poderia criar uma conta com o e-mail de outra pessoa e ver os pedidos dela.
- **Mensagens que não revelam se um e-mail tem conta:** login ("E-mail ou senha incorretos"), esqueci a senha, troca de e-mail. O tempo de resposta do login também é igual, com um hash de comparação quando o e-mail não existe.
- **Login limitado a 5 tentativas por e-mail e IP a cada 15 minutos.**
- **Tokens de verificação (24h) e de redefinição (1h) guardados só como hash SHA-256**, de uso único. Usar um link de redefinição invalida os demais.
- **Ao sair, o cookie do carrinho é apagado**, para o carrinho da conta não ficar no navegador. Ao entrar, o carrinho anônimo é somado ao da conta, respeitando o estoque.
- **Exclusão de conta é um pedido (`DataRequest`)** que o admin processa na fase 6. A anonimização apaga dados pessoais, endereços, favoritos, tokens e leads, e mantém os pedidos sem identificação.
- **"Baixar meus dados" grava auditoria** (`customer.self_export`).
- **Avaliação pelo link do e-mail** funciona sem login (número e token do pedido). O nome exibido é o primeiro nome e a inicial do sobrenome. Uma avaliação por produto por cliente.
- **Checkout de cliente logado** vem com nome, e-mail, CPF, celular e endereço padrão preenchidos, e um seletor de endereços salvos. O login dentro do checkout é um link para `/entrar` que volta ao checkout.
- **"Mover para favoritos" na sacola** entrou depois da fase 8 (ver "Depois da entrega").
- **`verifyCredentials` fica em `src/lib/credentials.ts`**, separado do Auth.js, para ser testável.

## 2026-10-03 — Fase 6

- **Log de argumentos das server actions desligado** (`logging.serverFunctions: false` no `next.config.ts`). Em desenvolvimento o Next registrava os argumentos de cada ação, o que incluía senhas do login e do cadastro e dados pessoais do checkout.
- **shadcn/ui só no admin**, em `src/components/admin/ui`, com os tokens do shadcn (`primary`, `muted`, `destructive`...) mapeados para as cores da marca no `@theme`: musgo como cor principal, vinho só em ações destrutivas e alertas.
- **TanStack Table v9** (API nova: `useTable` e `tableFeatures`). A tabela usa no navegador só a seleção de linhas; ordenação, filtros e paginação acontecem no servidor e ficam na URL. As células são renderizadas no servidor e passadas prontas.
- **Toda server action do admin passa por `runAdmin`** (`src/server/admin/action.ts`): confere a permissão no servidor, valida com Zod e entrega um `audit()` já com usuário, IP em hash e navegador.
- **Cancelar ou devolver pedido pago com estorno exige ADMIN.** A equipe (STAFF) altera os demais status.
- **Gráficos sem animação e com uma tabela equivalente para leitores de tela.**
- **Cadastros simples em um kit genérico.** Cupons, banners, depoimentos, ocasiões, páginas, FAQ, seções da home, regras de frete, feriados, redirecionamentos, categorias e coleções são definições em `src/server/admin/resources/` (campos, validação, colunas da lista). As páginas (`src/app/admin/[recurso]`) e as ações (`src/server/actions/admin/resources.ts`) são as mesmas para todos: salvar, excluir, ligar e desligar, ordenar, auditar e invalidar o cache. Módulos com fluxo próprio (pedidos, produtos, estoque, mídia, clientes, avaliações, relatórios) têm páginas próprias.
- **`Product.qualityScore`** (nova coluna, migração `product_quality_score`): a nota de qualidade é gravada a cada alteração, para a lista filtrar e o relatório ordenar sem recalcular tudo. A conta fica em `src/lib/product-quality.ts` e é a mesma no indicador ao vivo do formulário. Pesos: 3 imagens 20, texto alternativo 10, descrição 20, descrição curta 10, ficha 15, peso e dimensões 10, SEO 10, categoria 5.
- **Estoque alterado pelo cadastro do produto ou pela importação vira movimento** (`ADJUSTMENT` ou `IN`), como qualquer ajuste: o histórico nunca fica com buracos.
- **Variação já vendida ou com reserva não é apagada**, fica inativa. Produto com pedidos, na exclusão em massa, é arquivado.
- **Mudar o slug de produto, categoria ou coleção publicados** cria o redirecionamento 301 do endereço antigo, atualiza os redirecionamentos que apontavam para ele (sem cadeias) e remove um eventual redirecionamento que sairia do endereço novo (sem loops). Na categoria, vale também para as subcategorias.
- **Arrastar dentro da lista só reordena** (principais entre si, subcategorias entre si). Mudar a categoria pai por arrastar entrou depois da fase 8, com destinos próprios e confirmação (ver "Depois da entrega").
- **Importação de produtos:** o arquivo é lido no servidor (UTF-8 ou ISO-8859-1, vírgula ou ponto e vírgula), as linhas voltam para o navegador para o mapeamento e a gravação acontece em lotes de 50 produtos, cada lote em uma transação. No formato do site antigo o peso é lido em quilos; no formato próprio, em gramas. O tipo do produto, quando o arquivo não traz, é deduzido da categoria. Limite de 5.000 linhas e 10 MB por arquivo (`serverActions.bodySizeLimit` em 12 MB).
- **"Remover todos os produtos de teste"** apaga, em uma transação, produtos, variações, movimentos, avaliações, depoimentos, pedidos, carrinhos, leads, solicitações, contatos e clientes `isSample`. Imagens de teste que ainda ilustram categorias, coleções, banners ou ocasiões ficam até serem trocadas; usuários da equipe nunca são apagados.
- **O texto do banner fica sempre sobre um painel creme sólido**, então a leitura não depende da foto. A prévia ao vivo e o aviso de contraste entraram depois da fase 8 (ver "Depois da entrega").
- **Gerador de cupons em lote** copia as regras de um cupom modelo e cria códigos de um uso só (`PREFIXO-XXXXXX`, sem caracteres ambíguos), agrupados em um lote exportável.
- **Carrinho abandonado:** o e-mail de recuperação leva a `/carrinho/recuperar/[token]`, que devolve a sacola ao navegador. Quem se descadastrou não recebe.
- **Editar avaliação é só para erros de digitação**, e o texto anterior fica na auditoria.
- **Auditoria de clientes registra quais campos mudaram, sem copiar os dados pessoais.**
- **Login: só as tentativas erradas contam para o limite.** Um login correto zera o contador; antes, quem entrava e saía várias vezes era bloqueado.
- **Modo manutenção** cobre a loja (home, catálogo, sacola). Login, área do cliente, acompanhamento de pedido e painel continuam no ar, e a equipe logada vê a loja normalmente.
- **Tarefas agendadas** (`src/server/jobs.ts`): cada uma roda por `/api/cron/[tarefa]` com `Authorization: Bearer CRON_SECRET` ou pelo botão do painel, e grava `JobRun`. Sem `CRON_SECRET`, a rota responde 503.
- **Relatórios em um registro único** (`src/server/admin/reports.ts`): cada relatório devolve colunas e linhas; a tela, o gráfico e o CSV são genéricos. Venda é pedido pago que não foi cancelado, expirado nem devolvido.
- **Visualizar e-mail enviado:** o conteúdo é montado de novo a partir do modelo e dos dados gravados no `EmailLog`, em um `iframe` com `sandbox`. E-mails com link de uso único (senha, verificação, convite) não são reenviados.

## 2026-10-03 — Fase 7

- **Páginas institucionais em uma rota só** (`src/app/(loja)/[pagina]`): Sobre, Entrega, Trocas, Pagamentos, Privacidade, Cookies, Termos e qualquer página criada no painel. Ajuda, Contato, Avaliações e Solicitar produto têm páginas próprias.
- **Redirecionamentos legados no proxy, com a tabela `Redirect` em memória** (recarregada a cada 3 minutos). Um redirecionamento criado no painel passa a valer em até 3 minutos. Os acessos são contados sem atrasar a resposta. Com o banco fora do ar, a loja responde normalmente, só sem redirecionar.
- **Ordem das regras de URL antiga:** tabela `Redirect`; `listaprodutos.asp` com `Texto` vai para a busca e, sem mapa, para Novidades; `track.asp` e `cadastro.asp`; arquivo `.asp`/`.htm` ou produto antigo (termina em código numérico) vai para a busca com os termos do caminho; por fim, parâmetros de sessão (`IDLoja`, `mob`), maiúsculas e barra final são removidos com 301.
- **404 de verdade.** O `loading.tsx` do grupo da loja foi removido: com ele acima de uma página que chama `notFound()`, o Next já tinha enviado o status 200 quando descobria que a página não existe. O esqueleto de carregamento ficou só em busca e sacola, que nunca respondem 404. A página 404 registra o endereço em `NotFoundLog` (o proxy repassa o caminho no cabeçalho `x-nsg-path`).
- **Consentimento de cookies** no cookie `nsg_consent` (12 meses), lido no navegador. "Aceitar todos" e "Recusar opcionais" têm o mesmo peso visual. GA4 e pixel da Meta só são carregados (`next/script`) depois do consentimento da categoria; antes disso nenhum pedido sai para terceiros (há teste e2e).
- **Pop-up de boas-vindas:** `localStorage` guarda a última exibição (14 dias) e `sessionStorage` impede repetir na sessão. Não aparece para quem já se cadastrou (cookie `nsg_lead`), para a equipe logada, nem em checkout, sacola, conta e institucionais.
- **Lead com double opt-in:** o cupom é mostrado na hora e enviado por e-mail com o link de confirmação; o token é guardado só como hash. O descadastro é um link de um clique (`/descadastrar/[token]`), vale para todos os cadastros do e-mail e desliga as ofertas da conta.
- **Formulários públicos com campo-isca e tempo mínimo de 1,5 s.** Para um robô a resposta é a mesma de um envio normal, mas nada é gravado nem enviado.
- **Imagem Open Graph gerada em `/og?titulo=`** (creme, Cormorant, faixa musgo), usada por toda página sem foto própria. A fonte vem do pacote `@fontsource/cormorant-garamond` (arquivo `.woff`, que o `next/og` aceita).
- **Sitemap em arquivos de 5.000 URLs** (`/sitemap/0.xml`...), listados no `robots.txt`. Fora de produção o `robots.txt` bloqueia tudo.
- **CSP com `'unsafe-inline'` em scripts e estilos**, porque o Next injeta scripts embutidos; uma política com nonce exigiria renderização dinâmica em todas as páginas. `frame-ancestors 'none'`, `object-src 'none'`, `base-uri` e `form-action` restritos. HSTS só em produção.
- **Limite de requisições na busca** (60 por minuto por visitante), além de login, cadastro, senha, rastreio e formulários públicos.

## 2026-10-03 — Fase 8

- **Lighthouse (mobile, build de produção, catálogo de teste, máquina local).** Acessibilidade, boas práticas e SEO: 100 nas três páginas.

  | Página    | Desempenho, limitação aplicada | LCP   | CLS   | TBT   | Desempenho, limitação simulada | LCP estimado |
  | --------- | ------------------------------ | ----- | ----- | ----- | ------------------------------ | ------------ |
  | Home      | 98                             | 2,0 s | 0,001 | 20 ms | 86                             | 4,2 s        |
  | Categoria | 97                             | 2,5 s | 0,001 | 10 ms | 87                             | 4,1 s        |
  | Produto   | 99                             | 1,7 s | 0     | 10 ms | 87                             | 4,1 s        |

  Com a limitação aplicada de verdade (`--throttling-method=devtools`, 4G lento e CPU 4x mais lenta) as metas são atingidas; a categoria fica no limite de 2,5 s de LCP. No modo padrão do Lighthouse (limitação simulada), o desempenho fica em 86 a 87, abaixo da meta de 90: em servidor local tudo carrega em menos de 150 ms, e o modelo conta todo o JavaScript como anterior à imagem principal. A imagem do LCP já é pré-carregada, com prioridade alta, em WebP de 5 KB. **Refazer a medição no domínio de produção, com fotos reais**, que pesam mais do que as ilustrações de teste.

- **Peso das páginas da loja** (transferido, primeira visita): JavaScript 239 KB, CSS 17 KB, fontes 126 KB (três arquivos: Inter, Cormorant e Cormorant itálico). Total: home 501 KB, categoria 445 KB, produto 452 KB.
- **Recharts, Tiptap e TanStack Table ficam em arquivos carregados só no painel.** Conferido no build: nenhum dos arquivos de JavaScript da home contém essas bibliotecas. O Tiptap é carregado sob demanda (`next/dynamic`), só nas telas com editor.
- **Análise de bundle pelos números do build e do Lighthouse**, em vez do `@next/bundle-analyzer`, que é um plugin do webpack e não funciona com o Turbopack, usado pelo Next 16.
- **Testes:** 212 unitários e de integração (Vitest) e 17 de ponta a ponta (Playwright), cobrindo os 13 cenários da especificação e mais boleto, contato, consentimento de cookies e permissões da equipe. O axe roda em home, categoria, produto, ajuda, contato, sacola, checkout, login, conta e quatro telas do painel, sem violações sérias ou críticas.
- **Os testes e2e usam o banco de desenvolvimento** e reabastecem os produtos de teste antes de cada arquivo; o produto criado pelo teste do painel é apagado no fim.
- **Gráficos do painel com `inert`:** além de `aria-hidden`, para os elementos internos do gráfico não receberem foco (apontado pelo axe).
- **Conferência final:** os 127 redirecionamentos do site antigo respondem 301 para o destino certo; as 42 categorias têm produtos de teste (mínimo de 4) e abrem; buscas por "Net Shopping", "NetShop", caixa alta, setas em botões, pontos médios, gradientes, carrossel automático e telefone, e-mail ou valores fixos em componentes não encontraram nada.
- **Não feito na fase 8:** `pnpm db:reset` (o Prisma exige o consentimento do dono para um agente apagar o banco) e etiquetas e rastreio automático. "Mover para favoritos", arrastar categoria para outro nível e o aviso de contraste do banner foram feitos depois (ver "Depois da entrega").
- **Seed validado do zero em um banco descartável** (`netshopgarden_verificacao`, criado e apagado em seguida): migrações mais seed em 2,4 s, segunda execução em 1,3 s sem duplicar. 160 produtos, 44 com variações (27%), nenhuma descrição com menos de 300 caracteres, 250 pedidos (o total por dia passou a usar arredondamento acumulado, para a soma ser exata).

## 2026-10-03 — Depois da entrega

Três itens da especificação que tinham ficado de fora, feitos a pedido do dono.

- **"Mover para favoritos" na sacola.** Primeiro guarda nos favoritos e só depois tira da sacola; se guardar falhar, o item fica onde está. Sem login, leva para `/entrar` e volta para a sacola com o item ainda lá. O aviso tem "Desfazer" por 5 segundos, que devolve o item à sacola e tira dos favoritos.
- **Arrastar categoria para outro nível.** Durante o arrasto aparecem destinos tracejados: "mover para dentro de" em cada categoria principal e "virar categoria principal" no topo. Soltar em um destino abre uma confirmação com o endereço antigo e o novo; só então grava. Soltar sobre outra linha continua só reordenando, então não dá para mudar o pai sem querer. O endereço antigo passa a redirecionar (301), a categoria entra no fim da nova lista e a ação gera auditoria (`category.move`). A árvore continua com dois níveis: principal que tem subcategorias não vira subcategoria. A regra está em `src/server/admin/categories.ts` (`moveCategory`). Pelo teclado, o caminho continua sendo o campo "Categoria pai" do formulário.
- **Prévia ao vivo do banner com aviso de contraste.** A prévia usa o que está digitado, antes de salvar, nas versões de computador e celular. Como o texto fica sempre sobre painel sólido, o contraste do texto é fixo e já é coberto pelo teste de cores; o que varia com a foto é o painel se destacar ou não da imagem. O aviso mede isso: calcula no navegador a cor média da foto na área atrás do painel (mesmo corte 16:7 da loja) e avisa quando o contraste com o creme do painel fica abaixo de 1,3:1 (`MIN_SURFACE_CONTRAST` em `src/lib/color.ts`). Vale só para o destaque da home, que é onde o painel fica sobre a foto. Se a imagem vier de outro domínio sem permissão de leitura, a prévia diz que não conseguiu medir.
- **`SortableList` guarda só a ordem dos ids**, e o conteúdo de cada item vem sempre das props. Antes, qualquer nova renderização do componente pai desfazia a ordem otimista.
- **Ainda não feito, para lembrar:** etiquetas e rastreio automático dependem da escolha da transportadora ou do serviço de frete (item em `docs/PENDENCIAS-DO-DONO.md`). A posição de banner "Faixa secundária da home" existe no painel, mas a loja ainda não tem a seção que a exibe.
- **Testes:** 217 no Vitest e 20 no Playwright.

## 2026-10-03 — Integração com os Correios

- **Escrita a partir da descrição OpenAPI oficial** (`api.correios.com.br/{token,preco,prazo,srorastro}/v3/api-docs`): token por cartão de postagem (Basic com usuário e código de acesso), preço e prazo em lote (`POST /preco/v1/nacional`, `POST /prazo/v1/nacional`) e rastro (`GET /srorastro/v1/objetos/{codigo}`). **Não foi testada com credenciais reais**: não há contrato disponível. Os 17 testes usam `fetch` simulado. A única chamada real feita foi ao endpoint de token com credenciais inválidas, que respondeu 401 como esperado.
- **Os Correios trocam só preço e prazo das modalidades nacionais.** As regras do painel continuam decidindo onde cada modalidade existe, a entrega local, o frete grátis e os itens só locais. Assim o provider novo não duplica regra de negócio.
- **Falha dos Correios não para o checkout:** rede, tempo esgotado (8 s) ou autenticação recusada fazem valer a tabela do painel, com registro no log. Erro por serviço (`txErro`) tira a modalidade, porque oferecer um envio que os Correios não fazem seria pior.
- **Pacote estimado**, não cadastrado: base da maior caixa, altura pelo volume somado, 4 cm de folga. Não há campo de dimensões de embalagem no produto; se a estimativa se mostrar ruim na prática, o caminho é criar esses campos.
- **Cache em memória** de 10 minutos para cotação e 15 para rastreio, e token guardado em memória até perto de vencer. Em hospedagem com várias instâncias cada uma tem o seu; funciona, só consulta mais.
- **Entrega automática** pela tarefa `rastreio-correios`: evento BDE, BDI ou BDR com tipo 00 ou 01. Passa por `transitionOrder`, então grava histórico e manda o e-mail.
- **Códigos de serviço padrão** `03298` (PAC) e `03220` (SEDEX) vieram de memória, não da documentação consultada. São configuráveis e precisam ser conferidos no contrato.
- **Não feito:** pré-postagem (etiqueta e geração do código de rastreio).

## 2026-10-03 — Jadlog e mais de uma transportadora

- **`SHIPPING_PROVIDER` virou lista** (`mock`, `correios`, `jadlog`, `correios,jadlog`). As variáveis comuns passaram a `SHIPPING_ORIGIN_CEP` e `SHIPPING_HANDLING_DAYS` (antes `CORREIOS_*`, criadas horas antes e ainda sem uso).
- **Interface `Carrier`** (`carriers/types.ts`): cada transportadora cota "econômico" e "expresso". O `CarrierShippingProvider` substituiu o provider só dos Correios e escolhe a mais barata por modalidade. A escolha por preço é um padrão meu; se o dono preferir prioridade fixa, é uma linha no provider.
- **Restrição por produto:** `Product.carrierRestriction` (`ANY`, `JADLOG_ONLY`), migração `product_carrier_restriction`. Um item só Jadlog leva a sacola inteira para a Jadlog. O escopo de entrega (só Grande São Paulo ou Brasil) continua sendo outro campo: planta volumosa que vai para fora precisa dos dois ajustes.
- **Jadlog escrita pelo manual oficial 2.3**, lido do PDF. Endpoints, campos e exemplos de resposta vieram dele. Vieram de memória, e estão marcados na documentação para confirmar: códigos de modalidade, divisores de cubagem (3333 e 6000), prefixo `Bearer` e o status `ENTREGUE`. **Não foi testada com token real.**
- **Nome da transportadora no nome da opção** ("Envio econômico (Jadlog)"): é o que fica gravado no pedido, sem mudar o schema do pedido.
- **Tarefa renomeada** de `rastreio-correios` para `rastreio-transportadoras`.

## 2026-10-03 — Áreas de entrega por produto

- **`DeliveryArea`** (nome e faixas de CEP) e `Product.deliveryAreaId`, migração `delivery_areas`. Cadastro em `/admin/areas-de-entrega`; o produto escolhe a área na aba Entrega. Pedido do dono: muitos produtos não vão para todo o país, a área muda de produto para produto, e o cliente de fora precisa saber qual produto é e poder chamar no WhatsApp.
- **A área vale por cima do escopo.** Produto com área só é vendido para CEPs dentro dela, seja o envio local ou por transportadora. Produto sem área segue como antes: nacional, ou "só Grande São Paulo" pelas regras de entrega local.
- **O aviso diz o nome do produto e da área** e vem com botão de WhatsApp com a mensagem pronta. A frase é "X tem entrega só nesta área: Y", que funciona com qualquer nome de produto e de área sem errar gênero nem preposição. O aviso genérico de plantas (`LOCAL_ONLY_NOTICE`) saiu.
- **Com item bloqueado, nenhuma opção de frete é devolvida** (`quoteShipping`), então `placeOrder` recusa o pedido no servidor mesmo que o navegador tente. O botão do checkout agora remove só os itens bloqueados para aquele CEP, não todos os "só locais".
- **Regra pura em `src/lib/delivery-areas.ts`**, com testes; `quoteShipping` busca nome e área do produto pelo id da variação, para não mudar os cinco lugares que montam os itens da cotação.
- **Sem áreas no seed:** o dono cadastra as dele. O banco de desenvolvimento não ganhou nenhuma.

## 2026-10-08 — Curadoria do catálogo antigo e lixeira

- **Pedido do dono:** importar os cerca de 3000 produtos do site antigo e deixar a dona da loja escolher, de forma simples, o que fica, o que ganha destaque e o que sai, editando nome, preço e categoria, com uma aba de excluídos do mais recente para o mais antigo.
- **Os arquivos do site antigo não estavam no projeto** e o site bloqueia leitura automática (firewall com reCAPTCHA), que não foi contornado. A carga depende do arquivo exportado do painel da FastCommerce, em `data-privada/`.
- **`Product.curation`** (`PENDING`, `KEPT`, nulo para quem não passa por revisão), **lixeira** (`deletedAt`, `deletedById`, `statusBeforeDelete`) e **`legacyImageUrls`**, migração `curation_and_trash`.
- **Importar para a curadoria** (opção nova no assistente e padrão do script `pnpm import:legacy`): os produtos entram como rascunho, fora da loja. "Importar e publicar" não vale nesse modo.
- **Manter publica**, mas só quando o produto tem foto, preço e variação ativa (`publishIfReady`), para respeitar a regra de que produto publicado tem imagem com texto alternativo. Sem isso fica mantido e fora da loja, com o motivo no card.
- **Fotos do site antigo só são baixadas para o que é mantido.** Na importação ficam anotados os endereços (colunas `ImagemProd`, `ImagemDet`, `ImagemAmp`, nomes vindos de memória, a confirmar no arquivo real). Ao manter, as primeiras são trazidas em segundo plano (`after`); o botão "Trazer fotos do site antigo" faz o resto em lotes de 3 produtos por chamada, por causa do tempo limite da hospedagem. Enquanto isso o card mostra a foto direto do endereço antigo. O texto alternativo é o nome do produto.
- **Busca de foto só em endereço público** (`isFetchableImageUrl`): http ou https, sem localhost, sem IP literal, sem domínio interno. A lista vem de arquivo importado por administrador, mas a loja não deve buscar nada na rede interna.
- **Excluir virou lixeira em todo o painel.** A ação em massa "Excluir" da lista de produtos apagava de vez o que não tinha pedidos; agora manda para a lixeira. O produto na lixeira fica `ARCHIVED` (some da loja pelas regras que já existiam) e fora da lista de produtos. Não há "apagar de vez": só "Remover todos os produtos de teste" apaga.
- **Nomes repetidos** são comparados sem acento e sem caixa, por igualdade. Nomes parecidos, mas diferentes, não são apontados.
- **Preço no card** só para produto com uma variação; com mais de uma, o card leva ao cadastro completo.
- **Endereço do produto acompanha o nome** enquanto ele nunca foi publicado; depois de publicado, mudar o nome na curadoria não muda o endereço.
- **Script de carga em vez do assistente para o arquivo grande:** uma importação de 3000 produtos numa única chamada passa do tempo limite e do tamanho de requisição da Vercel. `scripts/import-legacy.ts` grava direto no banco de `DATABASE_URL`.
- **70 produtos fictícios** (`LEG0001` a `LEG0070`, `isSample`) ficaram no banco de desenvolvimento para experimentar a tela. As fotos deles apontam para um domínio que não existe, de propósito.
- **Vercel:** `vercel-build` aplica as migrações antes do build (pela conexão direta `DATABASE_URL_UNPOOLED`, quando existe), `vercel.json` declara as tarefas uma vez por dia (limite do plano Hobby) e as páginas de curadoria e importação pedem até 60 s por ação. O build foi ensaiado contra um banco recém-criado e vazio, e passou. Nenhum deploy real foi feito.

## 2026-10-08 — Carga do XML de produtos do site antigo

- **Fonte:** o gerador "XML de produtos" da FastCommerce (`/xml-products.ehc`, formato padrão, com descrições, referência, peso, caminho da categoria e foto ampliada), salvo pelo navegador em `data-privada/`. O `produtos.csv` do gerenciador de arquivos não serve: tem só a coluna de descrição longa e é de 2018.
- **`src/server/admin/legacy-feed.ts`** converte o XML para o formato próprio da importação. O script `pnpm import:legacy` aceita `.xml` e `.csv`.
- **1.155 produtos no arquivo recebido**, todos com preço e foto, em 27 categorias, todas mapeadas (tabela `LEGACY_CATEGORY_ALIASES`). O casamento de categoria passou a ser pelo caminho inteiro: só pelo último nível, "Cerâmica" de Cachepots cairia em Vasos.
- **Só entrega em São Paulo (431 produtos):** o site antigo marcava isso com peso de 350 kg ou com o texto "toda Cidade de São Paulo". Viram `deliveryScope = LOCAL_ONLY`, e o peso falso não é importado.
- **Referência repetida** (14 casos) ganha o id do site antigo no código.
- **Estoque não vem no XML** sem chave de acesso: todos entraram com estoque zero. Fica pendente decidir de onde vem o estoque.
- **As fotos baixam direto do site antigo** (testado com JPG, PNG e WebP). AVIF não é aceito pelo processamento de imagens: 1 produto fica sem foto.
- **Endereços antigos dos produtos** são lidos do XML (`oldPaths`), mas ainda não viram redirecionamentos. A fazer para os produtos mantidos, antes de trocar o domínio.
- **Carga feita só no banco de desenvolvimento.** Os 70 produtos fictícios da curadoria foram apagados.

## 2026-10-09 — Inválido, sem Correios e o erro do CI

- **Estoque fica zero.** O dono conferiu no gerador de XML do site antigo: a quantidade não vem. A etiqueta "sem estoque" saiu dos cards da curadoria (valeria para todos); o filtro continua. No lugar entrou "Só São Paulo" para os produtos de entrega local.
- **"Produto inválido"** é um terceiro destino na curadoria (`CurationStatus.INVALID`, migração `curation_invalid`, aba Inválidos): sai da fila e da loja, sem ir para a lixeira, até alguém corrigir e manter. Interpretação minha do pedido: serve para cadastro com foto, nome ou preço errados.
- **"Não entregue pelos Correios"** usa o campo que já existia, `carrierRestriction = JADLOG_ONLY`: no envio nacional o produto só vai pela Jadlog. É uma marcação no card e na barra de ações em massa, independente da decisão de manter ou excluir.
- **CI falhava no build:** o build gera o sitemap a partir do banco e rodava antes de as tabelas existirem (`P2021`, tabela `Category`). A etapa de migração e seed passou para antes do build. O CI nunca tinha rodado até o repositório existir no GitHub.

## 2026-10-09 — Primeiro deploy na Vercel

- **No ar em `shop-garden-products.vercel.app`**, com Postgres Neon (São Paulo) e fotos no Cloudflare R2. Três falhas de build até chegar lá, nenhuma reproduzível na máquina:
  - **Fonte do Google:** o `next/font/google` falhava no build da Vercel. As fontes (Cormorant Garamond e Inter, licença OFL) passaram para `src/fonts`, com `next/font/local`.
  - **Cliente Prisma ausente com cache de build:** com o cache restaurado, o `pnpm install` não roda o `postinstall`, e `src/generated` (fora do Git) não existe. O `vercel-build` passou a rodar `prisma generate` antes de tudo.
  - **Imagens do bucket:** `images.remotePatterns` é montado a partir de `S3_PUBLIC_URL`.
- **`prisma/seed/essentials.ts` (`pnpm db:seed:essentials`)**: carga de produção sem dados de teste. Substitui o plano de rodar o seed completo e remover os testes depois, que criaria no site publicado uma conta de equipe com senha conhecida.
- **Carga do catálogo em fatias paralelas** (`--parte=i/n`, `--faltantes`): com o banco a cerca de 150 ms por consulta, a carga em série levaria mais de uma hora.
- **Tarefa `atualizar-cache`**: a loja guarda configurações, categorias e catálogo em cache sem prazo. Depois de uma carga direta no banco, só essa tarefa (ou salvar as configurações no painel) faz o site enxergar os dados.
- **`regions: ["gru1"]`** no `vercel.json`: as funções rodam em São Paulo, junto do banco.
- **Login enviado antes de a página ficar interativa:** os formulários de acesso (entrar, criar conta, esqueci a senha, redefinir) só tratavam o envio no `onSubmit`. Um clique antes da hidratação fazia o navegador enviar o formulário por GET, com a senha no endereço da página. Agora o formulário também tem uma função em `action`, e o React segura o envio antecipado e o repete quando a página fica pronta. Coberto por `tests/e2e/auth.spec.ts`. Os demais formulários da loja (contato, newsletter, cupom) têm o mesmo padrão antigo, mas não carregam senha; ficaram como estavam.
