import {
  generatePlaceholder,
  mapWithConcurrency,
  type IllustrationKind,
} from "../../scripts/generate-placeholders";
import type { Prisma, ProductType } from "../../src/generated/prisma/client";
import { normalizeText, slugify } from "../../src/lib/slug";
import { seedCategories, type SeedCategory } from "./categories";
import { daysAgo, db, log, pad } from "./helpers";
import { rawProducts, type RawProduct } from "./product-data";

// ───────────────────────── Imagens ─────────────────────────

type MediaSpec = {
  name: string;
  kind: IllustrationKind;
  label: string;
  alt: string;
  variation?: number;
  width?: number;
  height?: number;
};

/** Gera os arquivos (se ainda não existem) e registra os MediaAsset. Devolve nome → id. */
export async function ensureMedia(specs: MediaSpec[]): Promise<Map<string, string>> {
  const generated = await mapWithConcurrency(specs, 8, async (spec) => ({
    spec,
    file: await generatePlaceholder(spec.name, spec),
  }));

  const existing = await db.mediaAsset.findMany({
    where: { storageKey: { in: generated.map((g) => g.file.storageKey) } },
    select: { id: true, storageKey: true },
  });
  const known = new Set(existing.map((m) => m.storageKey));

  await db.mediaAsset.createMany({
    data: generated
      .filter((g) => !known.has(g.file.storageKey))
      .map(({ spec, file }) => ({
        originalName: `${spec.name}.webp`,
        storageKey: file.storageKey,
        mimeType: "image/webp",
        sizeBytes: file.sizeBytes,
        width: file.width,
        height: file.height,
        alt: spec.alt,
        blurDataUrl: file.blurDataUrl,
        variants: file.variants,
        isSample: true,
      })),
    skipDuplicates: true,
  });

  const all = await db.mediaAsset.findMany({
    where: { storageKey: { in: generated.map((g) => g.file.storageKey) } },
    select: { id: true, storageKey: true },
  });
  const idByKey = new Map(all.map((m) => [m.storageKey, m.id]));
  return new Map(generated.map((g) => [g.spec.name, idByKey.get(g.file.storageKey)!]));
}

// ───────────────────────── Categorias ─────────────────────────

const filtersByGroup: Record<string, string[]> = {
  plantas: ["luz", "ambiente", "pet", "cuidado", "porte"],
  vasos: ["material", "cor", "altura", "boca", "furo", "uso"],
  artificiais: ["tipo", "vaso", "cor"],
  jardinagem: ["tipo", "marca"],
};

export async function seedCategoryTree(): Promise<Map<string, string>> {
  const flat: Array<{
    node: SeedCategory;
    path: string;
    parentPath: string | null;
    position: number;
  }> = [];
  seedCategories.forEach((root, rootIndex) => {
    flat.push({ node: root, path: root.slug, parentPath: null, position: rootIndex });
    root.children?.forEach((child, childIndex) => {
      flat.push({
        node: child,
        path: `${root.slug}/${child.slug}`,
        parentPath: root.slug,
        position: childIndex,
      });
    });
  });

  const media = await ensureMedia(
    flat.map(({ node, path }, index) => ({
      name: `categoria-${path.replace("/", "-")}`,
      kind: node.illustration,
      label: node.name,
      alt: `Ilustração de teste da categoria ${node.name}`,
      variation: index % 3 === 0 ? 2 : 0,
      width: 1200,
      height: 1500,
    })),
  );

  const idByPath = new Map<string, string>();
  for (const { node, path, parentPath, position } of flat) {
    const data = {
      name: node.name,
      slug: node.slug,
      parentId: parentPath ? idByPath.get(parentPath)! : null,
      description: node.description,
      seoTitle: node.seoTitle ?? null,
      seoDescription: node.seoDescription ?? node.description.slice(0, 160),
      seoContent: node.seoContent ?? null,
      faq: node.faq ?? [],
      imageId: media.get(`categoria-${path.replace("/", "-")}`)!,
      position,
      isSecondary: node.isSecondary ?? false,
      showOnHome: node.showOnHome ?? false,
      legacyPaths: node.legacyPaths,
      filtersConfig: [...new Set(node.filters.flatMap((group) => filtersByGroup[group]))],
    };
    // Em uma segunda execução, não sobrescreve o que o admin já editou.
    const category = await db.category.upsert({
      where: { path },
      create: { path, ...data },
      update: {},
      select: { id: true },
    });
    idByPath.set(path, category.id);
  }
  log("Categorias", flat.length);
  return idByPath;
}

