"use client";

import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";

type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  /** Texto secundário abaixo do rótulo. */
  description?: ReactNode;
  ref?: Ref<HTMLInputElement>;
};

function Choice({
  kind,
  label,
  description,
  className,
  ref,
  ...props
}: ChoiceProps & { kind: "checkbox" | "radio" | "switch" }) {
  const controlClass =
    kind === "checkbox" ? "control-check" : kind === "radio" ? "control-radio" : "control-switch";
  return (
    // min-h-11 garante 44px de área de toque.
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-start gap-3 py-2.5 has-disabled:cursor-not-allowed",
        kind === "switch" && "items-center justify-between",
        className,
      )}
    >
      {kind === "switch" ? null : (
        <input ref={ref} type={kind} className={controlClass} {...props} />
      )}
      <span className="type-small text-ink">
        {label}
        {description ? <span className="block text-ink-muted">{description}</span> : null}
      </span>
      {kind === "switch" ? (
        <input ref={ref} type="checkbox" role="switch" className={controlClass} {...props} />
      ) : null}
    </label>
  );
}

export function Checkbox(props: ChoiceProps) {
  return <Choice kind="checkbox" {...props} />;
}

export function Radio(props: ChoiceProps) {
  return <Choice kind="radio" {...props} />;
}

export function Switch(props: ChoiceProps) {
  return <Choice kind="switch" {...props} />;
}
