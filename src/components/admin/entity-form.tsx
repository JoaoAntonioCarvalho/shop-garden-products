"use client";

import { Plus, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { BannerPreview } from "@/components/admin/banner-preview";
import { MediaField, type PickedImage } from "@/components/admin/media-picker";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Textarea } from "@/components/admin/ui/textarea";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { AdminResult } from "@/server/admin/action";

// O editor (Tiptap) só é baixado nas telas que têm um campo de texto rico.
const RichTextEditor = dynamic(() => import("@/components/admin/rich-text-editor"), {
  ssr: false,
  loading: () => <div className="h-48 rounded-md border border-input bg-background" />,
});

export type FieldOption = { value: string; label: string };

export type FieldDef = {
  name: string;
  label: string;
  type:
    | "text"
    | "email"
    | "textarea"
    | "number"
    | "money"
    | "select"
    | "checkbox"
    | "date"
    | "datetime"
    | "richtext"
    | "image"
    | "tags"
    | "checklist"
    | "faq";
  options?: FieldOption[];
  help?: string;
  placeholder?: string;
  maxLength?: number;
  /** Mostra o contador de caracteres. */
  counter?: boolean;
  rows?: number;
  /** Ocupa a linha inteira. */
  wide?: boolean;
  /** Título do cartão em que o campo aparece. */
  section?: string;
  disabled?: boolean;
  /** Só aparece quando outro campo tem um destes valores. */
  showIf?: { field: string; in: string[] };
};

export type FormValues = Record<string, unknown>;
type FaqEntry = { question: string; answer: string };

export const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60";

