import "server-only";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { sendEmail } from "@/server/services/emails";

/**
 * "Avise-me": quando o produto volta a ter estoque, envia o e-mail "Chegou" a quem pediu e marca
 * o aviso como enviado, para ninguém receber duas vezes. Devolve quantos avisos saíram.
 */
export async function notifyBackInStock(productId: string): Promise<number> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { name: true, slug: true, status: true, totalAvailable: true },
  });
  if (!product || product.status !== "ACTIVE" || product.totalAvailable <= 0) return 0;
  const leads = await db.lead.findMany({
    where: { productId, source: "BACK_IN_STOCK", notifiedAt: null, unsubscribedAt: null },
    take: 500,
  });
  let sent = 0;
  for (const lead of leads) {
    const ok = await sendEmail(lead.email, "back-in-stock", {
      productName: product.name,
      productUrl: `${getEnv().APP_URL}/produto/${product.slug}?utm_source=email&utm_medium=avise-me`,
    });
    if (ok) {
      await db.lead.update({ where: { id: lead.id }, data: { notifiedAt: new Date() } });
      sent++;
    }
  }
  return sent;
}
