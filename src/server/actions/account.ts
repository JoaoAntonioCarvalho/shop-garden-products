"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { clientIpHash } from "@/lib/ip";
import { getCurrentUser, requireUser } from "@/lib/session";
import {
  passwordSchema,
  profileSchema,
  reviewSchema,
  savedAddressSchema,
} from "@/lib/validators/account";
import { emailSchema } from "@/lib/validators/checkout";
import { normalizeCep } from "@/lib/validators/cep";
import { onlyDigits } from "@/lib/validators/cpf";
import { hashPassword, sendVerificationEmail } from "@/server/services/accounts";
import { addCartItem } from "@/server/services/cart";
import { availableOf } from "@/server/services/catalog";
import { getOrderForViewer } from "@/server/services/order-view";
import { rateLimit, rateLimitMessage } from "@/server/services/rate-limit";
import { getStoreSettings } from "@/server/services/settings";

export type AccountResult =
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const fieldErrorsOf = (issues: Array<{ path: PropertyKey[]; message: string }>) =>
  Object.fromEntries(issues.map((issue) => [issue.path.join("."), issue.message]));
const invalid = (issues: Array<{ path: PropertyKey[]; message: string }>): AccountResult => ({
  ok: false,
  error: "Confira os campos destacados.",
  fieldErrors: fieldErrorsOf(issues),
});

export async function updateProfileAction(input: {
  name: string;
  phone?: string;
  cpf?: string;
  birthDate?: string;
}): Promise<AccountResult> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const cpf = parsed.data.cpf ? onlyDigits(parsed.data.cpf) : null;
  if (cpf) {
    const taken = await db.user.findFirst({
      where: { cpf, id: { not: user.id } },
      select: { id: true },
    });
    if (taken)
      return {
        ok: false,
        error: "Confira os campos destacados.",
        fieldErrors: {
          cpf: "Este CPF já está em outra conta. Fale com a gente se precisar de ajuda.",
        },
      };
  }
  await db.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone ? onlyDigits(parsed.data.phone) : null,
      cpf,
      birthDate: parsed.data.birthDate ? new Date(`${parsed.data.birthDate}T00:00:00Z`) : null,
    },
  });
  revalidatePath("/conta", "layout");
  return { ok: true, message: "Dados salvos" };
}

/** Trocar o e-mail exige a senha atual e uma nova verificação; só muda depois de confirmar o link. */
export async function changeEmailAction(input: {
  email: string;
  password: string;
}): Promise<AccountResult> {
  const user = await requireUser();
  const email = emailSchema.safeParse(input.email);
  if (!email.success)
    return {
      ok: false,
      error: "Confira os campos destacados.",
      fieldErrors: { email: "Digite um e-mail válido, como nome@exemplo.com." },
    };
  const record = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record.passwordHash || !(await bcrypt.compare(input.password, record.passwordHash))) {
    return {
      ok: false,
      error: "Confira os campos destacados.",
      fieldErrors: { password: "Senha atual incorreta." },
    };
  }
  if (email.data === user.email) return { ok: false, error: "Este já é o seu e-mail." };
  const taken = await db.user.findUnique({ where: { email: email.data }, select: { id: true } });
  // Não revela se o e-mail pertence a outra conta: o link só é enviado quando está livre.
  if (!taken) await sendVerificationEmail(user, { newEmail: email.data });
  return {
    ok: true,
    message: `Enviamos um link de confirmação para ${email.data}. O e-mail muda quando você confirmar.`,
  };
}

export async function resendVerificationAction(): Promise<AccountResult> {
  const user = await requireUser();
  if (user.emailVerifiedAt) return { ok: true, message: "Seu e-mail já está confirmado" };
  const limit = await rateLimit("passwordReset", `verify:${user.id}`);
  if (!limit.allowed) return { ok: false, error: rateLimitMessage(limit) };
  await sendVerificationEmail(user);
  return { ok: true, message: `Enviamos um novo link para ${user.email}` };
}

export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<AccountResult> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse(input.newPassword);
  if (!parsed.success)
    return {
      ok: false,
      error: "Confira os campos destacados.",
      fieldErrors: { newPassword: parsed.error.issues[0].message },
    };
  const record = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record.passwordHash || !(await bcrypt.compare(input.currentPassword, record.passwordHash))) {
    return {
      ok: false,
      error: "Confira os campos destacados.",
      fieldErrors: { currentPassword: "Senha atual incorreta." },
    };
  }
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data) },
  });
  return { ok: true, message: "Senha alterada" };
}

type AddressInput = Parameters<typeof savedAddressSchema.safeParse>[0];

