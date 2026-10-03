import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/admin-shell";
import { DataTable } from "@/components/admin/data-table";
import { FilterBar } from "@/components/admin/filter-bar";
import { InlineToggle, SortableList } from "@/components/admin/inline-controls";
import { Button } from "@/components/admin/ui/button";
import { requireAdminPage } from "@/lib/admin-guard";
import { can } from "@/lib/permissions";
import { reorderResourceAction, toggleResourceAction } from "@/server/actions/admin/resources";
import { orderByOf, parseListParams } from "@/server/admin/list";
import { delegateOf } from "@/server/admin/resource";
import { getResource } from "@/server/admin/resources";

type Props = PageProps<"/admin/[recurso]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getResource((await params).recurso)?.plural ?? "Painel" };
}

export default async function ResourceListPage({ params, searchParams }: Props) {
  const resource = getResource((await params).recurso);
  if (!resource) notFound();
  const user = await requireAdminPage(resource.permission);
  const list = resource.list;
  const query = parseListParams(await searchParams);
  const delegate = delegateOf(resource);
  const where = (await list.where?.(query)) ?? {};
  const sortable = list.sortable ?? [];
  const sort = sortable.includes(query.sort ?? "") ? orderByOf(query, sortable, sortable[0]) : null;
  const [records, total, filters, above] = await Promise.all([
    delegate.findMany({
      where,
      include: resource.include,
      orderBy: sort ? { [sort.field]: sort.dir } : list.orderBy,
      ...(list.reorder ? { take: 500 } : { skip: query.skip, take: query.pageSize }),
    }),
    delegate.count({ where }),
    list.filters?.() ?? [],
    list.above?.(user),
  ]);
  const editLink = (id: string, content: React.ReactNode) => (
    <Link
      href={`/admin/${resource.key}/${id}`}
      className="font-medium text-primary underline-offset-2 hover:underline"
    >
      {content}
    </Link>
  );
  const firstColumn = list.columns[0].key;
  const toggles = (id: string, record: Record<string, unknown>) =>
    resource.toggles?.length ? (
      <span className="flex flex-wrap gap-x-4">
        {resource.toggles.map((toggle) => (
          <InlineToggle
            key={toggle.field}
            label={toggle.label}
            checked={record[toggle.field] === true}
            action={toggleResourceAction.bind(null, resource.key, id, toggle.field)}
          />
        ))}
      </span>
    ) : null;
  const columns = resource.toggles?.length
    ? [...list.columns, { key: "__toggles", header: "Opções" }]
    : list.columns;

  return (
    <>
      <PageHeader
        title={resource.plural}
        description={resource.description}
        actions={
          resource.canCreate !== false ? (
            <Button asChild>
              <Link href={`/admin/${resource.key}/novo`}>
                {resource.feminine ? "Nova" : "Novo"} {resource.singular.toLowerCase()}
              </Link>
            </Button>
          ) : null
        }
      />
      {above}
      {list.searchPlaceholder || filters.length ? (
        <FilterBar
          searchPlaceholder={list.searchPlaceholder}
          fields={filters}
          exportHref={
            list.exportKey && can(user, resource.permission)
              ? `/admin/exportar/${list.exportKey}`
              : undefined
          }
        />
      ) : null}
      {list.reorder ? (
        records.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada cadastrado ainda.</p>
        ) : (
          <SortableList
            onReorder={reorderResourceAction.bind(null, resource.key)}
            items={records.map((record) => {
              const cells = list.row(record, user);
              return {
                id: record.id,
                label: resource.nameOf(record),
                content: (
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                    {list.columns.map((column) => (
                      <div
                        key={column.key}
                        className={column.key === firstColumn ? "min-w-48 flex-1" : undefined}
                      >
                        <span className="sr-only">{column.header}: </span>
                        {column.key === firstColumn
                          ? editLink(record.id, cells[column.key])
                          : cells[column.key]}
                      </div>
                    ))}
                    {toggles(record.id, record)}
                  </div>
                ),
              };
            })}
          />
        )
      ) : (
        <DataTable
          label={resource.plural}
          columns={columns.map((column) => ({
            ...column,
            sortable: sortable.includes(column.key),
          }))}
          total={total}
          page={query.page}
          pageSize={query.pageSize}
          sort={sort?.field ?? null}
          dir={sort?.dir ?? "desc"}
          rows={records.map((record) => {
            const cells = list.row(record, user);
            return {
              id: record.id,
              cells: {
                ...cells,
                [firstColumn]: editLink(record.id, cells[firstColumn]),
                __toggles: toggles(record.id, record),
              },
            };
          })}
        />
      )}
    </>
  );
}
