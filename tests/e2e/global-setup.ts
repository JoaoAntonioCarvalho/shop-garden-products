import { db } from "./helpers";

/**
 * Zera os contadores do limite de requisições antes da bateria. Sem isso, rodar os testes várias
 * vezes seguidas esgota os limites de cadastro e de formulários públicos, e os testes falham por
 * causa das execuções anteriores.
 */
export default async function globalSetup() {
  await db.rateLimitHit.deleteMany({});
  await db.$disconnect();
}
