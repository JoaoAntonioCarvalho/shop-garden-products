# Net Shop Garden

E-commerce de plantas naturais, orquídeas, arranjos, vasos, cachepots, flores artificiais, decoração e jardinagem. Substitui o site antigo (FastCommerce/ASP), mantendo as URLs antigas com redirecionamento 301.

Tudo funciona de verdade, menos duas coisas, que são simuladas atrás de interfaces trocáveis: o **pagamento** (Pix, cartão e boleto) e a **cotação de frete por transportadora**. Nenhum dinheiro é movimentado.

## Requisitos

- Node.js 22 e pnpm (`corepack enable`)
- Docker (PostgreSQL 16 e Mailpit)

## Subir do zero

```bash
cp .env.example .env        # preencha AUTH_SECRET (openssl rand -base64 32) e ADMIN_PASSWORD
docker compose up -d        # PostgreSQL e Mailpit
pnpm install
pnpm db:reset               # cria as tabelas e os dados de teste (apaga o banco local)
pnpm dev                    # http://localhost:3100
```

Em um banco vazio, `pnpm db:deploy && pnpm db:seed` faz o mesmo sem apagar nada. O seed pode ser rodado de novo sem duplicar dados.

A porta é a 3100 (definida nos scripts `dev` e `start` do `package.json` e em `APP_URL`).

## Acessos de teste

| Quem          | E-mail                  | Senha                      | Onde     |
| ------------- | ----------------------- | -------------------------- | -------- |
| Administrador | `ADMIN_EMAIL` do `.env` | `ADMIN_PASSWORD` do `.env` | `/admin` |
| Equipe        | `expedicao@example.com` | `Equipe@123`               | `/admin` |
| Cliente       | `cliente@example.com`   | `Cliente@123`              | `/conta` |

### Pagamento simulado

- **Pix e boleto**: na página do pedido aparecem os botões do simulador ("Simular pagamento aprovado", "Simular expiração"). Eles chamam o webhook de verdade, com assinatura. O simulador não existe em produção.
- **Cartões de teste** (qualquer validade futura e qualquer CVV):

| Número                | Resultado             |
| --------------------- | --------------------- |
| `4000 0000 0002 0000` | Aprovado              |
| `4000 0000 0000 0002` | Recusado por saldo    |
| `4000 0000 0007 0005` | Recusado por suspeita |

O número, a validade e o CVV nunca chegam ao servidor: o navegador troca os dados por um token, como um gateway real faz.

### E-mails

Em desenvolvimento, todo e-mail cai no Mailpit: <http://localhost:8025>. No painel, **E-mails enviados** mostra o histórico e o conteúdo.

## Scripts

| Comando                    | O que faz                                                       |
| -------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                 | Servidor de desenvolvimento                                     |
| `pnpm build`, `pnpm start` | Build e servidor de produção                                    |
| `pnpm lint`                | ESLint                                                          |
| `pnpm typecheck`           | Tipos de rota do Next e `tsc`                                   |
| `pnpm test`                | Vitest: testes unitários e de integração (usa o banco de teste) |
| `pnpm test:e2e`            | Playwright, contra o servidor de desenvolvimento                |
| `pnpm db:migrate`          | Cria e aplica uma migração em desenvolvimento                   |
| `pnpm db:deploy`           | Aplica as migrações (produção)                                  |
| `pnpm db:seed`             | Dados de teste (idempotente)                                    |
| `pnpm db:reset`            | Apaga o banco local, recria e roda o seed                       |
| `pnpm db:studio`           | Prisma Studio                                                   |
| `pnpm images:placeholders` | Gera de novo as imagens de teste                                |

Os testes e2e compram produtos de verdade no banco de desenvolvimento; antes de cada arquivo, os produtos usados são reabastecidos.

## Remover os dados de teste

O seed cria cerca de 160 produtos, 220 pedidos, 80 clientes, avaliações e leads, todos marcados como **Teste**. Quando o catálogo real estiver cadastrado, entre como administrador em **Produtos › Remover todos os produtos de teste**, digite `REMOVER TESTES` e confirme. Nada do que é real é alterado.

## Estrutura

```
prisma/               schema, migrações e seed
src/app/(loja)        home, categorias, produto, busca, sacola, páginas institucionais
src/app/(checkout)    checkout e página do pedido
src/app/(conta)       login, cadastro, área do cliente, rastreio
src/app/admin         painel administrativo
src/app/api           webhooks de pagamento, CEP, busca, tarefas agendadas
src/components        ui (primitivas da loja), store, admin, email
src/config            configuração central da loja, árvore de categorias
src/server            services (regras de negócio), providers, actions, admin, jobs
tests                 unit, integration, e2e
docs                  especificação, plano, decisões, arquitetura, integrações, manual do painel
```