export async function saveAddressAction(
  id: string | null,
  input: AddressInput,
): Promise<AccountResult> {
  const user = await requireUser();
  const parsed = savedAddressSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const count = await db.address.count({ where: { userId: user.id } });
  const data = {
    label: parsed.data.label || null,
    recipientName: parsed.data.recipientName,
    recipientPhone: parsed.data.recipientPhone ? onlyDigits(parsed.data.recipientPhone) : null,
    cep: normalizeCep(parsed.data.cep)!,
    street: parsed.data.street,
    number: parsed.data.number,
    complement: parsed.data.complement || null,
    district: parsed.data.district,
    city: parsed.data.city,
    state: parsed.data.state,
    reference: parsed.data.reference || null,
    // O primeiro endereço é sempre o padrão.
    isDefault: parsed.data.isDefault || count === 0,
  };

  if (id) {
    const owned = await db.address.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!owned) return { ok: false, error: "Endereço não encontrado." };
  } else if (count >= 20) {
    return {
      ok: false,
      error: "Você chegou ao limite de 20 endereços. Exclua um para adicionar outro.",
    };
  }

  await db.$transaction(async (tx) => {
    if (data.isDefault)
      await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    if (id) await tx.address.update({ where: { id }, data });
    else await tx.address.create({ data: { ...data, userId: user.id } });
  });
  revalidatePath("/conta/enderecos");
  return { ok: true, message: "Endereço salvo" };
}

export async function deleteAddressAction(id: string): Promise<AccountResult> {
  const user = await requireUser();
  const address = await db.address.findFirst({
    where: { id, userId: user.id },
    select: { id: true, isDefault: true },
  });
  if (!address) return { ok: false, error: "Endereço não encontrado." };
  await db.address.delete({ where: { id } });
  if (address.isDefault) {
    const next = await db.address.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (next) await db.address.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  revalidatePath("/conta/enderecos");
  return { ok: true, message: "Endereço excluído" };
}

export async function setDefaultAddressAction(id: string): Promise<AccountResult> {
  const user = await requireUser();
  const owned = await db.address.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!owned) return { ok: false, error: "Endereço não encontrado." };
  await db.$transaction([
    db.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } }),
    db.address.update({ where: { id }, data: { isDefault: true } }),
  ]);
  revalidatePath("/conta/enderecos");
  return { ok: true, message: "Endereço padrão alterado" };
}

const MARKETING_CONSENT_TEXT = {
  email: "Quero receber novidades e ofertas por e-mail.",
  whatsapp: "Quero receber novidades e ofertas por WhatsApp.",
} as const;

/** Preferências de comunicação: consentimento separado para e-mail e WhatsApp, com data. */
export async function updateCommunicationAction(input: {
  email: boolean;
  whatsapp: boolean;
}): Promise<AccountResult> {
  const user = await requireUser();
  const current = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { marketingEmailOptIn: true, marketingWhatsappOptIn: true, phone: true },
  });
  if (input.whatsapp && !current.phone)
    return {
      ok: false,
      error: "Cadastre o seu celular em Dados pessoais para receber por WhatsApp.",
    };
  const now = new Date();
  const gained =
    (input.email && !current.marketingEmailOptIn) ||
    (input.whatsapp && !current.marketingWhatsappOptIn);
  await db.user.update({
    where: { id: user.id },
    data: {
      marketingEmailOptIn: input.email,
      marketingWhatsappOptIn: input.whatsapp,
      ...(gained ? { optInAt: now } : {}),
    },
  });
  if (gained) {
    await db.lead.create({
      data: {
        email: user.email,
        name: user.name,
        whatsapp: input.whatsapp ? current.phone : null,
        source: "ACCOUNT",
        consentText: [
          input.email ? MARKETING_CONSENT_TEXT.email : null,
          input.whatsapp ? MARKETING_CONSENT_TEXT.whatsapp : null,
        ]
          .filter(Boolean)
          .join(" "),
        consentAt: now,
        ipHash: clientIpHash(await headers()),
      },
    });
  }
  if (!input.email)
    await db.lead.updateMany({
      where: { email: user.email, unsubscribedAt: null },
      data: { unsubscribedAt: now },
    });
  revalidatePath("/conta/comunicacao");
  return { ok: true, message: "Preferências salvas" };
}

/** "Excluir minha conta": abre o pedido para a loja processar. A senha confirma que é a própria pessoa. */
export async function requestAccountDeletionAction(password: string): Promise<AccountResult> {
  const user = await requireUser();
  const record = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record.passwordHash || !(await bcrypt.compare(password, record.passwordHash))) {
    return { ok: false, error: "Senha incorreta." };
  }
  const open = await db.dataRequest.findFirst({
    where: { userId: user.id, type: "DELETE", status: "OPEN" },
    select: { id: true },
  });
  if (!open)
    await db.dataRequest.create({ data: { userId: user.id, email: user.email, type: "DELETE" } });
  revalidatePath("/conta/privacidade");
  return {
    ok: true,
    message:
      "Pedido de exclusão registrado. Nossa equipe conclui em até 15 dias e avisa por e-mail.",
  };
}

