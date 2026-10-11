"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { formatBRL } from "@/lib/money";
import {
  cardBrandLabels,
  detectCardBrand,
  isValidCardExpiry,
  isValidCvv,
  passesLuhn,
} from "@/lib/validators/card";
import { onlyDigits } from "@/lib/validators/cpf";
import { cardTokenizationAction } from "@/server/actions/checkout";

/** Cartões de teste do gateway simulado. O resultado depende dos quatro últimos dígitos. */
export const TEST_CARDS = [
  { number: "4000 0000 0002 0000", outcome: "aprovado (final 0000)" },
  { number: "4000 0000 0000 0002", outcome: "recusado por saldo (final 0002)" },
  { number: "4000 0000 0007 0005", outcome: "recusado por suspeita de fraude (final 0005)" },
] as const;

export type CardTokenData = { token: string; brand: string; last4: string };

type CardFormProps = {
  installments: Array<{ count: number; valueCents: number }>;
  /** Mostra as regras dos cartões de teste. Só fora de produção. */
  showTestCards: boolean;
  onTokenized: (card: CardTokenData, installments: number) => void;
  submitLabel: string;
};

type CardFields = { number: string; name: string; expiry: string; cvv: string };

const CARD_ERROR = "Não foi possível validar o cartão. Confira os dados ou tente outro cartão.";

/**
 * Troca o cartão por um token. O número, a validade e o CVV saem deste componente só para o
 * gateway (na Cielo, direto do navegador para ela): para o servidor da loja vai o token, com a
 * bandeira e os quatro últimos dígitos.
 */
async function tokenize(card: CardFields): Promise<CardTokenData | { error: string }> {
  const digits = onlyDigits(card.number);
  const summary = { brand: detectCardBrand(digits), last4: digits.slice(-4) };
  const session = await cardTokenizationAction().catch(() => null);
  if (!session) return { error: CARD_ERROR };
  if (!session.ok) return { error: session.error };

  if (session.tokenization.kind === "mock") {
    const random = Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    return { token: `mock_tok_${random}`, ...summary };
  }

  // Cielo (Silent Order Post): validade em MM/AAAA e nome só com letras sem acento.
  const [month = "", year = ""] = card.expiry.split("/");
  const body = new URLSearchParams({
    HolderName: card.name
      .normalize("NFD")
      .replace(/[^a-zA-Z ]/g, "")
      .trim()
      .slice(0, 64),
    RawNumber: digits,
    Expiration: `${month}/${year.length === 2 ? `20${year}` : year}`,
    SecurityCode: card.cvv,
    AccessToken: session.tokenization.accessToken,
  });
  try {
    const response = await fetch(session.tokenization.url, {
      method: "POST",
      headers: { Accept: "application/json" },
      body,
    });
    const result = (await response.json()) as { PaymentToken?: string };
    if (response.status !== 201 || !result.PaymentToken) return { error: CARD_ERROR };
    return { token: result.PaymentToken, ...summary };
  } catch {
    return { error: CARD_ERROR };
  }
}

export function CardForm({ installments, showTestCards, onTokenized, submitLabel }: CardFormProps) {
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [count, setCount] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const brand = detectCardBrand(number);

  async function submit() {
    const next: Record<string, string> = {};
    if (!passesLuhn(number))
      next.number = "Este número de cartão não é válido. Confira os dígitos.";
    if (name.trim().split(/\s+/).length < 2)
      next.name = "Digite o nome como está impresso no cartão.";
    if (!isValidCardExpiry(expiry))
      next.expiry = "Validade inválida ou cartão vencido. Use o formato MM/AA.";
    if (!isValidCvv(cvv, brand))
      next.cvv =
        brand === "amex"
          ? "O código do American Express tem 4 dígitos."
          : "O código de segurança tem 3 dígitos.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setPending(true);
    const token = await tokenize({ number, name, expiry, cvv });
    setPending(false);
    if ("error" in token) {
      setErrors({ form: token.error });
      return;
    }
    onTokenized(token, Math.min(count, installments.length || 1));
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {showTestCards ? (
        <Alert tone="info" title="Ambiente de teste: cartões simulados">
          <ul className="list-disc pl-5">
            {TEST_CARDS.map((card) => (
              <li key={card.number}>
                <span className="tabular-nums">{card.number}</span>: {card.outcome}
              </li>
            ))}
          </ul>
          <p className="mt-1">
            Use qualquer nome, validade futura e código de 3 dígitos. Nenhuma cobrança é feita.
          </p>
        </Alert>
      ) : null}
      <Field
        label="Número do cartão"
        error={errors.number}
        hint={brand !== "unknown" ? `Bandeira: ${cardBrandLabels[brand]}` : undefined}
      >
        <MaskedInput mask="card" value={number} onValueChange={setNumber} />
      </Field>
      <Field label="Nome impresso no cartão" error={errors.name}>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="cc-name"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Validade" error={errors.expiry}>
          <MaskedInput mask="expiry" value={expiry} onValueChange={setExpiry} />
        </Field>
        <Field label="Código de segurança" error={errors.cvv}>
          <Input
            value={cvv}
            onChange={(event) => setCvv(onlyDigits(event.target.value).slice(0, 4))}
            inputMode="numeric"
            autoComplete="cc-csc"
            maxLength={4}
            placeholder="CVV"
          />
        </Field>
      </div>
      <Field label="Parcelas">
        <Select value={count} onChange={(event) => setCount(Number(event.target.value))}>
          {(installments.length ? installments : [{ count: 1, valueCents: 0 }]).map((option) => (
            <option key={option.count} value={option.count}>
              {option.count}x de {formatBRL(option.valueCents)} sem juros
            </option>
          ))}
        </Select>
      </Field>
      {errors.form ? <Alert tone="error">{errors.form}</Alert> : null}
      <Button onClick={submit} disabled={pending} className="self-start">
        {pending ? "Validando o cartão" : submitLabel}
      </Button>
    </div>
  );
}
