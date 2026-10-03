import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/session";
import { paymentMethodLabels } from "@/server/services/order-status";
import { leadSourceLabels } from "./leads";
import { channelLabels } from "./orders";
import type { Period } from "./periods";

/** Pedido conta como venda quando foi pago e não foi cancelado nem devolvido. */
const SOLD = Prisma.sql`o."paidAt" IS NOT NULL AND o.status NOT IN ('CANCELED', 'RETURNED', 'EXPIRED')`;

export type ReportColumn = { label: string; type: "text" | "money" | "number" | "percent" };
export type ReportResult = {
  columns: ReportColumn[];
  rows: Array<Array<string | number | null>>;
  /** Coluna do rótulo e coluna do valor do gráfico. */
  chart?: { label: number; value: number };
  note?: string;
};
export type Report = {
  key: string;
  label: string;
  description: string;
  /** Relatórios de situação atual não dependem do período. */
  usesPeriod: boolean;
  options?: { name: string; label: string; choices: Array<{ value: string; label: string }> };
  build: (period: Period, user: CurrentUser, option: string) => Promise<ReportResult>;
};

const text = (label: string): ReportColumn => ({ label, type: "text" });
const money = (label: string): ReportColumn => ({ label, type: "money" });
const number = (label: string): ReportColumn => ({ label, type: "number" });
const percent = (label: string): ReportColumn => ({ label, type: "percent" });
const n = (value: bigint | number | null | undefined) => Number(value ?? 0);
const rate = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
const between = (period: Period) => Prisma.sql`o."paidAt" BETWEEN ${period.from} AND ${period.to}`;

type Sales = { name: string | null; orders: bigint; revenue: bigint | null };
const salesRows = (rows: Sales[], labels?: Record<string, string>) =>
  rows.map((row) => [
    labels?.[row.name ?? ""] ?? row.name ?? "Não informado",
    n(row.orders),
    n(row.revenue),
    Math.round(n(row.revenue) / Math.max(1, n(row.orders))),
  ]);
const salesColumns = (first: string) => [
  text(first),
  number("Pedidos"),
  money("Faturamento"),
  money("Ticket médio"),
];

