/**
 * Árvore de categorias da loja (seção 8.1). É a fonte usada pelo seed para criar as categorias
 * e pelo menu enquanto o banco não responde. Depois do seed, o admin é quem manda.
 */
export type CategoryNode = {
  name: string;
  slug: string;
  /** Jardinagem e filhas: continuam na loja, com destaque reduzido. */
  isSecondary?: boolean;
  children?: CategoryNode[];
};

export const categoryTree: CategoryNode[] = [
  {
    name: "Plantas naturais",
    slug: "plantas-naturais",
    children: [
      { name: "Orquídeas", slug: "orquideas" },
      { name: "Plantas ornamentais", slug: "plantas-ornamentais" },
      { name: "Flores em vasos", slug: "flores-em-vasos" },
      { name: "Cactos e suculentas", slug: "cactos-e-suculentas" },
      { name: "Ervas e temperos", slug: "ervas-e-temperos" },
      { name: "Caixarias", slug: "caixarias" },
    ],
  },
  {
    name: "Arranjos",
    slug: "arranjos",
    children: [{ name: "Arranjos artificiais", slug: "arranjos-artificiais" }],
  },
  {
    name: "Vasos",
    slug: "vasos",
    children: [
      { name: "Cerâmica e barro", slug: "ceramica-e-barro" },
      { name: "Porcelana", slug: "porcelana" },
      { name: "Vidro", slug: "vidro" },
      { name: "Fibra de coco", slug: "fibra-de-coco" },
      { name: "Plástico", slug: "plastico" },
      { name: "Polietileno e reciclados", slug: "polietileno-e-reciclados" },
      { name: "Vasos decorativos", slug: "vasos-decorativos" },
      { name: "Acessórios para vasos", slug: "acessorios" },
    ],
  },
  {
    name: "Cachepots",
    slug: "cachepots",
    children: [
      { name: "Autoirrigáveis", slug: "autoirrigaveis" },
      { name: "Cerâmica", slug: "ceramica" },
      { name: "Porcelana", slug: "porcelana" },
      { name: "Metal e alumínio", slug: "metal-e-aluminio" },
      { name: "Vidro", slug: "vidro" },
      { name: "Madeira", slug: "madeira" },
      { name: "Cestaria", slug: "cestaria" },
      { name: "Plástico", slug: "plastico" },
    ],
  },
  {
    name: "Flores e plantas artificiais",
    slug: "flores-e-plantas-artificiais",
    children: [
      { name: "Plantas e flores artificiais", slug: "plantas-e-flores" },
      { name: "Buquês", slug: "buques" },
      { name: "Vasos com flores artificiais", slug: "vasos-com-flores" },
    ],
  },
  {
    name: "Decoração e aromas",
    slug: "decoracao-e-aromas",
    children: [
      { name: "Objetos de decoração", slug: "objetos-de-decoracao" },
      { name: "Aromas L'Envie", slug: "aromas-lenvie" },
      { name: "Linha Conceito", slug: "linha-conceito" },
    ],
  },
  {
    name: "Jardinagem",
    slug: "jardinagem",
    isSecondary: true,
    children: [
      { name: "Ferramentas e acessórios", slug: "ferramentas-e-acessorios" },
      { name: "Adubos e fertilizantes", slug: "adubos-e-fertilizantes" },
      { name: "Substratos", slug: "substratos" },
      { name: "Produtos para plantio", slug: "produtos-para-plantio" },
      { name: "Defensivos", slug: "defensivos" },
      { name: "Irrigação", slug: "irrigacao" },
    ],
  },
];

export const categoryHref = (path: string) => `/categoria/${path}`;
