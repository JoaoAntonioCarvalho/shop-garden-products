import { expect, test } from "@playwright/test";

test("aplicação sobe e o banco responde", async ({ page, request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBe(true);
  expect(await health.json()).toMatchObject({ database: "ok" });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Net Shop Garden");
});
