// Roda um comando com as variáveis de um arquivo .env (os valores podem ter "&" e outros
// caracteres que quebram o `source` do shell). Uso: node scripts/with-env.mjs .env.vercel pnpm build
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";

const [file, command, ...args] = process.argv.slice(2);
const result = spawnSync(command, args, {
  stdio: "inherit",
  env: { ...process.env, ...parse(readFileSync(file)) },
});
process.exit(result.status ?? 1);
