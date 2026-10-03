import { TIME_ZONE, type StoreSettings } from "@/config/store.config";

/**
 * Datas e horários da loja. Toda regra de horário de corte, dia de entrega e feriado usa o fuso
 * America/Sao_Paulo, independentemente do fuso do servidor ou do navegador.
 */

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

const weekdayIndex: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type ZonedParts = {
  /** AAAA-MM-DD no fuso da loja. */
  dateKey: string;
  hour: number;
  minute: number;
  /** 0 = domingo ... 6 = sábado. */
  weekday: number;
};

export function zonedParts(date: Date): ZonedParts {
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: weekdayIndex[parts.weekday],
  };
}

/** "AAAA-MM-DD" → Date ao meio-dia UTC, seguro para somar dias e formatar sem virar o dia. */
export function dateFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00Z`);
}

export function addDaysToKey(dateKey: string, days: number): string {
  const date = dateFromKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekdayOfKey(dateKey: string): number {
  return dateFromKey(dateKey).getUTCDay();
}

/** Dia útil para entrega: está nos dias da semana permitidos e não é feriado. */
export function isDeliveryDay(dateKey: string, weekdays: number[], holidays: string[]): boolean {
  return weekdays.includes(weekdayOfKey(dateKey)) && !holidays.includes(dateKey);
}

/** Próximas datas de entrega a partir de amanhã. */
export function nextDeliveryDates(
  now: Date,
  count: number,
  weekdays: number[],
  holidays: string[],
  startOffsetDays = 1,
): string[] {
  const dates: string[] = [];
  let cursor = addDaysToKey(zonedParts(now).dateKey, startOffsetDays);
  for (let guard = 0; dates.length < count && guard < 90; guard++) {
    if (isDeliveryDay(cursor, weekdays, holidays)) dates.push(cursor);
    cursor = addDaysToKey(cursor, 1);
  }
  return dates;
}

/** Soma dias úteis (segunda a sexta, fora feriados) a uma data. */
export function addBusinessDays(dateKey: string, days: number, holidays: string[]): string {
  let cursor = dateKey;
  let remaining = days;
  while (remaining > 0) {
    cursor = addDaysToKey(cursor, 1);
    if (isDeliveryDay(cursor, [1, 2, 3, 4, 5], holidays)) remaining--;
  }
  return cursor;
}

/** Dias úteis entre hoje e a data (0 se for hoje ou passado). */
export function businessDaysUntil(fromKey: string, toKey: string, holidays: string[]): number {
  let cursor = fromKey;
  let count = 0;
  while (cursor < toKey) {
    cursor = addDaysToKey(cursor, 1);
    if (isDeliveryDay(cursor, [1, 2, 3, 4, 5], holidays)) count++;
  }
  return count;
}

export type SameDayStatus = {
  /** Ainda dá para pedir agora e receber hoje. */
  open: boolean;
  /** Minutos até o horário de corte, quando aberto. */
  minutesLeft: number;
};

/** Entrega no mesmo dia: ligada, hoje é dia de entrega, não é feriado e ainda não passou do corte. */
export function getSameDayStatus(
  sameDay: Pick<StoreSettings["sameDay"], "enabled" | "cutoffTime" | "days">,
  holidays: string[],
  now: Date,
  cutoffOverride?: string | null,
): SameDayStatus {
  const closed = { open: false, minutesLeft: 0 };
  if (!sameDay.enabled) return closed;
  const parts = zonedParts(now);
  if (!isDeliveryDay(parts.dateKey, sameDay.days, holidays)) return closed;
  const [cutoffHour, cutoffMinute] = (cutoffOverride || sameDay.cutoffTime).split(":").map(Number);
  const minutesLeft = cutoffHour * 60 + cutoffMinute - (parts.hour * 60 + parts.minute);
  return minutesLeft > 0 ? { open: true, minutesLeft } : closed;
}

/** 134 → "2h14min"; 45 → "45min"; 120 → "2h" */
export function formatMinutesLeft(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}min`;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}min`;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const longFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});
const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** 03/10/2026 */
export const formatDate = (date: Date) => dateFormatter.format(date);
/** 03/10/2026, 14:05 */
export const formatDateTime = (date: Date) => dateTimeFormatter.format(date);
/** 3 de outubro de 2026 */
export const formatDateLong = (date: Date) => longFormatter.format(date);
/** "AAAA-MM-DD" → "sábado, 3 de outubro" */
export const formatDateKey = (dateKey: string) => weekdayFormatter.format(dateFromKey(dateKey));
/** Colunas @db.Date vêm do Prisma como meia-noite UTC: formata sem converter o fuso. */
export const formatDateOnly = (date: Date) => {
  const [year, month, day] = date.toISOString().slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};
