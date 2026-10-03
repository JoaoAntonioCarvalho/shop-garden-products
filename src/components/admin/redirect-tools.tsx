"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { toast } from "@/components/ui/toast";
import {
  importRedirectsAction,
  testRedirectAction,
  type RedirectTest,
} from "@/server/actions/admin/catalog-tools";

/** Ferramentas da lista de redirecionamentos: testar uma URL, importar CSV e ver as páginas não encontradas. */
export function RedirectTools() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<RedirectTest | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  return (
    <div className="mb-4 grid gap-4 lg:grid-cols-2">
      <form
        className="rounded-md border border-border bg-background p-4 text-sm"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => setResult(await testRedirectAction(url)));
        }}
      >
        <Label htmlFor="testar-url">Testar URL</Label>
        <div className="mt-1.5 flex gap-2">
          <Input
            id="testar-url"
            value={url}
            placeholder="/decoracao/orquideas-naturais-86355227"
            onChange={(event) => setUrl(event.target.value)}
          />
          <Button type="submit" variant="outline" disabled={pending || !url.trim()}>
            Testar
          </Button>
        </div>
        {result ? (
          <p aria-live="polite" className="mt-2">
            {result.match
              ? `${result.normalized} responde ${result.match.statusCode} para ${result.match.toPath}${result.match.isActive ? "" : " (desativado)"}.`
              : `Nenhum redirecionamento para ${result.normalized}.`}
          </p>
        ) : null}
      </form>
      <div className="rounded-md border border-border bg-background p-4 text-sm">
        <form
          action={(form) =>
            startTransition(async () => {
              const outcome = await importRedirectsAction(form);
              if (outcome.ok) {
                toast(outcome.message);
                setErrors(outcome.data?.errors ?? []);
                router.refresh();
              } else toast(outcome.error, { tone: "error" });
            })
          }
        >
          <Label htmlFor="importar-redirecionamentos">
            Importar CSV (colunas: origem; destino; código)
          </Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <input
              id="importar-redirecionamentos"
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              className="text-sm"
            />
            <Button type="submit" variant="outline" disabled={pending}>
              Importar
            </Button>
          </div>
        </form>
        {errors.length ? (
          <ul className="mt-2 max-h-32 list-disc overflow-auto pl-5 text-destructive">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
        <Link
          href="/admin/nao-encontradas"
          className="mt-2 inline-flex min-h-8 items-center text-primary underline underline-offset-2"
        >
          Ver páginas não encontradas
        </Link>
      </div>
    </div>
  );
}
