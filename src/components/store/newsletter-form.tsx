"use client";

import { CircleCheck, Copy } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { controlClasses } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { track } from "@/lib/analytics/events";
import { cn } from "@/lib/cn";

export type LeadSource = "POPUP" | "FOOTER";

export type LeadFormResult = { ok: true; couponCode: string } | { ok: false; error: string };

export type LeadFormInput = {
  email: string;
  whatsapp: string;
  consent: boolean;
  consentText: string;
  source: LeadSource;
  /** Honeypot: humanos deixam vazio. */
  website: string;
  /** Milissegundos entre a exibição do formulário e o envio. */
  elapsedMs: number;
};

type NewsletterFormProps = {
  /** Server action que cria o Lead. Sem ela o formulário informa que o cadastro está indisponível. */
  submit?: (input: LeadFormInput) => Promise<LeadFormResult>;
  source: LeadSource;
  /** Nome da loja, vindo da configuração (entra no texto de consentimento). */
  storeName: string;
  /** Percentual do cupom de boas-vindas, vindo da configuração. */
  discountPercent: number;
  /** Em fundo musgo (rodapé) os textos ficam creme. */
  tone?: "light" | "dark";
  submitLabel?: string;
  onSuccess?: () => void;
  className?: string;
};

export function consentTextFor(storeName: string) {
  return `Aceito receber novidades e ofertas da ${storeName} por e-mail e, se informado, por WhatsApp. Posso cancelar quando quiser.`;
}

export function NewsletterForm({
  submit,
  source,
  storeName,
  discountPercent,
  tone = "light",
  submitLabel = "Quero meu cupom",
  onSuccess,
  className,
}: NewsletterFormProps) {
  const id = useId();
  const startedAt = useRef<number>(0);
  const [whatsapp, setWhatsapp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const dark = tone === "dark";
  const consentText = consentTextFor(storeName);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const consent = form.get("consent") === "on";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Digite um e-mail válido, como nome@exemplo.com.");
      return;
    }
    if (!consent) {
      setError("Marque a caixa de consentimento para receber o cupom.");
      return;
    }
    if (!submit) {
      setError("O cadastro não está disponível agora. Tente novamente em instantes.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submit({
        email,
        whatsapp,
        consent,
        consentText,
        source,
        website: String(form.get("website") ?? ""),
        elapsedMs: startedAt.current ? Date.now() - startedAt.current : 0,
      });
      if (result.ok) {
        setCoupon(result.couponCode);
        track("generate_lead", { lead_source: source });
        onSuccess?.();
      } else {
        setError(result.error);
      }
    });
  }

  async function copyCoupon() {
    if (!coupon) return;
    try {
      await navigator.clipboard.writeText(coupon);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (coupon) {
    return (
      <div role="status" className={cn("flex flex-col gap-3", className)}>
        <p className={cn("flex items-start gap-2 type-body", dark ? "text-cream-50" : "text-ink")}>
          <CircleCheck aria-hidden="true" strokeWidth={1.5} className="mt-1 size-5 flex-none" />
          Seu cupom de {discountPercent}% para a primeira compra:
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <code className="rounded-control border border-dashed border-moss-700 bg-white px-4 py-2.5 font-sans text-[18px] font-semibold tracking-wide text-moss-900">
            {coupon}
          </code>
          <Button
            variant="secondary"
            onClick={copyCoupon}
            icon={<Copy aria-hidden="true" strokeWidth={1.5} className="size-4" />}
            className={cn(dark && "border-cream-50 text-cream-50 hover:bg-moss-900")}
          >
            {copied ? "Código copiado" : "Copiar código"}
          </Button>
        </div>
        <p className={cn("type-small", dark ? "text-cream-50" : "text-ink-muted")}>
          Também enviamos o código para o seu e-mail, com um link para confirmar o cadastro.
        </p>
      </div>
    );
  }

  const labelClass = cn("type-small font-medium", dark ? "text-cream-50" : "text-ink");

  return (
    <form
      onSubmit={handleSubmit}
      onFocus={() => {
        if (!startedAt.current) startedAt.current = Date.now();
      }}
      noValidate
      className={cn("flex flex-col gap-3", className)}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-email`} className={labelClass}>
            E-mail
          </label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-describedby={error ? `${id}-error` : undefined}
            className={cn(controlClasses, "h-11")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-whatsapp`} className={labelClass}>
            WhatsApp <span className="font-normal opacity-80">(opcional)</span>
          </label>
          <MaskedInput
            id={`${id}-whatsapp`}
            mask="phone"
            value={whatsapp}
            onValueChange={setWhatsapp}
          />
        </div>
      </div>

      {/* Honeypot contra robôs: invisível e fora da navegação por teclado. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Não preencha este campo
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label
        className={cn("flex min-h-11 cursor-pointer items-start gap-3 py-1", dark && "on-dark")}
      >
        <input type="checkbox" name="consent" className="control-check mt-0.5" />
        <span className={cn("type-caption", dark ? "text-cream-50" : "text-ink-muted")}>
          {consentText} Veja a{" "}
          <Link
            href="/privacidade"
            className={cn("underline underline-offset-3", dark ? "text-cream-50" : "text-moss-700")}
          >
            política de privacidade
          </Link>
          .
        </span>
      </label>

      <p
        id={`${id}-error`}
        aria-live="polite"
        className={cn(
          "type-small empty:hidden",
          dark ? "rounded-control bg-wine-50 px-3 py-2 text-wine-700" : "text-danger",
        )}
      >
        {error}
      </p>

      <Button
        type="submit"
        loading={pending}
        variant={dark ? "secondary" : "primary"}
        className={cn(
          "self-start",
          dark && "on-dark border-cream-50 bg-cream-50 text-moss-900 hover:bg-white",
        )}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
