import { hasTestDatabase, unique } from "./setup";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { verifyCredentials } from "@/lib/credentials";
import { db } from "@/lib/db";
import { passwordStrength, signupSchema } from "@/lib/validators/account";
import { setEmailProvider } from "@/server/providers/email";
import type { EmailMessage } from "@/server/providers/email/types";
import {
  anonymizeUser,
  createAccount,
  exportUserData,
  isResetTokenValid,
  requestPasswordReset,
  resetPassword,
  verifyEmailToken,
} from "@/server/services/accounts";

const sent: EmailMessage[] = [];
setEmailProvider({ send: async (message) => void sent.push(message) });
const emails: string[] = [];
const newEmail = () => {
  const email = `${unique("conta")}@example.com`.toLowerCase();
  emails.push(email);
  return email;
};
const tokenFrom = (message: EmailMessage, path: string) =>
  new RegExp(`/${path}/([a-f0-9]{64})`).exec(message.text)![1];

async function guestOrder(email: string) {
  const key = unique("G");
  return db.order.create({
    data: {
      number: key,
      accessToken: key,
      idempotencyKey: key,
      customerName: "Convidada",
      customerEmail: email,
      customerCpf: "52998224725",
      shippingAddress: { street: "Rua A" },
      paymentMethod: "PIX",
      subtotalCents: 1000,
      totalCents: 1000,
      shippingMethodCode: "x",
      shippingMethodName: "x",
      isSample: true,
    },
  });
}

