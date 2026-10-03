import { describe, expect, it } from "vitest";
import { parseConsent, serializeConsent } from "@/lib/consent";
import { normalizeText, slugify } from "@/lib/slug";
import { renderTokens } from "@/lib/template";
import { storeConfig } from "@/config/store.config";

describe("slug", () => {
  it("tira acentos, espaços e pontuação", () => {
    expect(slugify("Orquídea Phalaenopsis branca 2 hastes")).toBe(
      "orquidea-phalaenopsis-branca-2-hastes",
    );
    expect(slugify("  Vaso  de Cerâmica — Ø 20 cm!  ")).toBe("vaso-de-ceramica-20-cm");
    expect(slugify("Aromas L'Envie")).toBe("aromas-lenvie");
    expect(slugify("!!!")).toBe("");
  });

  it("normaliza o texto de busca sem perder os espaços", () => {
    expect(normalizeText("  Orquídea   BRANCA ")).toBe("orquidea branca");
  });
});

describe("consentimento de cookies", () => {
  it("vai e volta pelo cookie", () => {
    expect(parseConsent(serializeConsent({ analytics: true, marketing: false }))).toEqual({
      analytics: true,
      marketing: false,
    });
  });

  it("sem cookie, ou com cookie adulterado, não há consentimento", () => {
    expect(parseConsent(undefined)).toBeNull();
    expect(parseConsent("")).toBeNull();
    expect(parseConsent("nao-e-json")).toBeNull();
    expect(parseConsent(encodeURIComponent(JSON.stringify({ analytics: "sim" })))).toBeNull();
  });
});

describe("marcadores nos textos", () => {
  it("troca os marcadores pelos valores da configuração, sem deixar valor fixo no conteúdo", () => {
    const text = renderTokens(
      "Pix com {{descontoPix}}% de desconto. Fale pelo {{telefone}}.",
      storeConfig,
    );
    expect(text).toContain(`${storeConfig.pixDiscountPercent}%`);
    expect(text).toContain(storeConfig.phoneDisplay);
    expect(text).not.toContain("{{");
  });
});
