import "dotenv/config";
import { execSync } from "node:child_process";

/** Aplica as migrações no banco de teste (netshopgarden_test). Não apaga dados: é só `migrate deploy`. */
export default function setup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    console.warn("DATABASE_URL_TEST não definida: os testes de integração serão pulados.");
    return;
  }
  execSync("pnpm prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
