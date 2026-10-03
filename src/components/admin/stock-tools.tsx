"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { selectClass } from "@/components/admin/entity-form";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/admin/ui/popover";
import { Textarea } from "@/components/admin/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  adjustStockAction,
  applyInventoryCountAction,
  batchStockInAction,
  type BatchPreview,
} from "@/server/actions/admin/inventory";

const kinds = [
  ["IN", "Entrada"],
  ["OUT", "Saída"],
  ["ADJUSTMENT", "Ajuste de inventário"],
  ["LOSS", "Perda ou quebra"],
] as const;

/** Ajuste rápido de estoque de uma variação, com quantidade e motivo. */
export function StockAdjust({
  variantId,
  name,
  onHand,
}: {
  variantId: string;
  name: string;
  onHand: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof kinds)[number][0]>("IN");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Ajustar estoque de ${name}`}>
          Ajustar
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await adjustStockAction({ variantId, kind, quantity, reason });
              if (result.ok) {
                toast(result.message);
                setOpen(false);
                setQuantity("");
                setReason("");
                setError(null);
                router.refresh();
              } else
                setError(result.fieldErrors ? Object.values(result.fieldErrors)[0] : result.error);
            });
          }}
        >
          <p className="text-sm font-medium">
            {name}
            <span className="block text-xs font-normal text-muted-foreground">
              Em estoque: {onHand}
            </span>
          </p>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`ajuste-tipo-${variantId}`}>Tipo</Label>
            <select
              id={`ajuste-tipo-${variantId}`}
              value={kind}
              onChange={(event) => setKind(event.target.value as typeof kind)}
              className={selectClass}
            >
              {kinds.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`ajuste-qtd-${variantId}`}>
              {kind === "ADJUSTMENT" ? "Contagem real" : "Quantidade"}
            </Label>
            <Input
              id={`ajuste-qtd-${variantId}`}
              type="number"
              min={0}
              inputMode="numeric"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`ajuste-motivo-${variantId}`}>Motivo</Label>
            <Input
              id={`ajuste-motivo-${variantId}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="sm" disabled={pending}>
            Registrar
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Entrada em lote: uma linha por item, "SKU;quantidade;motivo", com prévia antes de aplicar. */
export function BatchStockIn() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [lines, setLines] = useState<BatchPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (apply: boolean) =>
    startTransition(async () => {
      const result = await batchStockInAction({ text, apply });
      if (!result.ok)
        return setError(result.fieldErrors ? Object.values(result.fieldErrors)[0] : result.error);
      setError(null);
      setLines(result.data?.lines ?? null);
      if (apply) {
        toast(result.message);
        setText("");
        router.refresh();
      }
    });
  const valid = lines?.filter((line) => !line.error).length ?? 0;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lote-linhas">Linhas no formato SKU;quantidade;motivo</Label>
        <Textarea
          id="lote-linhas"
          rows={8}
          value={text}
          placeholder={
            "TESTE-0001-01;10;Reposição do fornecedor\nTESTE-0002-01;4;Reposição do fornecedor"
          }
          onChange={(event) => {
            setText(event.target.value);
            setLines(null);
          }}
          className="font-mono text-sm"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button variant="outline" disabled={pending || !text.trim()} onClick={() => run(false)}>
          Ver prévia
        </Button>
        <Button disabled={pending || !lines || valid === 0} onClick={() => run(true)}>
          Registrar entrada de {valid} {valid === 1 ? "item" : "itens"}
        </Button>
      </div>
      {lines ? (
        <div className="overflow-x-auto rounded-md border border-border bg-background">
          <table className="w-full text-left text-sm" aria-label="Prévia da entrada em lote">
            <thead className="text-xs text-muted-foreground">
              <tr>
                {["Linha", "SKU", "Produto", "Estoque atual", "Entrada", "Depois", "Motivo"].map(
                  (heading) => (
                    <th key={heading} scope="col" className="px-2 py-1.5">
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.line} className="border-t border-border">
                  <td className="px-2 py-1.5 tabular-nums">{line.line}</td>
                  <td className="px-2 py-1.5">{line.sku}</td>
                  {line.error ? (
                    <td colSpan={5} className="px-2 py-1.5 text-destructive">
                      {line.error} Esta linha será ignorada.
                    </td>
                  ) : (
                    <>
                      <td className="px-2 py-1.5">{line.name}</td>
                      <td className="px-2 py-1.5 tabular-nums">{line.current}</td>
                      <td className="px-2 py-1.5 tabular-nums">+{line.quantity}</td>
                      <td className="px-2 py-1.5 tabular-nums">
                        {(line.current ?? 0) + line.quantity}
                      </td>
                      <td className="px-2 py-1.5">{line.reason}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

type CountItem = { variantId: string; name: string; sku: string; onHand: number; reserved: number };

/** Contagem de inventário: digita o que foi contado, vê as diferenças e só então aplica. */
export function InventoryCount({ items }: { items: CountItem[] }) {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const filled = items.filter(
    (item) => counts[item.variantId] !== undefined && counts[item.variantId] !== "",
  );
  const differences = filled.filter((item) => Number(counts[item.variantId]) !== item.onHand);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-md border border-border bg-background">
        <table className="w-full text-left text-sm" aria-label="Contagem de inventário">
          <thead className="text-xs text-muted-foreground">
            <tr>
              {["Produto", "SKU", "No sistema", "Reservado", "Contado", "Diferença"].map(
                (heading) => (
                  <th key={heading} scope="col" className="px-2 py-1.5">
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {(reviewing ? differences : items).map((item) => {
              const value = counts[item.variantId] ?? "";
              const difference = value === "" ? null : Number(value) - item.onHand;
              return (
                <tr key={item.variantId} className="border-t border-border">
                  <td className="px-2 py-1.5">{item.name}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{item.sku}</td>
                  <td className="px-2 py-1.5 tabular-nums">{item.onHand}</td>
                  <td className="px-2 py-1.5 tabular-nums">{item.reserved}</td>
                  <td className="px-2 py-1">
                    <Input
                      aria-label={`Contagem de ${item.name}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={value}
                      disabled={reviewing}
                      onChange={(event) =>
                        setCounts((current) => ({
                          ...current,
                          [item.variantId]: event.target.value,
                        }))
                      }
                      className="h-8 w-24"
                    />
                  </td>
                  <td
                    className={
                      difference
                        ? "px-2 py-1.5 font-medium text-destructive tabular-nums"
                        : "px-2 py-1.5 tabular-nums"
                    }
                  >
                    {difference === null ? "" : difference > 0 ? `+${difference}` : difference}
                  </td>
                </tr>
              );
            })}
            {reviewing && differences.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-4 text-center text-muted-foreground">
                  A contagem bate com o sistema. Nada a ajustar.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {reviewing ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setReviewing(false)}>
            Voltar à contagem
          </Button>
          <Button
            disabled={pending || differences.length === 0}
            onClick={() =>
              startTransition(async () => {
                const result = await applyInventoryCountAction({
                  counts: differences.map((item) => ({
                    variantId: item.variantId,
                    counted: counts[item.variantId],
                  })),
                  reason: "Contagem de inventário",
                });
                if (result.ok) {
                  toast(result.message);
                  setCounts({});
                  setReviewing(false);
                  setError(null);
                  router.refresh();
                } else setError(result.error);
              })
            }
          >
            Aplicar {differences.length} {differences.length === 1 ? "ajuste" : "ajustes"}
          </Button>
        </div>
      ) : (
        <Button
          className="self-start"
          disabled={filled.length === 0}
          onClick={() => setReviewing(true)}
        >
          Ver diferenças ({filled.length} {filled.length === 1 ? "item contado" : "itens contados"})
        </Button>
      )}
    </div>
  );
}
