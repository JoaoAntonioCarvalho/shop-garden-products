import "server-only";
import Link from "next/link";
import { z } from "zod";
import { RedirectTools } from "@/components/admin/redirect-tools";
import { ShippingSimulator } from "@/components/admin/shipping-simulator";
import type { Prisma } from "@/generated/prisma/client";
import { formatDateOnly } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatBRL, formatCentsPlain } from "@/lib/money";
import { normalizeRedirectInput } from "@/lib/redirects";
import { formatCep, normalizeCep } from "@/lib/validators/cep";
import {
  bool,
  int,
  money,
  optionalMoney,
  optionalText,
  requiredText,
  toDateInput,
} from "../fields";
import { assertRedirectIsSafe } from "../redirect-rules";
import { defineResource } from "../resource";
import { dateCell, muted, yesNoBadge } from "./shared";

// ───────────────────────── Regras de frete ─────────────────────────

type RuleRecord = Prisma.ShippingRuleGetPayload<object>;

export const shippingMethodLabels: Record<string, string> = {
  SAME_DAY: "Entrega hoje",
  LOCAL_SCHEDULED: "Entrega agendada",
  NATIONAL_ECONOMY: "Envio econômico",
  NATIONAL_EXPRESS: "Envio expresso",
  PICKUP: "Retirada",
};
const weekdayOptions = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"].map(
  (label, index) => ({ value: String(index), label }),
);

const cepField = (label: string) =>
  z
    .string()
    .transform((value) => normalizeCep(value) ?? "")
    .pipe(z.string().length(8, `Informe ${label} com 8 dígitos.`));

const ruleSchema = z
  .object({
    name: requiredText("o nome", 80),
    code: z
      .string()
      .trim()
      .toLowerCase()
      .min(2, "Informe o código.")
      .max(60)
      .regex(/^[a-z0-9-]+$/, "Use só letras minúsculas, números e hífens."),
    method: z.enum([
      "SAME_DAY",
      "LOCAL_SCHEDULED",
      "NATIONAL_ECONOMY",
      "NATIONAL_EXPRESS",
      "PICKUP",
    ]),
    cepStart: cepField("o CEP inicial"),
    cepEnd: cepField("o CEP final"),
    baseFeeCents: money("a taxa base"),
    feePerKgCents: money("o valor por quilo"),
    freeAboveCents: optionalMoney(),
    usesStoreFreeThreshold: bool(),
    minDays: int("o prazo mínimo", 0, 90),
    maxDays: int("o prazo máximo", 0, 90),
    cutoffTime: z.preprocess(
      (value) => (value === "" || value == null ? null : value),
      z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:MM.")
        .nullable(),
    ),
    weekdays: z
      .array(z.coerce.number().int().min(0).max(6))
      .min(1, "Escolha pelo menos um dia da semana."),
    allowsLocalOnlyProducts: bool(),
    description: optionalText(200),
    isActive: bool(),
  })
  .superRefine((data, context) => {
    if (data.cepEnd < data.cepStart)
      context.addIssue({
        code: "custom",
        path: ["cepEnd"],
        message: "O CEP final precisa ser maior que o inicial.",
      });
    if (data.maxDays < data.minDays)
      context.addIssue({
        code: "custom",
        path: ["maxDays"],
        message: "O prazo máximo precisa ser maior ou igual ao mínimo.",
      });
  });

