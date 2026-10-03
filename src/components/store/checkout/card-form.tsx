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

/**
 * Formulário de cartão. O número, a validade e o CVV ficam só neste componente: o que sai daqui
 * é um token com a bandeira e os quatro últimos dígitos. Nada mais vai para o servidor.
 */
// TODO(integracao): substituir pelo SDK de tokenização do gateway (Mercado Pago, Pagar.me, Stripe etc.)
function tokenize(number: string): CardTokenData {
  const digits = onlyDigits(number);
  const random = Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return { token: `mock_tok_${random}`, brand: detectCardBrand(digits), last4: digits.slice(-4) };
}

export function CardForm({ installments, showTestCards, onTokenized, submitLabel }: CardFormProps) {
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [count, setCount] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const brand = detectCardBrand(number);

  function submit() {
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
    onTokenized(tokenize(number), Math.min(count, installments.length || 1));
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
      <Button onClick={submit} className="self-start">
        {submitLabel}
      </Button>
    </div>
  );
}
