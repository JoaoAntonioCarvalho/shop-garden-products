"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { findOrderAction } from "@/server/actions/order";

/** Número do pedido e e-mail. Usado no rastreio e quando o link do pedido vem sem o token. */
export function OrderLookupForm({ defaultNumber = "" }: { defaultNumber?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await findOrderAction(
        String(form.get("number") ?? ""),
        String(form.get("email") ?? ""),
      );
      if (result.ok) router.push(result.url);
      else setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {error ? (
        <Alert tone="error" live>
          {error}
        </Alert>
      ) : null}
      <Field label="Número do pedido" hint="Está no e-mail de confirmação, como NSG-000123.">
        <Input
          name="number"
          defaultValue={defaultNumber.startsWith("NSG-") ? defaultNumber : ""}
          autoComplete="off"
          required
        />
      </Field>
      <Field label="E-mail usado na compra">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" loading={pending} className="self-start">
        Acompanhar pedido
      </Button>
    </form>
  );
}
