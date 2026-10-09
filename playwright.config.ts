import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.APP_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  // No CI o servidor de desenvolvimento compila cada página na primeira visita, e os testes
  // longos (conta, checkout) passam dos 30 s padrão.
  timeout: process.env.CI ? 120_000 : 30_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    // Os testes começam com os cookies já recusados e o pop-up de boas-vindas já visto, para a
    // barra e o pop-up não cobrirem a página. Os testes deles limpam este estado.
    storageState: {
      cookies: [
        {
          name: "nsg_consent",
          value: encodeURIComponent(JSON.stringify({ analytics: false, marketing: false })),
          domain: new URL(baseURL).hostname,
          path: "/",
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [
        {
          origin: baseURL,
          localStorage: [{ name: "nsg_popup_seen", value: "4102444800000" }],
        },
      ],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
