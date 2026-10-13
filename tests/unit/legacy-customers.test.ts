import { describe, expect, it } from "vitest";
import {
  buildLegacyCustomer,
  buildLegacyOrder,
  isLegacyOrderNumber,
  legacyCents,
  legacyDate,
  legacyName,
  legacyPhone,
  mapLegacyStatus,
  parseLegacyReport,
} from "@/lib/legacy-customers";
import { generateCpf } from "@/lib/validators/cpf";

const NOW = new Date("2026-10-12T12:00:00Z");

const itemRow = (overrides: Record<string, string> = {}) => ({
  Núm: "25934",
  "Feito em": "05/03/2023 14:30:00",
  Nome: "MARINA DA SILVA",
  "E-mail": "Marina@Example.com",
  "CPF/CNPJ": generateCpf("123456789"),
  Celular: "11987654321",
  "Nome Pedido": "MARINA DA SILVA",
  "Logradouro Pedido": "Rua das Flores",
  "Endereço número Pedido": "10",
  "Bairro Pedido": "Centro",
  "Cidade Pedido": "São Paulo",
  "Estado Pedido": "SP",
  "CEP Pedido": "01310-100",
  "Total sem frete": "180.00",
  Frete: "21.50",
  Pagamento: "Cartão de crédito",
  Parcelas: "3",
  Status: "Remetido",
  "Obs Frete": "São Paulo - capital",
  "Obj SEDEX": "",
  "Ref. Produto": "123456",
  "Nome Produto": "Vaso de cerâmica",
  Qtd: "2",
  "Preço unit": "50.00",
  CodCupom: "volta10",
  IDProduto: "9999999",
  ...overrides,
});

describe("relatórios do site antigo", () => {
  it("lê os registros do XML e desfaz as entidades", () => {
    const rows = parseLegacyReport(
      '<relat><registro><campo nome="Nome" valor="Flores &amp; Cia"/><campo nome="Qtd" valor=" 2 "/></registro></relat>',
    );
    expect(rows).toEqual([{ Nome: "Flores & Cia", Qtd: "2" }]);
  });

  it("converte datas no horário de São Paulo e valores em centavos", () => {
    expect(legacyDate("05/03/2023 14:30:00")?.toISOString()).toBe("2023-03-05T17:30:00.000Z");
    expect(legacyDate("")).toBeNull();
    expect(legacyCents("1234.50")).toBe(123450);
    expect(legacyCents("99,9")).toBe(9990);
  });

  it("arruma nomes em caixa alta e telefones", () => {
    expect(legacyName("MARINA DA SILVA")).toBe("Marina da Silva");
    expect(legacyName("Marina McDonald")).toBe("Marina McDonald");
    expect(legacyPhone("", "(11) 3333-4444")).toBe("1133334444");
    expect(legacyPhone("123")).toBeNull();
  });

  it("reconhece o número dos pedidos antigos", () => {
    expect(isLegacyOrderNumber("ANT-25934")).toBe(true);
    expect(isLegacyOrderNumber("NSG-000001")).toBe(false);
  });
});

describe("cliente do site antigo", () => {
  it("monta a conta com CPF válido, sem CNPJ e com o nome do pedido quando falta", () => {
    const customer = buildLegacyCustomer(
      {
        "E-mail": " Marina@Example.com ",
        Contato: "",
        "CNPJ/CPF": "12345678000199",
        "Cadastro em": "01/02/2022 10:00:00",
        "Data Nasc": "15/08/1985",
        Celular: "11987654321",
      },
      "MARINA DA SILVA",
    );
    expect(customer).toMatchObject({
      email: "marina@example.com",
      name: "Marina da Silva",
      cpf: null,
      phone: "11987654321",
      address: null,
    });
    expect(customer?.birthDate?.toISOString()).toBe("1985-08-15T00:00:00.000Z");
    expect(buildLegacyCustomer({ "E-mail": "sem-arroba" })).toBeNull();
  });
});

describe("pedido do site antigo", () => {
  it("soma os itens, separa o desconto e fecha o total com o frete", () => {
    const order = buildLegacyOrder(
      [itemRow(), itemRow({ "Ref. Produto": "", "Preço unit": "100.00", Qtd: "1" })],
      NOW,
    );
    expect(order).toMatchObject({
      number: "ANT-25934",
      email: "marina@example.com",
      customerName: "Marina da Silva",
      status: "DELIVERED",
      paymentStatus: "PAID",
      paymentMethod: "CREDIT_CARD",
      installments: 3,
      subtotalCents: 20000,
      discountCents: 2000,
      shippingCents: 2150,
      totalCents: 20150,
      couponCode: "VOLTA10",
      shippingMethodCode: "legado",
    });
    expect(order?.items.map((item) => item.sku)).toEqual(["123456", "antigo-9999999"]);
    expect(order?.shippingAddress).toMatchObject({ cep: "01310100", state: "SP" });
  });

  it("mapeia retirada, boleto, outros pagamentos e situações", () => {
    const pickup = buildLegacyOrder(
      [
        itemRow({
          "Obs Frete": "Av dos Bandeirantes, 5900-após LIBERAÇÃO por EMAIL",
          Pagamento: "Itaú Shopline",
          Status: "Cancelado",
        }),
      ],
      NOW,
    );
    expect(pickup).toMatchObject({
      shippingMethodCode: "retirada-legado",
      paymentMethod: "MANUAL",
      manualPaymentLabel: "Itaú Shopline",
      status: "CANCELED",
    });
    const old = new Date("2025-01-10T12:00:00Z");
    const recent = new Date("2026-10-05T12:00:00Z");
    expect(mapLegacyStatus("Liberado", old, NOW).status).toBe("DELIVERED");
    expect(mapLegacyStatus("Liberado", recent, NOW).status).toBe("PAID");
    expect(mapLegacyStatus("Novo", recent, NOW)).toEqual({
      status: "EXPIRED",
      paymentStatus: "EXPIRED",
    });
  });
});
