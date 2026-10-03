import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { addToCart, db, freezeTime, restockTestProducts } from "./helpers";

test.beforeAll(() => restockTestProducts());
test.afterAll(() => db.$disconnect());

test("da home à sacola: categoria, filtro, produto com variação, frete e sacola", async ({
  page,
  context,
}) => {
  await freezeTime(context);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Home → categoria (o link da categoria na home).
  await page.locator('a[href="/categoria/cachepots"]').first().click();
  await page.waitForURL("**/categoria/cachepots");
  await expect(page.getByRole("heading", { level: 1, name: "Cachepots" })).toBeVisible();
  const total = await page
    .getByRole("main")
    .getByRole("listitem")
    .filter({ has: page.getByRole("link") })
    .count();

  // Filtro: fica na URL e reduz a lista.
  await page
    .getByRole("complementary", { name: "Filtros" })
    .getByRole("checkbox", { name: /Cerâmica/ })
    .first()
    .click(); // o estado do filtro vem da URL, então a caixa só marca depois da navegação
  await page.waitForURL(/material=/);
  await expect(
    page.getByRole("link", { name: /Cachepot de cerâmica branca fosca/ }).first(),
  ).toBeVisible();
  expect(total).toBeGreaterThan(0);

  // Produto com variações: escolher a variação muda o preço.
  await page
    .getByRole("link", { name: /Cachepot de cerâmica branca fosca/ })
    .first()
    .click();
  await page.waitForURL("**/produto/cachepot-de-ceramica-branca-fosca");
  await expect(
    page.getByRole("heading", { level: 1, name: "Cachepot de cerâmica branca fosca" }),
  ).toBeVisible();
  const variants = await db.productVariant.findMany({
    where: { product: { slug: "cachepot-de-ceramica-branca-fosca" }, isActive: true },
    orderBy: { position: "asc" },
  });
  expect(variants.length).toBeGreaterThan(1);
  const chosen = variants[1];
  const optionLabel = Object.values(chosen.options as Record<string, string>)[0];
  await page.getByRole("button", { name: optionLabel, exact: true }).click();
  await expect(page.getByRole("button", { name: optionLabel, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const price = (chosen.priceCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  await expect(page.getByRole("main").getByText(price).first()).toBeVisible();

  // Frete calculado no servidor para o CEP informado.
  await page.getByRole("textbox", { name: "Calcular frete e prazo" }).fill("01310100");
  await page.getByRole("button", { name: "Calcular frete" }).click();
  await expect(page.getByText("Entrega agendada").first()).toBeVisible();

  // Sacola: o item entra com a variação escolhida.
  await page.getByRole("button", { name: "Adicionar à sacola" }).first().click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("heading", { name: "Adicionado à sacola" })).toBeVisible();
  await drawer.getByRole("link", { name: "Ver sacola" }).click();
  await page.waitForURL("**/carrinho");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("main").getByText("Cachepot de cerâmica branca fosca").first(),
  ).toBeVisible();
  await expect(page.getByRole("main").getByText(optionLabel).first()).toBeVisible();
});

async function expectAccessible(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(
    serious.map(
      (violation) =>
        `${name}: ${violation.id} (${violation.nodes.length}) ${violation.nodes[0]?.target.join(" ")}`,
    ),
  ).toEqual([]);
}

test("axe: sem violações sérias ou críticas na loja, no checkout, na conta e no painel", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await freezeTime(context);
  for (const [name, path] of [
    ["home", "/"],
    ["categoria", "/categoria/plantas-naturais/orquideas"],
    ["produto", "/produto/vaso-esmaltado-azul"],
    ["ajuda", "/ajuda"],
    ["contato", "/contato"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectAccessible(page, name);
  }

  await addToCart(page, "vaso-esmaltado-azul");
  await page.goto("/carrinho");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectAccessible(page, "sacola");
  await page.goto("/checkout");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectAccessible(page, "checkout");

  // Conta do cliente.
  await page.goto("/entrar");
  await expectAccessible(page, "entrar");
  await page.getByRole("main").getByRole("textbox", { name: "E-mail" }).fill("cliente@example.com");
  await page.getByRole("textbox", { name: "Senha" }).fill("Cliente@123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/conta");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectAccessible(page, "conta");
  await page.goto("/conta/pedidos");
  await expectAccessible(page, "pedidos da conta");

  // Painel administrativo.
  await context.clearCookies({ name: /authjs/ });
  await page.goto("/entrar");
  await page
    .getByRole("main")
    .getByRole("textbox", { name: "E-mail" })
    .fill(process.env.ADMIN_EMAIL ?? "");
  await page.getByRole("textbox", { name: "Senha" }).fill(process.env.ADMIN_PASSWORD ?? "");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/admin");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await expectAccessible(page, "dashboard do admin");
  for (const [name, path] of [
    ["pedidos do admin", "/admin/pedidos"],
    ["produtos do admin", "/admin/produtos"],
    ["estoque do admin", "/admin/estoque"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectAccessible(page, name);
  }
});
