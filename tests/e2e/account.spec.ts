import { expect, test } from "@playwright/test";
import {
  addToCart,
  chooseShipping,
  db,
  freezeTime,
  mailTo,
  reviewAndPlaceOrder,
  uniqueEmail,
  restockTestProducts,
} from "./helpers";

test.beforeAll(() => restockTestProducts());
test.afterAll(() => db.$disconnect());

test("cliente cria conta, entra com a sacola mesclada, salva endereço, compra, vê o pedido e baixa os dados", async ({
  page,
  context,
}) => {
  await freezeTime(context);
  const email = uniqueEmail("conta");
  const password = "Jardim#2026";

  // Visitante monta a sacola antes de ter conta.
  await addToCart(page, "vaso-esmaltado-azul");

  // Cria a conta: já entra logado, e a sacola anônima passa a ser a da conta.
  await page.goto("/criar-conta");
  await page.getByRole("textbox", { name: "Nome completo" }).fill("Helena Teste Prado");
  await page.getByRole("main").getByRole("textbox", { name: "E-mail" }).fill(email);
  await page.getByRole("textbox", { name: "Senha" }).fill(password);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Olá, Helena" })).toBeVisible();
  await expect(page.getByText("Confirme o seu e-mail")).toBeVisible();
  await expect.poll(() => mailTo(page.request, email)).toContain("Confirme o seu e-mail");

  const user = await db.user.findUniqueOrThrow({
    where: { email },
    select: { id: true, passwordHash: true },
  });
  expect(user.passwordHash).toMatch(/^\$2[aby]\$12\$/); // bcrypt, custo 12
  const cart = await db.cart.findFirstOrThrow({
    where: { userId: user.id, status: "ACTIVE" },
    include: { items: true },
  });
  expect(cart.items).toHaveLength(1);

  // Sai, monta outra sacola anônima e entra de novo: as duas sacolas são mescladas.
  await page.getByRole("button", { name: /Conta de Helena/ }).click();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL("/");
  await addToCart(page, "vaso-de-cimento-cilindrico");
  await page.goto("/entrar");
  await page.getByRole("main").getByRole("textbox", { name: "E-mail" }).fill(email);
  await page.getByRole("textbox", { name: "Senha" }).fill("senha-errada");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByText("E-mail ou senha incorretos. Confira os dados ou redefina a senha."),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Senha" }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Olá, Helena" })).toBeVisible();
  const merged = await db.cart.findFirstOrThrow({
    where: { userId: user.id, status: "ACTIVE" },
    include: { items: true },
  });
  expect(merged.items).toHaveLength(2);

  // Endereço salvo.
  await page.goto("/conta/enderecos");
  await page.getByRole("button", { name: "Adicionar endereço" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: /Nome do endereço/ }).fill("Casa");
  await dialog.getByRole("textbox", { name: "CEP" }).fill("01310100");
  await page
    .waitForResponse((response) => response.url().includes("/api/cep/"), { timeout: 10_000 })
    .catch(() => undefined);
  await page.waitForTimeout(300);
  for (const [label, value] of [
    ["Rua", "Avenida Paulista"],
    ["Bairro", "Bela Vista"],
    ["Cidade", "São Paulo"],
  ] as const) {
    const field = dialog.getByRole("textbox", { name: label, exact: true });
    if (!(await field.inputValue())) await field.fill(value);
  }
  await dialog.getByRole("textbox", { name: "Número", exact: true }).fill("1000");
  if (!(await dialog.getByRole("combobox", { name: "Estado" }).inputValue()))
    await dialog.getByRole("combobox", { name: "Estado" }).selectOption("SP");
  await dialog.getByRole("button", { name: "Salvar endereço" }).click();
  await expect(page.getByText("Avenida Paulista, 1000")).toBeVisible();
  await expect(page.getByText("Padrão", { exact: true })).toBeVisible();

  // Checkout: nome, e-mail e endereço padrão já vêm preenchidos.
  await page.goto("/checkout");
  await expect(page.getByRole("main").getByRole("textbox", { name: "E-mail" })).toHaveValue(email);
  await expect(page.getByRole("textbox", { name: "Nome completo" })).toHaveValue(
    "Helena Teste Prado",
  );
  await page.getByRole("textbox", { name: "CPF" }).fill("52998224725");
  await page.getByRole("textbox", { name: "Celular com DDD" }).fill("11987654321");
  await page.getByRole("button", { name: "Continuar para a entrega" }).click();
  await expect(page.getByRole("textbox", { name: "Rua", exact: true })).toHaveValue(
    "Avenida Paulista",
  );
  await chooseShipping(page, /Envio econômico/);
  await page.getByRole("button", { name: "Continuar para o pagamento" }).click();
  await page.getByRole("button", { name: "Continuar para a revisão" }).click();
  const number = await reviewAndPlaceOrder(page);
  expect((await db.order.findUniqueOrThrow({ where: { number } })).userId).toBe(user.id);

  // O pedido aparece na área do cliente, com "Pagar agora" enquanto está pendente.
  await page.goto("/conta/pedidos");
  await page.getByRole("link", { name: `Pedido ${number}` }).click();
  await expect(page.getByRole("heading", { level: 1, name: `Pedido ${number}` })).toBeVisible();
  await expect(page.getByText("Aguardando pagamento").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Pagar agora" })).toBeVisible();

  // Baixar meus dados: JSON com cadastro, endereço e pedido; a exportação fica registrada.
  await page.goto("/conta/privacidade");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar meus dados" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^meus-dados-\d{4}-\d{2}-\d{2}\.json$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  expect(data.cadastro.email).toBe(email);
  expect(data.enderecos).toHaveLength(1);
  expect(data.pedidos.map((order: { number: string }) => order.number)).toContain(number);
  expect(JSON.stringify(data)).not.toContain("passwordHash");
  expect(
    await db.auditLog.count({ where: { userId: user.id, action: "customer.self_export" } }),
  ).toBe(1);

  // Pedido de exclusão vai para a fila do admin.
  await page.getByRole("button", { name: "Excluir minha conta" }).click();
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: /Digite a sua senha/ })
    .fill(password);
  await page.getByRole("dialog").getByRole("button", { name: "Pedir a exclusão da conta" }).click();
  await expect(page.getByText(/Seu pedido de exclusão está registrado/)).toBeVisible();
  expect(
    await db.dataRequest.count({ where: { userId: user.id, type: "DELETE", status: "OPEN" } }),
  ).toBe(1);
});

