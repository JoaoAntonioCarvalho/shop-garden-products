/** "Orquídea Phalaenopsis branca 2 hastes" → "orquidea-phalaenopsis-branca-2-hastes" */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Remove acentos e baixa a caixa, mantendo espaços. Usado para normalizar termos de busca. */
export function normalizeText(input: string): string {
  return input.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
