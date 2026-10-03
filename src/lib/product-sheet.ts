import type { SheetRow } from "@/components/store/botanical-sheet";

/** Campos do produto usados na ficha. Funciona no servidor e na prévia ao vivo do admin. */
export type SheetSource = {
  name: string;
  productType: string;
  commonName?: string | null;
  scientificName?: string | null;
  light?: string | null;
  watering?: string | null;
  environment?: string | null;
  petSafety?: string | null;
  careLevel?: string | null;
  heightCm?: number | null;
  material?: string | null;
  color?: string | null;
  widthCm?: number | null;
  depthCm?: number | null;
  mouthDiameterCm?: number | null;
  baseDiameterCm?: number | null;
  capacityLiters?: number | null;
  hasDrainageHole?: boolean | null;
  indoorOutdoor?: string | null;
  includesPot?: boolean | null;
  cleaningCare?: string | null;
  brand?: string | null;
  weightGrams?: number | null;
};

export const lightLabels: Record<string, string> = {
  FULL_SUN: "Sol pleno",
  PARTIAL_SHADE: "Meia-sombra",
  SHADE: "Sombra",
  INDIRECT_LIGHT: "Luz indireta",
};
export const environmentLabels: Record<string, string> = {
  INDOOR: "Interno",
  OUTDOOR: "Externo",
  BOTH: "Interno e externo",
};
export const careLabels: Record<string, string> = {
  EASY: "Fácil",
  MODERATE: "Moderado",
  DEMANDING: "Exige atenção",
};
export const petLabels: Record<string, string> = {
  SAFE: "Pet friendly",
  NOT_SAFE: "Não indicada para casas com pets",
  TOXIC: "Tóxica para pets",
};

const n = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function formatWeight(grams: number): string {
  return grams >= 1000 ? `${n(grams / 1000)} kg` : `${grams} g`;
}

const BOTANICAL_TYPES = new Set(["NATURAL_PLANT", "ORCHID", "ARRANGEMENT"]);

export type ProductSheet = {
  heading: string;
  title: string;
  scientificName: string | null;
  rows: SheetRow[];
};

/**
 * Monta a ficha do produto: ficha botânica para plantas, orquídeas e arranjos naturais; ficha
 * técnica para vasos, cachepots, decoração e artificiais (seção 6.6). Null quando não há dados.
 */
export function buildProductSheet(product: SheetSource): ProductSheet | null {
  const rows: SheetRow[] = [];
  const add = (label: string, value: string | null | undefined | false, alert = false) => {
    if (value) rows.push({ label, value, alert });
  };

  if (BOTANICAL_TYPES.has(product.productType)) {
    add("Luz", product.light && lightLabels[product.light]);
    add("Rega", product.watering);
    add(
      "Porte na entrega",
      product.heightCm != null && `Cerca de ${n(product.heightCm)} cm de altura`,
    );
    add("Ambiente", product.environment && environmentLabels[product.environment]);
    add("Pets", product.petSafety && petLabels[product.petSafety], product.petSafety === "TOXIC");
    add("Nível de cuidado", product.careLevel && careLabels[product.careLevel]);
    if (rows.length === 0) return null;
    return {
      heading: "Ficha botânica",
      title: product.commonName || product.name,
      scientificName: product.scientificName ?? null,
      rows,
    };
  }

  add("Material", product.material);
  const round = [
    product.heightCm != null ? `${n(product.heightCm)} cm de altura` : null,
    product.mouthDiameterCm != null ? `${n(product.mouthDiameterCm)} cm de boca` : null,
    product.baseDiameterCm != null ? `${n(product.baseDiameterCm)} cm de base` : null,
  ].filter(Boolean);
  const box = [
    product.heightCm != null ? `${n(product.heightCm)} cm de altura` : null,
    product.widthCm != null ? `${n(product.widthCm)} cm de largura` : null,
    product.depthCm != null && product.depthCm !== product.widthCm
      ? `${n(product.depthCm)} cm de profundidade`
      : null,
  ].filter(Boolean);
  add("Dimensões", (product.mouthDiameterCm != null ? round : box).join(", "));
  add(
    "Capacidade",
    product.capacityLiters != null &&
      `${n(product.capacityLiters)} ${product.capacityLiters === 1 ? "litro" : "litros"}`,
  );
  if (product.hasDrainageHole != null)
    add("Furo de drenagem", product.hasDrainageHole ? "Sim" : "Não");
  if (product.includesPot != null) add("Acompanha vaso", product.includesPot ? "Sim" : "Não");
  add("Uso", product.indoorOutdoor && environmentLabels[product.indoorOutdoor]);
  add("Cor", product.color);
  add("Marca", product.brand);
  add(
    "Peso",
    product.weightGrams != null && product.weightGrams > 0 && formatWeight(product.weightGrams),
  );
  add("Limpeza", product.cleaningCare);
  if (rows.length === 0) return null;
  return { heading: "Ficha técnica", title: product.name, scientificName: null, rows };
}