// ───────────────────────── Produtos ─────────────────────────

const OCCASION_TAGS = [
  "aniversario",
  "agradecimento",
  "casa-nova",
  "condolencias",
  "datas-especiais",
];

type Defaults = {
  type: ProductType;
  local: boolean;
  giftable: boolean;
  kind: IllustrationKind;
};

function defaultsFor(raw: RawProduct): Defaults {
  const [root, sub] = raw.c.split("/");
  const category = seedCategories.find((c) => c.slug === root)!;
  const node = sub ? category.children!.find((c) => c.slug === sub)! : category;
  const kind = node.illustration;

  switch (root) {
    case "plantas-naturais":
      return {
        type: sub === "orquideas" ? "ORCHID" : "NATURAL_PLANT",
        local: true,
        giftable:
          !sub ||
          ["orquideas", "flores-em-vasos", "caixarias", "cactos-e-suculentas"].includes(sub),
        kind: sub ? kind : "leaf",
      };
    case "arranjos":
      return sub
        ? { type: "ARTIFICIAL", local: false, giftable: true, kind }
        : { type: "ARRANGEMENT", local: true, giftable: true, kind };
    case "vasos":
      return { type: "POT", local: false, giftable: sub === "vasos-decorativos", kind };
    case "cachepots":
      return {
        type: "CACHEPOT",
        local: false,
        giftable: sub === "porcelana" || sub === "ceramica",
        kind,
      };
    case "flores-e-plantas-artificiais":
      return { type: "ARTIFICIAL", local: false, giftable: sub !== "plantas-e-flores", kind };
    case "decoracao-e-aromas":
      return {
        type: sub === "aromas-lenvie" ? "AROMA" : "DECOR",
        local: false,
        giftable: true,
        kind,
      };
    default:
      return {
        type:
          sub === "ferramentas-e-acessorios" || sub === "irrigacao" || !sub
            ? "GARDEN_TOOL"
            : "GARDEN_SUPPLY",
        local: false,
        giftable: false,
        kind,
      };
  }
}

const lightText: Record<string, string> = {
  FULL_SUN: "Precisa de sol direto por pelo menos quatro horas ao dia.",
  PARTIAL_SHADE: "Vai bem à meia-sombra, com sol suave pela manhã ou no fim da tarde.",
  SHADE: "Adapta-se a ambientes de sombra, longe das janelas.",
  INDIRECT_LIGHT:
    "Prefere luz indireta, perto de uma janela bem iluminada e sem sol direto nas folhas.",
};

const number = (value: number) => value.toLocaleString("pt-BR");

