# Arquitetura

## Visão geral

Aplicação única em Next.js (App Router). As páginas são Server Components; a interatividade fica em componentes de cliente pequenos (sacola, checkout, filtros, formulários). Toda regra de negócio roda no servidor, em `src/server/services`, e o navegador só exibe.

```
navegador ─► src/proxy.ts ─► páginas (Server Components) ─► services ─► Prisma ─► PostgreSQL
                              server actions / route handlers ─┘            └► providers (pagamento, frete, e-mail, imagens)
```

## Camadas

| Camada    | Onde                   | Papel                                                                                      |
| --------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| Proxy     | `src/proxy.ts`         | Redirecionamentos das URLs antigas, proteção de `/conta` e `/admin`, captura de UTM        |
| Páginas   | `src/app`              | Buscam dados nos services e montam a tela                                                  |
| Actions   | `src/server/actions`   | Entrada de dados do navegador: validam com Zod, checam permissão, chamam os services       |
| Services  | `src/server/services`  | Regras de negócio. Os de cálculo (preço, cupom, totais, status, filtros) são funções puras |
| Providers | `src/server/providers` | Interfaces para o que é externo: pagamento, frete, e-mail, armazenamento                   |
| Admin     | `src/server/admin`     | Consultas e regras do painel, cadastros genéricos, relatórios, exportações                 |
| Dados     | `prisma/schema.prisma` | 50 tabelas. Dinheiro sempre em centavos (`Int`)                                            |

## Princípios que o código segue

- **O servidor é a única fonte de verdade** para preço, desconto, frete e estoque. O total é recalculado na criação do pedido e comparado com o que o cliente viu; se mudou, o envio para e a diferença é explicada.
- **Uma só conta de totais** (`totals.ts`) para sacola, checkout, pedido e pedido manual.
- **Nada de contato, prazo ou desconto escrito em componente.** Tudo vem de `getStoreSettings()`, que mescla `src/config/store.config.ts` com o que o admin salvou. Textos usam marcadores como `{{freteGratis}}`.
- **Toda ação do painel passa por `runAdmin`**: permissão no servidor, validação e auditoria.

## Fluxo do pedido

1. **Sacola** (`cart.ts`): fica no banco, ligada a um cookie httpOnly. Não reserva estoque; a disponibilidade é revalidada a cada abertura.
2. **Checkout** (`checkout.ts`, `placeOrder`): em uma transação, bloqueia as variações (`SELECT ... FOR UPDATE`, em ordem de id), confere o estoque, recalcula preço, cupom e frete, cria o pedido, **reserva** o estoque e registra o uso do cupom. Uma chave de idempotência impede o pedido duplicado.
3. **Pagamento** (`payments.ts`): o provider cria a cobrança. O resultado chega pelo webhook assinado (`/api/webhooks/payments/[provider]`), que é idempotente.
4. **Status** (`orders.ts`, `transitionOrder`): única porta para mudar o status. Bloqueia a linha do pedido, valida a transição na máquina de estados (`order-status.ts`), ajusta o estoque e grava o histórico. E-mails, estorno e cache acontecem depois do commit.

```
PENDING_PAYMENT ─► PAID ─► PREPARING ─► SHIPPED ──────────► DELIVERED ─► RETURNED
       │             │          │   └─► OUT_FOR_DELIVERY ─► DELIVERED
       ▼             ▼          │   └─► READY_FOR_PICKUP ─► DELIVERED
    EXPIRED       CANCELED ◄────┘
```

5. **Estoque** (`inventory.ts`): disponível = em estoque − reservado. Pedido criado reserva; pagamento confirmado baixa; expiração e cancelamento liberam; devolução repõe. Todo movimento fica em `InventoryMovement`. O banco tem `CHECK` que impede estoque negativo e reserva maior que o estoque.

## Catálogo

`getCatalogIndex()` mantém em cache uma linha enxuta por produto ativo. Categoria, coleção, busca e vitrines filtram, ordenam, contam facetas e paginam em memória (`catalog-filters.ts`, funções puras) e só então buscam os cards da página. Cada listagem faz no máximo duas consultas. A busca usa `unaccent` e `pg_trgm` sobre `Product.searchText`.

Campos desnormalizados do produto (`minPriceCents`, `totalAvailable`, `searchText`, `qualityScore`, `salesCount30d`, nota média) são recalculados por `refreshProductDerived`, pelo estoque e pela tarefa diária.

## Cache

`unstable_cache` com tags: `settings`, `categories`, `catalog`, `home`, `pages` e `product:[slug]`. O painel invalida a tag correspondente a cada alteração. Estoque e preço da página de produto e do carrinho nunca vêm do cache.

## Autenticação e permissões

Auth.js com e-mail e senha (bcrypt, custo 12) e sessão JWT. O papel (`CUSTOMER`, `STAFF`, `ADMIN`) é conferido no banco a cada requisição, então rebaixar ou desativar alguém vale na hora. A matriz fica em `src/lib/permissions.ts` e a função `can()` é usada na interface e no servidor.

Três barreiras: o proxy, a página (`requireAdminPage`) e a action ou rota (`requirePermission`).

## Providers

| Interface          | Implementação atual                      | Trocar por                          |
| ------------------ | ---------------------------------------- | ----------------------------------- |
| `PaymentProvider`  | `mock` (Pix, cartão, boleto)             | Gateway real (ver `INTEGRACOES.md`) |
| `ShippingProvider` | `mock` (regras da tabela `ShippingRule`) | Melhor Envio, Correios              |
| `EmailProvider`    | SMTP (Nodemailer)                        | Resend, SES por API                 |
| `StorageProvider`  | `local` (`./uploads`) e `s3`             | Qualquer serviço compatível com S3  |

## Painel

- **Módulos com fluxo próprio**: pedidos, produtos, estoque, mídia, clientes, avaliações, relatórios, configurações.
- **Cadastros genéricos**: cupons, banners, depoimentos, ocasiões, páginas, FAQ, seções da home, regras de frete, feriados, redirecionamentos, categorias e coleções são definições em `src/server/admin/resources/`; as telas em `src/app/admin/[recurso]` e as ações são as mesmas para todos.
- **Listas**: busca, filtros, ordenação e paginação no servidor, com o estado na URL. Exportações CSV em `exporters.ts`, sempre auditadas.

## Segurança e LGPD

- Cabeçalhos em `next.config.ts`: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS em produção.
- Limite de requisições em login, cadastro, senha, rastreio, busca e formulários públicos (`rate-limit.ts`).
- Formulários públicos com campo-isca e tempo mínimo. HTML rico sanitizado ao salvar e ao exibir.
- Upload validado pelo conteúdo, sem EXIF, com nome gerado.
- IP guardado só como hash com sal. CPF mascarado; revelar fica na auditoria. Dados de cartão nunca chegam ao servidor.
- Consentimento de e-mail e WhatsApp separado, nunca pré-marcado, com texto, data e origem. Double opt-in e descadastro em um clique. Exportação e exclusão de dados pelo cliente, com fila no painel.
- Scripts de análise e marketing só depois do consentimento de cookies.

## Testes

- **Unitários** (`tests/unit`): preço, cupons, totais, frete, status, validadores, contraste, e-mails, permissões, qualidade de cadastro, slug.
- **Integração** (`tests/integration`, PostgreSQL de teste): estoque com concorrência, pedidos e pagamentos, contas, produtos e importação, redirecionamentos, leads.
- **E2E** (`tests/e2e`, Playwright): os 13 cenários da especificação, com axe.
