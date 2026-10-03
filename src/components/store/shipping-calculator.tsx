"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { MaskedInput } from "@/components/ui/masked-input";
import { formatBRL } from "@/lib/money";
import { isValidCep } from "@/lib/validators/cep";
import type { ShippingOption } from "@/server/providers/shipping/types";

export type ShippingQuoteResult =
  { ok: true; options: ShippingOption[]; notice?: string } | { ok: false; error: string };

type ShippingCalculatorProps = {
  /** Server action que consulta o serviço de frete. O cálculo nunca acontece no navegador. */
  quote: (cep: string) => Promise<ShippingQuoteResult>;
  defaultCep?: string;
  onQuoted?: (cep: string, options: ShippingOption[]) => void;
  className?: string;
};

/** Prazo em texto. Entrega hoje e agendada já se explicam pela descrição, então não repetem o prazo. */
export function formatDeliveryEstimate(option: ShippingOption): string {
  if (option.requiresScheduling || (option.deliveryDate && option.minDays === 0)) return "";
  if (option.minDays === option.maxDays) {
    return option.minDays === 1 ? "1 dia útil" : `${option.minDays} dias úteis`;
  }
  return `${option.minDays} a ${option.maxDays} dias úteis`;
}

/** "2 a 4 dias úteis. Transportadora." ou só a descrição, quando não há prazo a mostrar. */
export function describeShippingOption(option: ShippingOption): string {
  return [formatDeliveryEstimate(option), option.description]
    .filter(Boolean)
    .join(". ")
    .replace(/\.\.$/, ".");
}

export function ShippingCalculator({
  quote,
  defaultCep = "",
  onQuoted,
  className,
}: ShippingCalculatorProps) {
  const id = useId();
  const [cep, setCep] = useState(defaultCep);
  const [result, setResult] = useState<ShippingQuoteResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isValidCep(cep)) {
      setResult({ ok: false, error: "Digite um CEP com 8 números." });
      return;
    }
    startTransition(async () => {
      const response = await quote(cep);
      setResult(response);
      if (response.ok) onQuoted?.(cep, response.options);
    });
  }

  const error = result && !result.ok ? result.error : null;

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-1.5">
        <label htmlFor={id} className="type-small font-medium text-ink">
          Calcular frete e prazo
        </label>
        <div className="flex gap-2">
          <MaskedInput
            id={id}
            mask="cep"
            value={cep}
            onValueChange={setCep}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className="max-w-40"
          />
          <Button type="submit" variant="secondary" loading={pending}>
            Calcular frete
          </Button>
        </div>
        <a
          href="https://buscacepinter.correios.com.br/app/endereco/index.php"
          target="_blank"
          rel="noopener noreferrer"
          className="self-start py-1 type-caption text-moss-700 underline underline-offset-3 hover:text-moss-900"
        >
          Não sei meu CEP
          <span className="sr-only"> (abre o site dos Correios em nova aba)</span>
        </a>
      </form>

      <div aria-live="polite">
        {error ? (
          <p id={`${id}-error`} className="mt-2 type-small text-danger">
            {error}
          </p>
        ) : null}
        {result?.ok && result.notice ? (
          <Alert tone="warning" className="mt-3">
            {result.notice}
          </Alert>
        ) : null}
        {result?.ok && result.options.length > 0 ? (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {result.options.map((option) => (
              <li key={option.code} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p className="type-small font-medium text-ink">{option.name}</p>
                  <p className="type-caption text-ink-muted">{describeShippingOption(option)}</p>
                </div>
                <p className="type-small font-medium whitespace-nowrap text-ink tabular-nums">
                  {option.isFree ? "Grátis" : formatBRL(option.priceCents)}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
