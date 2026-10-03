# Plano de execução

Marcar `[x]` ao concluir. Ao final de cada fase: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, commit `fase N: ...`.

## Fase 0 — Setup

- [x] Repositório git, `.gitignore` (`uploads/`, `.env*`, `data-privada/`)
- [x] Projeto Next.js + TypeScript strict + Tailwind + ESLint + Prettier
- [x] `docker-compose.yml` (postgres, mailpit, minio no profile `storage`)
- [x] `.env.example` comentado e `.env` local
- [x] Prisma inicializado e conectando
- [x] Vitest e Playwright configurados
- [x] Scripts do `package.json` (seção 4.3)
- [x] `pnpm dev` sobe, banco conecta, Mailpit acessível, lint e typecheck passam

## Fase 1 — Design system e layout da loja

- [x] Tokens de cor, tipografia, espaçamento e raio como variáveis CSS expostas ao Tailwind
- [x] Fontes Cormorant Garamond e Inter via `next/font`
- [x] `src/config/store.config.ts`
- [x] Primitivas: Button, Input, Textarea, Select, Checkbox, Radio, Switch, QuantityStepper, MaskedInput, Field
- [x] Price, Badge, Rating
- [x] Breadcrumb, Pagination, Accordion, Tabs, Dialog, Drawer, Toast, Tooltip, Skeleton, EmptyState, Alert
- [x] ProductCard, ProductGrid, CategoryTile, BotanicalSheet, ShippingCalculator, CouponField, FreeShippingProgress, WhatsAppButton, NewsletterForm
- [x] Logo provisório (`public/brand/logo.svg` + componente `Logo`) e ícones de pagamento
- [x] Layout da loja: barra superior, cabeçalho, mega menu, menu mobile, rodapé
- [x] `/dev/design-system` com todos os componentes e estados
- [x] Teste unitário de contraste
- [x] Revisão visual em 390, 768 e 1440 px

## Fase 2 — Banco e seed

- [x] Schema Prisma completo (seção 7) com índices
- [x] Migração com `unaccent`, `pg_trgm` e sequência do número do pedido
- [x] `scripts/generate-placeholders.ts`
- [x] Seed: configurações, usuários, categorias (com SEO e FAQ), coleções, redirecionamentos, frete, feriados
- [x] Seed: ~150 produtos de teste com variantes, imagens e estoque variado
- [x] Seed: clientes, pedidos, movimentos de estoque, avaliações, depoimentos, cupons
- [x] Seed: banners, seções da home, ocasiões, páginas, FAQ, leads, solicitações, contatos, carrinhos, buscas
- [ ] `pnpm db:reset` recria tudo sem erro (aguarda consentimento do dono: o Prisma bloqueia `migrate reset` executado por agente). Já verificado: seed em banco vazio roda em 20s e é idempotente (segunda execução em 1,3s, sem duplicar)

## Fase 3 — Catálogo

- [x] `getStoreSettings()` com cache e invalidação
- [x] Serviços `pricing` e `catalog` com testes
- [x] Home com seções configuráveis
- [x] Categoria e coleção: filtros na URL, ordenação, paginação, SEO e FAQ
- [x] Busca com sugestões, `unaccent` + `pg_trgm`, `SearchLog`
- [x] Página de produto completa (galeria, variantes, ficha, avaliações, relacionados, vistos recentemente)
- [x] Presentes e ocasiões
- [x] Metadados e JSON-LD básicos por página
- [x] Revisão visual em 390, 768 e 1440 px

## Fase 4 — Carrinho, checkout e pagamento

- [x] Carrinho no banco com cookie httpOnly, mini-carrinho e `/carrinho`
- [x] Serviços `coupons`, `shipping`, `inventory`, `orders` com testes
- [x] Providers `payment`, `shipping`, `email`, `storage` (interfaces + mock/local)
- [x] `/api/cep/[cep]`
- [x] Checkout em 4 etapas com idempotência e detecção de divergência
- [x] Reserva e baixa de estoque com `SELECT ... FOR UPDATE`; teste de concorrência
- [x] Máquina de estados `transitionOrder()`
- [x] Pix, cartão e boleto simulados; webhook com HMAC; simulador
- [x] Confirmação do pedido com polling e boleto imprimível
- [x] Templates de e-mail transacionais e `EmailLog`
- [x] Revisão visual em 390, 768 e 1440 px

## Fase 5 — Conta do cliente

- [x] Auth.js com credenciais, limite de tentativas, verificação de e-mail, redefinição de senha
- [x] Mescla de carrinho anônimo no login
- [x] Área do cliente: visão geral, pedidos, endereços, favoritos, dados, senha, comunicação, privacidade
- [x] Rastreio sem login com limite por IP
- [x] Exportação de dados e pedido de exclusão (LGPD)

## Fase 6 — Admin

