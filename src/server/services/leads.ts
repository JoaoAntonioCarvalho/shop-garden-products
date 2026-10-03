import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { LeadSource, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/seo/metadata";
import { sendEmail } from "./emails";
import { getStoreSettings } from "./settings";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const LEAD_COOKIE = "nsg_lead";

type SubscribeInput = {
  email: string;
  whatsapp?: string | null;
  name?: string | null;
  source: Extract<LeadSource, "POPUP" | "FOOTER" | "CHECKOUT" | "ACCOUNT">;
  /** Texto exato que a pessoa aceitou. */
  consentText: string;
  ipHash: string;
  utm?: Prisma.InputJsonValue | null;
};

/**
 * Cadastro de lead com consentimento: guarda o texto aceito, a data, a origem e a campanha,
 * envia o cupom de boas-vindas e o link de confirmação (double opt-in). Quem já está na lista
 * recebe o cupom de novo, sem duplicar o cadastro.
 */
export async function subscribeLead(input: SubscribeInput): Promise<{ couponCode: string }> {
  const settings = await getStoreSettings();
  const email = input.email.trim().toLowerCase();
  const token = randomBytes(24).toString("base64url");
  const existing = await db.lead.findFirst({
    where: { email, source: { in: ["POPUP", "FOOTER", "CHECKOUT", "ACCOUNT"] } },
    orderBy: { createdAt: "asc" },
  });
  const consent = {
    consentText: input.consentText,
    consentAt: new Date(),
    unsubscribedAt: null,
    ipHash: input.ipHash,
    couponIssued: settings.welcomeCoupon,
  };
  const lead = existing
    ? await db.lead.update({
        where: { id: existing.id },
        data: {
          ...consent,
          whatsapp: input.whatsapp || existing.whatsapp,
          name: input.name || existing.name,
          ...(existing.confirmedAt ? {} : { confirmTokenHash: hashToken(token) }),
        },
      })
    : await db.lead.create({
        data: {
          ...consent,
          email,
          whatsapp: input.whatsapp || null,
          name: input.name || null,
          source: input.source,
          utm: input.utm ?? undefined,
          confirmTokenHash: hashToken(token),
        },
      });
  const base = appUrl();
  await sendEmail(email, "welcome-coupon", {
    coupon: settings.welcomeCoupon,
    percent: settings.welcomeCouponPercent,
    confirmUrl: `${base}/newsletter/confirmar/${token}`,
    unsubscribeUrl: `${base}/descadastrar/${lead.unsubscribeToken}`,
  });
  return { couponCode: settings.welcomeCoupon };
}

/** Confirma o e-mail do lead (double opt-in). O link vale uma vez. */
export async function confirmLead(token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return false;
  const lead = await db.lead.findUnique({
    where: { confirmTokenHash: hashToken(token) },
    select: { id: true },
  });
  if (!lead) return false;
  await db.lead.update({
    where: { id: lead.id },
    data: { confirmedAt: new Date(), confirmTokenHash: null },
  });
  return true;
}

/** Descadastro em um clique: vale para todos os cadastros do e-mail e para a conta, se houver. */
export async function unsubscribeLead(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{10,80}$/.test(token)) return null;
  const lead = await db.lead.findUnique({
    where: { unsubscribeToken: token },
    select: { email: true },
  });
  if (!lead) return null;
  await db.$transaction([
    db.lead.updateMany({
      where: { email: lead.email, unsubscribedAt: null },
      data: { unsubscribedAt: new Date() },
    }),
    db.user.updateMany({
      where: { email: lead.email },
      data: { marketingEmailOptIn: false, marketingWhatsappOptIn: false },
    }),
  ]);
  return lead.email;
}
