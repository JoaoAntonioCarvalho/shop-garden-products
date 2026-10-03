/** Tokens de cor da marca. Espelham o @theme de src/app/globals.css (conferido por teste). */
export const colors = {
  "moss-900": "#2F3221",
  "moss-700": "#4D5236",
  "moss-500": "#6E7552",
  "moss-100": "#E7E8DC",
  "wine-800": "#7C1519",
  "wine-700": "#9A1B1F",
  "wine-50": "#F7EBEA",
  "cream-50": "#FBF8F2",
  "cream-100": "#F3EDE1",
  white: "#FFFFFF",
  ink: "#23251B",
  "ink-muted": "#5F624F",
  line: "#DDD6C6",
  warning: "#8A5A00",
} as const;

export type ColorToken = keyof typeof colors;

/**
 * Combinações de texto sobre fundo permitidas na loja. Todas precisam passar em AA (4.5:1).
 * Vinho sobre musgo e musgo sobre vinho não existem aqui de propósito: são proibidas.
 */
export const allowedTextPairs: Array<{ text: ColorToken; background: ColorToken }> = [
  { text: "ink", background: "cream-50" },
  { text: "ink", background: "cream-100" },
  { text: "ink", background: "white" },
  { text: "ink", background: "moss-100" },
  { text: "ink-muted", background: "cream-50" },
  { text: "ink-muted", background: "cream-100" },
  { text: "ink-muted", background: "white" },
  { text: "moss-700", background: "cream-50" },
  { text: "moss-700", background: "cream-100" },
  { text: "moss-700", background: "white" },
  { text: "moss-700", background: "moss-100" },
  { text: "moss-900", background: "cream-50" },
  { text: "moss-900", background: "cream-100" },
  { text: "white", background: "moss-700" },
  { text: "cream-50", background: "moss-700" },
  { text: "cream-50", background: "moss-900" },
  { text: "white", background: "wine-700" },
  { text: "white", background: "wine-800" },
  { text: "wine-700", background: "cream-50" },
  { text: "wine-700", background: "white" },
  { text: "wine-700", background: "wine-50" },
  { text: "warning", background: "cream-50" },
  { text: "warning", background: "white" },
];

function channelToLinear(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Cor inválida: ${hex}`);
  const int = parseInt(match[1], 16);
  const r = channelToLinear((int >> 16) & 255);
  const g = channelToLinear((int >> 8) & 255);
  const b = channelToLinear(int & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG entre duas cores, de 1 a 21. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}
