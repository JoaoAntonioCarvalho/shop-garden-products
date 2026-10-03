"use client";

import type { InputHTMLAttributes, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { useFieldControl } from "./field";

export const controlClasses =
  "w-full rounded-control border border-moss-500 bg-white px-3 text-[16px] text-ink placeholder:text-ink-muted transition-colors hover:border-moss-700 focus-visible:border-moss-700 disabled:cursor-not-allowed disabled:bg-cream-100 disabled:text-ink-muted aria-invalid:border-danger";

type InputProps = InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> };

export function Input({ className, ref, ...props }: InputProps) {
  const control = useFieldControl(props);
  return (
    <input ref={ref} {...props} {...control} className={cn(controlClasses, "h-11", className)} />
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: Ref<HTMLTextAreaElement>;
};

export function Textarea({ className, ref, rows = 4, ...props }: TextareaProps) {
  const control = useFieldControl(props);
  return (
    <textarea
      ref={ref}
      rows={rows}
      {...props}
      {...control}
      className={cn(controlClasses, "py-2.5 leading-normal", className)}
    />
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> };

/** Select nativo: melhor experiência no celular e acessível sem JavaScript. */
export function Select({ className, ref, children, ...props }: SelectProps) {
  const control = useFieldControl(props);
  return (
    <select
      ref={ref}
      {...props}
      {...control}
      className={cn(
        controlClasses,
        "h-11 appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22%234D5236%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%3E%3Cpath%20d=%22m6%209%206%206%206-6%22/%3E%3C/svg%3E')] bg-size-[20px] bg-position-[right_10px_center] bg-no-repeat pr-10",
        className,
      )}
    >
      {children}
    </select>
  );
}
