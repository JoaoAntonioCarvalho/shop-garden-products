import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/admin-shell";
import { ProductImportWizard } from "@/components/admin/product-import-wizard";
import { requireAdminPage } from "@/lib/admin-guard";
import { IMPORT_FIELDS } from "@/server/admin/product-import";
import { categoryOptions } from "@/server/admin/product-queries";

// Trazer fotos e importar levam mais que o padrão da hospedagem; as ações herdam este limite.
export const maxDuration = 60;

export const metadata: Metadata = { title: "Importar produtos" };

export default async function ImportProductsPage() {
  await requireAdminPage("products.import");
  return (
    <>
      <PageHeader
        back={{ href: "/admin/produtos", label: "Produtos" }}
        title="Importar produtos"
        description="Traga o catálogo do site antigo ou de uma planilha. Nada é gravado antes da prévia."
      />
      <ProductImportWizard
        fields={IMPORT_FIELDS.map((field) => ({
          key: field.key,
          label: field.label,
          required: field.required,
        }))}
        categories={await categoryOptions()}
      />
    </>
  );
}
