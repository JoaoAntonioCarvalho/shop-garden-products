import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getStoreSettings } from "@/server/services/settings";
import { CarrierShippingProvider, type ItemShipmentInfo } from "./carriers/provider";
import type { Carrier } from "./carriers/types";
import { CorreiosCarrier } from "./correios/carrier";
import { CorreiosClient } from "./correios/client";
import { JadlogClient } from "./jadlog/client";
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
let jadlogClient: JadlogClient | null | undefined;

/** Cliente dos Correios quando SHIPPING_PROVIDER inclui "correios"; senão, null. Usado no frete e no rastreio. */
export function getCorreiosClient(): CorreiosClient | null {
  if (correiosClient !== undefined) return correiosClient;
  const env = getEnv();
  correiosClient = env.SHIPPING_PROVIDER.includes("correios")
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

/** Cliente da Jadlog quando SHIPPING_PROVIDER inclui "jadlog"; senão, null. Usado no frete e no rastreio. */
export function getJadlogClient(): JadlogClient | null {
  if (jadlogClient !== undefined) return jadlogClient;
  const env = getEnv();
  jadlogClient = env.SHIPPING_PROVIDER.includes("jadlog")
    ? new JadlogClient({
        baseUrl: env.JADLOG_BASE_URL,
        trackingUrl: env.JADLOG_TRACKING_URL,
        token: env.JADLOG_TOKEN ?? "",
        cnpj: (env.JADLOG_CNPJ ?? "").replace(/\D/g, ""),
        account: env.JADLOG_ACCOUNT,
        contract: env.JADLOG_CONTRACT,
        modalities: {
          economy: env.JADLOG_MODALITY_ECONOMY,
          express: env.JADLOG_MODALITY_EXPRESS,
        },
      })
    : null;
  return jadlogClient;
}

/** Medidas e restrição de transportadora do produto de cada variação. */
async function loadItemInfo(variantIds: string[]): Promise<Map<string, ItemShipmentInfo>> {
  const variants = await db.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      product: {
        select: { widthCm: true, depthCm: true, heightCm: true, carrierRestriction: true },
      },
    },
  });
  return new Map(
    variants.map(({ id, product: { carrierRestriction, ...dimensions } }) => [
      id,
      { dimensions, jadlogOnly: carrierRestriction === "JADLOG_ONLY" },
    ]),
  );
}

let instance: ShippingProvider | undefined;

/** Provider de frete ativo, escolhido por SHIPPING_PROVIDER. */
export function getShippingProvider(): ShippingProvider {
  if (instance) return instance;
  const env = getEnv();
  const correios = getCorreiosClient();
  const jadlog = getJadlogClient();
  const carriers: Carrier[] = [
    ...(correios
      ? [
          new CorreiosCarrier(correios, {
            economy: env.CORREIOS_SERVICE_ECONOMY,
            express: env.CORREIOS_SERVICE_EXPRESS,
          }),
        ]
      : []),
    ...(jadlog ? [jadlog] : []),
  ];
  instance =
    carriers.length > 0
      ? new CarrierShippingProvider({
          carriers,
          load: loadRulesAndSettings,
          loadItemInfo,
          originCep: (env.SHIPPING_ORIGIN_CEP ?? "").replace(/\D/g, ""),
          handlingDays: env.SHIPPING_HANDLING_DAYS,
        })
      : new MockShippingProvider(loadRulesAndSettings);
  return instance;
}
