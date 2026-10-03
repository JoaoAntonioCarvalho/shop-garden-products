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

- [ ] `getStoreSettings()` com cache e invalidação
- [ ] Serviços `pricing` e `catalog` com testes
- [ ] Home com seções configuráveis
- [ ] Categoria e coleção: filtros na URL, ordenação, paginação, SEO e FAQ
- [ ] Busca com sugestões, `unaccent` + `pg_trgm`, `SearchLog`
- [ ] Página de produto completa (galeria, variantes, ficha, avaliações, relacionados, vistos recentemente)
- [ ] Presentes e ocasiões
- [ ] Metadados e JSON-LD básicos por página
- [ ] Revisão visual em 390, 768 e 1440 px

## Fase 4 — Carrinho, checkout e pagamento

- [ ] Carrinho no banco com cookie httpOnly, mini-carrinho e `/carrinho`
- [ ] Serviços `coupons`, `shipping`, `inventory`, `orders` com testes
- [ ] Providers `payment`, `shipping`, `email`, `storage` (interfaces + mock/local)
- [ ] `/api/cep/[cep]`
- [ ] Checkout em 4 etapas com idempotência e detecção de divergência
- [ ] Reserva e baixa de estoque com `SELECT ... FOR UPDATE`; teste de concorrência
- [ ] Máquina de estados `transitionOrder()`
- [ ] Pix, cartão e boleto simulados; webhook com HMAC; simulador
- [ ] Confirmação do pedido com polling e boleto imprimível
- [ ] Templates de e-mail transacionais e `EmailLog`
- [ ] Revisão visual em 390, 768 e 1440 px

## Fase 5 — Conta do cliente

- [ ] Auth.js com credenciais, limite de tentativas, verificação de e-mail, redefinição de senha
- [ ] Mescla de carrinho anônimo no login
- [ ] Área do cliente: visão geral, pedidos, endereços, favoritos, dados, senha, comunicação, privacidade
- [ ] Rastreio sem login com limite por IP
- [ ] Exportação de dados e pedido de exclusão (LGPD)

## Fase 6 — Admin

- [ ] Layout, busca global, matriz de permissões, auditoria
- [ ] Dashboard
- [ ] Pedidos (lista, detalhe, impressões, pedido manual)
- [ ] Produtos (lista, formulário em abas, qualidade de cadastro, importação e exportação CSV, remover testes)
- [ ] Categorias e coleções
- [ ] Estoque (ajustes, lote, inventário, histórico, valor)
- [ ] Mídia
- [ ] Clientes
- [ ] Carrinhos abandonados
- [ ] Cupons
- [ ] Avaliações e depoimentos
- [ ] Marketing e conteúdo (banners, home, barra superior, ocasiões, páginas, FAQ, leads, solicitações, contatos, avise-me)
- [ ] Frete e simulador
- [ ] Configurações
- [ ] Usuários da equipe
- [ ] Redirecionamentos e 404
- [ ] Relatórios
- [ ] Auditoria, e-mails enviados, tarefas agendadas e `/api/cron/[tarefa]`
- [ ] `docs/ADMIN-MANUAL.md`
- [ ] Revisão visual em 390, 768 e 1440 px

## Fase 7 — Institucional, leads, SEO e analytics

- [ ] Páginas institucionais, contato, solicitar produto, 404 e 500
- [ ] Pop-up de boas-vindas, newsletter, double opt-in, descadastro
- [ ] Banner e preferências de cookies
- [ ] Sitemap, robots, JSON-LD completo, imagens Open Graph
- [ ] Redirecionamentos legados no middleware, `NotFoundLog`
- [ ] Camada de analytics, captura de UTM, scripts só após consentimento
- [ ] Cabeçalhos de segurança, rate limit, honeypot

## Fase 8 — Qualidade e entrega

- [ ] Testes unitários da seção 18.1
- [ ] Testes e2e da seção 18.2 (13 cenários) com axe
- [ ] Lighthouse nas páginas principais (registrar números)
- [ ] Bundle analyzer (registrar números)
- [ ] README, ARQUITETURA, INTEGRACOES, ADMIN-MANUAL
- [ ] CI opcional
- [ ] Lista final de TODOs em `PENDENCIAS-DO-DONO.md`

## Critérios de aceite finais (seção 20)

- [ ] `docker compose up -d && pnpm install && pnpm db:reset && pnpm dev` sobe do zero sem erros
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` e `pnpm build` passam
- [ ] Todas as categorias da seção 8.1 existem, aparecem no menu e têm produtos de teste
- [ ] Todos os redirecionamentos legados respondem 301 para o destino correto
- [ ] Compra completa com Pix, cartão e boleto simulados, com e-mails no Mailpit
- [ ] Estoque reservado, baixado e liberado corretamente, sem venda acima do disponível em concorrência
- [ ] Área do cliente completa
- [ ] Todos os módulos do admin funcionam, com permissões e auditoria
- [ ] Pedido manual de WhatsApp aparece nos relatórios por canal
- [ ] "Remover todos os produtos de teste" limpa os dados de teste sem afetar dados reais
- [ ] Nenhum telefone, e-mail, preço de frete ou desconto escrito em componente
- [ ] Marca somente como "Net Shop Garden" (busca por "Net Shopping", "NetShop", "NETSHOP")
- [ ] Nenhum texto em caixa alta, nenhuma seta em botões, nenhum carrossel automático
- [ ] Vinho nunca sobre musgo e musgo nunca sobre vinho
- [ ] Metas do Lighthouse atingidas (números registrados)
- [ ] Nenhuma violação séria ou crítica do axe
- [ ] Revisão visual em 390, 768 e 1440 px sem quebras
- [ ] `PENDENCIAS-DO-DONO.md` completo

### Problemas do site antigo (seção 1.4)

- [ ] Site responsivo, uma URL por página
- [ ] Um único design system com tokens
- [ ] Uma página por conteúdo, URL canônica
- [ ] Tudo em UTF-8
- [ ] Nenhum script de terceiros sem necessidade e consentimento
- [ ] Banners com texto em HTML, editáveis no admin
- [ ] Vitrines curadas ou calculadas
- [ ] Links de WhatsApp com mensagem contextual e evento com origem
- [ ] Nome, telefones e e-mail de uma única fonte
- [ ] E-mail em domínio próprio
- [ ] Pix como método padrão com desconto destacado
- [ ] Avaliações por produto com moderação, nota, data e compra verificada
- [ ] Pop-up com cupom, captura com consentimento, captura no checkout
- [ ] Cupom de boas-vindas como gancho de captação
- [ ] Editor de produto com campos estruturados e indicador de qualidade
- [ ] Texto de SEO e FAQ por categoria, sem listas de palavras-chave
- [ ] Eventos de analytics, UTM em pedidos e leads, vendas por origem
- [ ] Pedido manual com origem WhatsApp
- [ ] LGPD: consentimento, exportação, exclusão, logs de exportação
