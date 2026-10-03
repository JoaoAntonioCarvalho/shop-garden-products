/** Estado das listas do admin, todo na URL: busca, filtros, ordenação e página. */

type RawParams = Record<string, string | string[] | undefined>;

export type ListParams = {
  page: number;
  pageSize: number;
  q: string;
  sort: string | null;
  dir: "asc" | "desc";
  /** Demais parâmetros, como filtros. */
  filters: Record<string, string>;
  skip: number;
};

const RESERVED = new Set(["pagina", "busca", "ordem", "dir", "por-pagina"]);

export function parseListParams(
  params: RawParams,
  defaults: { sort?: string; dir?: "asc" | "desc"; pageSize?: number } = {},
): ListParams {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  };
  const page = Math.max(1, Number(one("pagina")) || 1);
  const requested = Number(one("por-pagina"));
  const pageSize = [25, 50, 100].includes(requested) ? requested : (defaults.pageSize ?? 25);
  const filters: Record<string, string> = {};
  for (const key of Object.keys(params)) {
    if (!RESERVED.has(key) && one(key)) filters[key] = one(key).slice(0, 120);
  }
  return {
    page,
    pageSize,
    q: one("busca").slice(0, 120),
    sort: one("ordem") || defaults.sort || null,
    dir: one("dir") === "asc" ? "asc" : one("dir") === "desc" ? "desc" : (defaults.dir ?? "desc"),
    filters,
    skip: (page - 1) * pageSize,
  };
}

/** Só aceita ordenar por colunas conhecidas. */
export function orderByOf<T extends string>(
  params: ListParams,
  allowed: readonly T[],
  fallback: T,
): { field: T; dir: "asc" | "desc" } {
  const field = allowed.includes(params.sort as T) ? (params.sort as T) : fallback;
  return { field, dir: params.dir };
}

/** Intervalo de datas a partir de "de" e "ate" (AAAA-MM-DD), no fuso de São Paulo. */
export function dateRangeOf(
  from: string | undefined,
  to: string | undefined,
): { gte?: Date; lte?: Date } | undefined {
  const valid = (value?: string) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);
  const start = valid(from);
  const end = valid(to);
  if (!start && !end) return undefined;
  return {
    ...(start ? { gte: new Date(`${start}T00:00:00-03:00`) } : {}),
    ...(end ? { lte: new Date(`${end}T23:59:59.999-03:00`) } : {}),
  };
}

// ───────────────────────── CSV ─────────────────────────

const escapeCell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  // Células que começam com =, +, - ou @ poderiam ser lidas como fórmula pela planilha.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** CSV com ponto e vírgula e BOM, que abre direto no Excel em português. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  return "﻿" + [headers, ...rows].map((row) => row.map(escapeCell).join(";")).join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Lê CSV com vírgula ou ponto e vírgula, aspas e quebras de linha dentro de células. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (quoted) {
      if (char === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows.map((cells) => cells.map((value) => value.trim()));
}

/** Decodifica o arquivo detectando UTF-8 ou ISO-8859-1 (o formato do site antigo). */
export function decodeCsvBuffer(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("iso-8859-1").decode(buffer);
  }
}
