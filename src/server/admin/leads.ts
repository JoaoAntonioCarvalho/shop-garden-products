import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ListParams } from "./list";
import { dateRangeOf } from "./list";

export const leadSourceLabels: Record<string, string> = {
  POPUP: "Pop-up de boas-vindas",
  FOOTER: "Rodapé",
  CHECKOUT: "Checkout",
  ACCOUNT: "Conta",
  PRODUCT_REQUEST: "Solicitação de produto",
  CONTACT: "Contato",
  BACK_IN_STOCK: "Avise-me",
};

export function leadWhere(params: ListParams): Prisma.LeadWhereInput {
  const f = params.filters;
  const and: Prisma.LeadWhereInput[] = [];
  if (params.q)
    and.push({
      OR: [
        { email: { contains: params.q.toLowerCase() } },
        { name: { contains: params.q, mode: "insensitive" } },
      ],
    });
  if (f.origem && f.origem in leadSourceLabels) and.push({ source: f.origem as never });
  else and.push({ source: { not: "BACK_IN_STOCK" } });
  if (f.consentimento === "ativo") and.push({ consentAt: { not: null }, unsubscribedAt: null });
  if (f.consentimento === "descadastrado") and.push({ unsubscribedAt: { not: null } });
  if (f.confirmado === "1") and.push({ confirmedAt: { not: null } });
  const range = dateRangeOf(f.de, f.ate);
  if (range) and.push({ createdAt: range });
  return { AND: and };
}
