import { describe, expect, it } from "vitest";
import { parseImageUrls } from "@/server/admin/product-import";
import { isFetchableImageUrl } from "@/server/services/legacy-images";

describe("fotos do site antigo", () => {
  it("lê vários endereços por célula, completa os relativos e descarta o que não é da web", () => {
    expect(
      parseImageUrls(
        ["a.jpg", "https://cdn.example.com/b.jpg|c.png; a.jpg", "", "ftp://x.example.com/d.jpg"],
        "https://loja.example.com/img/",
      ),
    ).toEqual([
      "https://loja.example.com/img/a.jpg",
      "https://cdn.example.com/b.jpg",
      "https://loja.example.com/img/c.png",
    ]);
  });

  it("sem endereço base, ignora caminhos relativos e limita a seis fotos", () => {
    expect(parseImageUrls(["a.jpg"], "")).toEqual([]);
    const many = Array.from({ length: 9 }, (_, index) => `https://cdn.example.com/${index}.jpg`);
    expect(parseImageUrls([many.join(" ")], "")).toHaveLength(6);
  });

  it("só busca imagens em endereços públicos", () => {
    expect(isFetchableImageUrl("https://cdn.example.com/a.jpg")).toBe(true);
    for (const url of [
      "http://localhost/a.jpg",
      "http://127.0.0.1/a.jpg",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/a.jpg",
      "http://intranet/a.jpg",
      "http://servico.internal/a.jpg",
      "file:///etc/passwd",
      "nada",
    ])
      expect(isFetchableImageUrl(url), url).toBe(false);
  });
});
