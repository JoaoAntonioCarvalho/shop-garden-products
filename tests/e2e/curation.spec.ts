import { expect, test, type Page } from "@playwright/test";
import { db } from "./helpers";

const key = `E2E-CUR-${Date.now().toString(36)}`.toUpperCase();
const names = ["Antúrio", "Begônia", "Calatéia"].map((plant) => `${plant} ${key}`);

test.beforeAll(async () => {
  for (const [index, name] of names.entries())
    await db.product.create({
      data: {
        name,
        slug: `${key}-${index}`.toLowerCase(),
        sku: `${key}-${index}`,
        productType: "NATURAL_PLANT",
        status: "DRAFT",
        curation: "PENDING",
        minPriceCents: 5990,
        searchText: name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
        variants: { create: { sku: `${key}-${index}-V`, name: "Padrão", priceCents: 5990 } },
      },
    });
});

test.afterAll(async () => {
  await db.product.deleteMany({ where: { sku: { startsWith: key } } });
  await db.$disconnect();
});

async function loginAdmin(page: Page) {
  await page.goto("/entrar");
  await page
    .getByRole("main")
    .getByRole("textbox", { name: "E-mail" })
    .fill(process.env.ADMIN_EMAIL ?? "");
  await page.getByRole("textbox", { name: "Senha" }).fill(process.env.ADMIN_PASSWORD ?? "");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/admin");
}

const product = (index: number) =>
  db.product.findUniqueOrThrow({
    where: { sku: `${key}-${index}` },
    include: { variants: true },
  });

test("curadoria: editar no card, manter, excluir, restaurar da aba Excluídos e revisar um por um", async ({
  page,
}) => {
  await loginAdmin(page);
  await page.goto(`/admin/curadoria?busca=${key}`);
  const cards = page.getByRole("listitem").filter({ hasText: key });
  await expect(cards).toHaveCount(3);

  // Nome e preço são editados no próprio card e salvos ao sair do campo.
  const renamed = `Antúrio vermelho ${key}`;
  await page.getByRole("textbox", { name: `Nome de ${names[0]}` }).fill(renamed);
  await page.getByRole("textbox", { name: `Nome de ${names[0]}` }).press("Enter");
  await expect(page.getByText("Nome alterado", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: `Preço de ${renamed}` }).fill("74,50");
  await page.getByRole("textbox", { name: `Preço de ${renamed}` }).press("Enter");
  await expect(page.getByText("Preço alterado", { exact: true })).toBeVisible();
  await expect.poll(async () => (await product(0)).variants[0].priceCents).toBe(7450);
  expect((await product(0)).name).toBe(renamed);

  // Manter tira o produto da fila.
  await page.getByRole("button", { name: `Manter ${renamed}` }).click();
  await expect(cards).toHaveCount(2);
  await expect.poll(async () => (await product(0)).curation).toBe("KEPT");

  // Excluir manda para a lixeira; "Desfazer" traz de volta na hora.
  await page.getByRole("button", { name: `Excluir ${names[1]}` }).click();
  await expect(cards).toHaveCount(1);
  await page
    .locator("li", { hasText: "1 produto excluído" })
    .getByRole("button", { name: "Desfazer" })
    .click();
  await expect(cards).toHaveCount(2);
  await expect.poll(async () => (await product(1)).deletedAt).toBeNull();

  await page.getByRole("button", { name: `Excluir ${names[1]}` }).click();
  await expect(cards).toHaveCount(1);
  await expect.poll(async () => (await product(1)).deletedAt).not.toBeNull();

  // Aba Excluídos: o mais recente vem primeiro e pode ser restaurado.
  await page.getByRole("link", { name: /Excluídos/ }).click();
  await page.waitForURL(/aba=excluidos/);
  const first = page.getByRole("listitem").filter({ hasText: "Excluído em" }).first();
  await expect(first).toContainText(names[1]);
  await page.getByRole("button", { name: `Restaurar ${names[1]}` }).click();
  await expect.poll(async () => (await product(1)).deletedAt).toBeNull();
  expect((await product(1)).curation).toBe("PENDING");

  // Um por um, pelo teclado: D mantém com destaque, X exclui.
  await page.goto(`/admin/curadoria?busca=${key}`);
  await page.getByRole("button", { name: "Revisar um por um" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("textbox", { name: `Nome de ${names[1]}` })).toBeVisible();
  await page.keyboard.press("d");
  await expect(dialog.getByRole("textbox", { name: `Nome de ${names[2]}` })).toBeVisible();
  await page.keyboard.press("x");
  await expect(dialog.getByText("Você passou por todos os produtos desta lista.")).toBeVisible();
  await expect.poll(async () => (await product(1)).isFeatured).toBe(true);
  await expect.poll(async () => (await product(2)).deletedAt).not.toBeNull();

  // A lista de produtos do painel não mostra o que está na lixeira.
  await page.goto(`/admin/produtos?busca=${key}`);
  await expect(page.getByRole("link", { name: renamed })).toBeVisible();
  await expect(page.getByText(names[2])).toHaveCount(0);
});