/** Segundo parágrafo da descrição, montado a partir dos dados do próprio produto. */
function bodyFor(raw: RawProduct, d: Defaults, index: number): string {
  const parts: string[] = [];
  switch (d.type) {
    case "NATURAL_PLANT":
    case "ORCHID":
    case "ARRANGEMENT": {
      if (raw.h) {
        parts.push(
          d.type === "ARRANGEMENT"
            ? `O arranjo tem cerca de ${number(raw.h)} cm de altura${raw.l ? ` por ${number(raw.l)} cm de largura` : ""}.`
            : `Na entrega, tem cerca de ${number(raw.h)} cm de altura, contando o vaso de cultivo.`,
        );
      }
      if (raw.luz) parts.push(lightText[raw.luz]);
      if (raw.rega) parts.push(`Rega: ${raw.rega.charAt(0).toLowerCase()}${raw.rega.slice(1)}.`);
      if (raw.pet === "TOXIC")
        parts.push(
          "É tóxica se ingerida: mantenha fora do alcance de cães, gatos e crianças pequenas.",
        );
      if (raw.pet === "SAFE" && index % 2 === 0)
        parts.push("É segura para casas com cães e gatos.");
      parts.push("Entregamos apenas na Grande São Paulo, em embalagem própria para plantas vivas.");
      break;
    }
    case "POT":
    case "CACHEPOT": {
      const dims = [
        raw.h ? `${number(raw.h)} cm de altura` : null,
        raw.boca ? `${number(raw.boca)} cm de boca` : null,
        raw.base ? `${number(raw.base)} cm de base` : null,
        raw.l && !raw.boca ? `${number(raw.l)} cm de largura` : null,
      ].filter(Boolean);
      if (dims.length)
        parts.push(
          `Medidas: ${dims.join(", ")}${raw.cap ? `, com capacidade para ${number(raw.cap)} ${raw.cap === 1 ? "litro" : "litros"}` : ""}.`,
        );
      if (raw.furo === true)
        parts.push(
          "Tem furo de drenagem, então a planta pode ser plantada direto, com uma camada de argila expandida no fundo.",
        );
      if (raw.furo === false && d.type === "CACHEPOT")
        parts.push(
          "Não tem furo: a planta fica no vaso de cultivo, dentro do cachepot, e a água da rega não escorre para o móvel.",
        );
      if (raw.furo === false && d.type === "POT")
        parts.push(
          "Não tem furo de drenagem: use com flores de corte ou com o vaso de cultivo dentro.",
        );
      if (raw.uso === "OUTDOOR")
        parts.push("Resiste a sol e chuva e pode ficar em áreas externas o ano todo.");
      if (raw.uso === "INDOOR") parts.push("Indicado para ambientes internos e varandas cobertas.");
      if (raw.uso === "BOTH") parts.push("Pode ser usado dentro de casa e em áreas externas.");
      if (raw.v)
        parts.push(
          "As medidas acima são do menor tamanho; as demais opções estão na ficha técnica de cada variação.",
        );
      break;
    }
    case "ARTIFICIAL": {
      if (raw.h)
        parts.push(
          `Tem ${number(raw.h)} cm de altura${raw.l ? ` e ${number(raw.l)} cm de largura` : ""}.`,
        );
      parts.push(
        raw.vaso
          ? "Já vem montado no recipiente, pronto para usar."
          : "O vaso não acompanha: as hastes são flexíveis e podem ser ajustadas ao recipiente que você escolher.",
      );
      parts.push(
        index % 2 === 0
          ? "Não precisa de rega nem de luz e mantém a aparência por anos em ambientes internos."
          : "Para limpar, passe um pano seco ou use o secador no modo frio. Evite sol direto, que desbota as cores.",
      );
      break;
    }
    case "AROMA": {
      parts.push(
        "As fragrâncias da L'Envie são desenvolvidas com notas verdes e florais, que combinam com ambientes cheios de plantas.",
      );
      parts.push(
        "Escolha a fragrância nas opções ao lado. Mantenha o produto longe do sol direto e do alcance de crianças e animais.",
      );
      break;
    }
    case "DECOR": {
      const dims = [
        raw.h ? `${number(raw.h)} cm de altura` : null,
        raw.l ? `${number(raw.l)} cm de largura` : null,
        raw.pr ? `${number(raw.pr)} cm de profundidade` : null,
      ].filter(Boolean);
      if (dims.length) parts.push(`Medidas: ${dims.join(", ")}.`);
      if (raw.mat) parts.push(`Material: ${raw.mat.toLowerCase()}.`);
      parts.push(
        "Para limpar, use apenas um pano macio e seco. Enviamos em embalagem reforçada, com proteção contra impacto.",
      );
      break;
    }
    default: {
      parts.push(
        [
          "Selecionado pela equipe do Shopping Garden, que usa o mesmo produto no cuidado diário das plantas da loja.",
          "Um item de uso frequente, que vale ter sempre à mão para o cuidado com vasos, canteiros e hortas.",
          "Indicado tanto para quem está montando o primeiro jardim quanto para quem já cuida de muitas plantas.",
        ][index % 3],
      );
      parts.push(
        d.type === "GARDEN_TOOL"
          ? "Depois de usar, limpe e seque antes de guardar, para aumentar a vida útil."
          : "Siga as quantidades indicadas no rótulo e guarde a embalagem fechada, em local seco e arejado.",
      );
      if (raw.marca) parts.push(`Marca: ${raw.marca}.`);
    }
  }
  // A descrição precisa ter de 300 a 600 caracteres: completa com informações úteis do tipo de produto.
  const extras = extrasFor(d.type);
  let extraIndex = index;
  while (raw.t.length + parts.join(" ").length + 1 < 300 && extraIndex < index + extras.length) {
    parts.push(extras[extraIndex++ % extras.length]);
  }
  return parts.join(" ");
}

