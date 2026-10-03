/**
 * Gera as imagens placeholder dos dados de teste: ilustrações botânicas simples em linha, na cor
 * da marca, com o nome do item e a marca "Imagem de teste". Nenhuma imagem vem da internet.
 *
 * É usado pelo seed (import) e também pode ser rodado sozinho: pnpm images:placeholders
 */
import sharp from "sharp";
import { getStorage } from "../src/server/providers/storage";
import { IMAGE_WIDTHS } from "../src/server/services/media";

export type IllustrationKind =
  | "leaf"
  | "orchid"
  | "pot"
  | "cachepot"
  | "flower"
  | "cactus"
  | "tool"
  | "candle"
  | "arrangement"
  | "herb"
  | "bag"
  | "watering";

const MOSS = "#4D5236";
const backgrounds = ["#FFFFFF", "#FBF8F2", "#F3EDE1", "#FFFFFF"];

/** Desenhos em um quadro de 400 × 480, centrados em (200, 240). */
const drawings: Record<IllustrationKind, string> = {
  leaf: `
    <path d="M200 440V190"/>
    <path d="M200 300c-8-72-56-120-136-128 0 80 56 128 136 128Z"/>
    <path d="M200 230c8-80 56-136 144-144 0 88-56 144-144 144Z"/>
    <path d="M200 380c-5-48-37-80-88-85 0 53 37 85 88 85Z"/>
    <path d="M200 350c5-44 34-74 80-78 0 48-34 78-80 78Z"/>`,
  orchid: `
    <path d="M150 440c0-120 20-220 90-330"/>
    <path d="M150 440c-10-40-50-60-96-56 6 40 50 62 96 56Z"/>
    <path d="M150 440c14-36 56-52 100-42-10 36-54 52-100 42Z"/>
    <g transform="translate(250 100)"><circle r="9"/><path d="M0-9c-14-22-14-40 0-52 14 12 14 30 0 52ZM9 0c22-14 40-14 52 0-12 14-30 14-52 0ZM-9 0c-22-14-40-14-52 0 12 14 30 14 52 0ZM-5 8c-12 16-12 32 5 44 17-12 17-28 5-44"/></g>
    <g transform="translate(206 178) scale(.8)"><circle r="9"/><path d="M0-9c-14-22-14-40 0-52 14 12 14 30 0 52ZM9 0c22-14 40-14 52 0-12 14-30 14-52 0ZM-9 0c-22-14-40-14-52 0 12 14 30 14 52 0ZM-5 8c-12 16-12 32 5 44 17-12 17-28 5-44"/></g>
    <g transform="translate(178 258) scale(.62)"><circle r="9"/><path d="M0-9c-14-22-14-40 0-52 14 12 14 30 0 52ZM9 0c22-14 40-14 52 0-12 14-30 14-52 0ZM-9 0c-22-14-40-14-52 0 12 14 30 14 52 0Z"/></g>`,
  pot: `
    <path d="M96 150h208"/>
    <path d="M88 118h224v32H88Z"/>
    <path d="M108 150l26 270h132l26-270"/>
    <path d="M122 290h156"/>`,
  cachepot: `
    <path d="M92 150c0-18 48-32 108-32s108 14 108 32-48 32-108 32-108-14-108-32Z"/>
    <path d="M92 150c0 120 10 200 48 262 16 12 104 12 120 0 38-62 48-142 48-262"/>
    <path d="M112 262c56 18 120 18 176 0"/>`,
  flower: `
    <path d="M200 440V250"/>
    <circle cx="200" cy="170" r="24"/>
    <path d="M200 146c-22-30-22-60 0-84 22 24 22 54 0 84ZM224 170c30-22 60-22 84 0-24 22-54 22-84 0ZM176 170c-30-22-60-22-84 0 24 22 54 22 84 0ZM200 194c-22 26-22 52 0 72 22-20 22-46 0-72ZM217 153c8-34 28-54 60-60-2 32-24 54-60 60ZM183 153c-8-34-28-54-60-60 2 32 24 54 60 60Z"/>
    <path d="M200 360c-6-40-34-64-78-66 2 42 32 66 78 66ZM200 320c6-34 30-56 68-58-2 36-28 58-68 58Z"/>`,
  cactus: `
    <path d="M168 440V132c0-42 64-42 64 0v308"/>
    <path d="M168 300h-28c-34 0-34-18-34-44v-40c0-30 40-30 40 0v36h22"/>
    <path d="M232 262h24c34 0 34-18 34-44v-34c0-30-40-30-40 0v30h-18"/>
    <path d="M184 150v260M200 126v290M216 150v260"/>
    <path d="M120 440h160"/>`,
  tool: `
    <path d="M150 60c-34 40-34 96 0 150h44c34-54 34-110 0-150Z"/>
    <path d="M172 210v70"/>
    <path d="M152 280h40v150c0 14-40 14-40 0Z"/>
    <path d="M262 80v130M290 80v130M318 80v130"/>
    <path d="M254 210h72c0 30-14 44-36 44s-36-14-36-44Z"/>
    <path d="M290 254v36"/>
    <path d="M272 290h36v140c0 14-36 14-36 0Z"/>`,
  candle: `
    <path d="M200 96c-22 26-22 50 0 66 22-16 22-40 0-66Z"/>
    <path d="M200 162v34"/>
    <path d="M128 196h144v224c0 14-144 14-144 0Z"/>
    <path d="M128 250h144"/>
    <path d="M156 300h88v62h-88Z"/>`,
  arrangement: `
    <path d="M116 300h168l-16 126H132Z"/>
    <path d="M104 300h192"/>
    <path d="M200 300V170M160 300c-4-60-22-104-60-136M240 300c4-60 22-104 60-136"/>
    <g transform="translate(200 142)"><circle r="12"/><path d="M0-12c-12-18-12-34 0-46 12 12 12 28 0 46ZM12 0c18-12 34-12 46 0-12 12-28 12-46 0ZM-12 0c-18-12-34-12-46 0 12 12 28 12 46 0ZM0 12c-12 14-12 26 0 36 12-10 12-22 0-36Z"/></g>
    <g transform="translate(96 150) scale(.7)"><circle r="12"/><path d="M0-12c-12-18-12-34 0-46 12 12 12 28 0 46ZM12 0c18-12 34-12 46 0-12 12-28 12-46 0ZM-12 0c-18-12-34-12-46 0 12 12 28 12 46 0ZM0 12c-12 14-12 26 0 36 12-10 12-22 0-36Z"/></g>
    <g transform="translate(304 150) scale(.7)"><circle r="12"/><path d="M0-12c-12-18-12-34 0-46 12 12 12 28 0 46ZM12 0c18-12 34-12 46 0-12 12-28 12-46 0ZM-12 0c-18-12-34-12-46 0 12 12 28 12 46 0ZM0 12c-12 14-12 26 0 36 12-10 12-22 0-36Z"/></g>
    <path d="M150 300c-30-20-50-50-54-86 34 6 54 34 54 86ZM250 300c30-20 50-50 54-86-34 6-54 34-54 86Z"/>`,
  herb: `
    <path d="M124 330h152l-14 100H138Z"/>
    <path d="M200 330V120"/>
    <path d="M200 290c-30-4-48-22-52-52 30 4 48 22 52 52ZM200 290c30-4 48-22 52-52-30 4-48 22-52 52ZM200 230c-28-4-44-20-48-48 28 4 44 20 48 48ZM200 230c28-4 44-20 48-48-28 4-44 20-48 48ZM200 172c-24-4-38-18-40-42 24 4 38 18 40 42ZM200 172c24-4 38-18 40-42-24 4-38 18-40 42Z"/>
    <path d="M160 330c-6-40-20-66-44-84M240 330c6-40 20-66 44-84"/>`,
  bag: `
    <path d="M120 120h160l20 310H100Z"/>
    <path d="M120 120c10-22 20-34 30-40h100c10 6 20 18 30 40"/>
    <path d="M150 80v40M250 80v40"/>
    <path d="M150 220h100v110H150Z"/>
    <path d="M200 310v-60M200 284c-14-2-22-10-24-24 14 2 22 10 24 24ZM200 284c14-2 22-10 24-24-14 2-22 10-24 24Z"/>`,
  watering: `
    <path d="M130 200h150v210c0 14-150 14-150 0Z"/>
    <path d="M130 240L60 150"/>
    <path d="M40 132l40 36"/>
    <path d="M280 230c60-10 70 110 0 130"/>
    <path d="M150 200c0-60 110-60 110 0"/>
    <path d="M130 300h150"/>`,
};