/** Favoritar ou desfavoritar. Sem login, pede para entrar. */
export async function toggleWishlistAction(
  productId: string,
  next: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Entre na sua conta para guardar favoritos." };
  const id = String(productId).slice(0, 40);
  if (next) {
    const product = await db.product.findFirst({
      where: { id, status: "ACTIVE" },
      select: { id: true },
    });
    if (!product) return { ok: false, message: "Este produto não está mais disponível." };
    await db.wishlist.upsert({
      where: { userId_productId: { userId: user.id, productId: id } },
      create: { userId: user.id, productId: id },
      update: {},
    });
  } else {
    await db.wishlist.deleteMany({ where: { userId: user.id, productId: id } });
  }
  revalidatePath("/conta/favoritos");
  return { ok: true };
}

/** "Comprar novamente": põe na sacola os itens do pedido que ainda estão disponíveis. */
export async function reorderAction(orderNumber: string): Promise<AccountResult> {
  const user = await requireUser();
  const order = await getOrderForViewer(orderNumber, { userId: user.id });
  if (!order) return { ok: false, error: "Pedido não encontrado." };
  const settings = await getStoreSettings();
  let added = 0;
  const skipped: string[] = [];
  for (const item of order.items) {
    const variant = item.variantId
      ? await db.productVariant.findFirst({
          where: { id: item.variantId, isActive: true, product: { status: "ACTIVE" } },
          select: { id: true, stockOnHand: true, stockReserved: true },
        })
      : null;
    if (!variant || availableOf(variant) <= 0) {
      skipped.push(item.productName);
      continue;
    }
    const result = await addCartItem(variant.id, item.quantity, settings);
    if (result.ok) added++;
  }
  if (added === 0)
    return { ok: false, error: "Nenhum item deste pedido está disponível no momento." };
  return {
    ok: true,
    message: skipped.length
      ? `Itens adicionados à sacola. Indisponíveis: ${skipped.join(", ")}.`
      : "Itens adicionados à sacola",
  };
}

/**
 * Avaliação de produto: por cliente logado ou pelo link do e-mail de pedido entregue (número e
 * token do pedido). Toda avaliação entra pendente, para moderação.
 */
export async function submitReviewAction(input: {
  productSlug: string;
  rating: number;
  title?: string;
  body: string;
  orderNumber?: string;
  token?: string;
  website?: string;
}): Promise<AccountResult> {
  if (input.website) return { ok: false, error: "Não foi possível enviar a avaliação." };
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const limit = await rateLimit("publicForm", clientIpHash(await headers()));
  if (!limit.allowed) return { ok: false, error: rateLimitMessage(limit) };

  const user = await getCurrentUser();
  const linkedOrder =
    input.orderNumber && input.token
      ? await getOrderForViewer(input.orderNumber, { token: input.token })
      : null;
  if (!user && !linkedOrder) return { ok: false, error: "Entre na sua conta para avaliar." };

  const product = await db.product.findUnique({
    where: { slug: String(input.productSlug).slice(0, 160) },
    select: { id: true },
  });
  if (!product) return { ok: false, error: "Produto não encontrado." };

  // Selo de compra verificada: existe pedido entregue com este produto, do cliente ou do link.
  const purchase = await db.order.findFirst({
    where: {
      status: { in: ["DELIVERED", "RETURNED"] },
      items: { some: { productId: product.id } },
      OR: [
        ...(user ? [{ userId: user.id }] : []),
        ...(linkedOrder ? [{ id: linkedOrder.id }] : []),
      ],
    },
    select: { id: true, customerName: true, shippingCity: true, shippingState: true },
  });

  const duplicate = await db.review.findFirst({
    where: {
      productId: product.id,
      OR: [...(user ? [{ userId: user.id }] : []), ...(purchase ? [{ orderId: purchase.id }] : [])],
    },
    select: { id: true },
  });
  if (duplicate) return { ok: false, error: "Você já avaliou este produto. Obrigado." };

  const fullName = user?.name ?? linkedOrder?.customerName ?? "Cliente";
  const parts = fullName.trim().split(/\s+/);
  await db.review.create({
    data: {
      productId: product.id,
      userId: user?.id ?? linkedOrder?.userId ?? null,
      orderId: purchase?.id ?? null,
      // Nome e inicial do sobrenome, para não expor o nome completo.
      authorName: parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0],
      authorCity: purchase?.shippingCity
        ? `${purchase.shippingCity}, ${purchase.shippingState}`
        : null,
      rating: parsed.data.rating,
      title: parsed.data.title || null,
      body: parsed.data.body,
      isVerifiedPurchase: Boolean(purchase),
    },
  });
  return { ok: true, message: "Avaliação enviada. Ela aparece no site depois da moderação." };
}
