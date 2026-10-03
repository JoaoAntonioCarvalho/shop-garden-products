import { describe, expect, it } from "vitest";
import {
  blockedCartNotice,
  blockedContactMessage,
  blockedProductNotice,
  findBlockedItems,
  formatCepRanges,
  isCepInRanges,
  parseCepRanges,
  readCepRanges,
  type RestrictedItem,
} from "@/lib/delivery-areas";

const capital = {
  name: "São Paulo, capital",
  ranges: [
    { start: "01000000", end: "05999999" },
    { start: "08000000", end: "08499999" },
  ],
};
const item = (overrides: Partial<RestrictedItem>): RestrictedItem => ({
  variantId: "v",
  name: "Vaso esmaltado azul",
  localOnly: false,
  area: null,
  ...overrides,
});

describe("faixas de CEP", () => {
  it("lê as faixas digitadas, uma por linha, com ou sem hífen", () => {
    const { ranges, invalid } = parseCepRanges(
      "01000-000 a 05999-999\n08000000 até 08499999\n\n13010-000",
    );
    expect(invalid).toEqual([]);
    expect(ranges).toEqual([
      { start: "01000000", end: "05999999" },
      { start: "08000000", end: "08499999" },
      { start: "13010000", end: "13010000" },
    ]);
    expect(formatCepRanges(ranges)).toBe("01000-000 a 05999-999\n08000-000 a 08499-999\n13010-000");
  });

  it("aponta a linha que não dá para entender e a faixa invertida", () => {
    expect(parseCepRanges("capital\n05999-999 a 01000-000").invalid).toEqual([
      "capital",
      "05999-999 a 01000-000",
    ]);
  });

  it("ignora no banco o que não for faixa válida", () => {
    expect(readCepRanges([{ start: "01000-000", end: "05999999" }, { start: "1" }, null])).toEqual([
      { start: "01000000", end: "05999999" },
    ]);
    expect(readCepRanges("x")).toEqual([]);
  });

  it("confere se o CEP está em alguma faixa, incluindo as pontas", () => {
    expect(isCepInRanges("01000000", capital.ranges)).toBe(true);
    expect(isCepInRanges("08499999", capital.ranges)).toBe(true);
    expect(isCepInRanges("06454000", capital.ranges)).toBe(false);
  });
});

describe("itens que não vão para o CEP", () => {
  const palm = item({ variantId: "p", name: "Palmeira ráfis", area: capital });
  const orchid = item({ variantId: "o", name: "Orquídea branca", localOnly: true });
  const vase = item({ variantId: "v" });

  it("produto com área própria é bloqueado fora dela, mesmo com entrega local no CEP", () => {
    // Barueri: Grande São Paulo, mas fora da capital.
    expect(findBlockedItems("06454000", [palm, orchid, vase], true)).toEqual([
      { variantId: "p", name: "Palmeira ráfis", areaName: "São Paulo, capital" },
    ]);
    expect(findBlockedItems("01310100", [palm, orchid, vase], true)).toEqual([]);
  });

  it("produto só local sem área própria é bloqueado onde não há entrega local", () => {
    expect(findBlockedItems("22041001", [orchid, vase], false)).toEqual([
      { variantId: "o", name: "Orquídea branca", areaName: "Grande São Paulo" },
    ]);
  });

  it("produto sem restrição nunca é bloqueado", () => {
    expect(findBlockedItems("69900000", [vase], false)).toEqual([]);
  });

  it("escreve o aviso com o nome do produto e da área, uma frase por área", () => {
    const blocked = findBlockedItems(
      "22041001",
      [palm, orchid, item({ variantId: "o2", name: "Arranjo de rosas", localOnly: true })],
      false,
    );
    expect(blockedProductNotice([blocked[0]])).toBe(
      "Palmeira ráfis tem entrega só nesta área: São Paulo, capital. Para receber em outro lugar, fale com a gente pelo WhatsApp.",
    );
    expect(blockedCartNotice(blocked)).toBe(
      "Palmeira ráfis tem entrega só nesta área: São Paulo, capital. Orquídea branca e Arranjo de rosas têm entrega só nesta área: Grande São Paulo. Para receber em outro lugar, fale com a gente pelo WhatsApp. Para ver as opções de envio para este CEP, remova da sacola o que não pode ser enviado.",
    );
    expect(blockedContactMessage(blocked, "22041001")).toBe(
      "Olá! Quero receber Palmeira ráfis, Orquídea branca e Arranjo de rosas no CEP 22041-001. Vocês conseguem entregar?",
    );
  });
});
