import "server-only";
import { db } from "@/lib/db";
import { refreshAllQualityScores } from "@/server/admin/products";
import { invalidate } from "@/server/cache";
import { sendInternalEmail } from "@/server/services/emails";
import { expireOverduePayments } from "@/server/services/payments";
import { syncCarrierDeliveries } from "@/server/services/tracking";

export type Job = {
  key: string;
  label: string;
  description: string;
  schedule: string;
  run: () => Promise<string>;
};

/**
 * Tarefas agendadas (seção 12.19). Cada uma pode ser chamada por um agendador externo em
 * /api/cron/[tarefa] (com CRON_SECRET) ou pelo botão "Executar agora" do painel.
 */
export const JOBS: Job[] = [
  {
    key: "expirar-pagamentos",
    label: "Expirar Pix e boleto",
    description: "Cancela as cobranças vencidas, expira os pedidos e devolve o estoque reservado.",
    schedule: "A cada 5 minutos",
    run: async () => {
      const count = await expireOverduePayments();
      return `${count} ${count === 1 ? "cobrança expirada" : "cobranças expiradas"}`;
    },
  },
  {
    key: "vendas-30-dias",
    label: "Atualizar vendas de 30 dias",
    description:
      "Recalcula as vendas dos últimos 30 dias de cada produto (ordem de mais vendidos) e a nota de qualidade do cadastro.",
    schedule: "Uma vez por dia, de madrugada",
    run: async () => {
      const updated = await db.$executeRaw`
        UPDATE "Product" p SET "salesCount30d" = COALESCE(s.qty, 0)
        FROM (SELECT p2.id, (SELECT COALESCE(SUM(oi.quantity), 0)::int FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
                             WHERE oi."productId" = p2.id AND o."paidAt" >= NOW() - INTERVAL '30 days'
                               AND o.status NOT IN ('CANCELED', 'EXPIRED', 'RETURNED', 'PENDING_PAYMENT')) AS qty
              FROM "Product" p2) s
        WHERE s.id = p.id AND p."salesCount30d" <> COALESCE(s.qty, 0)`;
      const quality = await refreshAllQualityScores();
      invalidate("catalog", "home");
      return `${updated} produtos com vendas atualizadas, ${quality} notas de qualidade recalculadas`;
    },
  },
  {
    key: "carrinhos-abandonados",
    label: "Marcar carrinhos abandonados",
    description: "Marca como abandonadas as sacolas com itens paradas há mais de 2 horas.",
    schedule: "A cada hora",
    run: async () => {
      const { count } = await db.cart.updateMany({
        where: {
          status: "ACTIVE",
          order: null,
          items: { some: {} },
          lastActivityAt: { lt: new Date(Date.now() - 2 * 3_600_000) },
        },
        data: { status: "ABANDONED" },
      });
      return `${count} ${count === 1 ? "carrinho marcado" : "carrinhos marcados"}`;
    },
  },
  {
    key: "estoque-baixo",
    label: "Resumo de estoque baixo",
    description: "Envia ao e-mail interno a lista de variações com estoque baixo ou zerado.",
    schedule: "Uma vez por dia, de manhã",
    run: async () => {
      const rows = await db.$queryRaw<
        Array<{ name: string; variant: string; sku: string; available: number }>
      >`
        SELECT p.name, v.name AS variant, v.sku, (v."stockOnHand" - v."stockReserved")::int AS available
        FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
        WHERE v."isActive" AND p.status = 'ACTIVE' AND v."stockOnHand" - v."stockReserved" <= v."lowStockThreshold"
        ORDER BY available, p.name LIMIT 200`;
      if (rows.length === 0) return "Nenhuma variação com estoque baixo";
      const sent = await sendInternalEmail("internal-low-stock", {
        items: rows.map((row) => ({
          name: row.variant === "Padrão" ? row.name : `${row.name} (${row.variant})`,
          sku: row.sku,
          available: Math.max(0, row.available),
        })),
      });
      return sent ? `Resumo enviado com ${rows.length} variações` : "O e-mail não foi enviado";
    },
  },
  {
    key: "limpar-carrinhos",
    label: "Limpar carrinhos expirados",
    description:
      "Apaga as sacolas vencidas que não viraram pedido e os registros antigos do limite de requisições.",
    schedule: "Uma vez por dia, de madrugada",
    run: async () => {
      const carts = await db.cart.deleteMany({
        where: { expiresAt: { lt: new Date() }, status: { not: "CONVERTED" }, order: null },
      });
      await db.rateLimitHit
        .deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 2 * 86_400_000) } } })
        .catch(() => undefined);
      return `${carts.count} ${carts.count === 1 ? "carrinho apagado" : "carrinhos apagados"}`;
    },
  },
  {
    key: "rastreio-transportadoras",
    label: "Conferir entregas nas transportadoras",
    description:
      "Consulta o rastreio dos pedidos enviados pelos Correios e pela Jadlog e marca como entregues os que já chegaram. Só funciona com alguma transportadora ligada.",
    schedule: "A cada 2 horas",
    run: async () => {
      const result = await syncCarrierDeliveries();
      if (!result.enabled) return "Nenhuma transportadora ligada";
      return `${result.checked} pedidos conferidos, ${result.delivered} marcados como entregues`;
    },
  },
  {
    key: "atualizar-cache",
    label: "Atualizar a loja com o que está no banco",
    description:
      "Descarta o que a loja guarda em memória (configurações, categorias, catálogo, home e páginas). Use depois de uma carga feita direto no banco, como a importação do catálogo antigo.",
    schedule: "Só quando precisar",
    run: async () => {
      invalidate("settings", "categories", "catalog", "home", "pages");
      return "Loja atualizada";
    },
  },
];

export const getJob = (key: string) => JOBS.find((job) => job.key === key) ?? null;

/** Executa a tarefa e registra o resultado em JobRun. */
export async function runJob(job: Job): Promise<{ ok: boolean; summary: string }> {
  const run = await db.jobRun.create({ data: { name: job.key } });
  try {
    const summary = await job.run();
    await db.jobRun.update({
      where: { id: run.id },
      data: { status: "OK", summary, finishedAt: new Date() },
    });
    return { ok: true, summary };
  } catch (error) {
    const summary = error instanceof Error ? error.message.slice(0, 500) : "Erro desconhecido";
    await db.jobRun.update({
      where: { id: run.id },
      data: { status: "FAILED", summary, finishedAt: new Date() },
    });
    return { ok: false, summary };
  }
}
