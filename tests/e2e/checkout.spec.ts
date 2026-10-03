import { expect, test } from "@playwright/test";
import {
  addToCart,
  availableStock,
  chooseShipping,
  db,
  fillAddress,
  fillIdentification,
  freezeTime,
  mailTo,
  reviewAndPlaceOrder,
  RIO,
  SAO_PAULO,
  uniqueEmail,
  restockTestProducts,
} from "./helpers";

test.beforeAll(() => restockTestProducts());
test.afterAll(() => db.$disconnect());

test("convidado compra com Pix, entrega hoje, paga pelo simulador e recebe os e-mails", async ({
  page,
  context,
}) => {
  await freezeTime(context);
  const email = uniqueEmail("pix");
  const variant = await db.productVariant.findFirstOrThrow({
    where: { product: { slug: "vaso-esmaltado-azul" } },
    select: { sku: true },
  });
  const before = await availableStock(variant.sku);

  await addToCart(page, "vaso-esmaltado-azul");
  await page.getByRole("dialog").getByRole("link", { name: "Finalizar compra" }).click();
  await fillIdentification(page, email);
  await fillAddress(page, SAO_PAULO);
  await chooseShipping(page, /Entrega hoje/);
  await page.getByRole("button", { name: "Continuar para o pagamento" }).click();

  // Pix é o método padrão, com o desconto em destaque.
  await expect(page.getByRole("radio", { name: /Pix/ })).toBeChecked();
  await expect(page.getByText(/Pague R\$\s[\d.,]+ no Pix \(economize/)).toBeVisible();
  // Boleto não vale para entrega hoje, e o motivo aparece.
  await expect(page.getByRole("radio", { name: /Boleto/ })).toBeDisabled();
  await expect(page.getByText(/Indisponível para entrega hoje/)).toBeVisible();

  await page.getByRole("button", { name: "Continuar para a revisão" }).click();
  const number = await reviewAndPlaceOrder(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Pedido ${number} recebido`);
  await expect(page.getByRole("img", { name: /QR Code do Pix/ })).toBeVisible();
  // Pedido criado: estoque reservado.
  expect(await availableStock(variant.sku)).toBe(before - 1);

  await page.getByRole("button", { name: "Simular Pix pago" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Pagamento aprovado" })).toBeVisible({
    timeout: 20_000,
  });

  const order = await db.order.findUniqueOrThrow({ where: { number }, include: { items: true } });
  expect(order.status).toBe("PAID");
  expect(order.shippingMethodCode).toBe("entrega-hoje");
  expect(order.pixDiscountCents).toBeGreaterThan(0);
  expect(order.totalCents).toBe(order.subtotalCents - order.pixDiscountCents + order.shippingCents);

  // Estoque baixado: uma unidade a menos no físico, nada reservado por este pedido.
  const movements = await db.inventoryMovement.findMany({
    where: { orderId: order.id },
    orderBy: { createdAt: "asc" },
  });
  expect(movements.map((movement) => movement.type)).toEqual(["RESERVE", "SALE"]);
  expect(await availableStock(variant.sku)).toBe(before - 1);

  await expect
    .poll(() => mailTo(page.request, email))
    .toEqual(
      expect.arrayContaining([`Pedido ${number} recebido`, `Pagamento aprovado: pedido ${number}`]),
    );
});

test("cartão recusado (final 0002) e nova tentativa aprovada (final 0000) no mesmo pedido", async ({
  page,
  context,
}) => {
  await freezeTime(context);
  await addToCart(page, "vaso-de-cimento-cilindrico");
  await page.getByRole("dialog").getByRole("link", { name: "Finalizar compra" }).click();
  await fillIdentification(page, uniqueEmail("cartao"));
  await fillAddress(page, SAO_PAULO);
  await chooseShipping(page, /Entrega agendada/);
  await page.locator('input[name="data-entrega"]').first().check({ force: true });
  await page.getByText("Manhã", { exact: true }).click();
  await page.getByRole("button", { name: "Continuar para o pagamento" }).click();

  await page.getByRole("radio", { name: /Cartão de crédito/ }).check();
  const fillCard = async (cardNumber: string) => {
    await page.getByRole("textbox", { name: "Número do cartão" }).fill(cardNumber);
    await page.getByRole("textbox", { name: "Nome impresso no cartão" }).fill("MARINA T SILVA");
    await page.getByRole("textbox", { name: "Validade" }).fill("1235");
    await page.getByRole("textbox", { name: "Código de segurança" }).fill("123");
  };
  await fillCard("4000000000000002");
  await page.getByRole("button", { name: "Continuar para a revisão" }).click();
  const number = await reviewAndPlaceOrder(page);

  await expect(page.getByRole("heading", { name: "O pagamento não foi aprovado" })).toBeVisible();
  await expect(page.getByText(/Saldo insuficiente/)).toBeVisible();
  expect((await db.order.findUniqueOrThrow({ where: { number } })).status).toBe("PENDING_PAYMENT");

  await page.getByRole("button", { name: "Tentar outro cartão" }).click();
  await fillCard("4000000000020000");
  await page.getByRole("button", { name: "Pagar com este cartão" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Pagamento aprovado" })).toBeVisible({
    timeout: 20_000,
  });

  // Uma nova cobrança no mesmo pedido, sem duplicar o pedido. Nenhum dado sensível de cartão gravado.
  const order = await db.order.findUniqueOrThrow({
    where: { number },
    include: { payments: { orderBy: { createdAt: "asc" } } },
  });
  expect(order.status).toBe("PAID");
  expect(order.payments.map((payment) => payment.status)).toEqual(["FAILED", "PAID"]);
  expect(order.payments.map((payment) => payment.cardLast4)).toEqual(["0002", "0000"]);
  expect(JSON.stringify(order.payments)).not.toContain("4000000000020000");
});

test("cupom inválido mostra a mensagem certa e cupom válido aplica o desconto", async ({
  page,
}) => {
  await addToCart(page, "vaso-esmaltado-azul");
  await page.goto("/carrinho");

  const field = page.getByRole("textbox", { name: "Cupom de desconto" });
  await field.fill("NAOEXISTE");
  await page.getByRole("button", { name: "Aplicar cupom" }).click();
  await expect(
    page.getByText("Este cupom não existe. Confira se digitou corretamente."),
  ).toBeVisible();

  await field.fill("INVERNO20");
  await page.getByRole("button", { name: "Aplicar cupom" }).click();
  await expect(page.getByText(/Este cupom expirou em \d{2}\/\d{2}\/\d{4}\./)).toBeVisible();

  await field.fill("ESGOTADO50");
  await page.getByRole("button", { name: "Aplicar cupom" }).click();
  await expect(page.getByText(/limite de usos/)).toBeVisible();

  await field.fill("bemvindo10");
  await page.getByRole("button", { name: "Aplicar cupom" }).click();
  await expect(page.getByText(/Cupom BEMVINDO10 aplicado: 10% de desconto/)).toBeVisible();
  // R$ 249,00 com 10% de desconto.
  await expect(page.getByText("- R$ 24,90")).toBeVisible();
  await expect(page.locator("dl").getByText("R$ 224,10").first()).toBeVisible();
});

test("produto só local com CEP de outro estado mostra o aviso e bloqueia o envio nacional", async ({
  page,
  context,
}) => {
  await freezeTime(context);
  await addToCart(page, "orquidea-phalaenopsis-branca-2-hastes");
  await page.getByRole("dialog").getByRole("link", { name: "Finalizar compra" }).click();
  await fillIdentification(page, uniqueEmail("local"));
  await fillAddress(page, RIO);

  await expect(page.getByText(/entrega só nesta área: Grande São Paulo/)).toBeVisible();
  await expect(page.locator('input[name="entrega"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Continuar para o pagamento" }).click();
  await expect(page.getByText("Escolha uma opção de entrega.")).toBeVisible();

  // Com CEP de São Paulo, as entregas locais aparecem e o envio por transportadora não.
  await fillAddress(page, SAO_PAULO);
  await expect(page.getByRole("radio", { name: /Entrega hoje/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Envio econômico/ })).toHaveCount(0);
});

test("convidado compra com boleto para outro estado, vê a linha digitável e o pagamento é confirmado", async ({
  page,
  context,
}) => {
  await freezeTime(context);
  const email = uniqueEmail("boleto");
  await addToCart(page, "vaso-esmaltado-azul");
  await page.getByRole("dialog").getByRole("link", { name: "Finalizar compra" }).click();
  await fillIdentification(page, email);
  await fillAddress(page, RIO);
  await chooseShipping(page, /Envio econômico/);
  await page.getByRole("button", { name: "Continuar para o pagamento" }).click();

  await page.getByRole("radio", { name: /Boleto/ }).check();
  await page.getByRole("button", { name: "Continuar para a revisão" }).click();
  const number = await reviewAndPlaceOrder(page);

  await expect(page.getByRole("heading", { name: /Pague o boleto de R\$/ })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /Linha digitável/ })).toHaveValue(/\d{5}/);
  const pending = await db.order.findUniqueOrThrow({ where: { number } });
  expect(pending).toMatchObject({
    status: "PENDING_PAYMENT",
    paymentMethod: "BOLETO",
    pixDiscountCents: 0,
  });

  await page.getByRole("button", { name: "Simular boleto pago" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Pagamento aprovado" })).toBeVisible({
    timeout: 20_000,
  });
  expect((await db.order.findUniqueOrThrow({ where: { number } })).status).toBe("PAID");
  await expect
    .poll(() => mailTo(page.request, email))
    .toEqual(expect.arrayContaining([`Pagamento aprovado: pedido ${number}`]));
});

test("produto com área de entrega própria: fora da área, a loja diz qual produto não vai e oferece o WhatsApp", async ({
  page,
}) => {
  const slug = "vaso-de-cimento-cilindrico";
  const product = await db.product.findUniqueOrThrow({ where: { slug }, select: { id: true } });
  const area = await db.deliveryArea.create({
    data: {
      name: "São Paulo, capital",
      cepRanges: [
        { start: "01000000", end: "05999999" },
        { start: "08000000", end: "08499999" },
      ],
    },
  });
  await db.product.update({ where: { id: product.id }, data: { deliveryAreaId: area.id } });

  try {
    await page.goto(`/produto/${slug}`);
    const cep = page.getByRole("textbox", { name: "Calcular frete e prazo" });

    // Rio de Janeiro: fora da área.
    await cep.fill("22041001");
    await page.getByRole("button", { name: "Calcular frete" }).click();
    await expect(
      page.getByText(
        "Vaso de cimento cilíndrico tem entrega só nesta área: São Paulo, capital. Para receber em outro lugar, fale com a gente pelo WhatsApp.",
      ),
    ).toBeVisible();
    const whatsapp = page.getByRole("link", { name: /Falar pelo WhatsApp/ });
    await expect(whatsapp).toBeVisible();
    expect(decodeURIComponent((await whatsapp.getAttribute("href")) ?? "")).toContain(
      "Quero receber Vaso de cimento cilíndrico no CEP 22041-001",
    );

    // Avenida Paulista: dentro da área, as opções aparecem e o aviso some.
    await cep.fill("01310100");
    await page.getByRole("button", { name: "Calcular frete" }).click();
    await expect(page.getByText(/tem entrega só nesta área/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Falar pelo WhatsApp/ })).toHaveCount(0);
  } finally {
    await db.product.update({ where: { id: product.id }, data: { deliveryAreaId: null } });
    await db.deliveryArea.delete({ where: { id: area.id } });
  }
});
