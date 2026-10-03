"use server";

import { requirePermission } from "@/lib/admin-guard";
import { runAdmin, type AdminResult } from "@/server/admin/action";
import { decodeCsvBuffer, parseCsv } from "@/server/admin/list";
import {
  detectFormat,
  importSchema,
  parseImport,
  runImport,
  type ImportLineResult,
  type ImportMapping,
  type ImportReport,
} from "@/server/admin/product-import";

export type ParsedFile =
  | {
      ok: true;
      headers: string[];
      rows: string[][];
      format: "fastcommerce" | "proprio" | "desconhecido";
      mapping: ImportMapping;
    }
  | { ok: false; error: string };

/** Lê o CSV enviado: detecta a codificação (UTF-8 ou ISO-8859-1), o separador e o formato. */
export async function parseImportFileAction(form: FormData): Promise<ParsedFile> {
  await requirePermission("products.import");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Escolha um arquivo CSV." };
  if (file.size > 10 * 1024 * 1024)
    return { ok: false, error: "O arquivo passa de 10 MB. Divida em arquivos menores." };
  const table = parseCsv(decodeCsvBuffer(await file.arrayBuffer()));
  if (table.length < 2)
    return { ok: false, error: "O arquivo precisa ter o cabeçalho e pelo menos uma linha." };
  const [headers, ...rows] = table;
  if (rows.length > 5000) return { ok: false, error: "Importe até 5.000 linhas por vez." };
  return { ok: true, headers, rows, ...detectFormat(headers) };
}

export async function validateImportAction(
  input: unknown,
): Promise<AdminResult<{ lines: ImportLineResult[]; products: number; variants: number }>> {
  return runAdmin<
    typeof importSchema,
    { lines: ImportLineResult[]; products: number; variants: number }
  >("products.import", importSchema, input, async (data) => {
    const { products, lines } = await parseImport(data);
    return {
      message: "Prévia pronta",
      data: {
        lines,
        products: products.length,
        variants: products.reduce((sum, product) => sum + product.variants.length, 0),
      },
    };
  });
}

export async function runImportAction(input: unknown): Promise<AdminResult<ImportReport>> {
  return runAdmin<typeof importSchema, ImportReport>(
    "products.import",
    importSchema,
    input,
    async (data, context) => {
      const report = await runImport(data, context);
      return {
        message: `Importação concluída: ${report.created} criados, ${report.updated} atualizados`,
        data: report,
      };
    },
  );
}
