/** Áreas de entrega por faixa de CEP e o aviso de produto que não vai para o CEP do cliente. */

export type CepRange = { start: string; end: string };

/** Nome usado quando o produto é "só entrega local" e não tem área própria. */
export const DEFAULT_LOCAL_AREA = "Grande São Paulo";

const digits = (value: string) => value.replace(/\D/g, "");
const formatCep = (cep: string) => `${cep.slice(0, 5)}-${cep.slice(5)}`;

/** Lê as faixas gravadas no banco, ignorando o que não for uma faixa válida. */
export function readCepRanges(value: unknown): CepRange[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const start = digits(String((item as CepRange | null)?.start ?? ""));
    const end = digits(String((item as CepRange | null)?.end ?? ""));
    return start.length === 8 && end.length === 8 && start <= end ? [{ start, end }] : [];
  });
}

/**
 * Faixas digitadas no painel, uma por linha: "01000-000 a 05999-999". Uma linha com um CEP só
 * vale para aquele CEP. Devolve as linhas que não deu para entender.
 */
export function parseCepRanges(text: string): { ranges: CepRange[]; invalid: string[] } {
  const ranges: CepRange[] = [];
  const invalid: string[] = [];
  for (const line of text.split(/\r?\n/).map((item) => item.trim())) {
    if (!line) continue;
    const ceps = line.match(/\d{5}-?\d{3}/g)?.map(digits) ?? [];
    const [start, end = start] = ceps;
    if (ceps.length < 1 || ceps.length > 2 || start > end) invalid.push(line);
    else ranges.push({ start, end });
  }
  return { ranges, invalid };
}

export const formatCepRanges = (ranges: CepRange[]): string =>
  ranges
    .map((range) =>
      range.start === range.end
        ? formatCep(range.start)
        : `${formatCep(range.start)} a ${formatCep(range.end)}`,
    )
    .join("\n");

/** Os CEPs têm sempre 8 dígitos, então a comparação de texto funciona. */
export const isCepInRanges = (cep: string, ranges: CepRange[]): boolean =>
  ranges.some((range) => cep >= range.start && cep <= range.end);

export type RestrictedItem = {
  variantId: string;
  name: string;
  /** Produto marcado como "só entrega local" (regras locais do frete). */
  localOnly: boolean;
  /** Área de entrega própria do produto, se tiver. */
  area: { name: string; ranges: CepRange[] } | null;
};

export type BlockedItem = { variantId: string; name: string; areaName: string };

/**
 * Itens que não podem ser entregues no CEP. A área própria do produto vale primeiro; sem área,
 * o produto "só local" depende de haver regra de entrega local para o CEP.
 */
export function findBlockedItems(
  cep: string,
  items: RestrictedItem[],
  localDeliveryCoversCep: boolean,
): BlockedItem[] {
  const blocked = new Map<string, BlockedItem>();
  for (const item of items) {
    const outsideOwnArea = item.area !== null && !isCepInRanges(cep, item.area.ranges);
    const noLocalDelivery = item.localOnly && !localDeliveryCoversCep;
    if (!outsideOwnArea && !noLocalDelivery) continue;
    blocked.set(item.variantId, {
      variantId: item.variantId,
      name: item.name,
      areaName: item.area?.name ?? DEFAULT_LOCAL_AREA,
    });
  }
  return [...blocked.values()];
}

const joinNames = (names: string[]) =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;

/** "Palmeira ráfis tem entrega só nesta área: São Paulo, capital." Uma frase por área. */
export function blockedSentences(items: BlockedItem[]): string {
  const byArea = new Map<string, string[]>();
  for (const item of items) {
    const names = byArea.get(item.areaName) ?? [];
    if (!names.includes(item.name)) names.push(item.name);
    byArea.set(item.areaName, names);
  }
  return [...byArea.entries()]
    .map(
      ([area, names]) =>
        `${joinNames(names)} ${names.length > 1 ? "têm" : "tem"} entrega só nesta área: ${area}.`,
    )
    .join(" ");
}

const CONTACT_HINT = "Para receber em outro lugar, fale com a gente pelo WhatsApp.";

/** Aviso na página do produto. */
export const blockedProductNotice = (items: BlockedItem[]): string =>
  `${blockedSentences(items)} ${CONTACT_HINT}`;

/** Aviso na sacola e no checkout: os outros itens só podem seguir sem o que está bloqueado. */
export const blockedCartNotice = (items: BlockedItem[]): string =>
  `${blockedSentences(items)} ${CONTACT_HINT} Para ver as opções de envio para este CEP, remova da sacola o que não pode ser enviado.`;

/** Mensagem que já vai escrita no WhatsApp. */
export const blockedContactMessage = (items: BlockedItem[], cep: string): string =>
  `Olá! Quero receber ${joinNames([...new Set(items.map((item) => item.name))])} no CEP ${formatCep(cep)}. Vocês conseguem entregar?`;
