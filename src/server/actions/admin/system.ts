"use server";

import { z } from "zod";
import { storeConfig, type StoreSettings } from "@/config/store.config";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { normalizeCep } from "@/lib/validators/cep";
import { AdminError, runAdmin, type AdminResult } from "@/server/admin/action";
import { bool, int, money, optionalText, requiredText } from "@/server/admin/fields";
import { invalidate } from "@/server/cache";
import { getJob, runJob } from "@/server/jobs";
import { requestPasswordReset } from "@/server/services/accounts";
import { emailStore, sendEmail } from "@/server/services/emails";
import { getStoreSettings } from "@/server/services/settings";

// ───────────── Configurações ─────────────

const rangesField = z
  .string()
  .max(2000)
  .transform((text, context) => {
    const ranges = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [start, end] = line.split(/\s*(?:a|até|;|,)\s*/i).map((part) => normalizeCep(part));
        return start && end && end >= start ? { start, end } : null;
      });
    if (ranges.some((range) => range === null))
      context.addIssue({
        code: "custom",
        message: "Use uma faixa por linha, no formato 01000-000 a 05999-999.",
      });
    return ranges.filter((range) => range !== null);
  });

const settingsSchema = z.object({
  name: requiredText("o nome da loja", 80),
  tagline: optionalText(160).transform((value) => value ?? ""),
  legalName: requiredText("a razão social", 160),
  cnpj: requiredText("o CNPJ", 30),
  address: requiredText("o endereço", 300),
  whatsapp: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .pipe(
      z
        .string()
        .min(12, "Informe o WhatsApp com código do país e DDD, por exemplo 5511999999999.")
        .max(14),
    ),
  phoneDisplay: requiredText("o telefone exibido", 30),
  email: z.email("E-mail inválido."),
  notificationEmail: z.email("E-mail inválido."),
  businessHours: requiredText("o horário de atendimento", 120),
  instagram: z.preprocess(
    (value) => value ?? "",
    z
      .string()
      .trim()
      .max(200)
      .refine(
        (value) => value === "" || value.startsWith("https://"),
        "Use o endereço completo, começando com https://.",
      ),
  ),
  partnerClaim: optionalText(200).transform((value) => value ?? ""),
  pixDiscountPercent: int("o desconto do Pix", 0, 50),
  maxInstallments: int("o número de parcelas", 1, 12),
  minInstallmentCents: money("a parcela mínima"),
  freeShippingThresholdCents: money("o valor do frete grátis"),
  giftWrapPriceCents: money("o preço da embalagem para presente"),
  pixExpirationMinutes: int("a validade do Pix", 5, 1440),
  cartExpirationDays: int("a validade da sacola", 1, 90),
  lowStockDefaultThreshold: int("o alerta de estoque", 0, 1000),
  welcomeCoupon: z.string().trim().toUpperCase().max(40),
  welcomeCouponPercent: int("o percentual do cupom de boas-vindas", 0, 100),
  sameDayEnabled: bool(),
  sameDayCutoff: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:MM."),
  sameDayDays: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Escolha pelo menos um dia."),
  sameDayRanges: rangesField,
  sameDayDeliverBy: int("a hora limite de entrega", 12, 23),
  packagingText: requiredText("o texto de entrega e embalagem", 1000),
  ga4Id: z
    .string()
    .trim()
    .max(30)
    .regex(/^(G-[A-Z0-9]+)?$/, "O ID do GA4 começa com G-."),
  metaPixelId: z.string().trim().max(30).regex(/^\d*$/, "O ID do pixel tem só números."),
  maintenanceMode: bool(),
});

