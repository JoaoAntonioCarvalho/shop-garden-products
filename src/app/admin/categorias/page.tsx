import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { CategoryTree } from "@/components/admin/category-tree";
import { InlineToggle } from "@/components/admin/inline-controls";
import { Button } from "@/components/admin/ui/button";
import { requireAdminPage } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { toggleResourceAction } from "@/server/actions/admin/resources";

export const metadata: Metadata = { title: "Categorias" };

const flags = [
  ["isActive", "Ativa"],
  ["showInMenu", "No menu"],
  ["showOnHome", "Na home"],
  ["isSecondary", "Secundária"],
] as const;

export default async function AdminCategoriesPage() {
  const user = await requireAdminPage("categories.view");
  const canEdit = can(user, "categories.edit");
  const categories = await db.category.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { primaryProducts: true } } },
  });
  const roots = categories.filter((category) => !category.parentId);

  const row = (category: (typeof categories)[number]) => (
    <div key={category.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
      <div className="min-w-48 flex-1">
        {canEdit ? (
          <Link
            href={`/admin/categorias/${category.id}`}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {category.name}
          </Link>
        ) : (
          <span className="font-medium">{category.name}</span>
        )}
        <span className="block text-xs text-muted-foreground">
          /categoria/{category.path}, {category._count.primaryProducts} produtos
        </span>
      </div>
      {flags.map(([field, label]) => (
        <InlineToggle
          key={field}
          label={label}
          checked={category[field]}
          disabled={!canEdit}
          action={toggleResourceAction.bind(null, "categorias", category.id, field)}
        />
      ))}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Categorias"
        description="Arraste para mudar a ordem no menu e nas listas. Para mudar a categoria pai, arraste até um dos destinos tracejados que aparecem durante o arrasto, ou abra a categoria e escolha a categoria pai."
        actions={
          canEdit ? (
            <Button asChild>
              <Link href="/admin/categorias/novo">Nova categoria</Link>
            </Button>
          ) : null
        }
      />
      <CategoryTree
        canEdit={canEdit}
        roots={roots.map((root) => ({
          id: root.id,
          name: root.name,
          slug: root.slug,
          path: root.path,
          content: row(root),
          children: categories
            .filter((category) => category.parentId === root.id)
            .map((child) => ({
              id: child.id,
              name: child.name,
              slug: child.slug,
              path: child.path,
              content: row(child),
            })),
        }))}
      />
    </>
  );
}
