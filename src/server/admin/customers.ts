import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { onlyDigits } from "@/lib/validators/cpf";
import type { ListParams } from "./list";

export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: Date;
  marketingEmailOptIn: boolean;
  marketingWhatsappOptIn: boolean;
  isSample: boolean;
  orders: number;
  totalCents: number;
  lastOrderAt: Date | null;
  city: string | null;
  state: string | null;
};

const SORTS: Record<string, Prisma.Sql> = {
  name: Prisma.sql`u.name`,
  createdAt: Prisma.sql`u."createdAt"`,
  orders: Prisma.sql`orders`,
  totalCents: Prisma.sql`"totalCents"`,
  lastOrderAt: Prisma.sql`"lastOrderAt"`,
};

/**
 * Lista de clientes com os números de compra (pedidos pagos, total gasto, último pedido), em uma
 * consulta. Os filtros da seção 12.9 comparam esses números, por isso a lista é montada em SQL.
 */
export async function listCustomers(
  params: ListParams,
  options: { all?: boolean } = {},
): Promise<{ rows: CustomerRow[]; total: number }> {
  const f = params.filters;
  const conditions: Prisma.Sql[] = [
    Prisma.sql`u.role = 'CUSTOMER'`,
    Prisma.sql`u."anonymizedAt" IS NULL`,
  ];
  if (params.q) {
    const like = `%${params.q.toLowerCase()}%`;
    const digits = onlyDigits(params.q);
    conditions.push(
      digits.length >= 4
        ? Prisma.sql`(LOWER(u.name) LIKE ${like} OR u.email LIKE ${like} OR u.cpf LIKE ${`%${digits}%`} OR u.phone LIKE ${`%${digits}%`})`
        : Prisma.sql`(f_unaccent(LOWER(u.name)) LIKE f_unaccent(${like}) OR u.email LIKE ${like})`,
    );
  }
  if (f.pedidos === "com") conditions.push(Prisma.sql`COALESCE(s.orders, 0) > 0`);
  if (f.pedidos === "sem") conditions.push(Prisma.sql`COALESCE(s.orders, 0) = 0`);
  const min = Number(f["gasto-min"]);
  const max = Number(f["gasto-max"]);
  if (Number.isFinite(min) && min > 0)
    conditions.push(Prisma.sql`COALESCE(s.total, 0) >= ${Math.round(min * 100)}`);
  if (Number.isFinite(max) && max > 0)
    conditions.push(Prisma.sql`COALESCE(s.total, 0) <= ${Math.round(max * 100)}`);
  const days = Number(f["sem-comprar"]);
  if (Number.isFinite(days) && days > 0)
    conditions.push(Prisma.sql`s.last_order < NOW() - (${days} || ' days')::interval`);
  if (/^[A-Za-z]{2}$/.test(f.uf ?? ""))
    conditions.push(Prisma.sql`a.state = ${f.uf.toUpperCase()}`);
  if (f.consentimento === "email") conditions.push(Prisma.sql`u."marketingEmailOptIn"`);
  if (f.consentimento === "whatsapp") conditions.push(Prisma.sql`u."marketingWhatsappOptIn"`);
  if (f.consentimento === "nenhum")
    conditions.push(Prisma.sql`NOT u."marketingEmailOptIn" AND NOT u."marketingWhatsappOptIn"`);
  if (f.aniversario === "1")
    conditions.push(
      Prisma.sql`EXTRACT(MONTH FROM u."birthDate") = EXTRACT(MONTH FROM NOW() AT TIME ZONE 'America/Sao_Paulo')`,
    );
  if (f.teste === "1") conditions.push(Prisma.sql`u."isSample"`);
  if (f.teste === "0") conditions.push(Prisma.sql`NOT u."isSample"`);

  const from = Prisma.sql`
    FROM "User" u
    LEFT JOIN (SELECT "userId", COUNT(*)::int AS orders, SUM("totalCents")::int AS total, MAX("createdAt") AS last_order
               FROM "Order" WHERE "paidAt" IS NOT NULL AND "userId" IS NOT NULL GROUP BY 1) s ON s."userId" = u.id
    LEFT JOIN LATERAL (SELECT city, state FROM "Address" WHERE "userId" = u.id ORDER BY "isDefault" DESC, "createdAt" LIMIT 1) a ON true
    WHERE ${Prisma.join(conditions, " AND ")}`;
  const sort = SORTS[params.sort ?? ""] ?? SORTS.createdAt;
  const direction = params.dir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const page = options.all
    ? Prisma.sql`LIMIT 10000`
    : Prisma.sql`LIMIT ${params.pageSize} OFFSET ${params.skip}`;
  const [rows, count] = await Promise.all([
    db.$queryRaw<CustomerRow[]>`
      SELECT u.id, u.name, u.email, u.phone, u."createdAt", u."marketingEmailOptIn", u."marketingWhatsappOptIn", u."isSample",
             COALESCE(s.orders, 0) AS orders, COALESCE(s.total, 0) AS "totalCents", s.last_order AS "lastOrderAt", a.city, a.state
      ${from} ORDER BY ${sort} ${direction} NULLS LAST, u.id ${page}`,
    db.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*)::int AS count ${from}`,
  ]);
  return { rows, total: count[0]?.count ?? 0 };
}

/** Recalcula a nota média e a contagem de avaliações aprovadas do produto. */
export async function refreshProductRating(productId: string): Promise<void> {
  const stats = await db.review.aggregate({
    where: { productId, status: "APPROVED" },
    _avg: { rating: true },
    _count: true,
  });
  await db.product.update({
    where: { id: productId },
    data: {
      ratingAverage: Math.round((stats._avg.rating ?? 0) * 10) / 10,
      ratingCount: stats._count,
    },
  });
}

/** Carrinhos abandonados: identificados, com itens, sem atividade há mais de 2 horas e sem pedido. */
export const abandonedCartWhere = (): Prisma.CartWhereInput => ({
  status: { not: "CONVERTED" },
  order: null,
  items: { some: {} },
  lastActivityAt: { lt: new Date(Date.now() - 2 * 3_600_000) },
  OR: [{ email: { not: null } }, { userId: { not: null } }],
});

/** Início da janela de 30 dias usada na taxa de recuperação de carrinhos. */
export const recoveryWindowStart = () => new Date(Date.now() - 30 * 86_400_000);
