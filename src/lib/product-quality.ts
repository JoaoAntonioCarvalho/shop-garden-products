/**
 * Qualidade de cadastro do produto, de 0 a 100 (seção 12.5). A mesma conta alimenta o indicador
 * do formulário, o filtro da lista e o relatório de cadastro incompleto.
 */

export type QualityInput = {
  productType: string;
  primaryCategoryId: string | null;
  shortDescription: string | null;
  /** Texto da descrição já sem HTML. */
  descriptionText: string;
  seoTitle: string | null;
  seoDescription: string | null;
  images: Array<{ alt: string }>;
  /** Peso em gramas das variações ativas. */
  variantWeights: number[];
  heightCm: number | null;
  widthCm: number | null;
  // Ficha botânica
  light: string | null;
  watering: string | null;
  environment: string | null;
  petSafety: string | null;
  careLevel: string | null;
  // Ficha técnica
  material: string | null;
  color: string | null;
};

export type QualityCheck = { key: string; label: string; points: number; ok: boolean };

export const QUALITY_PUBLISH_MINIMUM = 60;

const LIVING_TYPES = new Set(["NATURAL_PLANT", "ORCHID", "ARRANGEMENT"]);

/** A descrição só com a frase padrão de envio do site antigo não conta como descrição. */
const SHIPPING_BOILERPLATE =
  /enviamos para todo o brasil|envio para todo o brasil|consulte o frete/gi;

export function isUsefulDescription(text: string): boolean {
  const withoutBoilerplate = text.replace(SHIPPING_BOILERPLATE, "").replace(/\s+/g, " ").trim();
  return withoutBoilerplate.length > 300;
}

export function productQuality(product: QualityInput): { score: number; checks: QualityCheck[] } {
  const living = LIVING_TYPES.has(product.productType);
  const sheetComplete = living
    ? Boolean(
        product.light &&
        product.watering &&
        product.environment &&
        product.petSafety &&
        product.careLevel &&
        product.heightCm,
      )
    : Boolean(product.material && product.color && product.heightCm);
  const checks: QualityCheck[] = [
    { key: "images", label: "3 ou mais imagens", points: 20, ok: product.images.length >= 3 },
    {
      key: "alt",
      label: "Todas as imagens com texto alternativo",
      points: 10,
      ok: product.images.length > 0 && product.images.every((image) => image.alt.trim().length > 0),
    },
    {
      key: "description",
      label: "Descrição com mais de 300 caracteres",
      points: 20,
      ok: isUsefulDescription(product.descriptionText),
    },
    {
      key: "short",
      label: "Descrição curta preenchida",
      points: 10,
      ok: Boolean(product.shortDescription?.trim()),
    },
    {
      key: "sheet",
      label: living ? "Ficha botânica completa" : "Ficha técnica completa",
      points: 15,
      ok: sheetComplete,
    },
    {
      key: "dimensions",
      label: "Peso e dimensões",
      points: 10,
      ok:
        product.variantWeights.length > 0 &&
        product.variantWeights.every((grams) => grams > 0) &&
        Boolean(product.heightCm && product.widthCm),
    },
    {
      key: "seo",
      label: "Título e descrição de SEO",
      points: 10,
      ok: Boolean(product.seoTitle?.trim() && product.seoDescription?.trim()),
    },
    {
      key: "category",
      label: "Categoria definida",
      points: 5,
      ok: Boolean(product.primaryCategoryId),
    },
  ];
  return { score: checks.reduce((sum, check) => sum + (check.ok ? check.points : 0), 0), checks };
}
