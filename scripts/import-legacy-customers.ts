/**
 * Clientes e pedidos do site antigo, a partir dos relatórios salvos em data-privada/site-antigo
 * (fora do repositório): clientes/, pedidos-itens/ e locais-entrega/.
 *
 * Uso: pnpm import:clientes-antigos [--desde 2022] [--gravar]
 *
 * Sem --gravar só mostra as contagens. Com --gravar:
 *   - cada cliente vira uma conta sem senha (`legacyImportedAt`), fora da newsletter; o dono do
 *     e-mail entra redefinindo a senha;
 *   - cada pedido entra como histórico (canal LEGACY, número ANT-<número antigo>): não mexe em
 *     estoque, não cobra, não envia e-mail e fica fora das vendas (sem `paidAt`).
 * Pode rodar de novo: contas e pedidos que já existem são pulados.
 */
import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  buildLegacyCustomer,
  buildLegacyOrder,
  legacyAddress,
  legacyDate,
  legacyName,
  parseLegacyReport,
  type LegacyOrder,
  type LegacyRow,
} from "@/lib/legacy-customers";

const ROOT = path.join(process.cwd(), "data-privada", "site-antigo");
const args = process.argv.slice(2);
const write = args.includes("--gravar");
const since = Number(args[args.indexOf("--desde") + 1]) || 2022;
const sinceDate = new Date(`${since}-01-01T00:00:00-03:00`);
const now = new Date();

function readReport(folder: string): LegacyRow[] {
  const dir = path.join(ROOT, folder);
  if (!existsSync(dir)) throw new Error(`Pasta não encontrada: ${dir}`);
  return readdirSync(dir)
    .filter((file) => file.endsWith(".xml"))
    .sort()
    .flatMap((file) => parseLegacyReport(readFileSync(path.join(dir, file), "utf8")));
}

const chunks = <T>(list: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, index) =>
    list.slice(index * size, (index + 1) * size),
  );