/** Um campo do formulário, pelo tipo. */
export function FieldControl({
  field,
  value,
  onChange,
  error,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}) {
  const id = `campo-${field.name}`;
  const describedBy =
    [error ? `${id}-erro` : null, field.help ? `${id}-ajuda` : null].filter(Boolean).join(" ") ||
    undefined;
  const common = {
    id,
    disabled: field.disabled,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  } as const;
  const text = typeof value === "string" || typeof value === "number" ? String(value) : "";
  let control: ReactNode;

  if (field.type === "checkbox") {
    return (
      <div className={cn("flex flex-col gap-1", field.wide && "md:col-span-2")}>
        <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="control-check size-4"
            checked={value === true}
            disabled={field.disabled}
            onChange={(event) => onChange(event.target.checked)}
            aria-describedby={describedBy}
          />
          {field.label}
        </label>
        {field.help ? (
          <p id={`${id}-ajuda`} className="text-xs text-muted-foreground">
            {field.help}
          </p>
        ) : null}
      </div>
    );
  }

  if (field.type === "textarea")
    control = (
      <Textarea
        {...common}
        rows={field.rows ?? 3}
        maxLength={field.maxLength}
        placeholder={field.placeholder}
        value={text}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  else if (field.type === "select")
    control = (
      <select
        {...common}
        value={text}
        onChange={(event) => onChange(event.target.value)}
        className={selectClass}
      >
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  else if (field.type === "richtext")
    control = <RichTextEditor id={id} value={text} onChange={onChange} disabled={field.disabled} />;
  else if (field.type === "image")
    control = (
      <MediaField
        value={(value as PickedImage) ?? null}
        onChange={onChange}
        disabled={field.disabled}
      />
    );
  else if (field.type === "checklist") {
    const selected = new Set(Array.isArray(value) ? (value as string[]) : []);
    control = (
      <div className="grid max-h-56 gap-x-4 overflow-y-auto rounded-md border border-input p-2 sm:grid-cols-2">
        {field.options?.map((option) => (
          <label
            key={option.value}
            className="flex min-h-8 cursor-pointer items-center gap-2 text-sm"
          >
            <input
              type="checkbox"
              className="control-check size-4"
              disabled={field.disabled}
              checked={selected.has(option.value)}
              onChange={(event) => {
                const next = new Set(selected);
                if (event.target.checked) next.add(option.value);
                else next.delete(option.value);
                onChange([...next]);
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    );
  } else if (field.type === "faq") {
    const entries = Array.isArray(value) ? (value as FaqEntry[]) : [];
    const update = (index: number, changes: Partial<FaqEntry>) =>
      onChange(entries.map((entry, i) => (i === index ? { ...entry, ...changes } : entry)));
    control = (
      <div className="flex flex-col gap-3">
        {entries.map((entry, index) => (
          <div key={index} className="flex gap-2 rounded-md border border-border p-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <Input
                aria-label={`Pergunta ${index + 1}`}
                placeholder="Pergunta"
                value={entry.question}
                disabled={field.disabled}
                onChange={(event) => update(index, { question: event.target.value })}
              />
              <Textarea
                aria-label={`Resposta ${index + 1}`}
                placeholder="Resposta"
                rows={2}
                value={entry.answer}
                disabled={field.disabled}
                onChange={(event) => update(index, { answer: event.target.value })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remover pergunta ${index + 1}`}
              disabled={field.disabled}
              onClick={() => onChange(entries.filter((_, i) => i !== index))}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={field.disabled}
          onClick={() => onChange([...entries, { question: "", answer: "" }])}
        >
          <Plus aria-hidden="true" />
          Adicionar pergunta
        </Button>
      </div>
    );
  } else {
    const type =
      field.type === "number"
        ? "number"
        : field.type === "date"
          ? "date"
          : field.type === "datetime"
            ? "datetime-local"
            : field.type === "email"
              ? "email"
              : "text";
    control = (
      <Input
        {...common}
        type={type}
        inputMode={field.type === "money" ? "decimal" : undefined}
        maxLength={field.maxLength}
        placeholder={
          field.placeholder ?? (field.type === "tags" ? "Separe com vírgulas" : undefined)
        }
        value={Array.isArray(value) ? (value as string[]).join(", ") : text}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        (field.wide || ["richtext", "faq", "checklist"].includes(field.type)) && "md:col-span-2",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{field.label}</Label>
        {field.counter && field.maxLength ? (
          <span
            className={cn(
              "text-xs text-muted-foreground tabular-nums",
              text.length > field.maxLength && "text-destructive",
            )}
          >
            {text.length}/{field.maxLength}
          </span>
        ) : null}
      </div>
      {control}
      {field.help ? (
        <p id={`${id}-ajuda`} className="text-xs text-muted-foreground">
          {field.help}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-erro`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Troca a imagem escolhida pelo id dela, que é o que o servidor recebe. */
export function serializeValues(fields: FieldDef[], values: FormValues): FormValues {
  const output: FormValues = { ...values };
  for (const field of fields) {
    if (field.type === "image")
      output[field.name] = (values[field.name] as PickedImage)?.id ?? null;
  }
  return output;
}

/** Prévia de como a página aparece no Google. */
export function SeoPreview({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  url: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">Prévia no Google</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{url}</p>
      <p className="truncate text-base text-primary">{title || "Título da página"}</p>
      <p className="line-clamp-2 text-sm text-muted-foreground">
        {description || "A descrição aparece aqui."}
      </p>
    </div>
  );
}

/** Avisa antes de sair da página com alterações não salvas. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}

type EntityFormProps = {
  fields: FieldDef[];
  initial: FormValues;
  action: (values: FormValues) => Promise<AdminResult<{ redirect?: string } | undefined>>;
  submitLabel?: string;
  /** Prévia do Google com os campos seoTitle e seoDescription (ou os nomes informados). */
  seo?: {
    url: string;
    titleField?: string;
    descriptionField?: string;
    fallbackTitleField?: string;
  };
  /** Texto calculado no servidor a partir dos valores (por exemplo, a prévia do cupom). */
  describe?: (values: FormValues) => Promise<string>;
  /** Prévia ao vivo desenhada com os valores digitados. */
  preview?: "banner";
  children?: ReactNode;
};

/** Formulário genérico do painel: campos por definição, erros por campo, aviso de alterações não salvas. */
export function EntityForm({
  fields,
  initial,
  action,
  submitLabel = "Salvar",
  seo,
  describe,
  preview,
  children,
}: EntityFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(initial);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useUnsavedWarning(dirty);

  const signature = describe ? JSON.stringify(values) : "";
  useEffect(() => {
    if (!describe) return;
    const timer = setTimeout(
      async () =>
        setDescription(
          await describe(serializeValues(fields, JSON.parse(signature) as FormValues)),
        ),
      300,
    );
    return () => clearTimeout(timer);
    // A assinatura resume os valores; fields e describe não mudam entre renderizações.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const visible = fields.filter(
    (field) => !field.showIf || field.showIf.in.includes(String(values[field.showIf.field] ?? "")),
  );
  const sections = [...new Set(visible.map((field) => field.section ?? ""))];

  function submit() {
    startTransition(async () => {
      const result = await action(serializeValues(fields, values));
      if (result.ok) {
        setErrors({});
        setFormError(null);
        setDirty(false);
        toast(result.message);
        if (result.data?.redirect) router.push(result.data.redirect);
        else router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.error);
        window.scrollTo({ top: 0 });
      }
    });
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-4"
    >
      {formError ? (
        <div
          role="alert"
          className="rounded-md border border-destructive bg-wine-50 p-3 text-sm text-destructive"
        >
          {formError}
        </div>
      ) : null}
      {sections.map((section) => (
        <Card key={section || "geral"}>
          {section ? (
            <CardHeader>
              <CardTitle className="text-base">{section}</CardTitle>
            </CardHeader>
          ) : null}
          <CardContent className={cn("grid gap-4 md:grid-cols-2", !section && "pt-6")}>
            {visible
              .filter((field) => (field.section ?? "") === section)
              .map((field) => (
                <FieldControl
                  key={field.name}
                  field={field}
                  value={values[field.name]}
                  error={errors[field.name]}
                  onChange={(value) => {
                    setValues((current) => ({ ...current, [field.name]: value }));
                    setDirty(true);
                  }}
                />
              ))}
          </CardContent>
        </Card>
      ))}
      {description ? (
        <p
          aria-live="polite"
          className="rounded-md border border-border bg-accent p-3 text-sm text-accent-foreground"
        >
          {description}
        </p>
      ) : null}
      {seo ? (
        <SeoPreview
          url={seo.url}
          title={String(
            values[seo.titleField ?? "seoTitle"] || values[seo.fallbackTitleField ?? "name"] || "",
          )}
          description={String(values[seo.descriptionField ?? "seoDescription"] ?? "")}
        />
      ) : null}
      {preview === "banner" ? <BannerPreview values={values} /> : null}
      {children}
      <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-background px-4 py-3 print:hidden">
        {dirty ? (
          <span className="text-sm text-muted-foreground">Alterações não salvas</span>
        ) : null}
        <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

type MiniFormProps = {
  fields: FieldDef[];
  initial: FormValues;
  action: (values: FormValues) => Promise<AdminResult<unknown>>;
  submitLabel: string;
  /** Limpa os campos depois de enviar (notas, respostas). */
  resetOnDone?: boolean;
  variant?: "default" | "outline" | "destructive";
};

/** Formulário pequeno, dentro de um cartão ou de uma linha: nota interna, resposta, status. */
export function MiniForm({
  fields,
  initial,
  action,
  submitLabel,
  resetOnDone,
  variant = "outline",
}: MiniFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      noValidate
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await action(serializeValues(fields, values));
          if (result.ok) {
            toast(result.message);
            setErrors({});
            setFormError(null);
            if (resetOnDone) setValues(initial);
            router.refresh();
          } else {
            setErrors(result.fieldErrors ?? {});
            setFormError(result.fieldErrors ? null : result.error);
          }
        });
      }}
    >
      {fields.map((field) => (
        <FieldControl
          key={field.name}
          field={field}
          value={values[field.name]}
          error={errors[field.name]}
          onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))}
        />
      ))}
      {formError ? (
        <p role="alert" className="text-sm text-destructive md:col-span-2">
          {formError}
        </p>
      ) : null}
      <div className="md:col-span-2">
        <Button
          type="submit"
          size="sm"
          variant={variant}
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
