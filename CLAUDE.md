# Net Shop Garden — e-commerce

Loja online de plantas naturais, orquídeas, arranjos, vasos, cachepots, flores artificiais, decoração e jardinagem. Parceira oficial de e-commerce do Shopping Garden (São Paulo, desde 1999). Substitui o site legado (FastCommerce/ASP).

A especificação completa foi entregue pelo dono no início do trabalho (22 seções) e só existia na conversa. Está transcrita, de forma condensada e sem perder valores, em `docs/especificacao/`:

- `01-negocio-design-dados.md`: seções 1, 5, 6, 7 (negócio, configuração, design system, modelo de dados)
- `02-categorias-regras-loja.md`: seções 8, 9, 10, 11 (categorias e URLs antigas, regras de negócio, páginas da loja, conta)
- `03-admin-seed-qualidade.md`: seções 12 a 21 (admin, seed, SEO, analytics, segurança, testes, entrega)

As referências "seção N" neste repositório apontam para ela. Leia a parte da fase em que estiver antes de codar.

## Se o contexto foi compactado ou a sessão foi retomada

Releia, nesta ordem: este arquivo, `docs/PLANO.md` (o que já foi feito), `docs/DECISOES.md` (por quê) e a parte de `docs/especificacao/` da fase atual. Continue da primeira caixa `[ ]` do plano.

## Stack

- Next.js (App Router) + TypeScript `strict`, Server Components por padrão, Server Actions
- Tailwind CSS v4 com tokens da marca como variáveis CSS
- PostgreSQL 16 (Docker em dev) + Prisma, extensões `unaccent` e `pg_trgm`
- Auth.js (NextAuth v5), credenciais + sessão JWT com papel (`CUSTOMER`, `STAFF`, `ADMIN`)
- Zod + React Hook Form
- Nodemailer + React Email (Mailpit em dev, `http://localhost:8025`)
- `sharp` para imagens; storage trocável (local / S3)
- Admin: shadcn/ui, TanStack Table, Recharts, Tiptap (somente no admin)
- Vitest (unitários) e Playwright (e2e + axe)
- pnpm

Versões exatas e desvios em relação à especificação: `docs/DECISOES.md`.

## Comandos

```
docker compose up -d      # Postgres + Mailpit (a porta 3000 é de outro projeto; este usa a 3100)
pnpm dev                  # http://localhost:3100
pnpm lint && pnpm typecheck && pnpm test && pnpm build   # rodar ao final de cada fase, nesta ordem
pnpm test:e2e
pnpm db:migrate | db:deploy | db:seed | db:reset | db:studio
# db:reset apaga o banco: o Prisma só deixa um agente rodar com consentimento explícito do dono
pnpm images:placeholders
```

## Princípios não negociáveis

1. Tudo real, menos pagamento e cotação de frete (mock atrás de provider trocável).
2. Servidor é a única fonte de verdade para preço, desconto, frete e estoque. Total sempre recalculado na criação do pedido.
3. Dinheiro em centavos (`Int`). Formatação BRL só na apresentação (`src/lib/money.ts`).
4. Nenhum telefone, e-mail, valor de frete grátis ou desconto escrito em componente: tudo vem de `src/config/store.config.ts` + `getStoreSettings()`.
5. Server Components por padrão.
6. Zod em toda entrada.
7. Toda ação administrativa que altera dados gera `AuditLog`.
8. WCAG 2.2 AA.
9. Interface, e-mails, erros e seed em pt-BR. Código em inglês.
10. Sem dados pessoais reais. Seeds com nomes fictícios e `@example.com`.
11. Dados de teste marcados com `isSample = true`.

## Convenções

- Marca: somente "Net Shop Garden". Nunca "Net Shopping Garden", "NetShopGarden" ou caixa alta.
- Textos em sentence case. Sem caixa alta, sem "→" em botões, sem eyebrows, sem pontos médios juntando metadados, sem gradientes decorativos, sem carrossel automático.
- Vinho nunca sobre musgo e musgo nunca sobre vinho.
- `// TODO(dono):` para valores que o dono precisa confirmar; `// TODO(integracao):` para pontos de provedor real. Ambos listados em `docs/PENDENCIAS-DO-DONO.md`.
- Commits: `fase N: descrição curta`.
- Permissões: `can(user, 'orders.refund')` em `src/lib/permissions.ts`, checado na interface e de novo em cada server action e route handler do admin.
- Transições de pedido só por `transitionOrder()`.
- Preço só por `getPriceDisplay(variant, settings)`.

## Onde está cada coisa

Atualizado ao longo do projeto.