async function main() {
  // Pedidos: uma linha por item, agrupadas pelo número.
  const byNumber = new Map<string, LegacyRow[]>();
  for (const row of readReport("pedidos-itens")) {
    const created = legacyDate(row["Feito em"]);
    if (!created || created < sinceDate) continue;
    byNumber.set(row["Núm"], [...(byNumber.get(row["Núm"]) ?? []), row]);
  }
  const orders = [...byNumber.values()]
    .map((rows) => buildLegacyOrder(rows, now))
    .filter((order): order is LegacyOrder => order !== null)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const lastNameOf = new Map(orders.map((order) => [order.email, order.customerName]));

  // Clientes: quem comprou no período ou se cadastrou nele.
  const customers = readReport("clientes")
    .filter((row) => {
      const registered = legacyDate(row["Cadastro em"]);
      return lastNameOf.has(row["E-mail"].toLowerCase()) || (registered && registered >= sinceDate);
    })
    .map((row) => buildLegacyCustomer(row, lastNameOf.get(row["E-mail"].toLowerCase())))
    .filter((customer) => customer !== null);
  const customerEmails = new Set(customers.map((customer) => customer.email));

  const [existingUsers, existingOrders, variants] = await Promise.all([
    db.user.findMany({
      select: { id: true, email: true, cpf: true, legacyImportedAt: true, emailVerifiedAt: true },
    }),
    db.order.findMany({ where: { channel: "LEGACY" }, select: { number: true } }),
    db.productVariant.findMany({
      select: {
        id: true,
        sku: true,
        productId: true,
        product: {
          select: {
            images: {
              orderBy: [{ isCover: "desc" }, { position: "asc" }],
              take: 1,
              select: { media: { select: { variants: true } } },
            },
          },
        },
      },
    }),
  ]);
  const knownEmails = new Set(existingUsers.map((user) => user.email));
  const takenCpfs = new Set(existingUsers.map((user) => user.cpf).filter(Boolean));
  const knownOrders = new Set(existingOrders.map((order) => order.number));
  const variantOf = new Map(variants.map((variant) => [variant.sku, variant]));

  const newCustomers = customers
    .filter((customer) => !knownEmails.has(customer.email))
    .map((customer) => {
      const cpf = customer.cpf && !takenCpfs.has(customer.cpf) ? customer.cpf : null;
      if (cpf) takenCpfs.add(cpf);
      return { ...customer, cpf, id: randomUUID() };
    });
  const newOrders = orders.filter((order) => !knownOrders.has(order.number));
  const items = newOrders.flatMap((order) => order.items);

  const count = (list: LegacyOrder[], key: (order: LegacyOrder) => string) =>
    Object.fromEntries(
      [...new Set(list.map(key))]
        .sort()
        .map((value) => [value, list.filter((order) => key(order) === value).length]),
    );
  console.log(`Recorte: de ${since} em diante${write ? "" : " (prévia, nada gravado)"}`);
  console.log({
    clientesNoRecorte: customers.length,
    clientesNovos: newCustomers.length,
    clientesJaExistentes: customers.length - newCustomers.length,
    comCpf: newCustomers.filter((customer) => customer.cpf).length,
    comTelefone: newCustomers.filter((customer) => customer.phone).length,
    comEndereco: newCustomers.filter((customer) => customer.address).length,
    semNomeNoCadastro: newCustomers.filter((customer) => customer.name === "Cliente").length,
    pedidosNoRecorte: orders.length,
    pedidosNovos: newOrders.length,
    pedidosSemClienteNoRecorte: newOrders.filter((order) => !customerEmails.has(order.email))
      .length,
    itens: items.length,
    itensLigadosAProdutoAtual: items.filter((item) => variantOf.has(item.sku)).length,
    porSituacao: count(newOrders, (order) => `${order.legacyStatus} > ${order.status}`),
    porPagamento: count(newOrders, (order) => order.paymentMethod),
    porAno: count(newOrders, (order) => String(order.createdAt.getFullYear())),
    totalEmReais: Math.round(newOrders.reduce((sum, order) => sum + order.totalCents, 0) / 100),
  });
  if (!write) return;

  for (const batch of chunks(newCustomers, 500)) {
    await db.user.createMany({
      data: batch.map((customer) => ({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        cpf: customer.cpf,
        birthDate: customer.birthDate,
        createdAt: customer.createdAt,
        legacyImportedAt: now,
      })),
    });
  }

  // Endereço do cadastro (padrão) e os locais de entrega extras de cada cliente.
  const idOf = new Map(newCustomers.map((customer) => [customer.email, customer.id]));
  const addresses = newCustomers
    .filter((customer) => customer.address)
    .map((customer) => ({ ...customer.address!, userId: customer.id, isDefault: true }));
  for (const row of readReport("locais-entrega")) {
    const userId = idOf.get((row["E-mail cliente"] ?? "").toLowerCase());
    const address = legacyAddress(
      row,
      legacyName(row["Nome de envio"]) || legacyName(row["Nome cliente"]),
    );
    if (!userId || !address) continue;
    addresses.push({ ...address, userId, isDefault: false });
  }
  for (const batch of chunks(addresses, 500)) await db.address.createMany({ data: batch });

  // O pedido só é ligado a contas importadas ou com e-mail confirmado; os demais ligam ao confirmar.
  const ownerOf = new Map<string, string>(idOf);
  for (const user of existingUsers)
    if (user.legacyImportedAt || user.emailVerifiedAt) ownerOf.set(user.email, user.id);

  for (const batch of chunks(newOrders, 200)) {
    const withIds = batch.map((order) => ({ order, id: randomUUID() }));
    await db.$transaction([
      db.order.createMany({
        data: withIds.map(({ order, id }) => ({
          id,
          number: order.number,
          accessToken: randomBytes(24).toString("hex"),
          idempotencyKey: `site-antigo-${order.number}`,
          channel: "LEGACY" as const,
          userId: ownerOf.get(order.email) ?? null,
          customerName: order.customerName,
          customerEmail: order.email,
          customerPhone: order.customerPhone,
          customerCpf: order.customerDocument,
          shippingAddress: order.shippingAddress,
          shippingCity: "city" in order.shippingAddress ? order.shippingAddress.city : null,
          shippingState: "state" in order.shippingAddress ? order.shippingAddress.state : null,
          status: order.status,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          manualPaymentLabel: order.manualPaymentLabel,
          installments: order.installments,
          subtotalCents: order.subtotalCents,
          discountCents: order.discountCents,
          shippingCents: order.shippingCents,
          totalCents: order.totalCents,
          couponCode: order.couponCode,
          shippingMethodCode: order.shippingMethodCode,
          shippingMethodName: order.shippingMethodName,
          trackingCode: order.trackingCode,
          customerNotes: order.customerNotes,
          canceledAt: order.status === "CANCELED" ? order.createdAt : null,
          // Analytics não dispara para pedido antigo.
          purchaseTrackedAt: order.createdAt,
          createdAt: order.createdAt,
        })),
      }),
      db.orderItem.createMany({
        data: withIds.flatMap(({ order, id }) =>
          order.items.map((item) => {
            const variant = variantOf.get(item.sku);
            const image = variant?.product.images[0]?.media.variants as
              Record<string, string> | undefined;
            return {
              orderId: id,
              variantId: variant?.id ?? null,
              productId: variant?.productId ?? null,
              productName: item.productName,
              variantName: item.variantName,
              sku: item.sku,
              imageUrl: image?.["400"] ?? null,
              unitPriceCents: item.unitPriceCents,
              quantity: item.quantity,
              totalCents: item.totalCents,
            };
          }),
        ),
      }),
      db.orderStatusHistory.createMany({
        data: withIds.map(({ order, id }) => ({
          orderId: id,
          toStatus: order.status,
          note: `Pedido do site antigo. Situação lá: ${order.legacyStatus || "sem registro"}.`,
          createdAt: order.createdAt,
        })),
      }),
    ]);
    console.log(`  ${batch.length} pedidos gravados`);
  }

  const admin = await db.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  await logAudit({
    userId: admin?.id ?? null,
    action: "legacy.customers_import",
    entityType: "User",
    diff: {
      desde: since,
      clientes: newCustomers.length,
      enderecos: addresses.length,
      pedidos: newOrders.length,
    },
  });
  console.log(
    `Gravado: ${newCustomers.length} clientes, ${addresses.length} endereços, ${newOrders.length} pedidos.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
