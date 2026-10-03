"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/admin/ui/popover";
import { toast } from "@/components/ui/toast";
import { quickEditVariantAction, removeSampleDataAction } from "@/server/actions/admin/products";

/** Edição rápida de preço e estoque da variação padrão, sem sair da lista. */
export function QuickEdit({
  variantId,
  name,
  price,
  stock,
  canPrice,
  canStock,
}: {
  variantId: string;
  name: string;
  price: string;
  stock: number;
  canPrice: boolean;
  canStock: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [priceValue, setPriceValue] = useState(price);
  const [stockValue, setStockValue] = useState(String(stock));
  const [pending, startTransition] = useTransition();
  if (!canPrice && !canStock) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Edição rápida de ${name}`}>
          Editar
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await quickEditVariantAction({
                variantId,
                price: canPrice ? priceValue : undefined,
                stock: canStock ? stockValue : undefined,
              });
              if (result.ok) {
                toast(result.message);
                setOpen(false);
                router.refresh();
              } else toast(result.error, { tone: "error" });
            });
          }}
        >
          <p className="text-sm font-medium">{name}</p>
          {canPrice ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor={`rapido-preco-${variantId}`}>Preço (R$)</Label>
              <Input
                id={`rapido-preco-${variantId}`}
                inputMode="decimal"
                value={priceValue}
                onChange={(event) => setPriceValue(event.target.value)}
              />
            </div>
          ) : null}
          {canStock ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor={`rapido-estoque-${variantId}`}>Estoque</Label>
              <Input
                id={`rapido-estoque-${variantId}`}
                inputMode="numeric"
                value={stockValue}
                onChange={(event) => setStockValue(event.target.value)}
              />
            </div>
          ) : null}
          <Button type="submit" size="sm" disabled={pending}>
            Salvar
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** "Remover todos os produtos de teste": exige digitar REMOVER TESTES e mostra o relatório do que foi apagado. */
export function RemoveSamplesButton({ sampleCount }: { sampleCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [report, setReport] = useState<Record<string, number> | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Remover todos os produtos de teste
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setConfirmation("");
            setReport(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover todos os produtos de teste</DialogTitle>
            <DialogDescription>
              {report
                ? "Os dados de teste foram removidos. Os dados reais não foram alterados."
                : `Apaga os ${sampleCount} produtos de teste e tudo o que veio com eles: variações, imagens, avaliações, pedidos, clientes, leads e carrinhos de teste. Produtos, pedidos e clientes reais não são alterados. Não dá para desfazer.`}
            </DialogDescription>
          </DialogHeader>
          {report ? (
            <ul className="text-sm">
              {Object.entries(report).map(([label, count]) => (
                <li key={label} className="flex justify-between border-b border-border py-1">
                  <span>{label}</span>
                  <span className="tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmar-remocao">Para confirmar, digite REMOVER TESTES</Label>
              <Input
                id="confirmar-remocao"
                value={confirmation}
                autoComplete="off"
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {report ? "Fechar" : "Voltar"}
            </Button>
            {report ? null : (
              <Button
                variant="destructive"
                disabled={pending || confirmation.trim() !== "REMOVER TESTES"}
                onClick={() =>
                  startTransition(async () => {
                    const result = await removeSampleDataAction({ confirmation });
                    if (result.ok) {
                      toast(result.message);
                      setReport(result.data ?? {});
                      router.refresh();
                    } else toast(result.error, { tone: "error", duration: 8000 });
                  })
                }
              >
                Remover dados de teste
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
