"use client";

import { CircleAlert } from "lucide-react";
import { createContext, useContext, useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type FieldContextValue = { id: string; describedBy?: string; invalid: boolean; required: boolean };

const FieldContext = createContext<FieldContextValue | null>(null);

/** Atributos de acessibilidade que o controle dentro de um Field deve receber. */
export function useFieldControl(props: { id?: string; "aria-describedby"?: string }) {
  const field = useContext(FieldContext);
  if (!field) return props;
  return {
    id: props.id ?? field.id,
    "aria-describedby":
      [props["aria-describedby"], field.describedBy].filter(Boolean).join(" ") || undefined,
    "aria-invalid": field.invalid || undefined,
    "aria-required": field.required || undefined,
  };
}

type FieldProps = {
  label: ReactNode;
  /** Texto de ajuda exibido abaixo do rótulo. */
  hint?: ReactNode;
  /** Mensagem de erro. Quando presente, o campo fica marcado como inválido. */
  error?: ReactNode;
  required?: boolean;
  /** Mostra "(opcional)" ao lado do rótulo. */
  optional?: boolean;
  className?: string;
  children: ReactNode;
};

/** Rótulo visível, ajuda e erro ligados ao controle por aria-describedby. */
export function Field({ label, hint, error, required, optional, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider
      value={{ id, describedBy, invalid: Boolean(error), required: !!required }}
    >
      <div className={cn("flex flex-col gap-1.5", className)}>
        <label htmlFor={id} className="type-small font-medium text-ink">
          {label}
          {optional ? <span className="font-normal text-ink-muted"> (opcional)</span> : null}
        </label>
        {hint ? (
          <p id={hintId} className="type-caption text-ink-muted">
            {hint}
          </p>
        ) : null}
        {children}
        {error ? (
          <p id={errorId} className="flex items-start gap-1.5 type-small text-danger">
            <CircleAlert aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-4 flex-none" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}
