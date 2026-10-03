import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { StoreSettings } from "@/config/store.config";
import { BCRYPT_COST } from "@/lib/credentials";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/seo/metadata";
import { availableOf } from "./catalog";
import { setCartCookie } from "./cart";
import { sendEmail } from "./emails";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("hex");

const VERIFY_HOURS = 24;
const RESET_HOURS = 1;

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_COST);

/** Envia o link de verificação. O token é guardado só como hash e vale 24 horas. */
export async function sendVerificationEmail(
  user: { id: string; name: string; email: string },
  options: { newEmail?: string; firstTime?: boolean } = {},
) {
  const token = newToken();
  await db.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      newEmail: options.newEmail ?? null,
      expiresAt: new Date(Date.now() + VERIFY_HOURS * 3_600_000),
    },
  });
  const verifyUrl = `${appUrl()}/verificar-email/${token}`;
  await sendEmail(
    options.newEmail ?? user.email,
    options.firstTime ? "account-created" : "email-verification",
    { name: user.name, verifyUrl },
  );
}

export type SignupInput = {
  name: string;
  email: string;
  password: string;
  phone?: string | null;
  marketingOptIn: boolean;
};

/** Cria a conta. Se o e-mail já tem conta, devolve null (quem chama não revela isso ao visitante). */
export async function createAccount(input: SignupInput) {
  const email = input.email.toLowerCase();
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, anonymizedAt: true },
  });
  if (existing?.passwordHash || existing?.anonymizedAt) return null;

  const now = new Date();
  const data = {
    name: input.name,
    passwordHash: await hashPassword(input.password),
    phone: input.phone || null,
    marketingEmailOptIn: input.marketingOptIn,
    optInAt: input.marketingOptIn ? now : null,
  };
  // Um cadastro sem senha pode existir (cliente criado pelo admin em um pedido manual): a conta é completada.
  const user = existing
    ? await db.user.update({
        where: { id: existing.id },
        data,
        select: { id: true, name: true, email: true },
      })
    : await db.user.create({
        data: { ...data, email },
        select: { id: true, name: true, email: true },
      });

  if (input.marketingOptIn) {
    await db.lead.create({
      data: {
        email,
        name: input.name,
        source: "ACCOUNT",
        consentText: "Quero receber novidades e ofertas por e-mail.",
        consentAt: now,
      },
    });
  }
  await sendVerificationEmail(user, { firstTime: true });
  return user;
}

/**
 * Confirma o e-mail pelo token. Só depois disso os pedidos feitos como convidado com o mesmo
 * e-mail são ligados à conta: antes, qualquer pessoa poderia criar uma conta com o e-mail de
 * outra e ver os pedidos dela.
 */
export async function verifyEmailToken(token: string): Promise<{ ok: boolean; email?: string }> {
  const record = await db.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) return { ok: false };

  const email = (record.newEmail ?? record.user.email).toLowerCase();
  if (record.newEmail) {
    const taken = await db.user.findFirst({
      where: { email, id: { not: record.userId } },
      select: { id: true },
    });
    if (taken) return { ok: false };
  }
  await db.$transaction([
    db.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.user.update({ where: { id: record.userId }, data: { email, emailVerifiedAt: new Date() } }),
    db.order.updateMany({
      where: { userId: null, customerEmail: email },
      data: { userId: record.userId },
    }),
  ]);
  return { ok: true, email };
}

/** Pede a redefinição de senha. Não diz se o e-mail existe. Token de uso único, em hash, válido por 1 hora. */
export async function requestPasswordReset(
  emailInput: string,
  template: "password-reset" | "team-invite" = "password-reset",
  storeName = "",
): Promise<void> {
  const user = await db.user.findUnique({
    where: { email: emailInput.toLowerCase() },
    select: { id: true, name: true, email: true, isActive: true, anonymizedAt: true },
  });
  if (!user || !user.isActive || user.anonymizedAt) return;
  const token = newToken();
  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_HOURS * 3_600_000),
    },
  });
  const url = `${appUrl()}/redefinir-senha/${token}`;
  if (template === "team-invite")
    await sendEmail(user.email, "team-invite", { name: user.name, inviteUrl: url, storeName });
  else await sendEmail(user.email, "password-reset", { name: user.name, resetUrl: url });
}

export async function isResetTokenValid(token: string): Promise<boolean> {
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { usedAt: true, expiresAt: true },
  });
  return Boolean(record && !record.usedAt && record.expiresAt > new Date());
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<{ ok: boolean; email?: string }> {
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) return { ok: false };
  await db.$transaction([
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Os demais links pendentes deixam de valer.
    db.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      data: { usedAt: new Date() },
    }),
    // Quem recebeu o link no e-mail comprovou que o e-mail é dele.
    db.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(password), emailVerifiedAt: new Date() },
    }),
    db.order.updateMany({
      where: { userId: null, customerEmail: record.user.email },
      data: { userId: record.userId },
    }),
  ]);
  return { ok: true, email: record.user.email };
}

/**
 * Ao entrar, o carrinho anônimo é mesclado ao carrinho da conta: as quantidades somam,
 * respeitando o estoque disponível.
 */
