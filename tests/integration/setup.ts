import "dotenv/config";

// Precisa ser importado ANTES de "@/lib/db": aponta o cliente Prisma para o banco de teste.
export const hasTestDatabase = Boolean(process.env.DATABASE_URL_TEST);
if (hasTestDatabase) process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

let counter = 0;
/** Sufixo único por execução, para os testes não colidirem com dados de execuções anteriores. */
export const unique = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;
