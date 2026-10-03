"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { selectClass } from "@/components/admin/entity-form";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { toast } from "@/components/ui/toast";
import { generateCouponBatchAction } from "@/server/actions/admin/catalog-tools";

/** Gerador em lote: cupons únicos, de um uso cada, com as regras de um cupom modelo. */
export function CouponBatchForm({ coupons }: { coupons: Array<{ value: string; label: string }> }) {
  const router = useRouter();
  const [baseId, setBaseId] = useState(coupons[0]?.value ?? "");
  const [prefix, setPrefix] = useState("");
  const [quantity, setQuantity] = useState("50");
  const [batch, setBatch] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (coupons.length === 0) return null;
  return (
    <details className="mb-4 rounded-md border border-border bg-background p-4 text-sm">
      <summary className="cursor-pointer font-medium">Gerar cupons únicos em lote</summary>
      <form
        className="mt-3 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const result = await generateCouponBatchAction({ baseId, prefix, quantity });
            if (result.ok) {
              toast(result.message);
              setBatch(result.data?.batch ?? null);
              router.refresh();
            } else
              toast(result.fieldErrors ? Object.values(result.fieldErrors)[0] : result.error, {
                tone: "error",
              });
          });
        }}
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="lote-modelo">Cupom modelo</Label>
          <select
            id="lote-modelo"
            value={baseId}
            onChange={(event) => setBaseId(event.target.value)}
            className={selectClass}
          >
            {coupons.map((coupon) => (
              <option key={coupon.value} value={coupon.value}>
                {coupon.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="lote-prefixo">Prefixo</Label>
          <Input
            id="lote-prefixo"
            value={prefix}
            placeholder="MAES"
            onChange={(event) => setPrefix(event.target.value.toUpperCase())}
            className="w-32"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="lote-quantidade">Quantidade</Label>
          <Input
            id="lote-quantidade"
            type="number"
            min={1}
            max={1000}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="w-24"
          />
        </div>
        <Button type="submit" disabled={pending}>
          Gerar cupons
        </Button>
        {batch ? (
          <Button asChild variant="outline">
            <a href={`/admin/exportar/cupons?lote=${encodeURIComponent(batch)}`} download>
              Baixar os códigos do lote
            </a>
          </Button>
        ) : null}
      </form>
      <p className="mt-2 text-muted-foreground">
        Cada cupom gerado copia as regras do modelo e vale para um único uso.
      </p>
    </details>
  );
}
