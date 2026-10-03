import { describe, expect, it } from "vitest";
import { slugify, normalizeText } from "@/lib/slug";
import {
  detectCardBrand,
  formatCardExpiry,
  formatCardNumber,
  isValidCardExpiry,
  isValidCvv,
  passesLuhn,
} from "@/lib/validators/card";
import { formatCep, isCepInRange, isValidCep, normalizeCep } from "@/lib/validators/cep";
import { formatCpf, generateCpf, isValidCpf, maskCpf } from "@/lib/validators/cpf";
import { formatPhone, isValidMobile, isValidPhone, toWhatsappNumber } from "@/lib/validators/phone";

describe("CPF", () => {
  it("aceita CPFs com dígitos verificadores corretos", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf(generateCpf("123456789"))).toBe(true);
  });

  it("recusa dígito errado, tamanho errado e sequências repetidas", () => {
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("1234567890")).toBe(false);
    expect(isValidCpf("")).toBe(false);
  });

  it("formata e mascara", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCpf("5299")).toBe("529.9");
    expect(maskCpf("52998224725")).toBe("***.982.247-**");
  });
});

describe("CEP", () => {
  it("valida e normaliza", () => {
    expect(isValidCep("01310-100")).toBe(true);
    expect(isValidCep("0131010")).toBe(false);
    expect(isValidCep("00000-000")).toBe(false);
    expect(normalizeCep("01310-100")).toBe("01310100");
    expect(normalizeCep("abc")).toBeNull();
    expect(formatCep("01310100")).toBe("01310-100");
  });

  it("confere faixas, incluindo os limites", () => {
    expect(isCepInRange("01000-000", "01000000", "05999999")).toBe(true);
    expect(isCepInRange("05999-999", "01000000", "05999999")).toBe(true);
    expect(isCepInRange("06000-000", "01000000", "05999999")).toBe(false);
    expect(isCepInRange("20040-020", "01000000", "09999999")).toBe(false);
  });
});

describe("telefone", () => {
  it("valida celular e fixo com DDD", () => {
    expect(isValidPhone("(11) 95581-7159")).toBe(true);
    expect(isValidPhone("(11) 3333-4444")).toBe(true);
    expect(isValidMobile("(11) 3333-4444")).toBe(false);
    expect(isValidPhone("(11) 85581-7159")).toBe(false);
    expect(isValidPhone("(01) 95581-7159")).toBe(false);
    expect(isValidPhone("99999")).toBe(false);
  });

  it("formata e converte para o formato do WhatsApp", () => {
    expect(formatPhone("11955817159")).toBe("(11) 95581-7159");
    expect(formatPhone("1133334444")).toBe("(11) 3333-4444");
    expect(formatPhone("119")).toBe("(11) 9");
    expect(toWhatsappNumber("(11) 95581-7159")).toBe("5511955817159");
    expect(toWhatsappNumber("5511955817159")).toBe("5511955817159");
  });
});

describe("cartão", () => {
  it("Luhn aceita números válidos e recusa inválidos", () => {
    expect(passesLuhn("4111 1111 1111 1111")).toBe(true);
    expect(passesLuhn("5555 5555 5555 4444")).toBe(true);
    expect(passesLuhn("4111 1111 1111 1112")).toBe(false);
    expect(passesLuhn("1234")).toBe(false);
  });

  it("detecta a bandeira pelo prefixo", () => {
    expect(detectCardBrand("4111111111111111")).toBe("visa");
    expect(detectCardBrand("5555555555554444")).toBe("mastercard");
    expect(detectCardBrand("2221000000000009")).toBe("mastercard");
    expect(detectCardBrand("378282246310005")).toBe("amex");
    expect(detectCardBrand("6362970000457013")).toBe("elo");
    expect(detectCardBrand("6062825624254001")).toBe("hipercard");
    expect(detectCardBrand("9999")).toBe("unknown");
  });

  it("formata número e validade", () => {
    expect(formatCardNumber("4111111111111111")).toBe("4111 1111 1111 1111");
    expect(formatCardNumber("378282246310005")).toBe("3782 822463 10005");
    expect(formatCardExpiry("1228")).toBe("12/28");
  });

  it("valida validade e CVV", () => {
    const now = new Date("2026-10-03T12:00:00-03:00");
    expect(isValidCardExpiry("10/26", now)).toBe(true);
    expect(isValidCardExpiry("09/26", now)).toBe(false);
    expect(isValidCardExpiry("13/27", now)).toBe(false);
    expect(isValidCardExpiry("12/28", now)).toBe(true);
    expect(isValidCvv("123", "visa")).toBe(true);
    expect(isValidCvv("123", "amex")).toBe(false);
    expect(isValidCvv("1234", "amex")).toBe(true);
  });
});

describe("slug", () => {
  it("gera slugs sem acento, em minúsculas e sem símbolos", () => {
    expect(slugify("Orquídea Phalaenopsis branca 2 hastes")).toBe(
      "orquidea-phalaenopsis-branca-2-hastes",
    );
    expect(slugify("Aromas L'Envie")).toBe("aromas-lenvie");
    expect(slugify("  Vaso 18 × 8 cm  ")).toBe("vaso-18-8-cm");
    expect(slugify("Costela-de-adão")).toBe("costela-de-adao");
  });

  it("normaliza texto de busca", () => {
    expect(normalizeText("  ORQUÍDEA   Branca ")).toBe("orquidea branca");
  });
});
