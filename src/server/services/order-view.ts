import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

const orderViewInclude = {
  items: { orderBy: { id: "asc" } },
  payments: { orderBy: { createdAt: "desc" } },
  statusHistory: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.OrderInclude;

export type OrderView = Prisma.OrderGetPayload<{ include: typeof orderViewInclude }>;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Pedido para quem tem direito de vê-lo: quem tem o token de acesso (link do e-mail) ou o
 * cliente dono do pedido, logado. Sem isso, devolve null.
 */
export async function getOrderForViewer(
  number: string,
  access: { token?: string | null; userId?: string | null },
): Promise<OrderView | null> {
  if (!/^NSG-\d{6,}$/.test(number)) return null;
  const order = await db.order.findUnique({ where: { number }, include: orderViewInclude });
  if (!order) return null;
  if (access.token && safeEqual(access.token, order.accessToken)) return order;
  if (access.userId && order.userId === access.userId) return order;
  return null;
}

export const normalizeOrderNumber = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits ? `NSG-${digits.padStart(6, "0")}` : "";
};