| O quê                                    | Onde                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Proxy (antigo middleware do Next)        | `src/proxy.ts`                                                                                                |
| Variáveis de ambiente validadas          | `src/lib/env.ts`                                                                                              |
| Cliente Prisma                           | `src/lib/db.ts` (config em `prisma7.config.ts`)                                                               |
| Configuração central da loja             | `src/config/store.config.ts`                                                                                  |
| Tokens do design system                  | `src/app/globals.css` (`@theme`) e `src/lib/color.ts`                                                         |
| Primitivas da loja                       | `src/components/ui/`                                                                                          |
| Componentes da loja                      | `src/components/store/`                                                                                       |
| Página de design system                  | `/dev/design-system` (fora de produção)                                                                       |
| Árvore de categorias e menu              | `src/config/category-tree.ts`, `src/config/navigation.ts`                                                     |
| Cálculo de preço                         | `src/server/services/pricing.ts` (`getPriceDisplay`)                                                          |
| Validadores e máscaras                   | `src/lib/validators/`                                                                                         |
| Eventos de analytics                     | `src/lib/analytics/events.ts` (`track`)                                                                       |
| Screenshots para revisão visual          | `pnpm tsx scripts/screenshots.ts <pasta> /caminho`                                                            |
| Schema e migrações                       | `prisma/schema.prisma`, `prisma/migrations/`                                                                  |
| Seed                                     | `prisma/seed/` (`index.ts` orquestra; `product-data.ts` é o catálogo de teste)                                |
| Imagens placeholder                      | `scripts/generate-placeholders.ts`                                                                            |
| Armazenamento e imagens                  | `src/server/providers/storage/`, `src/server/services/media.ts`, rota `/media/[...key]`                       |
| Normalização de URLs antigas             | `src/lib/redirects.ts`                                                                                        |
| Configuração mesclada com o banco        | `src/server/services/settings.ts` (`getStoreSettings`)                                                        |
| Catálogo (índice, cards, busca, produto) | `src/server/services/catalog.ts`                                                                              |
| Filtros, ordenação e facetas (puro)      | `src/server/services/catalog-filters.ts`                                                                      |
| Banners, seções da home, páginas, FAQ    | `src/server/services/content.ts`                                                                              |
| Marcadores `{{...}}` em textos           | `src/lib/template.ts`                                                                                         |
| Sanitização de HTML rico                 | `src/lib/sanitize.ts`, componente `RichText`                                                                  |
| Datas e horário de corte (fuso de SP)    | `src/lib/dates.ts`                                                                                            |
| SEO (metadados e JSON-LD)                | `src/lib/seo/`                                                                                                |
| Limite de requisições                    | `src/server/services/rate-limit.ts`                                                                           |
| Server actions                           | `src/server/actions/`                                                                                         |
| Sacola (cookie, itens, visão calculada)  | `src/server/services/cart.ts`, `src/components/store/cart/`                                                   |
| Cupons e totais (puros)                  | `src/server/services/coupons.ts`, `totals.ts`                                                                 |
| Frete                                    | `src/server/services/shipping.ts`, `src/server/providers/shipping/`                                           |
| Transportadoras (Correios, Jadlog)       | `src/server/providers/shipping/{carriers,correios,jadlog}/`, `src/server/services/tracking.ts`                |
| Áreas de entrega por produto             | `src/lib/delivery-areas.ts`, `src/server/services/shipping.ts`, `/admin/areas-de-entrega`                     |
| Estoque (reserva, baixa, liberação)      | `src/server/services/inventory.ts`                                                                            |
| Estados do pedido                        | `order-status.ts` (puro) e `orders.ts` (`transitionOrder`)                                                    |
| Criação do pedido                        | `src/server/services/checkout.ts` (`placeOrder`)                                                              |
| Pagamentos e webhook                     | `src/server/services/payments.ts`, `src/server/providers/payment/`, `/api/webhooks/payments/[provider]`       |
| E-mails                                  | `src/server/services/emails.ts`, `src/components/email/`                                                      |
| Auditoria                                | `src/lib/audit.ts` (`logAudit`)                                                                               |
| Autenticação                             | `src/lib/auth.ts` (Auth.js), `src/lib/credentials.ts`, `src/lib/session.ts` (`getCurrentUser`, `requireUser`) |
| Proxy (proteção de rotas e UTM)          | `src/proxy.ts`                                                                                                |
| Contas (cadastro, tokens, LGPD)          | `src/server/services/accounts.ts`                                                                             |
| Estrutura comum da loja                  | `src/components/store/store-shell.tsx`                                                                        |
| Área do cliente                          | `src/app/(conta)/`, `src/components/store/account/`                                                           |
| Testes                                   | `tests/unit`, `tests/integration` (Postgres de teste), `tests/e2e` (Playwright, usa o servidor de dev)        |
| Admin: ações com permissão e auditoria   | `src/server/admin/action.ts` (`runAdmin`), `src/server/actions/admin/`                                        |
| Admin: cadastros genéricos               | `src/server/admin/resources/` + `src/app/admin/[recurso]/` (cupons, banners, páginas, frete, categorias...)   |
| Admin: produtos, importação, qualidade   | `src/server/admin/products.ts`, `product-import.ts`, `src/lib/product-quality.ts`                             |
| Admin: listas, filtros e CSV             | `src/server/admin/list.ts`, `exporters.ts`, `src/components/admin/data-table.tsx`, `filter-bar.tsx`           |
| Admin: formulários                       | `src/components/admin/entity-form.tsx` (`EntityForm`, `MiniForm`), `product-form.tsx`                         |
| Relatórios                               | `src/server/admin/reports.ts`                                                                                 |
| Tarefas agendadas                        | `src/server/jobs.ts`, `/api/cron/[tarefa]`                                                                    |
| Screenshots do painel                    | `pnpm tsx scripts/admin-shots.ts <pasta> [largura] /admin/...`                                                |
| Redirecionamentos legados e 404          | `src/server/services/legacy-redirects.ts` (chamado pelo proxy), `src/components/store/not-found-content.tsx`  |
| Leads, newsletter e formulários públicos | `src/server/services/leads.ts`, `src/server/actions/leads.ts`, `src/components/store/public-forms.tsx`        |
| Cookies, consentimento e scripts         | `src/lib/consent.ts`, `src/components/store/cookie-consent.tsx`                                               |
| Sitemap, robots, imagem OG, cabeçalhos   | `src/app/sitemap.ts`, `robots.ts`, `og/route.tsx`, `next.config.ts`                                           |
| Plano e progresso                        | `docs/PLANO.md`                                                                                               |
| Decisões                                 | `docs/DECISOES.md`                                                                                            |
| Pendências do dono                       | `docs/PENDENCIAS-DO-DONO.md`                                                                                  |

@AGENTS.md
