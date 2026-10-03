import { db } from "@/lib/db";
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
  // TODO(integracao): registrar aqui o provider do gateway real (ver docs/INTEGRACOES.md).
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
