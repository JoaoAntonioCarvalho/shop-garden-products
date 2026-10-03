"use client";

import { rowSelectionFeature, tableFeatures, useTable } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/admin/ui/alert-dialog";
import { Button } from "@/components/admin/ui/button";
import { Checkbox } from "@/components/admin/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { AdminResult } from "@/server/admin/action";

// TanStack Table v9: só a seleção de linhas é usada no navegador. Ordenação, filtros e paginação
// acontecem no servidor e vivem na URL.
const features = tableFeatures({ rowSelectionFeature });

export type DataColumn = {
  key: string;
  header: string;
  sortable?: boolean;
  align?: "left" | "right";
  className?: string;
};

/** As células chegam já renderizadas pelo servidor; a tabela cuida de ordenação, seleção e paginação. */
export type DataRow = { id: string; cells: Record<string, ReactNode> };

export type BulkAction = {
  label: string;
  /** Server action que recebe os ids selecionados (e o valor digitado, quando a ação pede um). */
  action: (ids: string[], value?: string) => Promise<AdminResult<unknown>>;
  /** Campo pedido antes de executar: categoria, coleção, tags, porcentagem... */
  input?: {
    label: string;
    type: "select" | "text";
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
  };
  /** Prévia calculada no servidor a partir da seleção e do valor. */
  preview?: (ids: string[], value?: string) => Promise<string[]>;
  /** Pede confirmação antes de executar. */
  confirm?: string;
  destructive?: boolean;
};

type DataTableProps = {
  columns: DataColumn[];
  rows: DataRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: string | null;
  dir: "asc" | "desc";
  bulkActions?: BulkAction[];
  /** Rótulo acessível da tabela. */
  label: string;
  emptyMessage?: string;
};

/** Monta a URL mantendo busca e filtros. */
export function useListUrl() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };
}

export function DataTable({
  columns,
  rows,
  total,
  page,
  pageSize,
  sort,
  dir,
  bulkActions = [],
  label,
  emptyMessage = "Nada encontrado com esses filtros.",
}: DataTableProps) {
  const router = useRouter();
  const urlFor = useListUrl();
  const [selection, setSelection] = useState<Record<string, true>>({});
  const [confirming, setConfirming] = useState<BulkAction | null>(null);
  const [value, setValue] = useState("");
  const [preview, setPreview] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();
  const selectable = bulkActions.length > 0;

  const columnDefs = useMemo(
    () => columns.map((column) => ({ id: column.key, header: column.header })),
    [columns],
  );
  const table = useTable({
    features,
    data: rows,
    columns: columnDefs,
    getRowId: (row: DataRow) => row.id,
    enableRowSelection: selectable,
    state: { rowSelection: selection },
    onRowSelectionChange: setSelection,
  });

  const selectedIds = Object.keys(selection).filter((id) => selection[id]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  function run(action: BulkAction) {
    startTransition(async () => {
      const result = await action.action(selectedIds, action.input ? value : undefined);
      if (result.ok) {
        toast(result.message);
        setSelection({});
        router.refresh();
      } else {
        toast(result.error, { tone: "error", duration: 8000 });
      }
      setConfirming(null);
    });
  }

  return (
    <div>
      {selectable && selectedIds.length > 0 ? (
        <div
          role="region"
          aria-label="Ações em massa"
          className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-border bg-accent px-3 py-2"
        >
          <span className="text-sm font-medium text-accent-foreground">
            {selectedIds.length} {selectedIds.length === 1 ? "selecionado" : "selecionados"}
          </span>
          {bulkActions.map((action) => (
            <Button
              key={action.label}
              size="sm"
              variant={action.destructive ? "destructive" : "outline"}
              disabled={pending}
              onClick={() => {
                setValue(action.input?.options?.[0]?.value ?? "");
                setPreview(null);
                if (action.confirm || action.input) setConfirming(action);
                else run(action);
              }}
            >
              {action.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setSelection({})}>
            Limpar seleção
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-border bg-background">
        <Table aria-label={label}>
          <TableHeader>
            <TableRow>
              {selectable ? (
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Selecionar todos desta página"
                    checked={
                      table.getIsAllRowsSelected()
                        ? true
                        : table.getIsSomeRowsSelected()
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(value) => table.toggleAllRowsSelected(Boolean(value))}
                  />
                </TableHead>
              ) : null}
              {columns.map((column) => {
                const active = sort === column.key;
                const nextDir = active && dir === "asc" ? "desc" : "asc";
                return (
                  <TableHead
                    key={column.key}
                    aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
                    className={cn(column.align === "right" && "text-right", column.className)}
                  >
                    {column.sortable ? (
                      <Link
                        href={urlFor({ ordem: column.key, dir: nextDir, pagina: null })}
                        scroll={false}
                        className={cn(
                          "inline-flex min-h-9 items-center gap-1 hover:text-foreground",
                          column.align === "right" && "flex-row-reverse",
                        )}
                      >
                        {column.header}
                        {active ? (
                          dir === "asc" ? (
                            <ArrowUp aria-hidden="true" className="size-3.5" />
                          ) : (
                            <ArrowDown aria-hidden="true" className="size-3.5" />
                          )
                        ) : (
                          <ArrowUpDown aria-hidden="true" className="size-3.5 opacity-50" />
                        )}
                        <span className="sr-only">
                          {active
                            ? `, ordenado em ordem ${dir === "asc" ? "crescente" : "decrescente"}`
                            : ", ordenar"}
                        </span>
                      </Link>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                  {selectable ? (
                    <TableCell>
                      <Checkbox
                        aria-label="Selecionar linha"
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
                      />
                    </TableCell>
                  ) : null}
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        column.align === "right" && "text-right tabular-nums",
                        column.className,
                      )}
                    >
                      {row.original.cells[column.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p aria-live="polite">
          {total === 0 ? "Nenhum resultado" : `${first} a ${last} de ${total}`}
        </p>
        <nav aria-label="Paginação" className="flex items-center gap-2">
          {page > 1 ? (
            <Button asChild size="sm" variant="outline">
              <Link href={urlFor({ pagina: page - 1 > 1 ? String(page - 1) : null })}>
                Anterior
              </Link>
            </Button>
          ) : null}
          <span className="tabular-nums">
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Button asChild size="sm" variant="outline">
              <Link href={urlFor({ pagina: String(page + 1) })}>Próxima</Link>
            </Button>
          ) : null}
        </nav>
      </div>

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming?.label}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.confirm} ({selectedIds.length}{" "}
              {selectedIds.length === 1 ? "item selecionado" : "itens selecionados"})
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirming?.input ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="acao-em-massa-valor" className="text-sm font-medium">
                {confirming.input.label}
              </label>
              {confirming.input.type === "select" ? (
                <select
                  id="acao-em-massa-valor"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {confirming.input.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="acao-em-massa-valor"
                  value={value}
                  placeholder={confirming.input.placeholder}
                  onChange={(event) => setValue(event.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                />
              )}
              {confirming.preview ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={async () => setPreview(await confirming.preview!(selectedIds, value))}
                >
                  Ver prévia
                </Button>
              ) : null}
              {preview ? (
                <ul
                  aria-live="polite"
                  className="max-h-48 overflow-y-auto text-sm text-muted-foreground"
                >
                  {preview.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={() => confirming && run(confirming)}>
              {confirming?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
