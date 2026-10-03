"use client";

import { Copy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { track, type AnalyticsItem } from "@/lib/analytics/events";
import { formatBRL } from "@/lib/money";
import { retryPaymentAction, simulatePaymentAction } from "@/server/actions/order";
import { CardForm } from "./card-form";

type Poller = { number: string; token: string; active: boolean };

/** Verifica o status a cada 5 segundos enquanto o pagamento está pendente; para ao pagar ou expirar. */
function useOrderPolling({ number, token, active }: Poller, currentStatus: string) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/pedidos/${number}/status?token=${token}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { status: string; paymentStatus: string };
        if (`${data.status}:${data.paymentStatus}` !== currentStatus) router.refresh();
      } catch {
        // Falha de rede: tenta de novo no próximo intervalo.
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [number, token, active, currentStatus, router]);
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="primary"
      icon={<Copy aria-hidden="true" strokeWidth={1.5} className="size-4" />}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 4000);
        } catch {
          toast("Não foi possível copiar. Selecione o código e copie manualmente.", {
            tone: "error",
          });
        }
      }}
    >
      <span aria-live="polite">{copied ? "Código copiado" : label}</span>
    </Button>
  );
}

function Countdown({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const update = () => {
      const seconds = Math.max(0, Math.round((Date.parse(expiresAt) - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) onExpire();
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
    // onExpire muda de identidade a cada renderização; o prazo é o que importa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);
  if (remaining === null) return null;
  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, "0");
  return (
    <p className="type-small text-ink-muted">
      {remaining > 0 ? (
        <>
          Este código expira em{" "}
          <strong className="font-semibold text-ink tabular-nums">
            {minutes}:{seconds}
          </strong>
        </>
      ) : (
        "O código expirou."
      )}
    </p>
  );
}

export type PaymentPanelProps = {
  number: string;
  token: string;
  status: string;
  paymentStatus: string;
  totalCents: number;
  pix: { payload: string; qrCode: string | null; expiresAt: string } | null;
  boleto: { line: string; dueDate: string; url: string } | null;
  failureReason: string | null;
  installments: Array<{ count: number; valueCents: number }>;
  simulator: boolean;
  /** Dispara o evento purchase só na primeira vez que a confirmação é exibida. */
  purchase: { value: number; shipping: number; coupon?: string; items: AnalyticsItem[] } | null;
};

export function PaymentPanel({
  number,
  token,
  status,
  paymentStatus,
  totalCents,
  pix,
  boleto,
  failureReason,
  installments,
  simulator,
  purchase,
}: PaymentPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [retryWithCard, setRetryWithCard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const awaiting = status === "PENDING_PAYMENT";
  useOrderPolling(
    { number, token, active: awaiting && paymentStatus === "PENDING" },
    `${status}:${paymentStatus}`,
  );

  useEffect(() => {
    if (purchase) track("purchase", { transaction_id: number, currency: "BRL", ...purchase });
    // Uma única vez por pedido: o servidor só envia "purchase" na primeira exibição.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await action();
      setError(result.ok ? null : (result.error ?? "Não foi possível concluir. Tente de novo."));
      router.refresh();
    });

  const retry = (
    method: "PIX" | "CREDIT_CARD",
    card?: { token: string; brand: string; last4: string },
    count = 1,
  ) => run(() => retryPaymentAction(number, token, { method, installments: count, card }));

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Alert tone="error" live>
          {error}
        </Alert>
      ) : null}

      {awaiting && paymentStatus === "PENDING" && pix ? (
        <section aria-labelledby="pix-titulo" className="rounded-photo bg-white p-6">
          <h2 id="pix-titulo" className="type-h3 text-moss-900">
            Pague {formatBRL(totalCents)} com Pix
          </h2>
          <div className="mt-5 grid gap-6 md:grid-cols-[auto_1fr] md:items-start">
            {pix.qrCode ? (
              // QR Code gerado no servidor como data URL: não há o que o otimizador de imagens fazer.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pix.qrCode}
                alt="QR Code do Pix para pagar este pedido"
                width={240}
                height={240}
                className="mx-auto size-60 rounded-photo border border-line"
              />
            ) : null}
            <div className="flex flex-col gap-4">
              <ol className="flex list-decimal flex-col gap-1 pl-5 type-body text-ink">
                <li>Abra o aplicativo do seu banco e escolha pagar com Pix.</li>
                <li>Aponte a câmera para o QR Code ou use o Pix copia e cola.</li>
                <li>Confirme o pagamento. Esta página atualiza sozinha.</li>
              </ol>
              <div>
                <label htmlFor="pix-codigo" className="type-small font-medium text-ink">
                  Pix copia e cola
                </label>
                <textarea
                  id="pix-codigo"
                  readOnly
                  rows={3}
                  value={pix.payload}
                  onFocus={(event) => event.currentTarget.select()}
                  className="mt-1.5 w-full rounded-control border border-moss-500 bg-cream-50 p-3 font-mono text-[13px] break-all text-ink"
                />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <CopyButton value={pix.payload} label="Copiar código Pix" />
                <Countdown expiresAt={pix.expiresAt} onExpire={() => router.refresh()} />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {awaiting && paymentStatus === "PENDING" && boleto ? (
        <section aria-labelledby="boleto-titulo" className="rounded-photo bg-white p-6">
          <h2 id="boleto-titulo" className="type-h3 text-moss-900">
            Pague o boleto de {formatBRL(totalCents)} até {boleto.dueDate}
          </h2>
          <p className="mt-2 type-body text-ink-muted">
            A confirmação do pagamento pode levar até 3 dias úteis.
          </p>
          <label htmlFor="boleto-linha" className="mt-4 block type-small font-medium text-ink">
            Linha digitável
          </label>
          <input
            id="boleto-linha"
            readOnly
            value={boleto.line}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-1.5 h-11 w-full rounded-control border border-moss-500 bg-cream-50 px-3 font-mono text-[13px] text-ink"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <CopyButton value={boleto.line} label="Copiar linha digitável" />
            <Link href={boleto.url} target="_blank" className={buttonClasses("secondary")}>
              Abrir boleto<span className="sr-only"> (abre em nova aba)</span>
            </Link>
          </div>
        </section>
      ) : null}

      {awaiting && paymentStatus !== "PENDING" ? (
        <section aria-labelledby="recusado-titulo" className="rounded-photo bg-white p-6">
          <h2 id="recusado-titulo" className="type-h3 text-moss-900">
            O pagamento não foi aprovado
          </h2>
          <p className="mt-2 type-body text-ink">
            {failureReason ? `${failureReason}. ` : ""}Os produtos continuam reservados. Tente com
            outro cartão ou pague com Pix.
          </p>
          {retryWithCard ? (
            <CardForm
              installments={installments}
              showTestCards={simulator}
              submitLabel="Pagar com este cartão"
              onTokenized={(card, count) => retry("CREDIT_CARD", card, count)}
            />
          ) : (
            <div className="mt-4 flex flex-wrap gap-3">
              <Button loading={pending} onClick={() => retry("PIX")}>
                Pagar com Pix
              </Button>
              <Button variant="secondary" disabled={pending} onClick={() => setRetryWithCard(true)}>
                Tentar outro cartão
              </Button>
            </div>
          )}
        </section>
      ) : null}

      {simulator && awaiting && paymentStatus === "PENDING" ? (
        <section
          aria-labelledby="simulador-titulo"
          className="rounded-photo border border-dashed border-moss-700 p-6"
        >
          <h2 id="simulador-titulo" className="type-body font-semibold text-ink">
            Ambiente de teste
          </h2>
          <p className="mt-1 type-small text-ink-muted">
            Estes botões chamam o webhook do gateway simulado, como um gateway real faria. Não
            aparecem em produção.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="secondary"
              size="sm"
              loading={pending}
              onClick={() => run(() => simulatePaymentAction(number, token, "paid"))}
            >
              {boleto ? "Simular boleto pago" : "Simular Pix pago"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => run(() => simulatePaymentAction(number, token, "failed"))}
            >
              Simular pagamento recusado
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => run(() => simulatePaymentAction(number, token, "expired"))}
            >
              Simular expiração
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
