import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getStoreSettings } from "@/server/services/settings";
import { CorreiosClient } from "./correios/client";
import type { ItemDimensions } from "./correios/package";
import { CorreiosShippingProvider } from "./correios/provider";
import { MockShippingProvider, type ShippingRuleData } from "./mock";
import type { ShippingProvider } from "./types";

export async function loadShippingRules(): Promise<ShippingRuleData[]> {
  return db.shippingRule.findMany({ orderBy: { position: "asc" } });
}

const loadRulesAndSettings = async () => ({
  rules: await loadShippingRules(),
  settings: await getStoreSettings(),
});

let correiosClient: CorreiosClient | null | undefined;

/** Cliente dos Correios quando SHIPPING_PROVIDER=correios; senão, null. Usado no frete e no rastreio. */
export function getCorreiosClient(): CorreiosClient | null {
  if (correiosClient !== undefined) return correiosClient;
  const env = getEnv();
  correiosClient =
    env.SHIPPING_PROVIDER === "correios"
      ? new CorreiosClient({
          baseUrl: env.CORREIOS_BASE_URL,
          user: env.CORREIOS_USER ?? "",
          accessCode: env.CORREIOS_ACCESS_CODE ?? "",
          postingCard: env.CORREIOS_POSTING_CARD ?? "",
          contract: env.CORREIOS_CONTRACT,
          dr: env.CORREIOS_DR,
        })
      : null;
  return correiosClient;
}

/** Medidas do produto de cada variação, para estimar o pacote. */
async function loadDimensions(variantIds: string[]): Promise<Map<string, ItemDimensions>> {
  const variants = await db.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, product: { select: { widthCm: true, depthCm: true, heightCm: true } } },
  });
  return new Map(variants.map((variant) => [variant.id, variant.product]));
}

let instance: ShippingProvider | undefined;

/** Provider de frete ativo, escolhido por SHIPPING_PROVIDER. */
export function getShippingProvider(): ShippingProvider {
  if (instance) return instance;
  const env = getEnv();
  const client = getCorreiosClient();
  instance = client
    ? new CorreiosShippingProvider({
        client,
        load: loadRulesAndSettings,
        loadDimensions,
        options: {
          originCep: (env.CORREIOS_ORIGIN_CEP ?? "").replace(/\D/g, ""),
          services: {
            economy: env.CORREIOS_SERVICE_ECONOMY,
            express: env.CORREIOS_SERVICE_EXPRESS,
          },
          handlingDays: env.CORREIOS_HANDLING_DAYS,
        },
      })
    : new MockShippingProvider(loadRulesAndSettings);
  return instance;
}
