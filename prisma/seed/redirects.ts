import { normalizeRedirectInput } from "../../src/lib/redirects";
import { seedCategories } from "./categories";
import { db, log } from "./helpers";

/** Redirecionamentos 301 das URLs do site antigo (seções 8.1, 8.2 e 8.3). */
export async function seedRedirects() {
  const pairs: Array<[from: string, to: string, note: string]> = [];

  for (const root of seedCategories) {
    for (const legacy of root.legacyPaths)
      pairs.push([legacy, `/categoria/${root.slug}`, `Categoria ${root.name}`]);
    for (const child of root.children ?? []) {
      for (const legacy of child.legacyPaths) {
        pairs.push([
          legacy,
          `/categoria/${root.slug}/${child.slug}`,
          `Categoria ${root.name} / ${child.name}`,
        ]);
      }
    }
  }

  pairs.push(
    [
      "/listaprodutos.asp?avancada=true&Adicional1=238944",
      "/colecao/novidades",
      "Coleção Novidades",
    ],
    [
      "/listaprodutos.asp?avancada=true&Adicional1=232116",
      "/colecao/linha-carol-costa",
      "Coleção Linha Carol Costa",
    ],
    ["/QuemSomos.htm", "/sobre", "Página institucional"],
    ["/Ajuda.htm", "/ajuda", "Página institucional"],
    ["/Depoimentos.htm", "/avaliacoes", "Página institucional"],
    ["/Depoimentos2020.htm", "/avaliacoes", "Página institucional"],
    ["/track.asp", "/rastreio", "Rastreio de pedido"],
    ["/cadastro.asp", "/conta", "Cadastro"],
  );

  const data = pairs.map(([from, toPath, note]) => ({
    fromPath: normalizeRedirectInput(from),
    toPath,
    note,
    statusCode: 301,
  }));
  const unique = [...new Map(data.map((row) => [row.fromPath, row])).values()];
  await db.redirect.createMany({ data: unique, skipDuplicates: true });
  log("Redirecionamentos", unique.length);
}
