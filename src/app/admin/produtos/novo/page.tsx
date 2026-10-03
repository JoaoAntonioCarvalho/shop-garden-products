import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/admin-shell";
import { ProductForm } from "@/components/admin/product-form";
import { requireAdminPage } from "@/lib/admin-guard";
import { getEnv } from "@/lib/env";
import {
  categoryOptions,
  collectionOptions,
  emptyProductForm,
} from "@/server/admin/product-queries";
import { productTypeLabels } from "@/server/admin/products";

export const metadata: Metadata = { title: "Novo produto" };

export default async function NewProductPage() {
  await requireAdminPage("products.edit");
  const [categories, collections] = await Promise.all([categoryOptions(), collectionOptions()]);
  return (
    <>
      <PageHeader
        back={{ href: "/admin/produtos", label: "Produtos" }}
        title="Novo produto"
        description="O produto nasce como rascunho. Publique quando as fotos e a descrição estiverem prontas."
      />
      <ProductForm
        data={emptyProductForm()}
        categories={categories}
        collections={collections}
        typeOptions={Object.entries(productTypeLabels).map(([value, label]) => ({ value, label }))}
        canEdit
        canEditImages
        canSeeCost
        storeUrl={getEnv().APP_URL}
      />
    </>
  );
}
