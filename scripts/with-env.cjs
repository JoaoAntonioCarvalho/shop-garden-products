// Roda um comando com as variáveis de um arquivo .env (os valores podem ter "&" e outros
// caracteres que quebram o `source` do shell). Uso: node scripts/with-env.cjs .env.vercel pnpm build
const { spawnSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { parse } = require("dotenv");

const [file, command, ...args] = process.argv.slice(2);
const result = spawnSync(command, args, {
  stdio: "inherit",
  env: { ...process.env, ...parse(readFileSync(file)) },
});
process.exit(result.status ?? 1);
