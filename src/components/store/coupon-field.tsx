"use client";

import { Tag, X } from "lucide-react";
import { useId, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type CouponActionResult = { ok: true } | { ok: false; error: string };

type CouponFieldProps = {
  /** Cupom já aplicado à sacola, com o resumo do desconto. */
  applied?: { code: string; summary: string } | null;
  /** Server actions: a validação do cupom acontece sempre no servidor. */
  apply: (code: string) => Promise<CouponActionResult>;
  remove: () => Promise<CouponActionResult>;
  className?: string;
};

export function CouponField({ applied, apply, remove, className }: CouponFieldProps) {
  const id = useId();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Digite o código do cupom.");
      return;
    }
    startTransition(async () => {
      const result = await apply(trimmed);
      if (result.ok) {
        setCode("");
        setError(null);
      } else {
        setError(result.error);
      }
    });
  }

  if (applied) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between gap-3 rounded-control border border-moss-700 bg-moss-100 py-1 pr-1 pl-3">
          <p className="flex items-center gap-2 type-small text-ink">
            <Tag aria-hidden="true" strokeWidth={1.5} className="size-4 flex-none text-moss-700" />
            <span>
              Cupom <strong className="font-semibold">{applied.code}</strong> aplicado:{" "}
              {applied.summary}
            </span>
          </p>
          <button
            type="button"
            aria-label={`Remover cupom ${applied.code}`}
            disabled={pending}
            onClick={() => startTransition(async () => void (await remove()))}
            className="flex size-11 flex-none items-center justify-center rounded-control text-moss-700 hover:bg-white"
          >
            <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={className}>
      <label htmlFor={id} className="type-small font-medium text-ink">
        Cupom de desconto
      </label>
      <div className="mt-1.5 flex gap-2">
        <Input
          id={id}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <Button type="submit" variant="secondary" loading={pending}>
          Aplicar cupom
        </Button>
      </div>
      <p id={`${id}-error`} aria-live="polite" className="mt-2 type-small text-danger empty:hidden">
        {error}
      </p>
    </form>
  );
}
