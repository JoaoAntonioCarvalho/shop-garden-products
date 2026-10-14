/**
 * Padrão das fotos do catálogo: produto recortado, fundo branco, 1600 × 2000 (4:5), centralizado
 * e ocupando 76% do quadro, com uma sombra leve de contato. É o mesmo enquadramento das fotos
 * padronizadas em lote.
 */
export const STANDARD_PHOTO = { width: 1600, height: 2000, fill: 0.76, centerY: 0.51 } as const;

export type Bounds = { x: number; y: number; width: number; height: number };

/** Retângulo que contém tudo o que não é transparente em uma imagem RGBA. */
export function alphaBounds(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  threshold = 24,
): Bounds | null {
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (rgba[row + x * 4 + 3] <= threshold) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) return null;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/** Escala e posição do recorte dentro do quadro padrão. */
export function standardPlacement(bounds: Bounds, frame: typeof STANDARD_PHOTO = STANDARD_PHOTO) {
  const scale = Math.min(
    (frame.width * frame.fill) / bounds.width,
    (frame.height * frame.fill) / bounds.height,
  );
  const width = bounds.width * scale;
  const height = bounds.height * scale;
  return {
    scale,
    x: (frame.width - width) / 2,
    y: frame.height * frame.centerY - height / 2,
    width,
    height,
  };
}

/** Largura da base do produto: o que é opaco nas últimas linhas do recorte (o pé do vaso, não a copa). */
export function baseSpan(
  image: { data: Uint8ClampedArray | Uint8Array; width: number },
  solid: Bounds,
): { left: number; right: number } {
  const rows = Math.max(1, Math.round(solid.height * 0.04));
  let left = solid.x + solid.width;
  let right = solid.x - 1;
  for (let y = solid.y + solid.height - rows; y < solid.y + solid.height; y++) {
    for (let x = solid.x; x < solid.x + solid.width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3] <= 160) continue;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  return right < left ? { left: solid.x, right: solid.x + solid.width - 1 } : { left, right };
}

/** Monta a foto padronizada (JPEG) a partir do recorte RGBA. Só roda no navegador. */
export async function composeStandardPhoto(cutout: ImageData): Promise<Blob> {
  const bounds = alphaBounds(cutout.data, cutout.width, cutout.height);
  if (!bounds) throw new Error("Não foi possível encontrar o produto na foto.");
  const source = document.createElement("canvas");
  source.width = cutout.width;
  source.height = cutout.height;
  source.getContext("2d")!.putImageData(cutout, 0, 0);

  const canvas = document.createElement("canvas");
  canvas.width = STANDARD_PHOTO.width;
  canvas.height = STANDARD_PHOTO.height;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const place = standardPlacement(bounds);
  // Sombra de contato: uma elipse suave sob a base do produto. A base é medida só na parte
  // opaca do recorte, porque o resto da sombra da foto original vem quase transparente e
  // deixaria a sombra nova descolada.
  const solid = alphaBounds(cutout.data, cutout.width, cutout.height, 160) ?? bounds;
  const foot = baseSpan(cutout, solid);
  const base = place.y + (solid.y + solid.height - bounds.y) * place.scale;
  const footWidth = (foot.right - foot.left + 1) * place.scale;
  const footCenter = place.x + ((foot.left + foot.right) / 2 - bounds.x) * place.scale;
  context.save();
  context.filter = "blur(20px)";
  context.fillStyle = "rgba(0, 0, 0, 0.11)";
  context.beginPath();
  context.ellipse(
    footCenter,
    base - 8,
    footWidth * 0.52,
    Math.max(10, place.height * 0.01),
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    source,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    place.x,
    place.y,
    place.width,
    place.height,
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível gerar a foto."))),
      "image/jpeg",
      0.92,
    ),
  );
}