function extrasFor(type: ProductType): string[] {
  switch (type) {
    case "POT":
    case "CACHEPOT":
      return [
        "Enviamos em embalagem individual, com proteção contra impacto.",
        "Confira as medidas do vaso de cultivo da sua planta antes de escolher o tamanho.",
        "A cor pode variar levemente de uma peça para outra, o que é próprio do material.",
      ];
    case "ARTIFICIAL":
      return [
        "É enviado para todo o Brasil, em embalagem que preserva o formato das hastes.",
        "Ao receber, abra as folhas e ajuste as hastes com as mãos para dar volume.",
      ];
    case "DECOR":
    case "AROMA":
      return [
        "Pode ser enviado como presente, com cartão e embalagem especial.",
        "Combina com plantas de folhagem escura e com vasos de cerâmica clara.",
      ];
    case "GARDEN_TOOL":
    case "GARDEN_SUPPLY":
      return [
        "É enviado para todo o Brasil junto com os demais itens do pedido.",
        "Em caso de dúvida sobre o uso, fale com a nossa equipe pelo WhatsApp.",
      ];
    default:
      return [
        "Se for presente, inclua na sacola um cartão com a sua mensagem, sem custo.",
        "A planta enviada tem o mesmo porte e padrão da foto, com pequenas variações naturais.",
      ];
  }
}

