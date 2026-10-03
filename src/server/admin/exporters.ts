import "server-only";
import { formatDate, formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatCentsPlain } from "@/lib/money";
import type { Permission } from "@/lib/permissions";
import {
  orderStatusLabels,
  paymentMethodLabels,
  paymentStatusLabels,
} from "@/server/services/order-status";
import { stripHtml } from "@/lib/sanitize";
import { listCustomers } from "./customers";
import { movementLabels, movementWhere } from "./inventory";
import { leadSourceLabels, leadWhere } from "./leads";
import type { ListParams } from "./list";
import { IMPORT_FIELDS } from "./product-import";
import { productWhere } from "./product-queries";
import { productTypeLabels } from "./products";
import { channelLabels, orderWhere, sourceLabel } from "./orders";

export type Exporter = {
  permission: Permission;
  /** Entidade registrada na auditoria: "orders.export", "customers.export"... */
  auditEntity: string;
  build: (
    params: ListParams,
    raw: Record<string, string>,
  ) => Promise<{ headers: string[]; rows: unknown[][] }>;
};

const EXPORT_LIMIT = 10_000;

/** Exportações CSV do painel. Cada módulo registra a sua aqui. */
export const exporters: Record<string, Exporter> = {
  pedidos: {
    permission: "orders.export",
    auditEntity: "orders",
    build: async (params) => {
      const orders = await db.order.findMany({
        where: orderWhere(params),
        orderBy: { createdAt: "desc" },
        take: EXPORT_LIMIT,
      });
      return {
        headers: [
          "Número",
          "Data",
          "Cliente",
          "E-mail",
          "Status",
          "Pagamento",
          "Status do pagamento",
          "Subtotal",
          "Desconto",
          "Desconto Pix",
          "Frete",
          "Total",
          "Entrega",
          "Cidade",
          "UF",
          "Canal",
          "Origem",
          "Cupom",
        ],
        rows: orders.map((order) => [
          order.number,
          formatDateTime(order.createdAt),
          order.customerName,
          order.customerEmail,
          orderStatusLabels[order.status],
          order.manualPaymentLabel ?? paymentMethodLabels[order.paymentMethod],
          paymentStatusLabels[order.paymentStatus],
          formatCentsPlain(order.subtotalCents),
          formatCentsPlain(order.discountCents),
          formatCentsPlain(order.pixDiscountCents),
          formatCentsPlain(order.shippingCents),
          formatCentsPlain(order.totalCents),
          order.shippingMethodName,
          order.shippingCity,
          order.shippingState,
          channelLabels[order.channel],
          sourceLabel(order),
          order.couponCode,
        ]),
      };
    },
  },
  produtos: {
    permission: "products.export",
    auditEntity: "products",
    build: async (params) => {
      const products = await db.product.findMany({
        where: await productWhere(params),
        orderBy: { name: "asc" },
        take: EXPORT_LIMIT,
        include: {
          primaryCategory: { select: { name: true, parent: { select: { name: true } } } },
          variants: { orderBy: { position: "asc" } },
        },
      });
      // Mesmo formato do modelo de importação: uma linha por variação.
      return {
        headers: IMPORT_FIELDS.map((field) => field.column),
        rows: products.flatMap((product) =>
          product.variants.map((variant) => [
            product.sku,
            product.name,
            product.primaryCategory
              ? [product.primaryCategory.parent?.name, product.primaryCategory.name]
                  .filter(Boolean)
                  .join(" > ")
              : "",
            productTypeLabels[product.productType],
            product.status === "ACTIVE"
              ? "publicado"
              : product.status === "DRAFT"
                ? "rascunho"
                : "arquivado",
            product.brand,
            product.tags.join(", "),
            product.shortDescription,
            stripHtml(product.description),
            "",
            variant.sku,
            variant.name,
            formatCentsPlain(variant.priceCents),
            variant.compareAtPriceCents == null
              ? ""
              : formatCentsPlain(variant.compareAtPriceCents),
            variant.promoPriceCents == null ? "" : formatCentsPlain(variant.promoPriceCents),
            variant.promoStartsAt ? formatDate(variant.promoStartsAt) : "",
            variant.promoEndsAt ? formatDate(variant.promoEndsAt) : "",
            variant.stockOnHand,
            variant.weightGrams,
          ]),
        ),
      };
    },
  },
  cupons: {
    permission: "coupons.manage",
    auditEntity: "coupons",
    build: async (params) => {
      const coupons = await db.coupon.findMany({
        where: params.filters.lote ? { batch: params.filters.lote } : {},
        orderBy: { createdAt: "desc" },
        take: EXPORT_LIMIT,
      });
      return {
        headers: [
          "Código",
          "Tipo",
          "Valor",
          "Usos",
          "Limite de usos",
          "Início",
          "Fim",
          "Ativo",
          "Lote",
        ],
        rows: coupons.map((coupon) => [
          coupon.code,
          coupon.type === "PERCENT"
            ? "Percentual"
            : coupon.type === "FIXED"
              ? "Valor fixo"
              : "Frete grátis",
          coupon.type === "FIXED"
            ? formatCentsPlain(coupon.value)
            : coupon.type === "PERCENT"
              ? `${coupon.value}%`
              : "",
          coupon.usageCount,
          coupon.usageLimit,
          coupon.startsAt ? formatDateTime(coupon.startsAt) : "",
          coupon.endsAt ? formatDateTime(coupon.endsAt) : "",
          coupon.isActive ? "sim" : "não",
          coupon.batch,
        ]),
      };
    },
  },
  redirecionamentos: {
    permission: "redirects.manage",
    auditEntity: "redirects",
    build: async () => {
      const redirects = await db.redirect.findMany({
        orderBy: { fromPath: "asc" },
        take: EXPORT_LIMIT,
      });
      return {
        headers: ["origem", "destino", "codigo", "acessos", "ativo"],
        rows: redirects.map((redirect) => [
          redirect.fromPath,
          redirect.toPath,
          redirect.statusCode,
          redirect.hits,
          redirect.isActive ? "sim" : "não",
        ]),
      };
    },
  },
  estoque: {
    permission: "inventory.view",
    auditEntity: "inventory",
    build: async (params) => {
      const movements = await db.inventoryMovement.findMany({
        where: movementWhere(params),
        orderBy: { createdAt: "desc" },
        take: EXPORT_LIMIT,
        include: {
          variant: { select: { sku: true, product: { select: { name: true } } } },
          order: { select: { number: true } },
        },
      });
      return {
        headers: [
          "Data",
          "Produto",
          "SKU",
          "Tipo",
          "Quantidade",
          "Em estoque depois",
          "Reservado depois",
          "Motivo",
          "Pedido",
        ],
        rows: movements.map((movement) => [
          formatDateTime(movement.createdAt),
          movement.variant.product.name,
          movement.variant.sku,
          movementLabels[movement.type],
          movement.quantity,
          movement.stockOnHandAfter,
          movement.stockReservedAfter,
          movement.reason,
          movement.order?.number,
        ]),
      };
    },
  },
  clientes: {
    permission: "customers.export",
    auditEntity: "customers",
    build: async (params) => {
      const { rows } = await listCustomers(params, { all: true });
      return {
        headers: [
          "Nome",
          "E-mail",
          "Telefone",
          "Cidade",
          "UF",
          "Pedidos pagos",
          "Total gasto",
          "Último pedido",
          "Aceita e-mail",
          "Aceita WhatsApp",
          "Cadastro",
        ],
        rows: rows.map((customer) => [
          customer.name,
          customer.email,
          customer.phone,
          customer.city,
          customer.state,
          customer.orders,
          formatCentsPlain(customer.totalCents),
          customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "",
          customer.marketingEmailOptIn ? "sim" : "não",
          customer.marketingWhatsappOptIn ? "sim" : "não",
          formatDate(customer.createdAt),
        ]),
      };
    },
  },
  leads: {
    permission: "leads.export",
    auditEntity: "leads",
    build: async (params) => {
      // Só quem deu consentimento e não se descadastrou pode ir para uma lista de envio.
      const leads = await db.lead.findMany({
        where: { AND: [leadWhere(params), { consentAt: { not: null }, unsubscribedAt: null }] },
        orderBy: { createdAt: "desc" },
        take: EXPORT_LIMIT,
      });
      return {
        headers: [
          "E-mail",
          "Nome",
          "WhatsApp",
          "Origem",
          "Consentimento em",
          "Confirmado em",
          "Cupom",
          "Cadastro",
        ],
        rows: leads.map((lead) => [
          lead.email,
          lead.name,
          lead.whatsapp,
          leadSourceLabels[lead.source],
          lead.consentAt ? formatDateTime(lead.consentAt) : "",
          lead.confirmedAt ? formatDateTime(lead.confirmedAt) : "",
          lead.couponIssued,
          formatDateTime(lead.createdAt),
        ]),
      };
    },
  },
};
