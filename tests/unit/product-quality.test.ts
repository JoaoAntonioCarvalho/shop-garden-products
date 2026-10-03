import { describe, expect, it } from "vitest";
import { isUsefulDescription, productQuality, type QualityInput } from "@/lib/product-quality";

const complete: QualityInput = {
  productType: "ORCHID",
  primaryCategoryId: "cat",
  shortDescription: "Orquídea branca com duas hastes.",
  descriptionText: "a".repeat(320),
  seoTitle: "Orquídea branca",
  seoDescription: "Orquídea Phalaenopsis branca com duas hastes.",
  images: [{ alt: "frente" }, { alt: "detalhe" }, { alt: "ambiente" }],
  variantWeights: [900],
  heightCm: 60,
  widthCm: 20,
  light: "INDIRECT_LIGHT",
  watering: "Uma vez por semana",
  environment: "INDOOR",
  petSafety: "SAFE",
  careLevel: "EASY",
  material: null,
  color: null,
};

describe("qualidade de cadastro", () => {
  it("dá 100 ao cadastro completo", () => {
    expect(productQuality(complete).score).toBe(100);
  });

  it("desconta cada item que falta", () => {
    expect(productQuality({ ...complete, images: [{ alt: "frente" }] }).score).toBe(80);
    expect(
      productQuality({ ...complete, images: [{ alt: "" }, { alt: "b" }, { alt: "c" }] }).score,
    ).toBe(90);
    expect(productQuality({ ...complete, primaryCategoryId: null }).score).toBe(95);
    expect(productQuality({ ...complete, seoDescription: " " }).score).toBe(90);
    expect(productQuality({ ...complete, variantWeights: [0] }).score).toBe(90);
  });

  it("usa a ficha técnica para vasos e objetos", () => {
    const pot = { ...complete, productType: "POT", light: null, watering: null, careLevel: null };
    expect(productQuality(pot).checks.find((check) => check.key === "sheet")?.ok).toBe(false);
    expect(productQuality({ ...pot, material: "Cerâmica", color: "Branco" }).score).toBe(100);
  });

  it("não conta a frase padrão de envio como descrição", () => {
    expect(isUsefulDescription("Enviamos para todo o Brasil. ".repeat(20))).toBe(false);
    expect(isUsefulDescription("Planta de fácil cuidado. ".repeat(20))).toBe(true);
  });

  it("produto vazio fica em zero", () => {
    const empty: QualityInput = {
      ...complete,
      primaryCategoryId: null,
      shortDescription: null,
      descriptionText: "",
      seoTitle: null,
      seoDescription: null,
      images: [],
      variantWeights: [],
      heightCm: null,
      widthCm: null,
      light: null,
    };
    expect(productQuality(empty).score).toBe(0);
  });
});