function careFor(raw: RawProduct, d: Defaults): string {
  switch (d.type) {
    case "NATURAL_PLANT":
    case "ORCHID":
      return `<ul><li><strong>Luz:</strong> ${lightText[raw.luz ?? "INDIRECT_LIGHT"]}</li><li><strong>Rega:</strong> ${raw.rega ?? "Regue quando a terra estiver seca ao toque"}.</li><li><strong>Adubação:</strong> a cada 15 a 30 dias na primavera e no verão, com adubo próprio para a espécie.</li><li><strong>Ao receber:</strong> retire a embalagem, deixe a planta em local claro e só regue se o substrato estiver seco.</li></ul>`;
    case "ARRANGEMENT":
      return `<ul><li>Mantenha o arranjo em local fresco, longe de sol direto e de correntes de ar.</li><li>${raw.rega ?? "Regue as plantas quando o substrato estiver seco"}.</li><li>Retire flores e folhas secas para o arranjo durar mais.</li></ul>`;
    case "ARTIFICIAL":
      return "<ul><li>Passe pano seco ou secador no modo frio para tirar o pó.</li><li>A cada dois ou três meses, limpe as folhas maiores com pano levemente úmido.</li><li>Evite sol direto e produtos químicos.</li></ul>";
    case "POT":
    case "CACHEPOT":
      return `<ul><li>Limpe com pano úmido e sabão neutro.</li><li>${raw.furo ? "Use uma camada de argila expandida e manta de drenagem antes do substrato." : "Depois de regar, retire a água que sobrar no fundo."}</li><li>${/madeira|taboa|seagrass|rattan|palha|bambu|teca|pinus/i.test(raw.mat ?? "") ? "Evite contato direto com água: use um prato dentro da peça." : "Evite impactos e mudanças bruscas de temperatura."}</li></ul>`;
    case "AROMA":
      return "<ul><li>Mantenha longe do sol direto e de fontes de calor.</li><li>Não deixe velas acesas sem alguém por perto.</li><li>Em caso de contato com tecidos ou móveis, limpe imediatamente.</li></ul>";
    case "DECOR":
      return "<ul><li>Limpe com pano macio e seco.</li><li>Não use produtos abrasivos.</li></ul>";
    default:
      return "<ul><li>Guarde em local seco e arejado.</li><li>Mantenha fora do alcance de crianças e animais.</li><li>Leia o rótulo antes de usar.</li></ul>";
  }
}

function cleaningFor(raw: RawProduct, d: Defaults): string | null {
  if (d.type === "ARTIFICIAL") return "Passe pano seco ou secador no modo frio";
  if (d.type === "POT" || d.type === "CACHEPOT" || d.type === "DECOR") {
    return /madeira|taboa|seagrass|rattan|palha|bambu|teca|pinus/i.test(raw.mat ?? "")
      ? "Pano seco; evite contato com água"
      : "Pano úmido e sabão neutro";
  }
  return null;
}

type VariantDef = readonly [
  name: string,
  options: Record<string, string>,
  price: number,
  grams?: number,
];

/** Um em cada cinco produtos sem variação definida ganha duas opções coerentes com o tipo. */
function autoVariants(raw: RawProduct, d: Defaults, index: number): VariantDef[] | null {
  if (index % 5 !== 1) return null;
  switch (d.type) {
    case "NATURAL_PLANT":
    case "ORCHID":
      return [
        ["No vaso de cultivo", { Apresentação: "Vaso de cultivo" }, raw.p, raw.g],
        ["Com cachepot de cerâmica", { Apresentação: "Com cachepot" }, raw.p + 45, raw.g + 900],
      ];
    case "POT":
    case "CACHEPOT": {
      const base = raw.cor ?? "Natural";
      const other = base === "Branco" ? "Grafite" : "Branco";
      return [
        [base, { Cor: base }, raw.p, raw.g],
        [other, { Cor: other }, raw.p, raw.g],
      ];
    }
    case "GARDEN_TOOL":
    case "GARDEN_SUPPLY":
      return [
        ["1 unidade", { Quantidade: "1 unidade" }, raw.p, raw.g],
        ["Kit com 3", { Quantidade: "Kit com 3" }, Math.round(raw.p * 2.7), raw.g * 3],
      ];
    case "ARTIFICIAL":
      return raw.vaso
        ? null
        : [
            ["1 haste", { Quantidade: "1 haste" }, raw.p, raw.g],
            ["3 hastes", { Quantidade: "3 hastes" }, Math.round(raw.p * 2.6), raw.g * 3],
          ];
    default:
      return null;
  }
}

export type SeededVariant = {
  id: string;
  productId: string;
  sku: string;
  name: string;
  productName: string;
  priceCents: number;
  costCents: number;
  weightGrams: number;
  targetStock: number;
  local: boolean;
  imageUrl: string | null;
};

const ZERO_STOCK_POSITIONS = new Set([10, 61, 112, 163]);
const LOW_STOCK_POSITIONS = new Map([
  [3, 2],
  [25, 1],
  [48, 3],
  [71, 2],
  [95, 1],
  [118, 3],
  [140, 2],
  [176, 2],
]);

