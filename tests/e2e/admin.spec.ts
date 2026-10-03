import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { db, restockTestProducts } from "./helpers";

test.beforeAll(() => restockTestProducts());

test.afterAll(async () => {
  // O produto criado pelo teste não fica no catálogo de desenvolvimento.
  await db.product.deleteMany({ where: { sku: { startsWith: "E2E-" } } });
  await db.mediaAsset.deleteMany({
    where: { originalName: { startsWith: "e2e-" }, productImages: { none: {} } },
  });
  await db.$disconnect();
});

async function login(page: Page, email: string, password: string) {
  await page.goto("/entrar");
  await page.getByRole("main").getByRole("textbox", { name: "E-mail" }).fill(email);
  await page.getByRole("textbox", { name: "Senha" }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/admin");
}
const loginAdmin = (page: Page) =>
  login(page, process.env.ADMIN_EMAIL ?? "", process.env.ADMIN_PASSWORD ?? "");

/** Cria um pedido manual pago, com entrega para o Rio de Janeiro, e devolve o número. */
async function createManualOrder(page: Page, email: string): Promise<string> {
  await page.goto("/admin/pedidos/novo");
  await page.getByLabel("Nome", { exact: true }).fill("Bianca Teste Manual");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Telefone").fill("21987654321");
  await page.getByLabel("Adicionar produto").fill("vaso esmaltado azul");
  await page
    .getByRole("button", { name: /Vaso esmaltado azul/ })
    .first()
    .click();
  await page.getByRole("textbox", { name: "CEP" }).fill("22041001");
  await page
    .waitForResponse((response) => response.url().includes("/api/cep/"), { timeout: 10_000 })
    .catch(() => undefined);
  for (const [label, value] of [
    ["Rua", "Rua Barata Ribeiro"],
    ["Bairro", "Copacabana"],
    ["Cidade", "Rio de Janeiro"],
  ] as const) {
    const field = page.getByRole("textbox", { name: label, exact: true });
    if (!(await field.inputValue())) await field.fill(value);
  }
  await page.getByRole("textbox", { name: "Número", exact: true }).fill("200");
  const state = page.getByRole("combobox", { name: "Estado" });
  if (!(await state.inputValue())) await state.selectOption("RJ");
  await page.getByRole("radio", { name: /Envio econômico/ }).check();
  await expect(page.getByText("Frete", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Criar pedido" }).click();
  await page.waitForURL(/\/admin\/pedidos\/NSG-\d+/, { timeout: 30_000 });
  return page.url().match(/NSG-\d+/)![0];
}

test("admin cria produto com variação e imagem, publica e o produto aparece na loja", async ({
  page,
}) => {
  const stamp = Date.now().toString(36);
  const name = `Vaso de teste e2e ${stamp}`;
  const imagePath = path.join("test-results", `e2e-${stamp}.png`);
  mkdirSync("test-results", { recursive: true });
  await sharp({ create: { width: 800, height: 1000, channels: 3, background: "#4D5236" } })
    .png()
    .toFile(imagePath);

  await loginAdmin(page);
  await page.goto("/admin/produtos/novo");
  await page.getByLabel("Nome", { exact: true }).fill(name);
  await page.getByLabel("Código do produto (SKU pai)").fill(`E2E-${stamp}`);
  await page.getByLabel("Tipo").selectOption("POT");
  await page.getByLabel("Categoria principal").selectOption({ label: "Vasos › Cerâmica e barro" });
  await page.getByLabel("Descrição curta").fill("Vaso criado pelo teste automatizado.");

  await page.getByRole("tab", { name: "Variações" }).click();
  await page.getByRole("button", { name: "Adicionar opção" }).click();
  await page.getByLabel("Opção", { exact: true }).fill("Tamanho");
  await page.getByLabel("Valores, separados por vírgula").fill("P, M");
  await page.getByRole("button", { name: "Gerar combinações" }).click();
  for (const [variant, price, stock] of [
    ["P", "59,90", "5"],
    ["M", "89,90", "3"],
  ] as const) {
    await page.getByLabel(`Preço da variação ${variant}`, { exact: true }).fill(price);
    await page.getByLabel(`Peso em gramas da variação ${variant}`).fill("800");
    await page.getByLabel(`Estoque da variação ${variant}`, { exact: true }).fill(stock);
  }

  await page.getByRole("tab", { name: "Imagens" }).click();
  await page.getByLabel("Enviar imagens").setInputFiles(imagePath);
  const alt = page.getByLabel("Texto alternativo (obrigatório para publicar)");
  await expect(alt).toBeVisible({ timeout: 20_000 });
  await alt.fill("Vaso de teste em fundo verde");

  await page.getByRole("tab", { name: "Geral" }).click();
  await page.getByLabel("Status").selectOption("ACTIVE");
  await page.getByRole("button", { name: "Salvar produto" }).click();
  // Cadastro mínimo: a qualidade fica abaixo de 60 e publicar pede confirmação.
  await page.getByRole("button", { name: "Publicar mesmo assim" }).click();
  await page.waitForURL(/\/admin\/produtos\/(?!novo)[a-z0-9]+$/, { timeout: 30_000 });

  const product = await db.product.findUniqueOrThrow({
    where: { sku: `E2E-${stamp.toUpperCase()}` },
    include: { variants: true, images: true },
  });
  expect(product.status).toBe("ACTIVE");
  expect(product.variants).toHaveLength(2);
  expect(product.images).toHaveLength(1);
  expect(product.minPriceCents).toBe(5990);
  expect(
    await db.auditLog.count({ where: { action: "product.create", entityId: product.id } }),
  ).toBe(1);
  expect(
    await db.inventoryMovement.count({ where: { variant: { productId: product.id }, type: "IN" } }),
  ).toBe(2);

  await page.goto(`/produto/${product.slug}`);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByRole("button", { name: "M", exact: true })).toBeVisible();
  await page.goto(`/busca?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole("link", { name: new RegExp(name) }).first()).toBeVisible();
});

test("pedido manual pelo WhatsApp entra no relatório por canal; admin leva o pedido de pago a entregue com rastreio", async ({
  page,
}) => {
  await loginAdmin(page);
  const sku = "TESTE-0043-01";
  const before = await db.productVariant.findUniqueOrThrow({
    where: { sku },
    select: { stockOnHand: true },
  });
  const whatsappBefore = await db.order.count({
    where: { channel: "WHATSAPP", paidAt: { not: null } },
  });

  const number = await createManualOrder(page, `manual.${Date.now().toString(36)}@example.com`);
  const order = await db.order.findUniqueOrThrow({ where: { number } });
  expect(order.channel).toBe("WHATSAPP");
  expect(order.status).toBe("PAID");
  expect(
    (await db.productVariant.findUniqueOrThrow({ where: { sku }, select: { stockOnHand: true } }))
      .stockOnHand,
  ).toBe(before.stockOnHand - 1);

  // Cenário 9: o pedido manual aparece no relatório por canal.
  await page.goto("/admin/relatorios/canais?periodo=hoje");
  const row = page
    .getByRole("table", { name: "Vendas por canal e origem" })
    .getByRole("row", { name: /WhatsApp/ });
  await expect(row).toBeVisible();
  expect(await db.order.count({ where: { channel: "WHATSAPP", paidAt: { not: null } } })).toBe(
    whatsappBefore + 1,
  );

  // Cenário 8: de "Pago" a "Entregue", com rastreio.
  await page.goto(`/admin/pedidos/${number}`);
  await page.getByRole("button", { name: "Iniciar preparação" }).click();
  await expect(page.getByText("Status: Em preparação")).toBeVisible();
  await page.getByRole("button", { name: "Marcar como enviado" }).click();
  await page.getByLabel("Transportadora").fill("Transportadora Teste");
  await page.getByLabel("Código de rastreio").fill("BR123456789TS");
  await page.getByRole("dialog").getByRole("button", { name: "Marcar como enviado" }).click();
  await expect(page.getByText("BR123456789TS").first()).toBeVisible();
  await page.getByRole("button", { name: "Marcar como entregue" }).click();
  await expect(page.getByText("Status: Entregue")).toBeVisible();

  const history = await db.orderStatusHistory.findMany({
    where: { orderId: order.id },
    orderBy: { createdAt: "asc" },
    select: { toStatus: true },
  });
  expect(history.map((entry) => entry.toStatus)).toEqual(
    expect.arrayContaining(["PAID", "PREPARING", "SHIPPED", "DELIVERED"]),
  );
  const delivered = await db.order.findUniqueOrThrow({
    where: { number },
    select: { status: true, trackingCode: true },
  });
  expect(delivered).toEqual({ status: "DELIVERED", trackingCode: "BR123456789TS" });
  expect(
    await db.auditLog.count({
      where: { entityType: "Order", entityId: order.id, action: "order.status_change" },
    }),
  ).toBeGreaterThanOrEqual(3);
});

test("equipe (STAFF) não acessa configurações nem exporta clientes, na interface e no servidor", async ({
  page,
}) => {
  await login(page, "expedicao@example.com", "Equipe@123");

  // Interface: os itens não aparecem no menu nem na lista de clientes.
  const nav = page.getByRole("navigation").first();
  await expect(page.getByRole("link", { name: "Pedidos", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Configurações", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Usuários", exact: true })).toHaveCount(0);
  await expect(nav).toBeVisible();
  await page.goto("/admin/clientes");
  await expect(page.getByRole("heading", { level: 1, name: "Clientes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Exportar CSV" })).toHaveCount(0);

  // Servidor: as páginas não existem para o papel e as exportações respondem 403.
  expect((await page.goto("/admin/configuracoes"))?.status()).toBe(404);
  expect((await page.goto("/admin/usuarios"))?.status()).toBe(404);
  expect((await page.request.get("/admin/exportar/clientes")).status()).toBe(403);
  expect((await page.request.get("/admin/exportar/pedidos")).status()).toBe(403);
  const customer = await db.user.findUniqueOrThrow({
    where: { email: "cliente@example.com" },
    select: { id: true },
  });
  expect((await page.request.get(`/admin/clientes/${customer.id}/exportar`)).status()).toBe(403);

  // Preço: a equipe vê o produto, mas não tem o botão de salvar dados nem o campo de custo.
  const product = await db.product.findFirstOrThrow({
    where: { isSample: true },
    select: { id: true },
  });
  await page.goto(`/admin/produtos/${product.id}`);
  await expect(page.getByRole("button", { name: "Salvar imagens" })).toBeVisible();
  await page.getByRole("tab", { name: "Variações" }).click();
  await expect(page.getByRole("columnheader", { name: "Custo (R$)" })).toHaveCount(0);
});

test("categorias: arrastar para o destino tracejado muda a categoria pai, com confirmação e redirecionamento", async ({
  page,
}) => {
  const key = Date.now().toString(36);
  const make = (name: string, position: number) =>
    db.category.create({
      data: {
        name: `E2E ${name} ${key}`,
        slug: `e2e-${name}-${key}`,
        path: `e2e-${name}-${key}`,
        position,
        isActive: false,
        showInMenu: false,
      },
    });
  const parent = await make("pai", -2);
  const moved = await make("filha", -1);

  try {
    await loginAdmin(page);
    await page.goto("/admin/categorias");
    const source = page.getByRole("listitem").filter({ hasText: moved.name }).first();
    await source.scrollIntoViewIfNeeded();
    const box = (await source.boundingBox())!;
    await page.mouse.move(box.x + 14, box.y + 18);
    await page.mouse.down();
    await page.mouse.move(box.x + 30, box.y + 40, { steps: 5 });
    const zone = page.getByText(
      `Solte aqui para mover ${moved.name} para dentro de ${parent.name}`,
    );
    await expect(zone).toBeVisible();
    await zone.hover();
    await zone.hover();
    await page.mouse.up();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(`/categoria/${parent.slug}/${moved.slug}`);
    await dialog.getByRole("button", { name: "Mover" }).click();
    await expect(
      page.getByText(`${moved.name} agora fica dentro de ${parent.name}`).first(),
    ).toBeVisible();

    const after = await db.category.findUniqueOrThrow({ where: { id: moved.id } });
    expect(after.parentId).toBe(parent.id);
    expect(after.path).toBe(`${parent.slug}/${moved.slug}`);
    const redirect = await db.redirect.findUnique({
      where: { fromPath: `/categoria/${moved.slug}` },
    });
    expect(redirect?.toPath).toBe(`/categoria/${parent.slug}/${moved.slug}`);
    expect(
      await db.auditLog.count({ where: { action: "category.move", entityId: moved.id } }),
    ).toBe(1);
  } finally {
    await db.redirect.deleteMany({ where: { fromPath: { contains: `-${key}` } } });
    await db.category.deleteMany({ where: { id: moved.id } });
    await db.category.deleteMany({ where: { id: parent.id } });
  }
});

test("banner: a prévia acompanha o que é digitado, antes de salvar", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/admin/banners/novo");
  await page.getByLabel("Título", { exact: true }).fill("Orquídeas para o dia das mães");
  await page.getByLabel("Texto do botão").first().fill("Ver orquídeas");
  const preview = page.locator("form").getByText("Prévia", { exact: true }).locator("../..");
  await expect(preview.getByText("Orquídeas para o dia das mães").first()).toBeVisible();
  await expect(preview.getByText("Ver orquídeas").first()).toBeVisible();
  await expect(
    preview.getByText("Escolha a imagem para computador para conferir o contraste"),
  ).toBeVisible();
});
