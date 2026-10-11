import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { CieloPaymentProvider } from "./cielo";
import { MockPaymentProvider } from "./mock";
import type { PaymentProvider } from "./types";

const providers: Record<string, () => PaymentProvider> = {
  mock: () =>
    new MockPaymentProvider(async (externalId) => {
      const payment = await db.payment.findUnique({
        where: { externalId },
        select: { status: true },
      });
      return payment?.status ?? null;
    }),
  cielo: () => {
    const env = getEnv();
    return new CieloPaymentProvider({
      environment: env.CIELO_ENV,
      merchantId: env.CIELO_MERCHANT_ID ?? "",
      merchantKey: env.CIELO_MERCHANT_KEY ?? "",
      clientId: env.CIELO_CLIENT_ID,
      clientSecret: env.CIELO_CLIENT_SECRET,
      webhookSecret: env.CIELO_WEBHOOK_SECRET,
      softDescriptor: env.CIELO_SOFT_DESCRIPTOR,
    });
  },
};

const instances = new Map<string, PaymentProvider>();

/** Provider de pagamento pelo nome. Sem nome, o ativo em PAYMENT_PROVIDER. */
export function getPaymentProvider(
  name: string = process.env.PAYMENT_PROVIDER || "mock",
): PaymentProvider | null {
  if (!providers[name]) return null;
  if (!instances.has(name)) instances.set(name, providers[name]());
  return instances.get(name)!;
}

export function activePaymentProvider(): PaymentProvider {
  const provider = getPaymentProvider();
  if (!provider) throw new Error(`PAYMENT_PROVIDER desconhecido: ${process.env.PAYMENT_PROVIDER}`);
  return provider;
}
