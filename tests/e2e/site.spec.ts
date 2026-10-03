import { expect, test } from "@playwright/test";
import { db, mailTo, uniqueEmail } from "./helpers";

test.afterAll(() => db.$disconnect());

test("URL do site antigo responde 301 para a categoria nova", async ({ request }) => {
  const response = await request.get("/decoracao/orquideas-naturais-86355227", { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(new URL(response.headers().location, "http://localhost").pathname).toBe(
    "/categoria/plantas-naturais/orquideas",
  );

  // Maiúsculas, barra final e parâmetros de sessão do site antigo não mudam o resultado.
  const messy = await request.get("/Decoracao/Orquideas-Naturais-86355227/?IDLoja=123&mob=true", {
    maxRedirects: 5,
  });
  expect(new URL(messy.url()).pathname).toBe("/categoria/plantas-naturais/orquideas");

  const search = await request.get("/listaprodutos.asp?avancada=true&Texto=vaso", {
    maxRedirects: 0,
  });
  expect(search.status()).toBe(301);
  expect(search.headers().location).toContain("/busca?q=vaso");

  // Endereço que não existe responde 404 de verdade e entra na lista do painel.
  const path = `/pagina-que-nao-existe-${Date.now().toString(36)}`;
  expect((await request.get(path)).status()).toBe(404);
  await expect.poll(() => db.notFoundLog.count({ where: { path } })).toBe(1);
  await db.notFoundLog.deleteMany({ where: { path } });
});

test("pop-up de boas-vindas capta o lead com consentimento, mostra o cupom e não reaparece na sessão", async ({
  browser,
}) => {
  // Contexto limpo: sem o estado padrão dos testes (pop-up já visto).
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    locale: "pt-BR",
  });
  const page = await context.newPage();
  const email = uniqueEmail("lead");
  await page.goto("/");
  await page.getByRole("button", { name: "Recusar opcionais" }).click();

  // Metade da página rolada abre o pop-up.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.6));
  const dialog = page.getByRole("dialog", { name: /Ganhe \d+% na primeira compra/ });
  await expect(dialog).toBeVisible();

  // Sem o consentimento marcado, nada é enviado.
  await dialog.getByRole("textbox", { name: "E-mail" }).fill(email);
  await dialog.getByRole("button", { name: "Quero meu cupom" }).click();
  await expect(dialog.getByText("Marque a caixa de consentimento")).toBeVisible();
  expect(await db.lead.count({ where: { email } })).toBe(0);

  await dialog.getByRole("checkbox").check();
  await page.waitForTimeout(1600); // tempo mínimo de preenchimento, contra robôs
  await dialog.getByRole("button", { name: "Quero meu cupom" }).click();
  await expect(dialog.getByText("BEMVINDO10")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Copiar código" })).toBeVisible();

  const lead = await db.lead.findFirstOrThrow({ where: { email } });
  expect(lead.source).toBe("POPUP");
  expect(lead.consentAt).not.toBeNull();
  expect(lead.consentText).toContain("Aceito receber novidades");
  expect(lead.couponIssued).toBe("BEMVINDO10");
  expect(lead.confirmedAt).toBeNull();
  await expect
    .poll(() => mailTo(page.request, email))
    .toContain("Seu cupom de 10% na primeira compra");

  // Fecha com Esc e não reaparece ao navegar e rolar de novo.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.goto("/categoria/vasos");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.8));
  await page.waitForTimeout(800);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Descadastro em um clique.
  await page.goto(`/descadastrar/${lead.unsubscribeToken}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Você não vai mais receber novidades" }),
  ).toBeVisible();
  expect(
    (await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).unsubscribedAt,
  ).not.toBeNull();
  await context.close();
});

test("scripts de analytics só carregam depois do consentimento", async ({ browser }) => {
  await db.storeSetting.upsert({
    where: { key: "analytics" },
    update: { value: { ga4Id: "G-TESTE12345", metaPixelId: "" } },
    create: { key: "analytics", value: { ga4Id: "G-TESTE12345", metaPixelId: "" } },
  });
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    locale: "pt-BR",
  });
  const page = await context.newPage();
  const thirdParty: string[] = [];
  await page.route(/googletagmanager\.com|google-analytics\.com|facebook\.(net|com)/, (route) => {
    thirdParty.push(route.request().url());
    return route.abort();
  });
  try {
    // O cache das configurações é renovado ao salvar pelo painel; aqui o teste espera a página refletir.
    await expect
      .poll(async () => {
        await page.goto("/contato");
        await page.getByRole("button", { name: "Aceitar todos" }).waitFor();
        return thirdParty.length;
      })
      .toBe(0);
    await page.getByRole("button", { name: "Aceitar todos" }).click();
    await expect(page.getByRole("region", { name: "Uso de cookies" })).toHaveCount(0);
    const cookies = await context.cookies();
    expect(
      decodeURIComponent(cookies.find((cookie) => cookie.name === "nsg_consent")?.value ?? ""),
    ).toContain('"analytics":true');
  } finally {
    await db.storeSetting.deleteMany({ where: { key: "analytics" } });
    await context.close();
  }
});

test("formulário de contato grava a mensagem e avisa a loja", async ({ page }) => {
  const email = uniqueEmail("contato");
  await page.goto("/contato");
  await page.getByRole("textbox", { name: "Nome" }).fill("Paula Teste Contato");
  await page.getByRole("main").getByRole("textbox", { name: "E-mail" }).fill(email);
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.getByText("Escreva a mensagem com pelo menos 10 caracteres.")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Mensagem" })
    .fill("Gostaria de saber se vocês montam arranjos para eventos.");
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.getByText("Mensagem enviada. Respondemos em até um dia útil.")).toBeVisible();
  const message = await db.contactMessage.findFirstOrThrow({ where: { email } });
  expect(message.status).toBe("NEW");
  await db.contactMessage.delete({ where: { id: message.id } });
});