export const shippingRuleResource = defineResource<RuleRecord>({
  key: "frete",
  singular: "Regra de frete",
  plural: "Frete e entrega",
  feminine: true,
  description:
    "Cada regra vale para uma faixa de CEP. O valor do frete grátis da loja e o horário de corte padrão ficam em Configurações.",
  permission: "shipping.manage",
  model: "shippingRule",
  entityType: "ShippingRule",
  tags: ["settings"],
  nameOf: (rule) => rule.name,
  list: {
    columns: [
      { key: "name", header: "Regra" },
      { key: "range", header: "Faixa de CEP" },
      { key: "price", header: "Valor" },
      { key: "days", header: "Prazo" },
    ],
    orderBy: { position: "asc" },
    reorder: true,
    row: (rule) => ({
      name: (
        <>
          {rule.name}
          <span className="block text-xs font-normal text-muted-foreground">
            {shippingMethodLabels[rule.method]}
          </span>
        </>
      ),
      range: `${formatCep(rule.cepStart)} a ${formatCep(rule.cepEnd)}`,
      price: `${formatBRL(rule.baseFeeCents)}${rule.feePerKgCents ? ` + ${formatBRL(rule.feePerKgCents)} por kg` : ""}${rule.usesStoreFreeThreshold ? ", grátis acima do valor da loja" : rule.freeAboveCents ? `, grátis acima de ${formatBRL(rule.freeAboveCents)}` : ""}`,
      days:
        rule.method === "SAME_DAY"
          ? `No dia, pedidos até ${rule.cutoffTime ?? "o corte da loja"}`
          : rule.maxDays === 0
            ? "No dia"
            : `${rule.minDays} a ${rule.maxDays} dias úteis`,
    }),
    above: async () => {
      const holidays = await db.holiday.findMany({
        where: { date: { gte: new Date(Date.now() - 86_400_000) } },
        orderBy: { date: "asc" },
        take: 4,
      });
      return (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <ShippingSimulator />
          <div className="rounded-md border border-border bg-background p-4 text-sm">
            <p className="font-medium">Feriados</p>
            <p className="mt-1 text-muted-foreground">
              Nos feriados não há entrega local, e eles não contam como dia útil nos prazos.
            </p>
            <ul className="mt-2">
              {holidays.map((holiday) => (
                <li key={holiday.id}>
                  {formatDateOnly(holiday.date)}: {holiday.name}
                </li>
              ))}
            </ul>
            <Link
              href="/admin/feriados"
              className="mt-2 inline-flex min-h-8 items-center text-primary underline underline-offset-2"
            >
              Gerenciar feriados
            </Link>
          </div>
        </div>
      );
    },
  },
  form: {
    schema: ruleSchema,
    fields: () => [
      { name: "name", label: "Nome mostrado ao cliente", type: "text" },
      {
        name: "code",
        label: "Código",
        type: "text",
        help: "Identificador interno, por exemplo: agendada-capital.",
      },
      {
        name: "method",
        label: "Tipo de entrega",
        type: "select",
        options: Object.entries(shippingMethodLabels).map(([value, label]) => ({ value, label })),
      },
      { name: "description", label: "Descrição", type: "text" },
      { name: "cepStart", label: "CEP inicial", type: "text", section: "Onde vale" },
      { name: "cepEnd", label: "CEP final", type: "text", section: "Onde vale" },
      {
        name: "allowsLocalOnlyProducts",
        label: "Aceita produtos entregues só na Grande São Paulo",
        type: "checkbox",
        section: "Onde vale",
        wide: true,
      },
      { name: "baseFeeCents", label: "Taxa base (R$)", type: "money", section: "Valor" },
      { name: "feePerKgCents", label: "Valor por quilo (R$)", type: "money", section: "Valor" },
      { name: "freeAboveCents", label: "Grátis acima de (R$)", type: "money", section: "Valor" },
      {
        name: "usesStoreFreeThreshold",
        label: "Usar o valor de frete grátis da loja",
        type: "checkbox",
        section: "Valor",
      },
      { name: "minDays", label: "Prazo mínimo (dias úteis)", type: "number", section: "Prazo" },
      { name: "maxDays", label: "Prazo máximo (dias úteis)", type: "number", section: "Prazo" },
      {
        name: "cutoffTime",
        label: "Horário de corte (HH:MM)",
        type: "text",
        section: "Prazo",
        help: "Vazio usa o horário de corte das configurações.",
      },
      {
        name: "weekdays",
        label: "Dias de entrega",
        type: "checklist",
        options: weekdayOptions,
        section: "Prazo",
      },
      { name: "isActive", label: "Ativa", type: "checkbox", section: "Prazo" },
    ],
    toForm: (rule) => ({
      name: rule?.name ?? "",
      code: rule?.code ?? "",
      method: rule?.method ?? "LOCAL_SCHEDULED",
      description: rule?.description ?? "",
      cepStart: rule ? formatCep(rule.cepStart) : "",
      cepEnd: rule ? formatCep(rule.cepEnd) : "",
      allowsLocalOnlyProducts: rule?.allowsLocalOnlyProducts ?? false,
      baseFeeCents: formatCentsPlain(rule?.baseFeeCents ?? 0),
      feePerKgCents: formatCentsPlain(rule?.feePerKgCents ?? 0),
      freeAboveCents: rule?.freeAboveCents != null ? formatCentsPlain(rule.freeAboveCents) : "",
      usesStoreFreeThreshold: rule?.usesStoreFreeThreshold ?? false,
      minDays: rule?.minDays ?? 0,
      maxDays: rule?.maxDays ?? 0,
      cutoffTime: rule?.cutoffTime ?? "",
      weekdays: (rule?.weekdays ?? [1, 2, 3, 4, 5, 6]).map(String),
      isActive: rule?.isActive ?? true,
    }),
  },
  toggles: [{ field: "isActive", label: "Ativa" }],
});

// ───────────────────────── Feriados ─────────────────────────

type HolidayRecord = Prisma.HolidayGetPayload<object>;

