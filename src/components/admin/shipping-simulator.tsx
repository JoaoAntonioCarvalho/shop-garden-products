"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { describeShippingOption } from "@/components/store/shipping-calculator";
import { formatBRL } from "@/lib/money";
import { formatCep } from "@/lib/validators/cep";
import {
  simulateShippingAction,
  type ShippingSimulation,
} from "@/server/actions/admin/catalog-tools";

/** Simulador de frete do painel: CEP e um carrinho de exemplo, com as regras que o checkout usa. */
export function ShippingSimulator() {
  const [cep, setCep] = useState("");
  const [subtotal, setSubtotal] = useState("150");
  const [weight, setWeight] = useState("2000");
  const [localOnly, setLocalOnly] = useState(false);
  const [sameDay, setSameDay] = useState(true);
  const [result, setResult] = useState<ShippingSimulation | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="rounded-md border border-border bg-background p-4 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () =>
          setResult(
            await simulateShippingAction({
              cep,
              subtotal,
              weightGrams: weight,
              localOnly,
              sameDayEligible: sameDay,
            }),
          ),
        );
      }}
    >
      <p className="font-medium">Simulador de frete</p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="simulador-cep">CEP</Label>
          <Input
            id="simulador-cep"
            inputMode="numeric"
            value={cep}
            onChange={(event) => setCep(formatCep(event.target.value))}
            className="w-28"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="simulador-valor">Valor do carrinho (R$)</Label>
          <Input
            id="simulador-valor"
            type="number"
            min={0}
            value={subtotal}
            onChange={(event) => setSubtotal(event.target.value)}
            className="w-28"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="simulador-peso">Peso (g)</Label>
          <Input
            id="simulador-peso"
            type="number"
            min={0}
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            className="w-24"
          />
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          Simular
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-4">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="control-check size-4"
            checked={sameDay}
            onChange={(event) => setSameDay(event.target.checked)}
          />
          Produtos com entrega hoje
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="control-check size-4"
            checked={localOnly}
            onChange={(event) => setLocalOnly(event.target.checked)}
          />
          Tem produto só da Grande São Paulo
        </label>
      </div>
      <div aria-live="polite" className="mt-3">
        {result && !result.ok ? <p className="text-destructive">{result.error}</p> : null}
        {result?.ok ? (
          <>
            {result.notice ? <p className="text-warning">{result.notice}</p> : null}
            {result.options.length === 0 ? <p>Nenhuma opção de entrega para este CEP.</p> : null}
            <ul className="flex flex-col gap-1">
              {result.options.map((option) => (
                <li
                  key={option.code}
                  className="flex justify-between gap-3 border-t border-border pt-1"
                >
                  <span>
                    {option.name}
                    <span className="block text-xs text-muted-foreground">
                      {describeShippingOption(option)}
                    </span>
                  </span>
                  <span className="tabular-nums">
                    {option.isFree ? "Grátis" : formatBRL(option.priceCents)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </form>
  );
}