test("área do cliente exige login e volta para a página pedida", async ({ page }) => {
  await page.goto("/conta/pedidos");
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fconta%2Fpedidos/);
  await page.getByRole("main").getByRole("textbox", { name: "E-mail" }).fill("cliente@example.com");
  await page.getByRole("textbox", { name: "Senha" }).fill("Cliente@123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL("/conta/pedidos");
  await expect(page.getByRole("heading", { level: 1, name: "Pedidos" })).toBeVisible();
  // Cliente comum não entra no painel administrativo.
  await page.goto("/admin");
  await expect(page).toHaveURL("/conta");
});

test("sacola: mover para favoritos pede login, tira o item da sacola e dá para desfazer", async ({
  page,
}) => {
  const slug = "vaso-esmaltado-azul";
  const product = await db.product.findUniqueOrThrow({ where: { slug }, select: { id: true } });
  const customer = await db.user.findUniqueOrThrow({
    where: { email: "cliente@example.com" },
    select: { id: true },
  });
  const inWishlist = () =>
    db.wishlist.count({ where: { userId: customer.id, productId: product.id } });
  await db.wishlist.deleteMany({ where: { userId: customer.id, productId: product.id } });

  try {
    await addToCart(page, slug);
    await page.goto("/carrinho");
    const move = page.getByRole("button", { name: /Mover Vaso esmaltado azul para favoritos/ });

    // Sem login, vai para a entrada e volta para a sacola com o item ainda lá.
    await move.click();
    await expect(page).toHaveURL(/\/entrar\?voltar=%2Fcarrinho/);
    await page
      .getByRole("main")
      .getByRole("textbox", { name: "E-mail" })
      .fill("cliente@example.com");
    await page.getByRole("textbox", { name: "Senha" }).fill("Cliente@123");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL("/carrinho");

    const line = page.getByRole("main").getByRole("link", { name: "Vaso esmaltado azul" });
    await expect(line.first()).toBeVisible();
    await page
      .getByRole("button", { name: /Mover Vaso esmaltado azul para favoritos/ })
      .first()
      .click();
    await expect(
      page.getByText("Vaso esmaltado azul foi para os favoritos", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Mover Vaso esmaltado azul para favoritos/ }),
    ).toHaveCount(0);
    expect(await inWishlist()).toBe(1);

    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(
      page.getByRole("button", { name: /Mover Vaso esmaltado azul para favoritos/ }),
    ).toHaveCount(1);
    await expect.poll(inWishlist).toBe(0);
  } finally {
    await db.wishlist.deleteMany({ where: { userId: customer.id, productId: product.id } });
    await db.cartItem.deleteMany({ where: { cart: { userId: customer.id } } });
  }
});