export const holidayResource = defineResource<HolidayRecord>({
  key: "feriados",
  singular: "Feriado",
  plural: "Feriados",
  description:
    "Datas sem entrega local, que também não contam como dia útil nos prazos e no vencimento do boleto.",
  permission: "shipping.manage",
  model: "holiday",
  entityType: "Holiday",
  tags: ["settings"],
  nameOf: (holiday) => holiday.name,
  list: {
    columns: [
      { key: "name", header: "Feriado" },
      { key: "date", header: "Data" },
    ],
    orderBy: { date: "asc" },
    sortable: ["date", "name"],
    row: (holiday) => ({ name: holiday.name, date: formatDateOnly(holiday.date) }),
  },
  form: {
    schema: z.object({
      name: requiredText("o nome do feriado", 80),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data.")
        .transform((value) => new Date(`${value}T00:00:00.000Z`)),
    }),
    fields: () => [
      { name: "name", label: "Nome", type: "text" },
      { name: "date", label: "Data", type: "date" },
    ],
    toForm: (holiday) => ({
      name: holiday?.name ?? "",
      date: holiday ? holiday.date.toISOString().slice(0, 10) : toDateInput(new Date()),
    }),
  },
});

// ───────────────────────── Redirecionamentos ─────────────────────────

type RedirectRecord = Prisma.RedirectGetPayload<object>;

const redirectSchema = z.object({
  fromPath: z
    .string()
    .trim()
    .min(1, "Informe o endereço antigo.")
    .max(500)
    .transform(normalizeRedirectInput),
  toPath: z
    .string()
    .trim()
    .min(1, "Informe o destino.")
    .max(500)
    .regex(/^(\/|https:\/\/)/, "O destino começa com / ou https://."),
  statusCode: z.coerce.number().refine((code) => code === 301 || code === 302, "Use 301 ou 302."),
  isActive: bool(),
  note: optionalText(200),
});

export const redirectResource = defineResource<RedirectRecord>({
  key: "redirecionamentos",
  singular: "Redirecionamento",
  plural: "Redirecionamentos",
  description:
    "Endereços do site antigo e de produtos renomeados, que respondem com 301 para o endereço novo.",
  permission: "redirects.manage",
  model: "redirect",
  entityType: "Redirect",
  tags: [],
  nameOf: (redirect) => redirect.fromPath,
  list: {
    columns: [
      { key: "fromPath", header: "Origem" },
      { key: "toPath", header: "Destino" },
      { key: "statusCode", header: "Código" },
      { key: "hits", header: "Acessos", align: "right" },
      { key: "lastHitAt", header: "Último acesso" },
    ],
    orderBy: { createdAt: "desc" },
    sortable: ["fromPath", "hits", "lastHitAt"],
    searchPlaceholder: "Origem ou destino",
    exportKey: "redirecionamentos",
    where: (params) =>
      params.q
        ? {
            OR: [
              { fromPath: { contains: params.q.toLowerCase() } },
              { toPath: { contains: params.q.toLowerCase() } },
            ],
          }
        : {},
    row: (redirect) => ({
      fromPath: <span className="break-all">{redirect.fromPath}</span>,
      toPath: <span className="break-all text-muted-foreground">{redirect.toPath}</span>,
      statusCode: redirect.isActive ? redirect.statusCode : yesNoBadge(false),
      hits: redirect.hits,
      lastHitAt: redirect.lastHitAt ? dateCell(redirect.lastHitAt) : muted("Nunca"),
    }),
    above: () => <RedirectTools />,
  },
  form: {
    schema: redirectSchema,
    fields: () => [
      {
        name: "fromPath",
        label: "Endereço antigo (origem)",
        type: "text",
        wide: true,
        help: "Pode colar a URL inteira: maiúsculas, barra final e parâmetros de sessão do site antigo são ignorados.",
      },
      {
        name: "toPath",
        label: "Destino",
        type: "text",
        wide: true,
        placeholder: "/categoria/vasos",
      },
      {
        name: "statusCode",
        label: "Código",
        type: "select",
        options: [
          { value: "301", label: "301, permanente" },
          { value: "302", label: "302, temporário" },
        ],
      },
      { name: "note", label: "Observação", type: "text" },
      { name: "isActive", label: "Ativo", type: "checkbox" },
    ],
    toForm: (redirect) => ({
      fromPath: redirect?.fromPath ?? "",
      toPath: redirect?.toPath ?? "",
      statusCode: String(redirect?.statusCode ?? 301),
      note: redirect?.note ?? "",
      isActive: redirect?.isActive ?? true,
    }),
    save: async (data: z.output<typeof redirectSchema>, _context, existing) => {
      if (data.isActive) await assertRedirectIsSafe(data.fromPath, data.toPath, existing?.id);
      const saved = existing
        ? await db.redirect.update({ where: { id: existing.id }, data })
        : await db.redirect.create({ data });
      // O endereço deixa de constar como página não encontrada.
      await db.notFoundLog.deleteMany({ where: { path: data.fromPath } });
      return saved;
    },
  },
  toggles: [{ field: "isActive", label: "Ativo" }],
});
