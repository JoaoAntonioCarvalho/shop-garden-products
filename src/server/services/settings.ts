import "server-only";
import { unstable_cache } from "next/cache";
import { storeConfig, type StoreSettings } from "@/config/store.config";
import { db } from "@/lib/db";

export const SETTINGS_TAG = "settings";

/** Chaves que o admin pode sobrescrever pela tela de Configurações. */
export const EDITABLE_SETTING_KEYS = Object.keys(storeConfig).filter(
  (key) => key !== "holidays",
) as Array<keyof StoreSettings>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Mescla o que está salvo no banco sobre o padrão do arquivo, preservando chaves não salvas. */
export function mergeSettings(
  defaults: StoreSettings,
  overrides: Array<{ key: string; value: unknown }>,
  holidays: string[],
): StoreSettings {
  const merged: Record<string, unknown> = { ...defaults };
  for (const { key, value } of overrides) {
    if (!(key in defaults) || value === null || value === undefined) continue;
    const current = merged[key];
    merged[key] = isPlainObject(current) && isPlainObject(value) ? { ...current, ...value } : value;
  }

  const result = merged as StoreSettings;
  // IDs de analytics também podem vir do ambiente; o que está no admin tem prioridade.
  result.analytics = {
    ga4Id: result.analytics.ga4Id || process.env.NEXT_PUBLIC_GA4_ID || "",
    metaPixelId: result.analytics.metaPixelId || process.env.NEXT_PUBLIC_META_PIXEL_ID || "",
  };
  result.holidays = holidays;
  return result;
}

const loadSettings = unstable_cache(
  async (): Promise<StoreSettings> => {
    const [rows, holidays] = await Promise.all([
      db.storeSetting.findMany({ select: { key: true, value: true } }),
      db.holiday.findMany({ select: { date: true }, orderBy: { date: "asc" } }),
    ]);
    return mergeSettings(
      storeConfig,
      rows,
      holidays.map((holiday) => holiday.date.toISOString().slice(0, 10)),
    );
  },
  ["store-settings"],
  { tags: [SETTINGS_TAG] },
);

/**
 * Configuração da loja: o padrão de src/config/store.config.ts mesclado com o que o admin salvou
 * (tabela StoreSetting) e com os feriados (tabela Holiday). Fica em cache até o admin salvar,
 * quando a tag "settings" é invalidada.
 */
export async function getStoreSettings(): Promise<StoreSettings> {
  return loadSettings();
}