/** Salva só o que mudou em relação ao que está valendo, audita e invalida o cache da loja inteira. */
export async function saveSettingsAction(input: unknown): Promise<AdminResult> {
  return runAdmin("settings.manage", settingsSchema, input, async (data, { user, audit }) => {
    const {
      sameDayEnabled,
      sameDayCutoff,
      sameDayDays,
      sameDayRanges,
      sameDayDeliverBy,
      ga4Id,
      metaPixelId,
      ...flat
    } = data;
    const next: Partial<StoreSettings> = {
      ...flat,
      sameDay: {
        enabled: sameDayEnabled,
        cutoffTime: sameDayCutoff,
        days: sameDayDays as StoreSettings["sameDay"]["days"],
        cepRanges: sameDayRanges,
        deliverByHour: sameDayDeliverBy,
      },
      analytics: { ga4Id, metaPixelId },
    };
    if (
      next.welcomeCoupon &&
      !(await db.coupon.findUnique({ where: { code: next.welcomeCoupon }, select: { id: true } }))
    )
      throw new AdminError(
        `O cupom de boas-vindas ${next.welcomeCoupon} não existe. Crie o cupom antes.`,
      );
    const current = await getStoreSettings();
    const stored = await db.storeSetting.findMany({ select: { key: true } });
    const changed: Record<string, { antes: unknown; depois: unknown }> = {};
    for (const [key, value] of Object.entries(next) as Array<[keyof StoreSettings, unknown]>) {
      const before =
        key === "analytics"
          ? {
              ...current.analytics,
              ...(stored.some((row) => row.key === "analytics") ? {} : storeConfig.analytics),
            }
          : current[key];
      if (JSON.stringify(before) === JSON.stringify(value)) continue;
      changed[key] = { antes: before, depois: value };
      await db.storeSetting.upsert({
        where: { key },
        update: { value: value as Prisma.InputJsonValue, updatedById: user.id },
        create: { key, value: value as Prisma.InputJsonValue, updatedById: user.id },
      });
    }
    if (Object.keys(changed).length === 0) return { message: "Nada foi alterado" };
    await audit({
      action: "settings.update",
      entityType: "StoreSetting",
      diff: changed as Prisma.InputJsonValue,
    });
    invalidate("settings", "home", "catalog", "pages", "categories");
    return { message: "Configurações salvas" };
  });
}

const testEmailSchema = z.object({ to: z.email("E-mail inválido.") });

export async function sendTestEmailAction(
  input: z.input<typeof testEmailSchema>,
): Promise<AdminResult> {
  return runAdmin("settings.manage", testEmailSchema, input, async (data, { user, audit }) => {
    const sent = await sendEmail(data.to, "test", { sentBy: user.name });
    if (!sent)
      throw new AdminError(
        "O e-mail não foi enviado. Veja o erro em E-mails enviados e confira as variáveis SMTP.",
      );
    await audit({ action: "settings.test_email", entityType: "StoreSetting" });
    return { message: `E-mail de teste enviado para ${data.to}` };
  });
}

// ───────────── Usuários da equipe ─────────────

const inviteSchema = z.object({
  name: requiredText("o nome", 120),
  email: z.email("E-mail inválido.").transform((value) => value.toLowerCase()),
  role: z.enum(["ADMIN", "STAFF"]),
});

/** Convida alguém para a equipe: cria a conta sem senha e envia o link para a pessoa definir a dela. */
export async function inviteTeamMemberAction(
  input: z.input<typeof inviteSchema>,
): Promise<AdminResult> {
  return runAdmin("users.manage", inviteSchema, input, async (data, { audit }) => {
    const existing = await db.user.findUnique({
      where: { email: data.email },
      select: { id: true, role: true, anonymizedAt: true },
    });
    if (existing?.anonymizedAt) throw new AdminError("Este e-mail não pode ser usado.");
    if (existing && existing.role !== "CUSTOMER")
      throw new AdminError("Esta pessoa já faz parte da equipe.");
    const member = existing
      ? await db.user.update({
          where: { id: existing.id },
          data: { role: data.role, isActive: true },
        })
      : await db.user.create({
          data: {
            name: data.name,
            email: data.email,
            role: data.role,
            emailVerifiedAt: new Date(),
          },
        });
    await requestPasswordReset(data.email, "team-invite", (await emailStore()).name);
    await audit({
      action: "user.invite",
      entityType: "User",
      entityId: member.id,
      diff: { papel: data.role },
    });
    return { message: `Convite enviado para ${data.email}` };
  });
}

