import { describe, expect, it } from "vitest";
import {
  findRedirectProblem,
  normalizeRedirectInput,
  normalizeRedirectPath,
  searchTermsFromLegacyPath,
  stripLegacyParams,
} from "@/lib/redirects";

describe("normalização de URLs antigas", () => {
  it("ignora maiúsculas e barra final", () => {
    expect(normalizeRedirectPath("/Decoracao/Vasos/")).toBe("/decoracao/vasos");
    expect(normalizeRedirectPath("/landingVasosCeramica.html")).toBe("/landingvasosceramica.html");
    expect(normalizeRedirectPath("/")).toBe("/");
    expect(normalizeRedirectPath("//decoracao//cactus")).toBe("/decoracao/cactus");
  });

  it("mantém só o parâmetro que identifica o conteúdo nas páginas .asp", () => {
    expect(normalizeRedirectPath("/listaprodutos.asp", "avancada=true&Adicional1=238944")).toBe(
      "/listaprodutos.asp?adicional1=238944",
    );
    expect(normalizeRedirectPath("/decoracao/vasos", "IDLoja=123&mob=true")).toBe(
      "/decoracao/vasos",
    );
  });

  it("aceita URL completa digitada no admin", () => {
    expect(normalizeRedirectInput("https://www.netshopgarden.com.br/QuemSomos.htm")).toBe(
      "/quemsomos.htm",
    );
    expect(normalizeRedirectInput("/listaprodutos.asp?avancada=true&Adicional1=232116")).toBe(
      "/listaprodutos.asp?adicional1=232116",
    );
  });

  it("remove os parâmetros de sessão do site antigo", () => {
    const cleaned = stripLegacyParams(new URLSearchParams("IDLoja=42&mob=true&pagina=2"));
    expect(cleaned?.toString()).toBe("pagina=2");
    expect(stripLegacyParams(new URLSearchParams("pagina=2"))).toBeNull();
  });

  it("extrai termos de busca de URLs antigas de produto", () => {
    expect(searchTermsFromLegacyPath("/decoracao/vaso-ceramica-azul-86355227")).toBe(
      "vaso ceramica azul",
    );
    expect(searchTermsFromLegacyPath("/landing-orquidea-branca.html")).toBe("orquidea branca");
  });
});

describe("validação de redirecionamentos", () => {
  const existing = new Map([
    ["/a", "/b"],
    ["/b", "/c"],
  ]);

  it("detecta loop direto e indireto", () => {
    expect(findRedirectProblem("/x", "/x", existing)).toBe("loop");
    expect(findRedirectProblem("/c", "/a", existing)).toBe("loop");
  });

  it("detecta cadeia", () => {
    expect(findRedirectProblem("/x", "/a", existing)).toBe("chain");
  });

  it("aceita destino final", () => {
    expect(findRedirectProblem("/x", "/categoria/vasos", existing)).toBeNull();
  });
});