export async function seedProducts(categoryIds: Map<string, string>): Promise<SeededVariant[]> {
  const now = new Date();
  const prepared = rawProducts.map((raw, index) => ({
    raw,
    index,
    d: defaultsFor(raw),
    sku: `TESTE-${pad(index + 1, 4)}`,
    slug: slugify(raw.n),
  }));

  // Imagens: de 2 a 4 por produto, com composição e fundo variando.
  const imageSpecs = prepared.flatMap(({ raw, d, slug, index }) =>
    Array.from({ length: 2 + (index % 3) }, (_, i) => ({
      name: `produto-${slug}-${i + 1}`,
      kind: d.kind,
      label: raw.n,
      alt:
        i === 0 ? `${raw.n}: ilustração de teste` : `${raw.n}: ilustração de teste, vista ${i + 1}`,
      variation: i,
    })),
  );
  const media = await ensureMedia(imageSpecs);
  log("Imagens de produto", imageSpecs.length);

  const existing = new Set(
    (
      await db.product.findMany({ where: { sku: { startsWith: "TESTE-" } }, select: { sku: true } })
    ).map((p) => p.sku),
  );
  let created = 0;
  let variantPosition = 0;

  for (const { raw, index, d, sku, slug } of prepared) {
    const variantDefs = raw.v ??
      autoVariants(raw, d, index) ?? [["Padrão", {}, raw.p, raw.g] as const];
    const positions = variantDefs.map(() => variantPosition++);
    if (existing.has(sku)) continue;

    const isNew = index % 7 === 0;
    const onPromo = index % 10 === 3;
    const fragile =
      d.local || /cerâmica|porcelana|vidro|barro|cimento|concreto/i.test(raw.mat ?? "");
    const giftTags = d.giftable ? [OCCASION_TAGS[index % 5], OCCASION_TAGS[(index + 2) % 5]] : [];
    const [root, sub] = raw.c.split("/");
    const tags = [
      ...new Set([
        ...giftTags,
        root,
        ...(sub ? [sub] : []),
        ...(raw.sub ? [slugify(raw.sub)] : []),
      ]),
    ];
    const body = bodyFor(raw, d, index);
    const isPlant = d.type === "NATURAL_PLANT" || d.type === "ORCHID" || d.type === "ARRANGEMENT";
    const categoryNode = seedCategories.find((c) => c.slug === root)!;
    const categoryName = sub
      ? categoryNode.children!.find((c) => c.slug === sub)!.name
      : categoryNode.name;
    const imageCount = 2 + (index % 3);

    const data: Prisma.ProductUncheckedCreateInput = {
      name: raw.n,
      slug,
      sku,
      status: "ACTIVE",
      productType: d.type,
      primaryCategoryId: categoryIds.get(raw.c)!,
      brand: raw.marca ?? null,
      shortDescription: (raw.t.split(". ")[0] + ".").replace(/\.\.$/, ".").slice(0, 160),
      description: `<p>${raw.t}</p><p>${body}</p>`,
      careInstructions: careFor(raw, d),
      tags,
      isFeatured: index % 9 === 1,
      isNew,
      isGiftable: d.giftable,
      sameDayEligible: true,
      deliveryScope: d.local ? "LOCAL_ONLY" : "NATIONAL",
      fragile,
      perishable: d.local,
      commonName: isPlant ? (raw.pop ?? null) : null,
      scientificName: raw.sci ?? null,
      light: raw.luz ?? null,
      watering: raw.rega ?? null,
      environment: isPlant ? (raw.amb ?? null) : null,
      petSafety: raw.pet ?? null,
      careLevel: raw.cuid ?? null,
      heightCm: raw.h ?? null,
      material: raw.mat ?? null,
      color: raw.cor ?? null,
      widthCm: raw.l ?? raw.boca ?? null,
      depthCm: raw.pr ?? raw.boca ?? null,
      mouthDiameterCm: raw.boca ?? null,
      baseDiameterCm: raw.base ?? null,
      capacityLiters: raw.cap ?? null,
      hasDrainageHole: raw.furo ?? null,
      indoorOutdoor: raw.uso ?? null,
      includesPot: raw.vaso ?? null,
      cleaningCare: cleaningFor(raw, d),
      subtype: raw.sub ?? null,
      seoTitle: raw.n,
      seoDescription: (raw.t.split(". ")[0] + ".").slice(0, 155),
      searchText: normalizeText(
        [raw.n, raw.sci, raw.pop, tags.join(" "), sku, categoryName, raw.mat, raw.marca]
          .filter(Boolean)
          .join(" "),
      ),
      isSample: true,
      publishedAt: isNew ? daysAgo(2 + (index % 18), now) : daysAgo(60 + ((index * 13) % 240), now),
      variants: {
        create: variantDefs.map(([name, options, price, grams], i) => {
          const priceCents = Math.round(price * 100);
          const position = positions[i];
          const stock = ZERO_STOCK_POSITIONS.has(position)
            ? 0
            : (LOW_STOCK_POSITIONS.get(position) ?? 5 + ((position * 7) % 36));
          return {
            name,
            sku: `${sku}-${pad(i + 1, 2)}`,
            options,
            priceCents,
            compareAtPriceCents:
              !onPromo && index % 6 === 2 ? Math.round((priceCents * 1.18) / 100) * 100 : null,
            costCents: Math.round((priceCents * (45 + (index % 16))) / 100),
            promoPriceCents: onPromo ? Math.round((priceCents * 0.85) / 10) * 10 : null,
            promoStartsAt: onPromo ? daysAgo(5, now) : null,
            promoEndsAt: onPromo ? daysAgo(-20, now) : null,
            stockOnHand: stock,
            lowStockThreshold: 3,
            weightGrams: grams ?? raw.g,
            barcode: `789${pad(1000000000 + index * 100 + i, 10)}`,
            position: i,
          };
        }),
      },
      images: {
        create: Array.from({ length: imageCount }, (_, i) => ({
          mediaId: media.get(`produto-${slug}-${i + 1}`)!,
          position: i,
          isCover: i === 0,
        })),
      },
    };

    await db.product.create({ data });
    created++;
  }
  log("Produtos de teste", `${prepared.length} (${created} novos)`);

  const variants = await db.productVariant.findMany({
    where: { product: { isSample: true } },
    orderBy: { sku: "asc" },
    select: {
      id: true,
      productId: true,
      sku: true,
      name: true,
      priceCents: true,
      costCents: true,
      weightGrams: true,
      stockOnHand: true,
      product: {
        select: {
          name: true,
          deliveryScope: true,
          images: {
            where: { isCover: true },
            take: 1,
            select: { media: { select: { variants: true } } },
          },
        },
      },
    },
  });

  return variants.map((v) => ({
    id: v.id,
    productId: v.productId,
    sku: v.sku,
    name: v.name,
    productName: v.product.name,
    priceCents: v.priceCents,
    costCents: v.costCents ?? 0,
    weightGrams: v.weightGrams,
    targetStock: v.stockOnHand,
    local: v.product.deliveryScope === "LOCAL_ONLY",
    imageUrl:
      ((v.product.images[0]?.media.variants ?? {}) as Record<string, string>)["400"] ?? null,
  }));
}

