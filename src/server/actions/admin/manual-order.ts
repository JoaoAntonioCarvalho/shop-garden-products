"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { normalizeText } from "@/lib/slug";
import { onlyDigits } from "@/lib/validators/cpf";
import { AdminError, runAdmin, type AdminResult } from "@/server/admin/action";
import {
  computeManualOrder,
  createManualOrder,
  manualOrderSchema,
  toPreview,
  type ManualOrderPreview,
} from "@/server/admin/manual-order";
import { availableOf } from "@/server/services/catalog";
import { getEffectivePriceCents } from "@/server/services/pricing";

export type VariantHit = {
  variantId: string;
  name: string;
  sku: string;
  priceCents: number;
  available: number;
};
export type CustomerHit = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
};

/** Busca de produtos para o pedido manual, mostrando o estoque de cada variação. */
export async function searchVariantsAction(query: string): Promise<VariantHit[]> {
  await requirePermission("orders.create_manual");
  const q = String(query).trim().slice(0, 60);
  if (q.length < 2) return [];
  const variants = await db.productVariant.findMany({
    where: {
      isActive: true,
      product: { status: "ACTIVE" },
      OR: [
        { sku: { contains: q.toUpperCase() } },
        { product: { searchText: { contains: normalizeText(q) } } },
      ],
    },
    take: 12,
    orderBy: { product: { salesCount30d: "desc" } },
    include: { product: { select: { name: true } } },
  });
  return variants.map((variant) => ({
    variantId: variant.id,
    name: `${variant.product.name}${variant.name !== "Padrão" ? ` (${variant.name})` : ""}`,
    sku: variant.sku,
    priceCents: getEffectivePriceCents(variant),
    available: availableOf(variant),
  }));
}

export async function searchCustomersAction(query: string): Promise<CustomerHit[]> {
  await requirePermission("orders.create_manual");
  const q = String(query).trim().slice(0, 60);
  if (q.length < 2) return [];
  const digits = onlyDigits(q);
  return db.user.findMany({
    where: {
      role: "CUSTOMER",
      anonymizedAt: null,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q.toLowerCase() } },
        ...(digits.length >= 4
          ? [{ cpf: { contains: digits } }, { phone: { contains: digits } }]
          : []),
      ],
    },
    take: 8,
    select: { id: true, name: true, email: true, phone: true, cpf: true },
  });
}

/** Prévia calculada no servidor: preços, cupom, frete e totais. */
export async function previewManualOrderAction(
  input: z.input<typeof manualOrderSchema>,
): Promise<{ ok: true; preview: ManualOrderPreview } | { ok: false; error: string }> {
  const user = await requirePermission("orders.create_manual");
  // A prévia aceita o formulário incompleto: só os itens, o cupom e o CEP importam aqui.
  const lenient = manualOrderSchema.safeParse({
    ...input,
    customer: {
      name: input.customer?.name || "Cliente",
      email: input.customer?.email || "previa@example.com",
      id: input.customer?.id,
    },
    shipping: {
      ...input.shipping,
      mode: input.shipping?.mode === "quote" ? "quote" : (input.shipping?.mode ?? "none"),
      code: input.shipping?.code || "previa",
      manualName: input.shipping?.manualName || "Entrega",
    },
    address: {
      ...input.address,
      street: input.address?.street || "-",
      number: input.address?.number || "-",
      city: input.address?.city || "-",
      state: input.address?.state || "SP",
    },
  });
  if (!lenient.success)
    return { ok: false, error: lenient.error.issues[0]?.message ?? "Confira os dados." };
  const computed = await computeManualOrder(
    { ...lenient.data, shipping: { ...lenient.data.shipping, code: input.shipping?.code } },
    user,
  );
  const preview = toPreview(computed);
  // Na prévia, a ausência de opção de entrega escolhida ainda não é um problema.
  preview.problems = preview.problems.filter(
    (problem) => !problem.startsWith("A opção de entrega"),
  );
  return { ok: true, preview };
}

export async function createManualOrderAction(
  input: z.input<typeof manualOrderSchema>,
): Promise<AdminResult<{ number: string }>> {
  return runAdmin<typeof manualOrderSchema, { number: string }>(
    "orders.create_manual",
    manualOrderSchema,
    input,
    async (data, { user, ipHash, userAgent }) => {
      if (data.items.some((item) => item.unitPriceCents != null) && user.role !== "ADMIN") {
        throw new AdminError("Só administradores podem ajustar o preço unitário.");
      }
      const order = await createManualOrder(data, user, { ipHash, userAgent });
      revalidatePath("/admin", "layout");
      return { message: `Pedido ${order.number} criado`, data: { number: order.number } };
    },
  );
}
