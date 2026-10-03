import type { Parcel } from "./types";

export type ItemDimensions = {
  widthCm: number | null;
  depthCm: number | null;
  heightCm: number | null;
};

/** Medidas mínimas de pacote dos Correios, em centímetros. Servem também para a Jadlog. */
const MIN = { length: 16, width: 11, height: 2 };
const MAX_STACK_CM = 100;
/** Folga de embalagem (caixa, papel, plástico-bolha) em cada medida do produto. */
const PADDING_CM = 4;
/** Medida usada quando o cadastro do produto não tem dimensões. */
const DEFAULT_SIDE_CM = 20;
const MIN_WEIGHT_GRAMS = 300;

/**
 * Estima um pacote único para os itens. Cada unidade vira uma caixa com folga; o pacote tem a
 * base da maior caixa e a altura que comporta o volume somado. É uma aproximação: quem define
 * a cobrança é o peso real ou o cúbico, o maior, calculado a partir destas medidas.
 */
export function estimatePackage(
  items: Array<{ quantity: number; weightGrams: number; dimensions: ItemDimensions | null }>,
): Parcel {
  let weightGrams = 0;
  let volume = 0;
  let length = 0;
  let width = 0;
  let height = 0;
  for (const item of items) {
    const sides = [item.dimensions?.widthCm, item.dimensions?.depthCm, item.dimensions?.heightCm]
      .map((side) => (side && side > 0 ? side + PADDING_CM : DEFAULT_SIDE_CM))
      .sort((a, b) => b - a);
    weightGrams += item.weightGrams * item.quantity;
    volume += sides[0] * sides[1] * sides[2] * item.quantity;
    length = Math.max(length, sides[0]);
    width = Math.max(width, sides[1]);
    height = Math.max(height, sides[2]);
  }
  length = Math.max(MIN.length, Math.ceil(length));
  width = Math.max(MIN.width, Math.ceil(width));
  height = Math.max(MIN.height, Math.ceil(height), Math.ceil(volume / (length * width)));
  // Uma pilha alta demais vira um pacote mais largo, com o mesmo volume.
  if (height > MAX_STACK_CM) {
    const side = Math.ceil(Math.cbrt(volume));
    length = Math.max(length, side);
    width = Math.max(width, side);
    height = Math.max(MIN.height, Math.ceil(volume / (length * width)));
  }
  return {
    weightGrams: Math.max(MIN_WEIGHT_GRAMS, Math.ceil(weightGrams)),
    lengthCm: length,
    widthCm: width,
    heightCm: height,
  };
}