export async function mergeCartOnLogin(
  userId: string,
  anonymousToken: string | null,
  settings: StoreSettings,
): Promise<void> {
  const [anonymous, existing] = await Promise.all([
    anonymousToken
      ? db.cart.findFirst({
          where: { token: anonymousToken, status: { in: ["ACTIVE", "ABANDONED"] } },
          include: { items: true },
        })
      : null,
    db.cart.findFirst({
      where: { userId, status: { in: ["ACTIVE", "ABANDONED"] } },
      orderBy: { lastActivityAt: "desc" },
      include: { items: true },
    }),
  ]);
  const expiresAt = new Date(Date.now() + settings.cartExpirationDays * 86_400_000);

  if (anonymous && (!existing || existing.id === anonymous.id)) {
    await db.cart.update({
      where: { id: anonymous.id },
      data: { userId, status: "ACTIVE", expiresAt },
    });
    return;
  }
  if (!existing) return;

  if (anonymous && anonymous.items.length > 0) {
    const variants = await db.productVariant.findMany({
      where: { id: { in: anonymous.items.map((item) => item.variantId) } },
      select: { id: true, stockOnHand: true, stockReserved: true },
    });
    const available = new Map(variants.map((variant) => [variant.id, availableOf(variant)]));
    for (const item of anonymous.items) {
      const current =
        existing.items.find((entry) => entry.variantId === item.variantId)?.quantity ?? 0;
      const quantity = Math.min(current + item.quantity, available.get(item.variantId) ?? 0);
      if (quantity <= 0) continue;
      await db.cartItem.upsert({
        where: { cartId_variantId: { cartId: existing.id, variantId: item.variantId } },
        create: { cartId: existing.id, variantId: item.variantId, quantity },
        update: { quantity },
      });
    }
    await db.cart.update({
      where: { id: existing.id },
      data: {
        couponCode: existing.couponCode ?? anonymous.couponCode,
        giftMessage: existing.giftMessage ?? anonymous.giftMessage,
        giftWrap: existing.giftWrap || anonymous.giftWrap,
      },
    });
    await db.cart.delete({ where: { id: anonymous.id } });
  }
  await db.cart.update({
    where: { id: existing.id },
    data: { status: "ACTIVE", lastActivityAt: new Date(), expiresAt },
  });
  await setCartCookie(existing.token, expiresAt);
}

/** "Baixar meus dados": dados cadastrais, endereços, pedidos e consentimentos, em JSON. */
export async function exportUserData(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      phone: true,
      cpf: true,
      birthDate: true,
      createdAt: true,
      emailVerifiedAt: true,
      marketingEmailOptIn: true,
      marketingWhatsappOptIn: true,
      optInAt: true,
      addresses: {
        select: {
          label: true,
          recipientName: true,
          recipientPhone: true,
          cep: true,
          street: true,
          number: true,
          complement: true,
          district: true,
          city: true,
          state: true,
          reference: true,
          isDefault: true,
        },
      },
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          number: true,
          createdAt: true,
          status: true,
          paymentMethod: true,
          subtotalCents: true,
          discountCents: true,
          pixDiscountCents: true,
          shippingCents: true,
          giftWrapCents: true,
          totalCents: true,
          shippingMethodName: true,
          shippingAddress: true,
          giftMessage: true,
          items: {
            select: {
              productName: true,
              variantName: true,
              sku: true,
              quantity: true,
              unitPriceCents: true,
              totalCents: true,
            },
          },
        },
      },
      reviews: {
        select: {
          rating: true,
          title: true,
          body: true,
          createdAt: true,
          product: { select: { name: true } },
        },
      },
      wishlist: { select: { createdAt: true, product: { select: { name: true } } } },
    },
  });
  const leads = await db.lead.findMany({
    where: { email: user.email },
    select: {
      source: true,
      consentText: true,
      consentAt: true,
      confirmedAt: true,
      unsubscribedAt: true,
      createdAt: true,
    },
  });
  return {
    geradoEm: new Date().toISOString(),
    cadastro: {
      nome: user.name,
      email: user.email,
      telefone: user.phone,
      cpf: user.cpf,
      nascimento: user.birthDate,
      criadoEm: user.createdAt,
      emailVerificadoEm: user.emailVerifiedAt,
    },
    consentimentos: {
      email: user.marketingEmailOptIn,
      whatsapp: user.marketingWhatsappOptIn,
      data: user.optInAt,
      registros: leads,
    },
    enderecos: user.addresses,
    pedidos: user.orders,
    avaliacoes: user.reviews,
    favoritos: user.wishlist,
  };
}

/**
 * Anonimiza a conta (LGPD): os dados pessoais são apagados e os pedidos são mantidos, sem
 * identificação, pela obrigação fiscal.
 */
export async function anonymizeUser(userId: string): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  const placeholder = `anonimizado-${userId}@example.invalid`;
  await db.$transaction([
    db.address.deleteMany({ where: { userId } }),
    db.wishlist.deleteMany({ where: { userId } }),
    db.customerNote.deleteMany({ where: { customerId: userId } }),
    db.passwordResetToken.deleteMany({ where: { userId } }),
    db.emailVerificationToken.deleteMany({ where: { userId } }),
    db.cart.deleteMany({ where: { userId } }),
    db.lead.deleteMany({ where: { email: user.email } }),
    db.review.updateMany({ where: { userId }, data: { authorName: "Cliente", authorCity: null } }),
    db.order.updateMany({
      where: { userId },
      data: {
        customerName: "Cliente anonimizado",
        customerEmail: placeholder,
        customerPhone: null,
        customerCpf: null,
        recipientName: null,
        recipientPhone: null,
        shippingAddress: {},
        giftMessage: null,
        customerNotes: null,
      },
    }),
    db.user.update({
      where: { id: userId },
      data: {
        name: "Cliente anonimizado",
        email: placeholder,
        passwordHash: null,
        phone: null,
        cpf: null,
        birthDate: null,
        marketingEmailOptIn: false,
        marketingWhatsappOptIn: false,
        isActive: false,
        anonymizedAt: new Date(),
      },
    }),
  ]);
}