// ───────────────────────── Coleções ─────────────────────────

export async function seedCollections() {
  const media = await ensureMedia([
    {
      name: "colecao-novidades",
      kind: "leaf",
      label: "Novidades",
      alt: "Ilustração de teste da coleção Novidades",
      width: 1200,
      height: 1500,
    },
    {
      name: "colecao-carol-costa",
      kind: "cachepot",
      label: "Linha Carol Costa",
      alt: "Ilustração de teste da Linha Carol Costa",
      width: 1200,
      height: 1500,
      variation: 2,
    },
    {
      name: "colecao-mais-vendidos",
      kind: "orchid",
      label: "Mais vendidos",
      alt: "Ilustração de teste da coleção Mais vendidos",
      width: 1200,
      height: 1500,
    },
    {
      name: "colecao-sob-medida",
      kind: "arrangement",
      label: "Arranjos sob medida",
      alt: "Ilustração de teste da coleção Arranjos sob medida",
      width: 1200,
      height: 1500,
      variation: 2,
    },
  ]);

  const collections: Array<Prisma.CollectionUncheckedCreateInput & { products?: string[] }> = [
    {
      name: "Novidades",
      slug: "novidades",
      description:
        "O que acabou de chegar do Shopping Garden: plantas, vasos e peças novas na loja.",
      type: "RULE",
      rule: { kind: "new", days: 45 },
      legacyPaths: ["/listaprodutos.asp?adicional1=238944"],
      imageId: media.get("colecao-novidades")!,
      position: 0,
    },
    {
      name: "Linha Carol Costa",
      slug: "linha-carol-costa",
      description: "Vasos e cachepots da Linha Carol Costa, em cerâmica e acabamentos naturais.",
      type: "MANUAL",
      legacyPaths: ["/listaprodutos.asp?adicional1=232116"],
      imageId: media.get("colecao-carol-costa")!,
      position: 1,
      products: [
        "cachepot-de-ceramica-mosaico",
        "cachepot-de-ceramica-branca-fosca",
        "cachepot-de-ceramica-canelada-terracota",
        "vaso-de-ceramica-vitrificada-verde-musgo",
        "vaso-decorativo-de-ceramica-texturizada",
        "vaso-decorativo-de-ceramica-bicolor",
        "cachepot-de-cestaria-natural",
        "kit-3-vasos-de-ceramica-natural",
      ],
    },
    {
      name: "Mais vendidos",
      slug: "mais-vendidos",
      description: "As plantas e peças mais pedidas nos últimos 30 dias.",
      type: "RULE",
      rule: { kind: "bestsellers" },
      imageId: media.get("colecao-mais-vendidos")!,
      position: 2,
    },
    {
      name: "Arranjos sob medida",
      slug: "sob-medida",
      description:
        "Arranjos exclusivos, montados para a sua ocasião, o seu espaço e o seu orçamento.",
      content:
        "<p>Conte para a gente a ocasião, as cores que você imagina e onde o arranjo vai ficar. Nossa equipe de floristas do Shopping Garden envia sugestões com fotos, medidas e valores, e monta a peça para a data combinada.</p><h2>Como funciona</h2><ol><li>Você descreve a ideia pelo WhatsApp, com fotos de referência se tiver.</li><li>Enviamos de duas a três propostas, com orçamento.</li><li>Depois da aprovação, montamos e entregamos na Grande São Paulo.</li></ol><p>Abaixo, alguns arranjos que já fazem parte da loja e servem de ponto de partida.</p>",
      type: "RULE",
      rule: { kind: "category", path: "arranjos" },
      imageId: media.get("colecao-sob-medida")!,
      position: 3,
    },
  ];

  for (const { products, ...data } of collections) {
    const collection = await db.collection.upsert({
      where: { slug: data.slug },
      create: data,
      update: {},
      select: { id: true },
    });
    if (products) {
      const found = await db.product.findMany({
        where: { slug: { in: products } },
        select: { id: true, slug: true },
      });
      await db.collectionProduct.createMany({
        data: found.map((p) => ({
          collectionId: collection.id,
          productId: p.id,
          position: products.indexOf(p.slug),
        })),
        skipDuplicates: true,
      });
    }
  }
  log("Coleções", collections.length);
}
