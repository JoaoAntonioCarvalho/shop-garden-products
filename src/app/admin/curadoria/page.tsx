import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { CurationBoard } from "@/components/admin/curation-board";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { requireAdminPage } from "@/lib/admin-guard";
import { cn } from "@/lib/cn";
import { can } from "@/lib/permissions";
import {
  CURATION_PAGE_SIZE,
  curationCounts,
  listCuration,
  parseCurationParams,
  type CurationParams,
  type CurationTab,
} from "@/server/admin/curation";
import { categoryOptions } from "@/server/admin/product-queries";

export const metadata: Metadata = { title: "Curadoria" };

const tabs: Array<{ key: CurationTab; label: string }> = [
  { key: "revisar", label: "A revisar" },
  { key: "mantidos", label: "Mantidos" },
  { key: "destaques", label: "Destaques" },
  { key: "excluidos", label: "Excluídos" },
];

const number = new Intl.NumberFormat("pt-BR");
const selectClass = "h-9 rounded-md border border-input bg-background px-2 text-sm";

function hrefOf(params: CurationParams, change: Partial<CurationParams>): string {
  const next = { ...params, ...change };
  const query = new URLSearchParams();
  if (next.tab !== "revisar") query.set("aba", next.tab);
  if (next.q) query.set("busca", next.q);
  if (next.categoryId) query.set("categoria", next.categoryId);
  if (next.flag) query.set("filtro", next.flag);
  if (next.page > 1) query.set("pagina", String(next.page));
  const text = query.toString();
  return `/admin/curadoria${text ? `?${text}` : ""}`;
}

export default async function CurationPage({ searchParams }: PageProps<"/admin/curadoria">) {
  const user = await requireAdminPage("products.view");
  const params = parseCurationParams(await searchParams);
  const [{ items, total }, counts, categories] = await Promise.all([
    listCuration(params),
    curationCounts(),
    categoryOptions(),
  ]);

  const all = counts.revisar + counts.mantidos + counts.excluidos;
  const decided = counts.mantidos + counts.excluidos;
  const percent = all ? Math.round((decided / all) * 100) : 0;
  const pages = Math.max(1, Math.ceil(total / CURATION_PAGE_SIZE));
  const filtered = Boolean(params.q || params.categoryId || params.flag);

  return (
    <>
      <PageHeader
        title="Curadoria"
        description="Decida o que fica na loja. Manter publica o produto, destaque o coloca na frente, e excluir manda para a aba Excluídos, de onde dá para restaurar."
        actions={
          can(user, "products.import") ? (
            <Button asChild variant="outline">
              <Link href="/admin/produtos/importar">Importar produtos</Link>
            </Button>
          ) : null
        }
      />

      {all > 0 ? (
        <div className="mb-5 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">
              {counts.revisar === 0
                ? "Todos os produtos foram revisados"
                : `Faltam ${number.format(counts.revisar)} de ${number.format(all)} produtos`}
            </p>
            <p className="text-sm text-muted-foreground">
              {number.format(counts.mantidos)} mantidos, {number.format(counts.excluidos)} excluídos
            </p>
          </div>
          <div
            role="progressbar"
            aria-label="Progresso da revisão"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={`${percent}% revisado`}
            className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
        </div>
      ) : null}

      <nav aria-label="Listas da curadoria" className="mb-4 flex flex-wrap gap-1 border-b">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={hrefOf(params, { tab: tab.key, page: 1, flag: "" })}
            aria-current={params.tab === tab.key ? "page" : undefined}
            className={cn(
              "-mb-px flex min-h-10 items-center gap-2 border-b-2 border-transparent px-3 text-sm text-muted-foreground hover:text-foreground",
              params.tab === tab.key && "border-primary font-medium text-foreground",
            )}
          >
            {tab.label}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">
              {number.format(counts[tab.key])}
            </span>
          </Link>
        ))}
      </nav>

      <form action="/admin/curadoria" className="mb-4 flex flex-wrap items-end gap-2">
        {params.tab !== "revisar" ? <input type="hidden" name="aba" value={params.tab} /> : null}
        <div className="flex flex-col gap-1">
          <label htmlFor="curadoria-busca" className="text-sm font-medium">
            Buscar
          </label>
          <Input
            id="curadoria-busca"
            name="busca"
            type="search"
            defaultValue={params.q}
            placeholder="Nome ou código"
            className="w-56"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="curadoria-categoria" className="text-sm font-medium">
            Categoria
          </label>
          <select
            id="curadoria-categoria"
            name="categoria"
            defaultValue={params.categoryId}
            className={cn(selectClass, "w-56")}
          >
            <option value="">Todas</option>
            <option value="sem">Sem categoria</option>
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
        {params.tab !== "excluidos" ? (
          <div className="flex flex-col gap-1">
            <label htmlFor="curadoria-filtro" className="text-sm font-medium">
              Mostrar
            </label>
            <select
              id="curadoria-filtro"
              name="filtro"
              defaultValue={params.flag}
              className={cn(selectClass, "w-48")}
            >
              <option value="">Todos</option>
              <option value="sem-foto">Sem foto</option>
              <option value="sem-estoque">Sem estoque</option>
              <option value="duplicados">Nomes repetidos</option>
            </select>
          </div>
        ) : null}
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
        {filtered ? (
          <Button asChild variant="ghost">
            <Link href={hrefOf({ ...params, q: "", categoryId: "", flag: "" }, { page: 1 })}>
              Limpar filtros
            </Link>
          </Button>
        ) : null}
      </form>

      {all === 0 && counts.excluidos === 0 && !filtered ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">Ainda não há produtos para revisar.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Importe o arquivo de produtos do site antigo e escolha &quot;Importar para a
            curadoria&quot;. Eles entram aqui, fora da loja, até você decidir.
          </p>
        </div>
      ) : (
        <CurationBoard
          // Cada aba começa limpa: o que foi tirado de uma lista precisa aparecer na outra.
          key={params.tab}
          items={items}
          total={total}
          tab={params.tab}
          categories={categories}
          photosPending={counts.photosPending}
          hasMore={total > items.length}
          permissions={{
            edit: can(user, "products.edit"),
            price: can(user, "products.edit_price"),
            remove: can(user, "products.delete"),
            images: can(user, "products.edit_images"),
          }}
        />
      )}

      {pages > 1 ? (
        <nav aria-label="Páginas" className="mt-4 flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Página {params.page} de {pages}, {number.format(total)} produtos
          </p>
          <div className="flex gap-2">
            {params.page > 1 ? (
              <Button asChild variant="outline">
                <Link href={hrefOf(params, { page: params.page - 1 })}>Anterior</Link>
              </Button>
            ) : null}
            {params.page < pages ? (
              <Button asChild variant="outline">
                <Link href={hrefOf(params, { page: params.page + 1 })}>Próxima</Link>
              </Button>
            ) : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}