const memberSchema = z.object({
  id: z.string().max(40),
  role: z.enum(["ADMIN", "STAFF", "CUSTOMER"]).optional(),
  isActive: z.boolean().optional(),
  resend: z.boolean().optional(),
});

/** Altera papel, ativa, desativa ou reenvia o convite. Nunca deixa a loja sem um administrador ativo. */
export async function updateTeamMemberAction(
  input: z.input<typeof memberSchema>,
): Promise<AdminResult> {
  return runAdmin("users.manage", memberSchema, input, async (data, { user, audit }) => {
    const member = await db.user.findUnique({
      where: { id: data.id },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    if (!member || member.role === "CUSTOMER")
      throw new AdminError("Usuário da equipe não encontrado.");
    if (data.resend) {
      await requestPasswordReset(member.email, "team-invite", (await emailStore()).name);
      await audit({
        action: "user.invite",
        entityType: "User",
        entityId: member.id,
        diff: { reenviado: true },
      });
      return { message: `Convite reenviado para ${member.email}` };
    }
    const role = data.role ?? member.role;
    const isActive = data.isActive ?? member.isActive;
    const losesAdmin =
      member.role === "ADMIN" && member.isActive && (role !== "ADMIN" || !isActive);
    if (losesAdmin) {
      if (member.id === user.id)
        throw new AdminError(
          "Você não pode tirar o seu próprio acesso de administrador. Peça a outro administrador.",
        );
      const admins = await db.user.count({
        where: { role: "ADMIN", isActive: true, anonymizedAt: null },
      });
      if (admins <= 1) throw new AdminError("A loja precisa de pelo menos um administrador ativo.");
    }
    await db.user.update({ where: { id: member.id }, data: { role, isActive } });
    await audit({
      action: "user.update",
      entityType: "User",
      entityId: member.id,
      diff: {
        papel: { antes: member.role, depois: role },
        ativo: { antes: member.isActive, depois: isActive },
      },
    });
    return {
      message: role === "CUSTOMER" ? `${member.name} saiu da equipe` : `${member.name} atualizado`,
    };
  });
}

// ───────────── E-mails e tarefas ─────────────

const idSchema = z.object({ id: z.string().max(40) });

export async function resendEmailLogAction(input: z.input<typeof idSchema>): Promise<AdminResult> {
  return runAdmin("emails.view", idSchema, input, async (data, { audit }) => {
    const log = await db.emailLog.findUnique({ where: { id: data.id } });
    if (!log) throw new AdminError("E-mail não encontrado.");
    // Links de uso único (senha, verificação) já venceram ou foram usados: não são reenviados.
    if (["password-reset", "email-verification", "team-invite"].includes(log.template))
      throw new AdminError(
        "Este e-mail tem um link de uso único. Peça um novo link em vez de reenviar.",
      );
    const sent = await sendEmail(log.to, log.template as never, log.payload as never, {
      orderId: log.orderId,
    });
    if (!sent) throw new AdminError("O e-mail não foi enviado.");
    await audit({
      action: "email.resend",
      entityType: "EmailLog",
      entityId: log.id,
      diff: { modelo: log.template },
    });
    return { message: `E-mail reenviado para ${log.to}` };
  });
}

const jobSchema = z.object({ key: z.string().max(60) });

export async function runJobAction(input: z.input<typeof jobSchema>): Promise<AdminResult> {
  return runAdmin("jobs.manage", jobSchema, input, async (data, { audit }) => {
    const job = getJob(data.key);
    if (!job) throw new AdminError("Tarefa desconhecida.");
    const result = await runJob(job);
    await audit({
      action: "job.run",
      entityType: "JobRun",
      diff: { tarefa: job.key, resultado: result.summary },
    });
    if (!result.ok) throw new AdminError(`${job.label} falhou: ${result.summary}`);
    return { message: `${job.label}: ${result.summary}` };
  });
}
