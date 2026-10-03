import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { PageHeader } from "@/components/admin/admin-shell";
import { ProductForm } from "@/components/admin/product-form";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { can } from "@/lib/permissions";
import { duplicateProductAction } from "@/server/actions/admin/products";
import { actionLabel, userNames } from "@/server/admin/audit";
import { movementLabels } from "@/server/admin/inventory";
import {
  categoryOptions,
  collectionOptions,
  deliveryAreaOptions,
  loadProductForm,
} from "@/server/admin/product-queries";
import { productTypeLabels } from "@/server/admin/products";

export const metadata: Metadata = { title: "Editar produto" };

export default async function EditProductPage({ params }: PageProps<"/admin/produtos/[id]">) {
  const user = await requireAdminPage("products.view");
  const { id } = await params;
  const [data, categories, collections, audits, movements] = await Promise.all([
    loadProductForm(id),
    categoryOptions(),
    collectionOptions(),
    db.auditLog.findMany({
      where: { entityType: "Product", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.inventoryMovement.findMany({
      where: { variant: { productId: id } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { variant: { select: { name: true, sku: true } } },
    }),
  ]);
  if (!data) notFound();
  const names = await userNames(audits.map((entry) => entry.userId));
  const slug = String(data.values.slug);
  const status = String(data.values.status);

  const history = (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alterações</CardTitle>
        </CardHeader>
        <CardContent>
          {audits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
          ) : null}
          <ul className="flex flex-col gap-2 text-sm">
            {audits.map((entry) => (
              <li key={entry.id} className="border-l-2 border-border pl-3">
                {actionLabel(entry.action)}
                <span className="block text-xs text-muted-foreground">
                  {formatDateTime(entry.createdAt)}, por{" "}
                  {(entry.userId && names.get(entry.userId)) || "sistema"}
                  {entry.diff && typeof entry.diff === "object"
                    ? `. Campos: ${Object.keys(entry.diff).slice(0, 8).join(", ")}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimentos de estoque</CardTitle>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum movimento.</p>
          ) : null}
          <ul className="flex flex-col gap-2 text-sm">
            {movements.map((movement) => (
              <li key={movement.id} className="border-l-2 border-border pl-3">
                {movementLabels[movement.type]}:{" "}
                {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity} (
                {movement.variant.sku})
                <span className="block text-xs text-muted-foreground">
                  {formatDateTime(movement.createdAt)}. Em estoque depois:{" "}
                  {movement.stockOnHandAfter}
                  {movement.reason ? `. ${movement.reason}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <>
      <PageHeader
        back={{ href: "/admin/produtos", label: "Produtos" }}
        title={String(data.values.name)}
        actions={
          <>
            <Button asChild variant="outline">
              <Link
                href={status === "DRAFT" ? `/produto/${slug}?previa=1` : `/produto/${slug}`}
                target="_blank"
              >
                {status === "DRAFT" ? "Ver prévia" : "Ver na loja"}
              </Link>
            </Button>
            {can(user, "products.edit") ? (
              <ActionButton variant="outline" action={duplicateProductAction.bind(null, { id })}>
                Duplicar
              </ActionButton>
            ) : null}
          </>
        }
      />
      <ProductForm
        key={id}
        data={data}
        categories={categories}
        collections={collections}
        deliveryAreas={await deliveryAreaOptions()}
        typeOptions={Object.entries(productTypeLabels).map(([value, label]) => ({ value, label }))}
        canEdit={can(user, "products.edit")}
        canEditImages={can(user, "products.edit_images")}
        canSeeCost={can(user, "products.view_cost")}
        storeUrl={getEnv().APP_URL}
        history={history}
      />
    </>
  );
}
