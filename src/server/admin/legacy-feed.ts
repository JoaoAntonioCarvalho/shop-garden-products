/**
 * Leitura do XML de produtos do site antigo (FastCommerce, /xml-products.ehc no formato padrão).
 * Devolve uma tabela no formato próprio da importação, mais o que a importação não cobre:
 * quais produtos só são entregues em São Paulo e o endereço antigo de cada um.
 */

export const LEGACY_FEED_HEADERS = [
  "sku_produto",
  "nome",
  "categoria",
  "marca",
  "descricao_curta",
  "descricao",
  "preco",
  "preco_de",
  "peso_gramas",
  "imagem",
] as const;

export type LegacyFeed = {
  headers: string[];
  rows: string[][];
  /** Códigos dos produtos que o site antigo só entregava na cidade de São Paulo. */
  localOnlySkus: string[];
  /** Código do produto → caminho da página dele no site antigo, para redirecionar. */
  oldPaths: Record<string, string>;
};

/** No site antigo, 350 kg de peso era o truque para impedir a cotação de frete nacional. */
const LOCAL_ONLY_WEIGHT_GRAMS = 350_000;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeXmlText(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&(\w+);/g, (match, name) => NAMED_ENTITIES[name] ?? match);
}

function tag(block: string, name: string): string {
  const match = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(block);
  return match ? decodeXmlText(match[1]).trim() : "";
}

/** "R$ 1.234,50" → "1234,50". */
const money = (text: string) => text.replace(/[^\d,]/g, "");

export function parseLegacyFeed(xml: string): LegacyFeed {
  const blocks = xml.match(/<produto>[\s\S]*?<\/produto>/g) ?? [];
  const feed: LegacyFeed = {
    headers: [...LEGACY_FEED_HEADERS],
    rows: [],
    localOnlySkus: [],
    oldPaths: {},
  };
  const used = new Set<string>();

  for (const block of blocks) {
    const id = tag(block, "id_produto");
    const reference = tag(block, "Ref").toUpperCase();
    // A referência se repete em alguns produtos; o id do site antigo desempata.
    let sku = reference || `FC${id}`;
    if (used.has(sku)) sku = `${sku}-${id}`;
    used.add(sku);

    const name = tag(block, "descricao").replace(/\s+/g, " ");
    const short = tag(block, "DescricaoCurta").replace(/\s+/g, " ");
    const long = tag(block, "DescricaoLonga");
    const weight = Number(tag(block, "Peso").replace(/[^\d]/g, "")) || 0;
    const price = money(tag(block, "preco"));
    const regular = money(tag(block, "preco_normal"));
    const brand = /<descritor nome='Marca'>([\s\S]*?)<\/descritor>/.exec(block);
    const localOnly =
      weight >= LOCAL_ONLY_WEIGHT_GRAMS || /toda\s+(a\s+)?cidade de s[ãa]o paulo/i.test(long);
    if (localOnly) feed.localOnlySkus.push(sku);

    try {
      const path = new URL(tag(block, "link_produto")).pathname;
      if (path.length > 1) feed.oldPaths[sku] = path;
    } catch {
      // Sem endereço antigo válido: o produto entra sem redirecionamento.
    }

    feed.rows.push([
      sku,
      name,
      tag(block, "categoria"),
      brand ? decodeXmlText(brand[1]).trim() : "",
      // A descrição curta do site antigo quase sempre repete o nome.
      short.toLowerCase() === name.toLowerCase() ? "" : short,
      long,
      price,
      regular !== price ? regular : "",
      weight >= LOCAL_ONLY_WEIGHT_GRAMS ? "" : String(weight),
      tag(block, "imagem"),
    ]);
  }
  return feed;
}

/**
 * Categorias do site antigo cujo nome não bate com o da loja nova, já sem acentos e em minúsculas,
 * com os níveis separados por " > ".
 */
export const LEGACY_CATEGORY_ALIASES: Record<string, string> = {
  "vasos > acessorios": "vasos > acessorios para vasos",
  "vasos > polietileno": "vasos > polietileno e reciclados",
  "vasos > barro": "vasos > ceramica e barro",
  "vasos > fibra de coco/palmeira": "vasos > fibra de coco",
  "jardinagem > fertilizantes": "jardinagem > adubos e fertilizantes",
  "plantas naturais > orquideas naturais": "plantas naturais > orquideas",
  "flores artificiais": "flores e plantas artificiais",
  "flores artificiais > plantas/floresartificiais":
    "flores e plantas artificiais > plantas e flores artificiais",
  cachepot: "cachepots",
  "cachepot > ceramica": "cachepots > ceramica",
  "cachepot > metal/aluminio": "cachepots > metal e aluminio",
  "cachepot > autoirrigavel": "cachepots > autoirrigaveis",
  "cachepot > vidro": "cachepots > vidro",
  decoracao: "decoracao e aromas",
  "decoracao > aromas": "decoracao e aromas",
};
