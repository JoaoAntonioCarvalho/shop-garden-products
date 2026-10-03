import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { InlineToggle, SortableList } from "@/components/admin/inline-controls";
import { Button } from "@/components/admin/ui/button";
import { requireAdminPage } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { reorderCategoriesAction } from "@/server/actions/admin/catalog-tools";
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
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
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
        description="Arraste para mudar a ordem no menu e nas listas. Para mudar a categoria pai, abra a categoria."
        actions={
          canEdit ? (
            <Button asChild>
              <Link href="/admin/categorias/novo">Nova categoria</Link>
            </Button>
          ) : null
        }
      />
      <SortableList
        onReorder={reorderCategoriesAction}
        items={roots.map((root) => {
          const children = categories.filter((category) => category.parentId === root.id);
          return {
            id: root.id,
            label: root.name,
            content: (
              <>
                {row(root)}
                {children.length ? (
                  <SortableList
                    className="mt-2 ml-2 border-l border-border pl-3"
                    onReorder={reorderCategoriesAction}
                    items={children.map((child) => ({
                      id: child.id,
                      label: child.name,
                      content: row(child),
                    }))}
                  />
                ) : null}
              </>
            ),
          };
        })}
      />
    </>
  );
}