Mais em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md). O que depende do dono da loja está em [`docs/PENDENCIAS-DO-DONO.md`](docs/PENDENCIAS-DO-DONO.md). O uso do painel está em [`docs/ADMIN-MANUAL.md`](docs/ADMIN-MANUAL.md).

## Deploy

### Passo a passo na Vercel

1. **Repositório:** envie o código para um repositório privado no GitHub e importe-o na Vercel. O framework é detectado sozinho; o build usa `vercel-build`, que aplica as migrações antes de compilar.
2. **Banco:** em Storage, crie um Postgres Neon ligado ao projeto. Ele preenche `DATABASE_URL` e `DATABASE_URL_UNPOOLED` (usada só pelas migrações).
3. **Imagens:** crie um bucket S3 ou Cloudflare R2 com endereço público e preencha `STORAGE_DRIVER=s3` e as variáveis `S3_*`. Sem isso, nenhum envio de foto funciona na Vercel.
4. **Variáveis:** `AUTH_SECRET` (`openssl rand -base64 32`), `APP_URL` (o endereço https do site), `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `CRON_SECRET`. `SMTP_*` quando houver e-mail contratado.
5. **Dados iniciais:** na sua máquina, com a `DATABASE_URL` de produção e as variáveis `S3_*` no ambiente, rode `pnpm db:seed` uma vez. Ele cria o administrador, as categorias, as páginas e as regras de frete, além dos dados de teste, que saem depois em Admin > Produtos > Remover todos os produtos de teste.
6. **Catálogo antigo:** `pnpm import:legacy data-privada/arquivo.csv`, também com a `DATABASE_URL` de produção. Depois, Admin > Curadoria.
7. **Tarefas agendadas:** já declaradas em `vercel.json`, uma vez por dia, que é o que o plano Hobby aceita. No plano Pro, passe `expirar-pagamentos` para `*/5 * * * *` e `carrinhos-abandonados` e `rastreio-transportadoras` para `0 * * * *`.

O plano Hobby da Vercel não permite uso comercial: serve para a curadoria e os testes, não para a loja vendendo.

### Em qualquer hospedagem

Recomendado: Vercel (ou qualquer hospedagem Node 22) + PostgreSQL gerenciado + armazenamento S3 ou R2 + SMTP.

1. **Banco**: crie um PostgreSQL 16 com as extensões `unaccent` e `pg_trgm` permitidas. Rode `pnpm db:deploy` com a `DATABASE_URL` de produção. Não rode o seed em produção, a menos que queira os dados de teste para homologar.
2. **Variáveis de ambiente**: as do `.env.example`. Obrigatórias: `DATABASE_URL`, `AUTH_SECRET`, `APP_URL` (com https), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SMTP_*`, `EMAIL_FROM`, `CRON_SECRET`. Nenhum segredo usa o prefixo `NEXT_PUBLIC_`.
3. **Imagens**: `STORAGE_DRIVER=s3` com `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` e `S3_PUBLIC_URL`. A pasta local `uploads/` não sobrevive em hospedagem sem disco.
4. **E-mail**: um SMTP transacional (Amazon SES, Resend, Brevo...) com SPF e DKIM do domínio.
5. **Primeiro administrador**: `pnpm db:seed` cria o usuário de `ADMIN_EMAIL`; em produção sem seed, crie pelo Prisma Studio com a senha em bcrypt, ou rode o seed uma vez e remova os dados de teste pelo painel.
6. **Pagamento e frete reais**: veja [`docs/INTEGRACOES.md`](docs/INTEGRACOES.md). Enquanto `PAYMENT_PROVIDER=mock`, a loja não cobra ninguém.

### Tarefas agendadas

Cada tarefa é uma chamada HTTP com o cabeçalho `Authorization: Bearer $CRON_SECRET`:

| Endereço                          | Frequência sugerida    | O que faz                                         |
| --------------------------------- | ---------------------- | ------------------------------------------------- |
| `/api/cron/expirar-pagamentos`    | a cada 5 minutos       | Expira Pix e boleto vencidos e devolve o estoque  |
| `/api/cron/carrinhos-abandonados` | a cada hora            | Marca as sacolas paradas há mais de 2 horas       |
| `/api/cron/vendas-30-dias`        | todo dia, de madrugada | Atualiza "mais vendidos" e a nota de qualidade    |
| `/api/cron/estoque-baixo`         | todo dia, de manhã     | Envia o resumo de estoque baixo ao e-mail interno |
| `/api/cron/limpar-carrinhos`      | todo dia, de madrugada | Apaga sacolas vencidas                            |

Na Vercel, declare em `vercel.json` (`crons`); a Vercel envia o `CRON_SECRET` sozinha quando a variável existe. Em servidor próprio, use o `cron` do sistema:

```
*/5 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://www.exemplo.com.br/api/cron/expirar-pagamentos
```

O painel (**Tarefas agendadas**) mostra a última execução de cada uma e permite rodar na hora.
