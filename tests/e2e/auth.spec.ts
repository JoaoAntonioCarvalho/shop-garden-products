import { expect, test } from "@playwright/test";

test("login enviado antes de a página ficar interativa é concluído depois, sem a senha ir para o endereço", async ({
  page,
}) => {
  const visited: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) visited.push(frame.url());
  });
  // Atrasa os scripts: o formulário já está na tela, mas ainda não responde.
  await page.route("**/_next/static/**/*.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.continue();
  });

  await page.goto("/entrar", { waitUntil: "commit" });
  await page.locator('main input[name="email"]').fill(process.env.ADMIN_EMAIL ?? "");
  await page.locator('main input[name="password"]').fill(process.env.ADMIN_PASSWORD ?? "");
  await page.locator('main button[type="submit"]').click();

  await page.waitForURL("**/admin", { timeout: 25_000 });
  expect(visited.filter((url) => url.includes("password="))).toEqual([]);
});
