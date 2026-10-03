"use client";

import { useState, type ChangeEvent, type InputHTMLAttributes, type Ref } from "react";
import { formatCardExpiry, formatCardNumber } from "@/lib/validators/card";
import { formatCep } from "@/lib/validators/cep";
import { formatCpf } from "@/lib/validators/cpf";
import { formatPhone } from "@/lib/validators/phone";
import { Input } from "./input";

export type MaskKind = "cpf" | "cep" | "phone" | "card" | "expiry";

const masks: Record<
  MaskKind,
  {
    format: (value: string) => string;
    placeholder: string;
    autoComplete: string;
    maxLength: number;
  }
> = {
  cpf: { format: formatCpf, placeholder: "000.000.000-00", autoComplete: "off", maxLength: 14 },
  cep: { format: formatCep, placeholder: "00000-000", autoComplete: "postal-code", maxLength: 9 },
  phone: {
    format: formatPhone,
    placeholder: "(11) 90000-0000",
    autoComplete: "tel-national",
    maxLength: 15,
  },
  card: {
    format: formatCardNumber,
    placeholder: "0000 0000 0000 0000",
    autoComplete: "cc-number",
    maxLength: 23,
  },
  expiry: { format: formatCardExpiry, placeholder: "MM/AA", autoComplete: "cc-exp", maxLength: 5 },
};

export function applyMask(kind: MaskKind, value: string) {
  return masks[kind].format(value);
}

type MaskedInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "type"
> & {
  mask: MaskKind;
  value?: string;
  defaultValue?: string;
  /** Recebe o valor já formatado. */
  onValueChange?: (value: string) => void;
  ref?: Ref<HTMLInputElement>;
};

/** Campo com máscara brasileira. Funciona controlado (value) ou não controlado (defaultValue). */
export function MaskedInput({
  mask,
  value,
  defaultValue,
  onValueChange,
  ref,
  ...props
}: MaskedInputProps) {
  const config = masks[mask];
  const [internal, setInternal] = useState(() => config.format(defaultValue ?? ""));
  const current = value !== undefined ? config.format(value) : internal;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const formatted = config.format(event.target.value);
    if (value === undefined) setInternal(formatted);
    onValueChange?.(formatted);
  }

  return (
    <Input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete={config.autoComplete}
      placeholder={config.placeholder}
      maxLength={config.maxLength}
      {...props}
      value={current}
      onChange={handleChange}
    />
  );
}