function escapeXml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Quebra o texto em até duas linhas para caber na base da imagem. */
function wrapLabel(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current);
  if (lines.length > 2)
    return [
      lines[0],
      lines
        .slice(1)
        .join(" ")
        .slice(0, maxChars - 1) + "…",
    ];
  return lines;
}

type RenderOptions = {
  kind: IllustrationKind;
  label: string;
  /** Muda fundo, escala e posição, para a galeria não parecer repetida. */
  variation?: number;
  width: number;
  height: number;
};

export function buildPlaceholderSvg({
  kind,
  label,
  variation = 0,
  width,
  height,
}: RenderOptions): string {
  const background = backgrounds[variation % backgrounds.length];
  const landscape = width > height;
  const scaleBase = (landscape ? height / 620 : width / 560) * [1, 0.9, 1.1, 0.82][variation % 4];
  const offsetX = [0, -0.06, 0.05, 0.1][variation % 4] * width;
  const mirror = variation % 2 === 1 ? -1 : 1;
  const cx = (landscape ? width * 0.68 : width / 2) + offsetX;
  const cy = height * (landscape ? 0.5 : 0.44);
  const stroke = Math.max(1.5, 3.2 / scaleBase);
  const fontSize = Math.round(Math.min(width, height) * 0.03);
  const lines = wrapLabel(label, landscape ? 60 : 42);
  const textX = landscape ? width * 0.06 : width / 2;
  const anchor = landscape ? "start" : "middle";
  const baseY = height * 0.93;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${background}"/>
  <g transform="translate(${cx} ${cy}) scale(${scaleBase * mirror} ${scaleBase}) translate(-200 -240)" fill="none" stroke="${MOSS}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${drawings[kind]}
  </g>
  <g font-family="Georgia, 'Times New Roman', serif" fill="${MOSS}" text-anchor="${anchor}">
    ${lines
      .map(
        (line, index) =>
          `<text x="${textX}" y="${baseY - (lines.length - 1 - index) * fontSize * 1.3 - fontSize * 1.6}" font-size="${fontSize}">${escapeXml(line)}</text>`,
      )
      .join("\n    ")}
    <text x="${textX}" y="${baseY}" font-family="Helvetica, Arial, sans-serif" font-size="${Math.round(fontSize * 0.78)}" opacity="0.7">Imagem de teste</text>
  </g>
</svg>`;
}

export type PlaceholderResult = {
  storageKey: string;
  width: number;
  height: number;
  sizeBytes: number;
  blurDataUrl: string;
  variants: Record<string, string>;
};

/**
 * Gera e grava a imagem (nas larguras 400, 800 e 1600, ou a largura cheia quando for maior).
 * Se os arquivos já existem, não gera de novo: o seed pode rodar várias vezes.
 */
export async function generatePlaceholder(
  name: string,
  options: Omit<RenderOptions, "width" | "height"> & { width?: number; height?: number },
): Promise<PlaceholderResult> {
  const width = options.width ?? 1600;
  const height = options.height ?? 2000;
  const storage = getStorage();
  const widths = [...new Set([...IMAGE_WIDTHS.filter((w) => w < width), Math.min(width, 2400)])];
  const largest = widths[widths.length - 1];
  const keyFor = (w: number) => `amostra/${name}-${w}.webp`;
  const variants: Record<string, string> = {};
  for (const w of widths)
    variants[String(w === largest && largest > 1600 ? 1600 : w)] = storage.url(keyFor(w));
  if (largest > 1600) variants[String(largest)] = storage.url(keyFor(largest));

  const svg = Buffer.from(buildPlaceholderSvg({ ...options, width, height }));
  const blur = await sharp(svg).resize({ width: 16 }).webp({ quality: 40 }).toBuffer();
  const blurDataUrl = `data:image/webp;base64,${blur.toString("base64")}`;

  let sizeBytes = 0;
  if (await storage.exists(keyFor(largest))) {
    sizeBytes = (await storage.get(keyFor(largest)))?.byteLength ?? 0;
  } else {
    const full = await sharp(svg).webp({ quality: 80 }).toBuffer();
    for (const w of widths) {
      const data =
        w === width
          ? full
          : await sharp(full).resize({ width: w }).webp({ quality: 80 }).toBuffer();
      await storage.put(keyFor(w), data, "image/webp");
      if (w === largest) sizeBytes = data.byteLength;
    }
  }

  return {
    storageKey: keyFor(largest),
    width: largest,
    height: Math.round((largest / width) * height),
    sizeBytes,
    blurDataUrl,
    variants,
  };
}

/** Executa tarefas em paralelo com limite, para não saturar a CPU. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await worker(items[index], index);
      }
    }),
  );
  return results;
}

// Execução direta: gera uma amostra de cada ilustração, para conferência visual.
if (process.argv[1]?.endsWith("generate-placeholders.ts")) {
  const kinds = Object.keys(drawings) as IllustrationKind[];
  mapWithConcurrency(kinds, 4, (kind, index) =>
    generatePlaceholder(`ilustracao-${kind}`, {
      kind,
      label: `Ilustração: ${kind}`,
      variation: index,
    }),
  ).then((results) => {
    console.log(`${results.length} ilustrações geradas em uploads/amostra/`);
  });
}