export const REPORTS: Report[] = [
  {
    key: "vendas",
    label: "Vendas por período",
    description: "Pedidos pagos, faturamento, descontos e frete, por dia, semana ou mês.",
    usesPeriod: true,
    options: {
      name: "grupo",
      label: "Agrupar por",
      choices: [
        { value: "dia", label: "Dia" },
        { value: "semana", label: "Semana" },
        { value: "mes", label: "Mês" },
      ],
    },
    build: async (period, _user, option) => {
      const unit =
        option === "mes"
          ? Prisma.sql`'month'`
          : option === "semana"
            ? Prisma.sql`'week'`
            : Prisma.sql`'day'`;
      const rows = await db.$queryRaw<
        Array<{
          bucket: string;
          orders: bigint;
          revenue: bigint;
          discount: bigint;
          shipping: bigint;
        }>
      >`
        SELECT to_char(date_trunc(${unit}, o."paidAt" AT TIME ZONE 'America/Sao_Paulo'), 'DD/MM/YYYY') AS bucket,
               COUNT(*) AS orders, SUM(o."totalCents") AS revenue, SUM(o."discountCents" + o."pixDiscountCents") AS discount, SUM(o."shippingCents") AS shipping
        FROM "Order" o WHERE ${SOLD} AND ${between(period)}
        GROUP BY date_trunc(${unit}, o."paidAt" AT TIME ZONE 'America/Sao_Paulo') ORDER BY date_trunc(${unit}, o."paidAt" AT TIME ZONE 'America/Sao_Paulo')`;
      return {
        columns: [
          text(option === "mes" ? "Mês (início)" : option === "semana" ? "Semana (início)" : "Dia"),
          number("Pedidos"),
          money("Faturamento"),
          money("Descontos"),
          money("Frete cobrado"),
          money("Ticket médio"),
        ],
        rows: rows.map((row) => [
          row.bucket,
          n(row.orders),
          n(row.revenue),
          n(row.discount),
          n(row.shipping),
          Math.round(n(row.revenue) / Math.max(1, n(row.orders))),
        ]),
        chart: { label: 0, value: 2 },
      };
    },
  },
  {
    key: "produtos",
    label: "Vendas por produto, variação e categoria",
    description: "O que mais vendeu no período. Administradores veem também o custo e a margem.",
    usesPeriod: true,
    options: {
      name: "grupo",
      label: "Agrupar por",
      choices: [
        { value: "produto", label: "Produto" },
        { value: "variacao", label: "Variação" },
        { value: "categoria", label: "Categoria principal" },
      ],
    },
    build: async (period, user, option) => {
      const group =
        option === "categoria"
          ? Prisma.sql`COALESCE(root.name, c.name, 'Sem categoria')`
          : option === "variacao"
            ? Prisma.sql`i."productName" || COALESCE(' (' || NULLIF(i."variantName", 'Padrão') || ')', '') || ', ' || i.sku`
            : Prisma.sql`i."productName"`;
      const rows = await db.$queryRaw<
        Array<{ name: string; quantity: bigint; revenue: bigint; cost: bigint | null }>
      >`
        SELECT ${group} AS name, SUM(i.quantity) AS quantity, SUM(i."totalCents") AS revenue, SUM(i.quantity * i."unitCostCents") AS cost
        FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
        LEFT JOIN "Product" p ON p.id = i."productId" LEFT JOIN "Category" c ON c.id = p."primaryCategoryId" LEFT JOIN "Category" root ON root.id = c."parentId"
        WHERE ${SOLD} AND ${between(period)} GROUP BY 1 ORDER BY revenue DESC LIMIT 300`;
      const margin = can(user, "reports.margin");
      return {
        columns: [
          text(
            option === "categoria" ? "Categoria" : option === "variacao" ? "Variação" : "Produto",
          ),
          number("Unidades"),
          money("Faturamento"),
          ...(margin ? [money("Custo"), money("Margem"), percent("Margem %")] : []),
        ],
        rows: rows.map((row) => [
          row.name,
          n(row.quantity),
          n(row.revenue),
          ...(margin
            ? [
                row.cost === null ? null : n(row.cost),
                row.cost === null ? null : n(row.revenue) - n(row.cost),
                row.cost === null ? null : rate(n(row.revenue) - n(row.cost), n(row.revenue)),
              ]
            : []),
        ]),
        chart: { label: 0, value: 2 },
        note: margin
          ? "A margem considera o custo cadastrado na variação no momento da venda. Itens sem custo ficam em branco."
          : undefined,
      };
    },
  },
  {
    key: "canais",
    label: "Vendas por canal e origem",
    description:
      "Site, WhatsApp, telefone e loja, e de onde vieram as visitas que compraram (UTM). Inclui os pedidos manuais.",
    usesPeriod: true,
    options: {
      name: "grupo",
      label: "Agrupar por",
      choices: [
        { value: "canal", label: "Canal" },
        { value: "origem", label: "Origem (UTM)" },
      ],
    },
    build: async (period, _user, option) => {
      const rows =
        option === "origem"
          ? await db.$queryRaw<
              Sales[]
            >`SELECT COALESCE(o."utmSource" || COALESCE(' / ' || o."utmMedium", ''), 'direto') AS name, COUNT(*) AS orders, SUM(o."totalCents") AS revenue FROM "Order" o WHERE ${SOLD} AND ${between(period)} GROUP BY 1 ORDER BY revenue DESC`
          : await db.$queryRaw<
              Sales[]
            >`SELECT o.channel::text AS name, COUNT(*) AS orders, SUM(o."totalCents") AS revenue FROM "Order" o WHERE ${SOLD} AND ${between(period)} GROUP BY 1 ORDER BY revenue DESC`;
      return {
        columns: salesColumns(option === "origem" ? "Origem" : "Canal"),
        rows: salesRows(rows, option === "origem" ? undefined : channelLabels),
        chart: { label: 0, value: 2 },
      };
    },
  },
  {
    key: "pagamentos",
    label: "Meios de pagamento e aprovação",
    description:
      "Tentativas de pagamento criadas no período, quantas foram aprovadas e o valor aprovado.",
    usesPeriod: true,
    build: async (period) => {
      const rows = await db.$queryRaw<
        Array<{ method: string; attempts: bigint; approved: bigint; amount: bigint | null }>
      >`
        SELECT p.method::text AS method, COUNT(*) AS attempts, COUNT(*) FILTER (WHERE p.status IN ('PAID', 'REFUNDED')) AS approved,
               SUM(p."amountCents") FILTER (WHERE p.status IN ('PAID', 'REFUNDED')) AS amount
        FROM "Payment" p WHERE p."createdAt" BETWEEN ${period.from} AND ${period.to} GROUP BY 1 ORDER BY amount DESC NULLS LAST`;
      return {
        columns: [
          text("Meio de pagamento"),
          number("Tentativas"),
          number("Aprovadas"),
          percent("Aprovação"),
          money("Valor aprovado"),
        ],
        rows: rows.map((row) => [
          paymentMethodLabels[row.method as keyof typeof paymentMethodLabels] ?? row.method,
          n(row.attempts),
          n(row.approved),
          rate(n(row.approved), n(row.attempts)),
          n(row.amount),
        ]),
        chart: { label: 0, value: 4 },
      };
    },
  },
  {
    key: "entregas",
    label: "Entregas por método e região",
    description: "Pedidos pagos por tipo de entrega ou por estado de destino.",
    usesPeriod: true,
    options: {
      name: "grupo",
      label: "Agrupar por",
      choices: [
        { value: "metodo", label: "Método de entrega" },
        { value: "regiao", label: "Estado" },
        { value: "cidade", label: "Cidade" },
      ],
    },
    build: async (period, _user, option) => {
      const group =
        option === "regiao"
          ? Prisma.sql`COALESCE(o."shippingState", 'Sem entrega')`
          : option === "cidade"
            ? Prisma.sql`COALESCE(o."shippingCity" || '/' || o."shippingState", 'Sem entrega')`
            : Prisma.sql`o."shippingMethodName"`;
      const rows = await db.$queryRaw<Array<Sales & { shipping: bigint }>>`
        SELECT ${group} AS name, COUNT(*) AS orders, SUM(o."totalCents") AS revenue, SUM(o."shippingCents") AS shipping
        FROM "Order" o WHERE ${SOLD} AND ${between(period)} GROUP BY 1 ORDER BY orders DESC LIMIT 200`;
      return {
        columns: [
          text(option === "regiao" ? "Estado" : option === "cidade" ? "Cidade" : "Método"),
          number("Pedidos"),
          money("Faturamento"),
          money("Frete cobrado"),
        ],
        rows: rows.map((row) => [
          row.name ?? "Não informado",
          n(row.orders),
          n(row.revenue),
          n(row.shipping),
        ]),
        chart: { label: 0, value: 1 },
      };
    },
  },
  {
    key: "cupons",
    label: "Cupons",
    description: "Pedidos pagos com cupom no período, o desconto concedido e o faturamento.",
    usesPeriod: true,
    build: async (period) => {
      const rows = await db.$queryRaw<
        Array<{ code: string; orders: bigint; discount: bigint; revenue: bigint }>
      >`
        SELECT o."couponCode" AS code, COUNT(*) AS orders, SUM(o."discountCents") AS discount, SUM(o."totalCents") AS revenue
        FROM "Order" o WHERE ${SOLD} AND ${between(period)} AND o."couponCode" IS NOT NULL GROUP BY 1 ORDER BY orders DESC`;
      return {
        columns: [
          text("Cupom"),
          number("Pedidos"),
          money("Desconto concedido"),
          money("Faturamento"),
        ],
        rows: rows.map((row) => [row.code, n(row.orders), n(row.discount), n(row.revenue)]),
        chart: { label: 0, value: 1 },
      };
    },
  },
  {
    key: "clientes",
    label: "Clientes novos e recorrentes",
    description:
      "Quem comprou pela primeira vez e quem voltou a comprar no período, com a taxa de recompra e o valor médio por cliente.",
    usesPeriod: true,
    build: async (period) => {
      const rows = await db.$queryRaw<
        Array<{ kind: string; customers: bigint; orders: bigint; revenue: bigint }>
      >`
        WITH firsts AS (SELECT o."customerEmail" AS email, MIN(o."paidAt") AS first_paid FROM "Order" o WHERE ${SOLD} GROUP BY 1)
        SELECT CASE WHEN f.first_paid >= ${period.from} THEN 'Novos' ELSE 'Recorrentes' END AS kind,
               COUNT(DISTINCT o."customerEmail") AS customers, COUNT(*) AS orders, SUM(o."totalCents") AS revenue
        FROM "Order" o JOIN firsts f ON f.email = o."customerEmail"
        WHERE ${SOLD} AND ${between(period)} GROUP BY 1 ORDER BY 1`;
      const customers = rows.reduce((sum, row) => sum + n(row.customers), 0);
      const recurring = n(rows.find((row) => row.kind === "Recorrentes")?.customers);
      return {
        columns: [
          text("Clientes"),
          number("Quantidade"),
          number("Pedidos"),
          money("Faturamento"),
          money("Valor médio por cliente"),
        ],
        rows: rows.map((row) => [
          row.kind,
          n(row.customers),
          n(row.orders),
          n(row.revenue),
          Math.round(n(row.revenue) / Math.max(1, n(row.customers))),
        ]),
        chart: { label: 0, value: 3 },
        note: customers
          ? `Taxa de recompra no período: ${rate(recurring, customers).toLocaleString("pt-BR")}% dos clientes que compraram já tinham comprado antes.`
          : undefined,
      };
    },
  },
  {
    key: "leads",
    label: "Leads por origem e conversão",
    description:
      "Contatos captados no período, quantos confirmaram o e-mail e quantos já compraram.",
    usesPeriod: true,
    build: async (period) => {
      const rows = await db.$queryRaw<
        Array<{ source: string; leads: bigint; confirmed: bigint; buyers: bigint }>
      >`
        SELECT l.source::text AS source, COUNT(*) AS leads, COUNT(*) FILTER (WHERE l."confirmedAt" IS NOT NULL) AS confirmed,
               COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Order" o WHERE o."customerEmail" = l.email AND o."paidAt" IS NOT NULL)) AS buyers
        FROM "Lead" l WHERE l."createdAt" BETWEEN ${period.from} AND ${period.to} AND l.source <> 'BACK_IN_STOCK' GROUP BY 1 ORDER BY leads DESC`;
      return {
        columns: [
          text("Origem"),
          number("Leads"),
          number("E-mail confirmado"),
          number("Já compraram"),
          percent("Conversão"),
        ],
        rows: rows.map((row) => [
          leadSourceLabels[row.source] ?? row.source,
          n(row.leads),
          n(row.confirmed),
          n(row.buyers),
          rate(n(row.buyers), n(row.leads)),
        ]),
        chart: { label: 0, value: 1 },
      };
    },
  },
  {
    key: "buscas",
    label: "Buscas na loja",
    description: "O que os visitantes mais procuram e o que procuram e não encontram.",
    usesPeriod: false,
    options: {
      name: "grupo",
      label: "Mostrar",
      choices: [
        { value: "todas", label: "Mais buscados" },
        { value: "sem-resultado", label: "Sem resultado" },
      ],
    },
    build: async (_period, _user, option) => {
      const rows = await db.searchLog.findMany({
        where: option === "sem-resultado" ? { resultsCount: 0 } : {},
        orderBy: { count: "desc" },
        take: 200,
      });
      return {
        columns: [text("Termo"), number("Buscas"), number("Resultados"), text("Última busca")],
        rows: rows.map((row) => [
          row.term,
          row.count,
          row.resultsCount,
          row.lastSearchedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        ]),
        chart: { label: 0, value: 1 },
        note:
          option === "sem-resultado"
            ? "Termos sem resultado mostram produtos que os clientes querem e a loja não tem, ou nomes que valem uma tag no cadastro."
            : undefined,
      };
    },
  },
  {
    key: "estoque",
    label: "Estoque: giro e produtos parados",
    description:
      "Unidades vendidas no período comparadas ao estoque atual. Produtos parados são os que têm estoque e não venderam.",
    usesPeriod: true,
    options: {
      name: "grupo",
      label: "Mostrar",
      choices: [
        { value: "giro", label: "Giro" },
        { value: "parados", label: "Parados" },
      ],
    },
    build: async (period, user, option) => {
      const rows = await db.$queryRaw<
        Array<{ name: string; sku: string; stock: number; sold: bigint; value: bigint | null }>
      >`
        SELECT p.name || COALESCE(' (' || NULLIF(v.name, 'Padrão') || ')', '') AS name, v.sku, v."stockOnHand" AS stock,
               COALESCE((SELECT SUM(i.quantity) FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId" WHERE i."variantId" = v.id AND ${SOLD} AND ${between(period)}), 0) AS sold,
               (v."stockOnHand" * v."costCents")::bigint AS value
        FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
        WHERE p.status <> 'ARCHIVED' AND v."isActive" ORDER BY sold DESC, stock DESC LIMIT 2000`;
      const filtered =
        option === "parados"
          ? rows
              .filter((row) => n(row.sold) === 0 && row.stock > 0)
              .sort((a, b) => b.stock - a.stock)
          : rows.filter((row) => n(row.sold) > 0);
      const value = can(user, "inventory.value_report");
      return {
        columns: [
          text("Produto"),
          text("SKU"),
          number("Em estoque"),
          number("Vendidos no período"),
          number("Giro (vendidos ÷ estoque)"),
          ...(value ? [money("Valor em estoque (custo)")] : []),
        ],
        rows: filtered
          .slice(0, 300)
          .map((row) => [
            row.name,
            row.sku,
            row.stock,
            n(row.sold),
            row.stock > 0 ? Math.round((n(row.sold) / row.stock) * 100) / 100 : null,
            ...(value ? [row.value === null ? null : n(row.value)] : []),
          ]),
        chart: option === "parados" ? { label: 0, value: 2 } : { label: 0, value: 3 },
      };
    },
  },
  {
    key: "cadastro-incompleto",
    label: "Cadastro incompleto",
    description:
      "Produtos com nota de qualidade abaixo de 60, que precisam de fotos, descrição, ficha ou SEO.",
    usesPeriod: false,
    build: async () => {
      const products = await db.product.findMany({
        where: { status: { not: "ARCHIVED" }, qualityScore: { lt: 60 } },
        orderBy: [{ qualityScore: "asc" }, { salesCount30d: "desc" }],
        take: 500,
        select: {
          name: true,
          sku: true,
          status: true,
          qualityScore: true,
          salesCount30d: true,
          _count: { select: { images: true } },
        },
      });
      return {
        columns: [
          text("Produto"),
          text("SKU"),
          text("Situação"),
          number("Qualidade"),
          number("Imagens"),
          number("Vendas em 30 dias"),
        ],
        rows: products.map((product) => [
          product.name,
          product.sku,
          product.status === "ACTIVE" ? "Publicado" : "Rascunho",
          product.qualityScore,
          product._count.images,
          product.salesCount30d,
        ]),
        note: "Abra o produto em Produtos e siga o checklist de qualidade. Comece pelos que mais vendem.",
      };
    },
  },
];

export const getReport = (key: string) => REPORTS.find((report) => report.key === key) ?? null;
