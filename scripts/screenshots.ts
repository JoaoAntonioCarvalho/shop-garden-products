/**
 * Revisão visual: tira screenshots de página inteira em 390, 768 e 1440 px.
 * Uso: pnpm tsx scripts/screenshots.ts <pasta-de-saida> /caminho [/outro-caminho ...]
 * Precisa do servidor rodando (pnpm dev).
 */
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [outDir, ...paths] = process.argv.slice(2);
if (!outDir || paths.length === 0) {
  console.error("Uso: tsx scripts/screenshots.ts <pasta-de-saida> /caminho [...]");
  process.exit(1);
}

const baseURL = process.env.APP_URL ?? "http://localhost:3100";
const widths = [390, 768, 1440];

async function main() {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
    });
    const page = await context.newPage();
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(message.text());
    });
    page.on("pageerror", (error) => problems.push(error.message));
    for (const path of paths) {
      await page.goto(baseURL + path, { waitUntil: "networkidle" });
      // Rola a página inteira para carregar as imagens com lazy loading antes da captura.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 60));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      const name =
        (path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home") + `-${width}.png`;
      await page.screenshot({ path: join(outDir, name), fullPage: true });
      console.log(`${name}${overflow > 0 ? `  ESTOURO HORIZONTAL de ${overflow}px` : ""}`);
    }
    if (problems.length) console.log(`  erros no console (${width}px):`, [...new Set(problems)]);
    await context.close();
  }
  await browser.close();
}

main();
