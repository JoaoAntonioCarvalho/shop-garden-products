"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientIpHash } from "@/lib/ip";
import { rateLimit, rateLimitMessage } from "@/server/services/rate-limit";

export type FormResult = { ok: true; message: string } | { ok: false; error: string };

const backInStockSchema = z.object({
  email: z.email("Digite um e-mail válido, como nome@exemplo.com."),
  productId: z.string().min(1),
  variantId: z.string().min(1),
  /** Honeypot: humanos deixam vazio. */
  website: z.string().max(0).optional(),
});

/** "Avise-me quando chegar": registra o interesse no produto esgotado. */
export async function requestBackInStock(
  input: z.input<typeof backInStockSchema>,
): Promise<FormResult> {
  const parsed = backInStockSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Confira os dados e tente de novo.",
    };
  }
  const ipHash = clientIpHash(await headers());
  const limit = await rateLimit("publicForm", ipHash);
  if (!limit.allowed) return { ok: false, error: rateLimitMessage(limit) };

  const { productId, variantId } = parsed.data;
  const email = parsed.data.email.toLowerCase();
  const variant = await db.productVariant.findFirst({
    where: { id: variantId, productId, isActive: true },
    select: { id: true },
  });
  if (!variant) return { ok: false, error: "Este produto não está mais disponível." };

  const existing = await db.lead.findFirst({
    where: { email, variantId, source: "BACK_IN_STOCK", notifiedAt: null },
    select: { id: true },
  });
  if (!existing) {
    await db.lead.create({
      data: {
        email,
        source: "BACK_IN_STOCK",
        productId,
        variantId,
        ipHash,
        // Aviso pontual sobre um produto pedido pela própria pessoa: não é consentimento de marketing.
        consentText: "Quero ser avisado por e-mail quando este produto voltar ao estoque.",
        consentAt: new Date(),
      },
    });
  }
  return { ok: true, message: "Pronto. Avisamos por e-mail assim que o produto chegar." };
}