- [x] Layout, busca global, matriz de permissões, auditoria
- [x] Dashboard
- [x] Pedidos (lista, detalhe, impressões, pedido manual)
- [x] Produtos (lista, formulário em abas, qualidade de cadastro, importação e exportação CSV, remover testes)
- [x] Categorias e coleções
- [x] Estoque (ajustes, lote, inventário, histórico, valor)
- [x] Mídia
- [x] Clientes
- [x] Carrinhos abandonados
- [x] Cupons
- [x] Avaliações e depoimentos
- [x] Marketing e conteúdo (banners, home, barra superior, ocasiões, páginas, FAQ, leads, solicitações, contatos, avise-me)
- [x] Frete e simulador
- [x] Configurações
- [x] Usuários da equipe
- [x] Redirecionamentos e 404
- [x] Relatórios
- [x] Auditoria, e-mails enviados, tarefas agendadas e `/api/cron/[tarefa]`
- [x] `docs/ADMIN-MANUAL.md`
- [x] Revisão visual em 390, 768 e 1440 px

## Fase 7 — Institucional, leads, SEO e analytics

- [x] Páginas institucionais, contato, solicitar produto, 404 e 500
- [x] Pop-up de boas-vindas, newsletter, double opt-in, descadastro
- [x] Banner e preferências de cookies
- [x] Sitemap, robots, JSON-LD completo, imagens Open Graph
- [x] Redirecionamentos legados no middleware, `NotFoundLog`
- [x] Camada de analytics, captura de UTM, scripts só após consentimento
- [x] Cabeçalhos de segurança, rate limit, honeypot

## Fase 8 — Qualidade e entrega

- [x] Testes unitários da seção 18.1
- [x] Testes e2e da seção 18.2 (13 cenários) com axe
- [x] Lighthouse nas páginas principais (registrar números)
- [x] Bundle analyzer (registrar números)
- [x] README, ARQUITETURA, INTEGRACOES, ADMIN-MANUAL
- [x] CI opcional (`.github/workflows/ci.yml`, não executado: o repositório ainda não está no GitHub)
- [x] Lista final de TODOs em `PENDENCIAS-DO-DONO.md`

## Critérios de aceite finais (seção 20)

- [ ] `docker compose up -d && pnpm install && pnpm db:reset && pnpm dev` sobe do zero sem erros (falta só o `db:reset`, que aguarda o consentimento do dono; migrações e seed em banco vazio foram verificados)
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` e `pnpm build` passam
- [x] Todas as categorias da seção 8.1 existem, aparecem no menu e têm produtos de teste
- [x] Todos os redirecionamentos legados respondem 301 para o destino correto
- [x] Compra completa com Pix, cartão e boleto simulados, com e-mails no Mailpit
- [x] Estoque reservado, baixado e liberado corretamente, sem venda acima do disponível em concorrência
- [x] Área do cliente completa
- [x] Todos os módulos do admin funcionam, com permissões e auditoria
- [x] Pedido manual de WhatsApp aparece nos relatórios por canal
- [x] "Remover todos os produtos de teste" limpa os dados de teste sem afetar dados reais
- [x] Nenhum telefone, e-mail, preço de frete ou desconto escrito em componente
- [x] Marca somente como "Net Shop Garden" (busca por "Net Shopping", "NetShop", "NETSHOP")
- [x] Nenhum texto em caixa alta, nenhuma seta em botões, nenhum carrossel automático
- [x] Vinho nunca sobre musgo e musgo nunca sobre vinho
- [x] Metas do Lighthouse atingidas com limitação aplicada (97 a 99); no modo simulado o desempenho fica em 86 a 87. Números e explicação em `DECISOES.md`, fase 8. Medir de novo em produção
- [x] Nenhuma violação séria ou crítica do axe
- [x] Revisão visual em 390, 768 e 1440 px sem quebras
- [x] `PENDENCIAS-DO-DONO.md` completo

### Problemas do site antigo (seção 1.4)

- [x] Site responsivo, uma URL por página
- [x] Um único design system com tokens
- [x] Uma página por conteúdo, URL canônica
- [x] Tudo em UTF-8
- [x] Nenhum script de terceiros sem necessidade e consentimento
- [x] Banners com texto em HTML, editáveis no admin
- [x] Vitrines curadas ou calculadas
- [x] Links de WhatsApp com mensagem contextual e evento com origem
- [x] Nome, telefones e e-mail de uma única fonte
- [x] E-mail em domínio próprio
- [x] Pix como método padrão com desconto destacado
- [x] Avaliações por produto com moderação, nota, data e compra verificada
- [x] Pop-up com cupom, captura com consentimento, captura no checkout
- [x] Cupom de boas-vindas como gancho de captação
- [x] Editor de produto com campos estruturados e indicador de qualidade
- [x] Texto de SEO e FAQ por categoria, sem listas de palavras-chave
- [x] Eventos de analytics, UTM em pedidos e leads, vendas por origem
- [x] Pedido manual com origem WhatsApp
- [x] LGPD: consentimento, exportação, exclusão, logs de exportação
