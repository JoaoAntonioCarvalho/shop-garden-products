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