describe.skipIf(!hasTestDatabase)("contas (contra o Postgres de teste)", () => {
  beforeEach(() => {
    sent.length = 0;
  });
  afterAll(async () => {
    await db.order.deleteMany({
      where: {
        OR: [{ customerEmail: { in: emails } }, { user: { email: { contains: "anonimizado-" } } }],
        isSample: true,
      },
    });
    await db.lead.deleteMany({ where: { email: { in: emails } } });
    await db.user.deleteMany({
      where: { OR: [{ email: { in: emails } }, { email: { endsWith: "@example.invalid" } }] },
    });
    await db.$disconnect();
  });

  it("cria a conta com senha em bcrypt custo 12 e envia a verificação; e-mail repetido não cria outra", async () => {
    const email = newEmail();
    const user = await createAccount({
      name: "Helena Prado",
      email,
      password: "Jardim#2026",
      marketingOptIn: false,
    });
    expect(user).not.toBeNull();
    const stored = await db.user.findUniqueOrThrow({ where: { email } });
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(stored.passwordHash).not.toContain("Jardim");
    expect(stored.marketingEmailOptIn).toBe(false);
    expect(sent[0].subject).toBe("Confirme o seu e-mail");
    expect(
      await createAccount({
        name: "Outra Pessoa",
        email,
        password: "outra-senha-1",
        marketingOptIn: false,
      }),
    ).toBeNull();
  });

  it("login: aceita a senha certa e recusa a errada, e-mail inexistente e conta desativada", async () => {
    const email = newEmail();
    await createAccount({
      name: "Helena Prado",
      email,
      password: "Jardim#2026",
      marketingOptIn: false,
    });
    expect(await verifyCredentials(email.toUpperCase(), "Jardim#2026")).toMatchObject({
      email,
      role: "CUSTOMER",
    });
    expect(await verifyCredentials(email, "errada")).toBeNull();
    expect(await verifyCredentials("ninguem@example.com", "Jardim#2026")).toBeNull();
    await db.user.update({ where: { email }, data: { isActive: false } });
    expect(await verifyCredentials(email, "Jardim#2026")).toBeNull();
  });

  it("pedidos de convidado só entram na conta depois de confirmar o e-mail; o token é de uso único", async () => {
    const email = newEmail();
    const order = await guestOrder(email);
    const user = await createAccount({
      name: "Helena Prado",
      email,
      password: "Jardim#2026",
      marketingOptIn: true,
    });
    // Antes da confirmação o pedido continua sem dono: criar conta com o e-mail de outra pessoa não dá acesso.
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).userId).toBeNull();

    const token = tokenFrom(sent[0], "verificar-email");
    expect(await verifyEmailToken(token)).toEqual({ ok: true, email });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).userId).toBe(user!.id);
    expect((await db.user.findUniqueOrThrow({ where: { email } })).emailVerifiedAt).not.toBeNull();
    expect(await verifyEmailToken(token)).toEqual({ ok: false });
    expect(await verifyEmailToken("f".repeat(64))).toEqual({ ok: false });
    // Consentimento de marketing registrado com o texto aceito.
    expect(await db.lead.findFirst({ where: { email, source: "ACCOUNT" } })).toMatchObject({
      consentText: "Quero receber novidades e ofertas por e-mail.",
    });
  });

  it("redefinição de senha: token em hash, uso único, expira em 1 hora e não revela se o e-mail existe", async () => {
    const email = newEmail();
    await createAccount({
      name: "Helena Prado",
      email,
      password: "Jardim#2026",
      marketingOptIn: false,
    });
    sent.length = 0;

    await requestPasswordReset("nao-existe@example.com");
    expect(sent).toHaveLength(0);

    await requestPasswordReset(email);
    const token = tokenFrom(sent[0], "redefinir-senha");
    const stored = await db.passwordResetToken.findFirstOrThrow({ where: { user: { email } } });
    expect(stored.tokenHash).not.toBe(token);
    expect(Math.round((stored.expiresAt.getTime() - Date.now()) / 60_000)).toBe(60);
    expect(await isResetTokenValid(token)).toBe(true);

    expect(await resetPassword(token, "NovaSenha#2026")).toMatchObject({ ok: true });
    expect(await verifyCredentials(email, "NovaSenha#2026")).not.toBeNull();
    expect(await verifyCredentials(email, "Jardim#2026")).toBeNull();
    expect(await resetPassword(token, "OutraSenha#2026")).toEqual({ ok: false });

    await requestPasswordReset(email);
    await db.passwordResetToken.updateMany({
      where: { user: { email }, usedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await resetPassword(tokenFrom(sent[1], "redefinir-senha"), "OutraSenha#2026")).toEqual({
      ok: false,
    });
  });

  it("exportação traz os dados do cliente e nunca a senha; anonimização apaga dados pessoais e mantém o pedido", async () => {
    const email = newEmail();
    const user = (await createAccount({
      name: "Helena Prado",
      email,
      password: "Jardim#2026",
      phone: "11987654321",
      marketingOptIn: false,
    }))!;
    const order = await guestOrder(email);
    await db.order.update({ where: { id: order.id }, data: { userId: user.id } });
    await db.address.create({
      data: {
        userId: user.id,
        recipientName: "Helena",
        cep: "01310100",
        street: "Avenida Paulista",
        number: "1000",
        district: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        isDefault: true,
      },
    });

    const exported = await exportUserData(user.id);
    expect(exported.cadastro.email).toBe(email);
    expect(exported.enderecos).toHaveLength(1);
    expect(exported.pedidos[0].number).toBe(order.number);
    expect(JSON.stringify(exported)).not.toMatch(/passwordHash|\$2[aby]\$/);

    await anonymizeUser(user.id);
    const anonymized = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { addresses: true },
    });
    expect(anonymized).toMatchObject({
      name: "Cliente anonimizado",
      passwordHash: null,
      phone: null,
      cpf: null,
      isActive: false,
    });
    expect(anonymized.email).not.toBe(email);
    expect(anonymized.anonymizedAt).not.toBeNull();
    expect(anonymized.addresses).toHaveLength(0);
    const kept = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(kept.totalCents).toBe(1000);
    expect(kept).toMatchObject({
      customerName: "Cliente anonimizado",
      customerCpf: null,
      shippingAddress: {},
    });
    expect(kept.customerEmail).not.toBe(email);
    expect(await verifyCredentials(email, "Jardim#2026")).toBeNull();
  });
});

describe("validação de cadastro", () => {
  it("senha com menos de 8 caracteres é recusada; consentimento de marketing nunca vem marcado", () => {
    const short = signupSchema.safeParse({
      name: "Helena Prado",
      email: "h@example.com",
      password: "1234567",
    });
    expect(short.success).toBe(false);
    const ok = signupSchema.parse({
      name: "Helena Prado",
      email: " H@Example.com ",
      password: "12345678",
    });
    expect(ok.email).toBe("h@example.com");
    expect(ok.marketingOptIn).toBe(false);
  });

  it("indicador de força da senha", () => {
    expect(passwordStrength("abc").score).toBe(0);
    expect(passwordStrength("senha123").score).toBeLessThanOrEqual(1);
    expect(passwordStrength("Jardim#2026Flores").score).toBe(4);
  });
});
