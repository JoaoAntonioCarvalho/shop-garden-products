import { hasTestDatabase, unique } from "./setup";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { setEmailProvider } from "@/server/providers/email";
import type { EmailMessage } from "@/server/providers/email/types";
import { confirmLead, subscribeLead, unsubscribeLead } from "@/server/services/leads";
import {
  clearRedirectCache,
  logNotFound,
  resolveLegacyRedirect,
} from "@/server/services/legacy-redirects";

const sent: EmailMessage[] = [];
setEmailProvider({ send: async (message) => void sent.push(message) });

const params = (query = "") => new URLSearchParams(query);

describe.skipIf(!hasTestDatabase)("redirecionamentos do site antigo", () => {
  const key = unique("leg").toLowerCase();
  afterAll(async () => {
    await db.redirect.deleteMany({ where: { fromPath: { contains: key } } });
    await db.notFoundLog.deleteMany({ where: { path: { contains: key } } });
  });

  it("usa a tabela, ignorando maiúsculas, barra final e parâmetros de sessão", async () => {
    await db.redirect.create({
      data: {
        fromPath: `/decoracao/${key}-86355227`,
        toPath: "/categoria/plantas-naturais/orquideas",
      },
    });
    await db.redirect.create({
      data: {
        fromPath: `/listaprodutos.asp?adicional1=${key}`,
        toPath: "/colecao/linha-carol-costa",
      },
    });
    clearRedirectCache();
    expect(
      await resolveLegacyRedirect(
        `/Decoracao/${key.toUpperCase()}-86355227/`,
        params("IDLoja=1&mob=true"),
      ),
    ).toEqual({ location: "/categoria/plantas-naturais/orquideas", status: 301 });
    expect(
      await resolveLegacyRedirect("/listaprodutos.asp", params(`avancada=true&Adicional1=${key}`)),
    ).toEqual({ location: "/colecao/linha-carol-costa", status: 301 });
    await expect
      .poll(
        async () =>
          (
            await db.redirect.findUniqueOrThrow({
              where: { fromPath: `/decoracao/${key}-86355227` },
            })
          ).hits,
      )
      .toBe(1);
  });

  it("aplica as regras por padrão quando não há mapa", async () => {
    expect(
      await resolveLegacyRedirect("/listaprodutos.asp", params("avancada=true&Texto=vaso azul")),
    ).toEqual({ location: "/busca?q=vaso%20azul", status: 301 });
    expect(await resolveLegacyRedirect("/listaprodutos.asp", params("Adicional1=000"))).toEqual({
      location: "/colecao/novidades",
      status: 301,
    });
    expect(await resolveLegacyRedirect("/track.asp", params("pedido=1"))).toEqual({
      location: "/rastreio",
      status: 301,
    });
    expect(await resolveLegacyRedirect("/cadastro.asp", params())).toEqual({
      location: "/conta",
      status: 301,
    });
    expect(await resolveLegacyRedirect("/decoracao/vaso-ceramica-azul-123456", params())).toEqual({
      location: "/busca?q=vaso%20ceramica%20azul",
      status: 301,
    });
  });

  it("normaliza endereços do site novo e não toca nos que já estão certos", async () => {
    expect(
      await resolveLegacyRedirect("/produto/zamioculca", params("IDLoja=9&mob=true&cor=verde")),
    ).toEqual({ location: "/produto/zamioculca?cor=verde", status: 301 });
    expect(await resolveLegacyRedirect("/Categoria/Vasos", params())).toEqual({
      location: "/categoria/vasos",
      status: 301,
    });
    expect(
      await resolveLegacyRedirect("/produto/zamioculca", params("utm_source=google")),
    ).toBeNull();
    expect(await resolveLegacyRedirect("/admin/pedidos", params("IDLoja=1"))).toBeNull();
    expect(await resolveLegacyRedirect("/", params())).toBeNull();
  });

  it("registra páginas não encontradas, menos arquivos e áreas internas", async () => {
    await logNotFound(`/${key}-sumiu`);
    await logNotFound(`/${key}-sumiu`);
    await logNotFound(`/admin/${key}`);
    await logNotFound(`/${key}.png`);
    expect(await db.notFoundLog.findUnique({ where: { path: `/${key}-sumiu` } })).toMatchObject({
      hits: 2,
    });
    expect(await db.notFoundLog.count({ where: { path: { contains: key } } })).toBe(1);
  });
});

describe.skipIf(!hasTestDatabase)("leads", () => {
  it("cadastra com consentimento, confirma por link de uso único e descadastra em um clique", async () => {
    const email = `${unique("lead").toLowerCase()}@example.com`;
    const consentText = "Aceito receber novidades e ofertas da Net Shop Garden por e-mail.";
    sent.length = 0;
    const result = await subscribeLead({
      email: email.toUpperCase(),
      source: "FOOTER",
      consentText,
      ipHash: "hash",
      utm: { source: "instagram", medium: "social" },
    });
    expect(result.couponCode).toBe("BEMVINDO10");

    const lead = await db.lead.findFirstOrThrow({ where: { email } });
    expect(lead).toMatchObject({
      source: "FOOTER",
      consentText,
      couponIssued: "BEMVINDO10",
      confirmedAt: null,
      unsubscribedAt: null,
      utm: { source: "instagram", medium: "social" },
    });
    expect(lead.consentAt).not.toBeNull();
    expect(sent).toHaveLength(1);
    const token = /newsletter\/confirmar\/([A-Za-z0-9_-]+)/.exec(sent[0].html)?.[1] ?? "";
    // O banco guarda só o hash do token.
    expect(lead.confirmTokenHash).not.toBe(token);
    expect(sent[0].html).toContain(`/descadastrar/${lead.unsubscribeToken}`);

    // Cadastrar de novo não duplica.
    await subscribeLead({ email, source: "POPUP", consentText, ipHash: "hash" });
    expect(await db.lead.count({ where: { email } })).toBe(1);
    const latest = /newsletter\/confirmar\/([A-Za-z0-9_-]+)/.exec(sent[1].html)?.[1] ?? "";

    expect(await confirmLead(token)).toBe(false); // o link anterior foi substituído
    expect(await confirmLead(latest)).toBe(true);
    expect(await confirmLead(latest)).toBe(false); // uso único
    expect((await db.lead.findFirstOrThrow({ where: { email } })).confirmedAt).not.toBeNull();

    expect(await unsubscribeLead("token-que-nao-existe")).toBeNull();
    expect(await unsubscribeLead(lead.unsubscribeToken)).toBe(email);
    expect((await db.lead.findFirstOrThrow({ where: { email } })).unsubscribedAt).not.toBeNull();
    await db.lead.deleteMany({ where: { email } });
  });
});
