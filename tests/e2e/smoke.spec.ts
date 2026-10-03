import { expect, test } from "@playwright/test";

test("aplicação sobe, o banco responde e a home mostra o catálogo", async ({ page, request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBe(true);
  expect(await health.json()).toMatchObject({ database: "ok" });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Mais vendidos" })).toBeVisible();
});
