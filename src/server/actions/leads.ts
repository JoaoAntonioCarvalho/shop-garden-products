"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import type { LeadFormInput, LeadFormResult } from "@/components/store/newsletter-form";
import type { Prisma } from "@/generated/prisma/client";
import { parseUtmCookie, UTM_COOKIE } from "@/lib/analytics/utm";
import { db } from "@/lib/db";
import { clientIpHash } from "@/lib/ip";
import { isValidPhone } from "@/lib/validators/phone";
import { invalidate } from "@/server/cache";
import { sendInternalEmail } from "@/server/services/emails";
import { LEAD_COOKIE, subscribeLead } from "@/server/services/leads";
import { InvalidImageError, MAX_UPLOAD_BYTES, processAndStoreImage } from "@/server/services/media";
import { rateLimit, rateLimitMessage } from "@/server/services/rate-limit";
import { getStoreSettings } from "@/server/services/settings";

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

/** Formulário preenchido rápido demais ou com o campo-isca preenchido é tratado como robô. */
const MIN_FILL_MS = 1500;
const looksAutomated = (website: string | undefined, elapsedMs: number | undefined) =>
  Boolean(website) || (typeof elapsedMs === "number" && elapsedMs > 0 && elapsedMs < MIN_FILL_MS);

const leadSchema = z.object({
  email: z.email("Digite um e-mail válido, como nome@exemplo.com.").max(160),
  whatsapp: z
    .string()
    .max(20)
    .refine((value) => value === "" || isValidPhone(value), "Confira o WhatsApp, com DDD."),
  consent: z.literal(true, { error: "Marque a caixa de consentimento para receber o cupom." }),
  consentText: z.string().min(10).max(400),
  source: z.enum(["POPUP", "FOOTER"]),
  website: z.string().max(200),
  elapsedMs: z.number(),
});

/** Newsletter do rodapé e pop-up de boas-vindas: cria o lead com consentimento e entrega o cupom. */
export async function subscribeLeadAction(input: LeadFormInput): Promise<LeadFormResult> {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Confira os dados e tente de novo.",
    };
  const settings = await getStoreSettings();
  // Para um robô a resposta é igual à de um cadastro normal, mas nada é gravado nem enviado.
  if (looksAutomated(parsed.data.website, parsed.data.elapsedMs))
    return { ok: true, couponCode: settings.welcomeCoupon };
  const ipHash = clientIpHash(await headers());
  const limit = await rateLimit("publicForm", ipHash);
  if (!limit.allowed) return { ok: false, error: rateLimitMessage(limit) };

  const jar = await cookies();
  const utm = parseUtmCookie(jar.get(UTM_COOKIE)?.value);
  const { couponCode } = await subscribeLead({
    email: parsed.data.email,
    whatsapp: parsed.data.whatsapp,
    source: parsed.data.source,
    consentText: parsed.data.consentText,
    ipHash,
    utm: utm as Prisma.InputJsonValue | null,
  });
  // Quem já se cadastrou não vê o pop-up de novo.
  jar.set(LEAD_COOKIE, "1", {
    maxAge: 365 * 86_400,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return { ok: true, couponCode };
}

const contactSchema = z.object({
  name: z.string().trim().min(2, "Informe o seu nome.").max(120),
  email: z.email("Digite um e-mail válido, como nome@exemplo.com.").max(160),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((value) => value === "" || isValidPhone(value), "Confira o telefone, com DDD."),
  orderNumber: z.string().trim().toUpperCase().max(20),
  subject: z.string().trim().min(3, "Informe o assunto.").max(120),
  message: z.string().trim().min(10, "Escreva a mensagem com pelo menos 10 caracteres.").max(4000),
  website: z.string().max(200).optional(),
  elapsedMs: z.number().optional(),
});

export type PublicFormResult =
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const invalid = (issues: z.core.$ZodIssue[]): PublicFormResult => ({
  ok: false,
  error: "Confira os campos destacados.",
  fieldErrors: Object.fromEntries(issues.map((issue) => [String(issue.path[0]), issue.message])),
});

export async function sendContactAction(
  input: z.input<typeof contactSchema>,
): Promise<PublicFormResult> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const done = { ok: true as const, message: "Mensagem enviada. Respondemos em até um dia útil." };
  if (looksAutomated(parsed.data.website, parsed.data.elapsedMs)) return done;
  const limit = await rateLimit("publicForm", clientIpHash(await headers()));
  if (!limit.allowed) return { ok: false, error: rateLimitMessage(limit) };
  const { website: _website, elapsedMs: _elapsed, ...data } = parsed.data;
  void [_website, _elapsed];
  await db.contactMessage.create({
    data: { ...data, phone: data.phone || null, orderNumber: data.orderNumber || null },
  });
  await sendInternalEmail("internal-contact", data);
  return done;
}

const requestSchema = z.object({
  name: z.string().trim().min(2, "Informe o seu nome.").max(120),
  email: z.email("Digite um e-mail válido, como nome@exemplo.com.").max(160),
  whatsapp: z
    .string()
    .trim()
    .max(20)
    .refine((value) => value === "" || isValidPhone(value), "Confira o WhatsApp, com DDD."),
  description: z
    .string()
    .trim()
    .min(10, "Conte o que você procura, com pelo menos 10 caracteres.")
    .max(4000),
  budgetRange: z.string().trim().max(60),
});

/** "Não encontrou o que procura?": descrição, orçamento, foto opcional e contato. */
export async function sendProductRequestAction(form: FormData): Promise<PublicFormResult> {
  const text = (key: string) => String(form.get(key) ?? "");
  const parsed = requestSchema.safeParse({
    name: text("name"),
    email: text("email"),
    whatsapp: text("whatsapp"),
    description: text("description"),
    budgetRange: text("budgetRange"),
  });
  if (!parsed.success) return invalid(parsed.error.issues);
  const done = {
    ok: true as const,
    message: "Solicitação enviada. Vamos procurar e responder em até dois dias úteis.",
  };
  if (looksAutomated(text("website"), Number(text("elapsedMs")) || undefined)) return done;
  const limit = await rateLimit("publicForm", clientIpHash(await headers()));
  if (!limit.allowed) return { ok: false, error: rateLimitMessage(limit) };

  let imageId: string | null = null;
  const file = form.get("photo");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES)
      return {
        ok: false,
        error: "A foto passa de 10 MB. Envie um arquivo menor.",
        fieldErrors: { photo: "A foto passa de 10 MB." },
      };
    try {
      // O tipo é conferido pelo conteúdo, os metadados são removidos e o nome do arquivo é gerado.
      const image = await processAndStoreImage(Buffer.from(await file.arrayBuffer()), {
        keyPrefix: "solicitacoes",
      });
      imageId = (
        await db.mediaAsset.create({
          data: {
            ...image,
            originalName: "foto-de-referencia",
            alt: "Foto de referência enviada pelo cliente",
          },
        })
      ).id;
    } catch (error) {
      if (error instanceof InvalidImageError)
        return { ok: false, error: error.message, fieldErrors: { photo: error.message } };
      throw error;
    }
  }
  const data = parsed.data;
  await db.productRequest.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      whatsapp: data.whatsapp || null,
      description: data.description,
      budgetRange: data.budgetRange || null,
      imageId,
    },
  });
  await sendInternalEmail("internal-product-request", {
    name: data.name,
    email: data.email,
    whatsapp: data.whatsapp,
    description: data.description,
    budget: data.budgetRange,
  });
  invalidate();
  return done;
}
