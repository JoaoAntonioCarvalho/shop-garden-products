import "dotenv/config";
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

/** Cliente Prisma para conferir no banco o efeito do que foi feito no navegador. */
export const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

export const MAILPIT = "http://localhost:8025";

/** Quinta-feira, 10h em São Paulo: dia útil, antes do horário de corte. Sempre no futuro próximo. */
export function weekdayMorning(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  while (date.getUTCDay() !== 4) date.setUTCDate(date.getUTCDate() + 1);
  return `${date.toISOString().slice(0, 10)}T10:00:00-03:00`;
}

/** Fixa o horário das cotações e do pedido (só funciona fora de produção). */
export async function freezeTime(context: BrowserContext, iso: string = weekdayMorning()) {
  await context.addCookies([
    {
      name: "nsg_test_now",
      value: encodeURIComponent(iso),
      url: process.env.APP_URL ?? "http://localhost:3100",
    },
  ]);
}

export const uniqueEmail = (prefix: string) => `${prefix}.${Date.now().toString(36)}@example.com`;

export async function addToCart(page: Page, slug: string) {
  await page.goto(`/produto/${slug}`);
  await page.getByRole("button", { name: "Adicionar à sacola" }).first().click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Adicionado à sacola" }),
  ).toBeVisible();
}

export async function fillIdentification(page: Page, email: string) {
  await page.getByRole("textbox", { name: "E-mail" }).fill(email);
  await page.getByRole("textbox", { name: "Nome completo" }).fill("Marina Teste Silva");
  await page.getByRole("textbox", { name: "CPF" }).fill("52998224725");
  await page.getByRole("textbox", { name: "Celular com DDD" }).fill("11987654321");
  await page.getByRole("button", { name: "Continuar para a entrega" }).click();
}

type AddressFixture = {
  cep: string;
  street: string;
  district: string;
  city: string;
  state: string;
};
export const SAO_PAULO: AddressFixture = {
  cep: "01310100",
  street: "Avenida Paulista",
  district: "Bela Vista",
  city: "São Paulo",
  state: "SP",
};
export const RIO: AddressFixture = {
  cep: "22041001",
  street: "Rua Barata Ribeiro",
  district: "Copacabana",
  city: "Rio de Janeiro",
  state: "RJ",
};

/** Preenche o endereço. O ViaCEP pode ou não responder: os campos vazios são preenchidos à mão. */
export async function fillAddress(page: Page, address: AddressFixture) {
  await page.getByRole("textbox", { name: "CEP" }).fill(address.cep);
  // Espera a busca do CEP terminar (com sucesso ou não) antes de completar os campos.
  await page
    .waitForResponse((response) => response.url().includes("/api/cep/"), { timeout: 10_000 })
    .catch(() => undefined);
  await page.waitForTimeout(300);
  for (const [label, value] of [
    ["Rua", address.street],
    ["Bairro", address.district],
    ["Cidade", address.city],
  ] as const) {
    const field = page.getByRole("textbox", { name: label, exact: true });
    if (!(await field.inputValue())) await field.fill(value);
  }
  await page.getByRole("textbox", { name: "Número", exact: true }).fill("1000");
  const state = page.getByRole("combobox", { name: "Estado" });
  if (!(await state.inputValue())) await state.selectOption(address.state);
}

export async function chooseShipping(page: Page, name: RegExp) {
  await page.getByRole("radio", { name }).check();
  // A cotação é refeita com a opção escolhida.
  await expect(page.locator('fieldset[aria-busy="true"]')).toHaveCount(0);
}

export async function reviewAndPlaceOrder(page: Page) {
  await page.getByRole("checkbox", { name: /Li e aceito/ }).check();
  await page.getByRole("button", { name: "Fazer pedido" }).click();
  await page.waitForURL(/\/pedido\/NSG-\d+/, { timeout: 30_000 });
  return page.url().match(/NSG-\d+/)![0];
}

export async function mailTo(request: Page["request"], email: string): Promise<string[]> {
  const response = await request.get(
    `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
  );
  const data = (await response.json()) as { messages: Array<{ Subject: string }> };
  return data.messages.map((message) => message.Subject);
}

export async function availableStock(sku: string): Promise<number> {
  const variant = await db.productVariant.findUniqueOrThrow({
    where: { sku },
    select: { stockOnHand: true, stockReserved: true },
  });
  return variant.stockOnHand - variant.stockReserved;
}
