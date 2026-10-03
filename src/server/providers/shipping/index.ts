import { db } from "@/lib/db";
import { getStoreSettings } from "@/server/services/settings";
import { MockShippingProvider, type ShippingRuleData } from "./mock";
import type { ShippingProvider } from "./types";

export async function loadShippingRules(): Promise<ShippingRuleData[]> {
  return db.shippingRule.findMany({ orderBy: { position: "asc" } });
}

let instance: ShippingProvider | undefined;

/** Provider de frete ativo, escolhido por SHIPPING_PROVIDER. */
export function getShippingProvider(): ShippingProvider {
  if (instance) return instance;
  // TODO(integracao): plugar aqui a cotação real (Melhor Envio, Correios), implementando ShippingProvider.
  instance = new MockShippingProvider(async () => ({
    rules: await loadShippingRules(),
    settings: await getStoreSettings(),
  }));
  return instance;
}
