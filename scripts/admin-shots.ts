/**
 * Screenshots do painel administrativo, já logado como admin.
 * Uso: pnpm tsx scripts/admin-shots.ts <pasta-de-saida> [largura] /admin /admin/pedidos ...
 */
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const [outDir, ...rest] = process.argv.slice(2);
const width = /^\d+$/.test(rest[0] ?? "") ? Number(rest.shift()) : 1440;
const base = process.env.APP_URL ?? "http://localhost:3100";

(async () => {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height: 900 }, locale: "pt-BR" });
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  await page.goto(`${base}/entrar`);
  await page
    .getByRole("main")
    .getByRole("textbox", { name: "E-mail" })
    .fill(process.env.ADMIN_EMAIL ?? "");
  await page.getByRole("textbox", { name: "Senha" }).fill(process.env.ADMIN_PASSWORD ?? "");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/admin");
  for (const path of rest) {
    const response = await page.goto(base + path, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    const name = `${path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-${width}.png`;
    await page.screenshot({ path: `${outDir}/${name}`, fullPage: true });
    console.log(
      `${response?.status()} ${path}${overflow > 0 ? `  ESTOURO HORIZONTAL de ${overflow}px` : ""}`,
    );
  }
  if (problems.length) console.log("erros no console:", [...new Set(problems)].slice(0, 5));
  await browser.close();
})().catch((error) => {
  console.error("FALHOU:", String(error.message).split("\n").slice(0, 5).join("\n"));
  process.exit(1);
});
