import { addDaysToKey, zonedParts } from "@/lib/dates";

export const PERIOD_PRESETS = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "mes", label: "Mês atual" },
  { value: "mes-anterior", label: "Mês anterior" },
  { value: "personalizado", label: "Personalizado" },
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number]["value"];

export type Period = {
  preset: PeriodPreset;
  /** Datas no fuso de São Paulo, AAAA-MM-DD, inclusivas. */
  fromKey: string;
  toKey: string;
  from: Date;
  to: Date;
  /** Período anterior equivalente (mesma duração, imediatamente antes). */
  previousFrom: Date;
  previousTo: Date;
  days: number;
  label: string;
};

const startOf = (key: string) => new Date(`${key}T00:00:00-03:00`);
const endOf = (key: string) => new Date(`${key}T23:59:59.999-03:00`);
const isKey = (value?: string | null): value is string =>
  Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((startOf(toKey).getTime() - startOf(fromKey).getTime()) / 86_400_000) + 1;
}

/** Resolve o período escolhido e o período anterior equivalente, para a comparação em %. */
export function resolvePeriod(
  input: { periodo?: string; de?: string; ate?: string },
  now: Date = new Date(),
): Period {
  const today = zonedParts(now).dateKey;
  const preset = (
    PERIOD_PRESETS.some((item) => item.value === input.periodo) ? input.periodo : "30d"
  ) as PeriodPreset;
  let fromKey = today;
  let toKey = today;

  switch (preset) {
    case "ontem":
      fromKey = toKey = addDaysToKey(today, -1);
      break;
    case "7d":
      fromKey = addDaysToKey(today, -6);
      break;
    case "30d":
      fromKey = addDaysToKey(today, -29);
      break;
    case "mes":
      fromKey = `${today.slice(0, 8)}01`;
      break;
    case "mes-anterior": {
      const firstOfThis = `${today.slice(0, 8)}01`;
      toKey = addDaysToKey(firstOfThis, -1);
      fromKey = `${toKey.slice(0, 8)}01`;
      break;
    }
    case "personalizado":
      if (isKey(input.de) && isKey(input.ate) && input.de <= input.ate) {
        fromKey = input.de;
        toKey = input.ate;
      } else {
        fromKey = addDaysToKey(today, -29);
      }
      break;
  }

  const days = daysBetween(fromKey, toKey);
  const previousToKey = addDaysToKey(fromKey, -1);
  const previousFromKey = addDaysToKey(previousToKey, -(days - 1));
  const format = (key: string) => key.split("-").reverse().join("/");
  return {
    preset,
    fromKey,
    toKey,
    from: startOf(fromKey),
    to: endOf(toKey),
    previousFrom: startOf(previousFromKey),
    previousTo: endOf(previousToKey),
    days,
    label: fromKey === toKey ? format(fromKey) : `${format(fromKey)} a ${format(toKey)}`,
  };
}

/** Variação em % em relação ao período anterior. Null quando não há base de comparação. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
