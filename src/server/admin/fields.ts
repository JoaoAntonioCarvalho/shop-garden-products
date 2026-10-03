import { z } from "zod";
import { parseBRLToCents } from "@/lib/money";

/** Peças de schema Zod para os formulários do painel, que enviam os campos como texto. */

const blankToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

export const requiredText = (label: string, max = 200) =>
  z
    .string({ error: `Informe ${label}.` })
    .trim()
    .min(1, `Informe ${label}.`)
    .max(max, `Use até ${max} caracteres.`);

export const optionalText = (max = 500) =>
  z.preprocess(
    (value) => (value == null ? null : blankToNull(value)),
    z.string().trim().max(max, `Use até ${max} caracteres.`).nullable(),
  );

/** "1.234,56" → 123456 centavos. */
export const money = (label = "o valor") =>
  z.preprocess(
    (value) =>
      typeof value === "number" ? value : typeof value === "string" ? parseBRLToCents(value) : null,
    z
      .number({ error: `Informe ${label} em reais.` })
      .int()
      .min(0, "O valor não pode ser negativo.")
      .max(100_000_000),
  );

export const optionalMoney = () =>
  z.preprocess(
    (value) =>
      value == null || value === ""
        ? null
        : typeof value === "number"
          ? value
          : parseBRLToCents(String(value)),
    z.number({ error: "Informe um valor em reais." }).int().min(0).max(100_000_000).nullable(),
  );

const toNumber = (value: unknown) => {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export const int = (label: string, min = 0, max = 1_000_000) =>
  z.preprocess(
    toNumber,
    z
      .number({ error: `Informe ${label}.` })
      .int("Use um número inteiro.")
      .min(min)
      .max(max),
  );

export const optionalInt = (min = 0, max = 1_000_000) =>
  z.preprocess(
    toNumber,
    z
      .number({ error: "Use um número." })
      .int("Use um número inteiro.")
      .min(min)
      .max(max)
      .nullable(),
  );

export const optionalFloat = (min = 0, max = 100_000) =>
  z.preprocess(toNumber, z.number({ error: "Use um número." }).min(min).max(max).nullable());

/** Campo datetime-local ("2026-11-30T23:59"), interpretado no fuso de São Paulo. */
export const optionalDateTime = () =>
  z.preprocess(
    (value) => {
      if (value == null || value === "") return null;
      if (value instanceof Date) return value;
      const text = String(value);
      const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
        ? new Date(`${text}T00:00:00-03:00`)
        : new Date(`${text.slice(0, 16)}:00-03:00`);
      return Number.isNaN(date.getTime()) ? "invalid" : date;
    },
    z.date({ error: "Data inválida." }).nullable(),
  );

export const bool = () =>
  z.preprocess((value) => value === true || value === "true" || value === "on", z.boolean());

export const idList = (max = 500) => z.array(z.string().min(1).max(40)).max(max).default([]);

export const tagList = () =>
  z.preprocess(
    (value) =>
      (Array.isArray(value) ? value : String(value ?? "").split(","))
        .map((tag) => String(tag).trim().toLowerCase())
        .filter(Boolean),
    z.array(z.string().max(40)).max(40),
  );

export const optionalId = () =>
  z.preprocess(
    (value) => (value == null ? null : blankToNull(value)),
    z.string().max(40).nullable(),
  );

export const slugField = () =>
  z
    .string()
    .trim()
    .min(1, "Informe o endereço (slug).")
    .max(120)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use só letras minúsculas, números e hífens.");

export const faqList = () =>
  z
    .array(z.object({ question: z.string().trim().max(200), answer: z.string().trim().max(2000) }))
    .max(30)
    .default([])
    .transform((items) => items.filter((item) => item.question && item.answer));

/** Data em um campo datetime-local, no fuso de São Paulo. */
export function toDateTimeInput(date: Date | null | undefined): string {
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
  return parts.replace(" ", "T");
}

export function toDateInput(date: Date | null | undefined): string {
  return toDateTimeInput(date).slice(0, 10);
}
