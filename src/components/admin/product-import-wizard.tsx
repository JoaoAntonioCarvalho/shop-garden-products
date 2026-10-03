"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { selectClass } from "@/components/admin/entity-form";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { Label } from "@/components/admin/ui/label";
import {
  parseImportFileAction,
  runImportAction,
  validateImportAction,
} from "@/server/actions/admin/product-import";

type Field = { key: string; label: string; required: boolean };
type Line = { line: number; sku: string; name: string; errors: string[] };
type Report = {
  created: number;
  updated: number;
  variants: number;
  skipped: number;
  errors: Line[];
};
type Step = "enviar" | "colunas" | "categorias" | "previa" | "relatorio";

const steps: Array<[Step, string]> = [
  ["enviar", "Enviar arquivo"],
  ["colunas", "Mapear colunas"],
  ["categorias", "Mapear categorias"],
  ["previa", "Prévia"],
  ["relatorio", "Relatório"],
];

/** Importação de produtos em etapas: enviar, mapear colunas, mapear categorias, prévia e relatório. */
export function ProductImportWizard({
  fields,
  categories,
}: {
  fields: Field[];
  categories: Array<{ value: string; label: string }>;
}) {
  const [step, setStep] = useState<Step>("enviar");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [format, setFormat] = useState("");
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{
    lines: Line[];
    products: number;
    variants: number;
  } | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fileCategories =
    mapping.category === undefined
      ? []
      : [
          ...new Set(rows.map((row) => (row[mapping.category] ?? "").trim()).filter(Boolean)),
        ].sort();
  const payload = (publish: boolean) => ({
    rows,
    mapping,
    categoryMap,
    publish,
    weightInKg: format === "fastcommerce",
  });
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  function upload(form: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await parseImportFileAction(form);
      if (!result.ok) return setError(result.error);
      setHeaders(result.headers);
      setRows(result.rows);
      setFormat(result.format);
      setMapping(result.mapping as Record<string, number>);
      setStep("colunas");
    });
  }

  function toCategories() {
    const missing = fields.filter((field) => field.required && mapping[field.key] === undefined);
    if (missing.length)
      return setError(`Escolha a coluna de: ${missing.map((field) => field.label).join(", ")}.`);
    setError(null);
    // Sugere a categoria da loja com o nome mais parecido.
    const index = mapping.category;
    const names =
      index === undefined
        ? []
        : [...new Set(rows.map((row) => (row[index] ?? "").trim()).filter(Boolean))];
    setCategoryMap((current) =>
      Object.fromEntries(
        names.map((name) => [
          name,
          current[name] ??
            categories.find((category) =>
              normalize(category.label).endsWith(normalize(name.split(/[>›/]/).pop() ?? name)),
            )?.value ??
            "",
        ]),
      ),
    );
    setStep("categorias");
  }

  function validate() {
    setError(null);
    startTransition(async () => {
      const result = await validateImportAction(payload(false));
      if (!result.ok) return setError(result.error);
      setPreview(result.data ?? null);
      setStep("previa");
    });
  }

  function run(publish: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await runImportAction(payload(publish));
      if (!result.ok) return setError(result.error);
      setReport(result.data ?? null);
      setStep("relatorio");
    });
  }

  const invalid = preview?.lines.filter((line) => line.errors.length) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Etapas da importação">
        {steps.map(([key, label], index) => (
          <li
            key={key}
            aria-current={step === key ? "step" : undefined}
            className={
              step === key
                ? "rounded-md bg-primary px-3 py-1 text-primary-foreground"
                : "rounded-md border border-border px-3 py-1 text-muted-foreground"
            }
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive bg-wine-50 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {step === "enviar" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enviar o arquivo CSV</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={upload} className="flex flex-col gap-3 text-sm">
              <p className="text-muted-foreground">
                Aceita a exportação do site antigo (FastCommerce) e o formato próprio do painel. O
                separador (vírgula ou ponto e vírgula) e a codificação (UTF-8 ou ISO-8859-1) são
                detectados.
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="arquivo-csv">Arquivo CSV</Label>
                <input
                  id="arquivo-csv"
                  name="file"
                  type="file"
                  accept=".csv,text/csv"
                  required
                  className="text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={pending}>
                  Enviar e continuar
                </Button>
                <Button asChild variant="outline">
                  <a href="/admin/produtos/importar/modelo" download>
                    Baixar modelo CSV
                  </a>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {step === "colunas" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mapear colunas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {format === "fastcommerce"
                ? "Formato do site antigo reconhecido. "
                : format === "proprio"
                  ? "Formato próprio reconhecido. "
                  : "Formato não reconhecido: escolha a coluna de cada campo. "}
              {rows.length} linhas no arquivo.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {fields.map((field) => (
                <div key={field.key} className="flex flex-col gap-1">
                  <Label htmlFor={`coluna-${field.key}`}>
                    {field.label}
                    {field.required ? " (obrigatório)" : ""}
                  </Label>
                  <select
                    id={`coluna-${field.key}`}
                    className={selectClass}
                    value={mapping[field.key] ?? ""}
                    onChange={(event) =>
                      setMapping((current) => {
                        const next = { ...current };
                        if (event.target.value === "") delete next[field.key];
                        else next[field.key] = Number(event.target.value);
                        return next;
                      })
                    }
                  >
                    <option value="">Não importar</option>
                    {headers.map((header, index) => (
                      <option key={index} value={index}>
                        {header || `Coluna ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("enviar")}>
                Voltar
              </Button>
              <Button onClick={toCategories}>Continuar</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "categorias" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mapear categorias</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {fileCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                O arquivo não tem coluna de categoria. Os produtos entram sem categoria.
              </p>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              {fileCategories.map((name, index) => (
                <div key={name} className="flex flex-col gap-1">
                  <Label htmlFor={`categoria-${index}`}>{name}</Label>
                  <select
                    id={`categoria-${index}`}
                    className={selectClass}
                    value={categoryMap[name] ?? ""}
                    onChange={(event) =>
                      setCategoryMap((current) => ({ ...current, [name]: event.target.value }))
                    }
                  >
                    <option value="">Sem categoria</option>
                    {categories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("colunas")}>
                Voltar
              </Button>
              <Button onClick={validate} disabled={pending}>
                Ver prévia
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "previa" && preview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prévia</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p>
              {preview.products} produtos e {preview.variants} variações prontos para importar.{" "}
              {invalid.length}{" "}
              {invalid.length === 1
                ? "linha com erro será ignorada"
                : "linhas com erro serão ignoradas"}
              . Produtos com SKU já cadastrado são atualizados.
            </p>
            <div className="max-h-96 overflow-auto rounded-md border border-border">
              <table className="w-full text-left" aria-label="Validação por linha">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-2 py-1">
                      Linha
                    </th>
                    <th scope="col" className="px-2 py-1">
                      SKU
                    </th>
                    <th scope="col" className="px-2 py-1">
                      Nome
                    </th>
                    <th scope="col" className="px-2 py-1">
                      Situação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...invalid, ...preview.lines.filter((line) => line.errors.length === 0)]
                    .slice(0, 300)
                    .map((line) => (
                      <tr key={line.line} className="border-t border-border">
                        <td className="px-2 py-1 tabular-nums">{line.line}</td>
                        <td className="px-2 py-1">{line.sku}</td>
                        <td className="px-2 py-1">{line.name}</td>
                        <td
                          className={
                            line.errors.length ? "px-2 py-1 text-destructive" : "px-2 py-1"
                          }
                        >
                          {line.errors.length ? line.errors.join(" ") : "Pronta"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep("categorias")}>
                Voltar
              </Button>
              <Button
                onClick={() => run(false)}
                disabled={pending || preview.products === 0}
                aria-busy={pending || undefined}
              >
                Importar como rascunho
              </Button>
              <Button
                variant="outline"
                onClick={() => run(true)}
                disabled={pending || preview.products === 0}
              >
                Importar e publicar
              </Button>
            </div>
            {pending ? (
              <p aria-live="polite">Importando em lotes de 50 produtos. Não feche a página.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {step === "relatorio" && report ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Relatório da importação</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <ul>
              <li>{report.created} produtos criados</li>
              <li>{report.updated} produtos atualizados</li>
              <li>{report.variants} variações gravadas</li>
              <li>{report.skipped} linhas ignoradas</li>
            </ul>
            {report.errors.length ? (
              <ul className="max-h-64 list-disc overflow-auto pl-5 text-destructive">
                {report.errors.map((line) => (
                  <li key={`${line.line}-${line.sku}`}>
                    Linha {line.line} ({line.sku || "sem SKU"}): {line.errors.join(" ")}
                  </li>
                ))}
              </ul>
            ) : null}
            <Button asChild className="self-start">
              <Link href="/admin/produtos?ordem=updatedAt&dir=desc">Ver produtos</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
