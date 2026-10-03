import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { FilterBar } from "@/components/admin/filter-bar";
import { MediaLibrary } from "@/components/admin/media-library";
import { Button } from "@/components/admin/ui/button";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { parseListParams } from "@/server/admin/list";
import { mediaUsage, mediaUsageInclude, toMediaItem, unusedMediaWhere } from "@/server/admin/media";

export const metadata: Metadata = { title: "Mídia" };

const PAGE_SIZE = 48;

export default async function AdminMediaPage({ searchParams }: PageProps<"/admin/midia">) {
  const user = await requireAdminPage("media.view");
  const params = parseListParams(await searchParams);
  const and: Prisma.MediaAssetWhereInput[] = [];
  if (params.q)
    and.push({
      OR: [
        { alt: { contains: params.q, mode: "insensitive" } },
        { originalName: { contains: params.q, mode: "insensitive" } },
      ],
    });
  if (params.filters["sem-alt"] === "1") and.push({ alt: "" });
  if (params.filters["nao-usadas"] === "1") and.push(unusedMediaWhere);
  if (params.filters.teste === "1") and.push({ isSample: true });
  if (params.filters.teste === "0") and.push({ isSample: false });
  const where = { AND: and };
  const [assets, total] = await Promise.all([
    db.mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: mediaUsageInclude,
    }),
    db.mediaAsset.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const query = (page: number) => {
    const search = new URLSearchParams({
      ...params.filters,
      ...(params.q ? { busca: params.q } : {}),
      ...(page > 1 ? { pagina: String(page) } : {}),
    });
    return `/admin/midia${search.size ? `?${search}` : ""}`;
  };
  return (
    <>
      <PageHeader
        title="Mídia"
        description="As imagens enviadas perdem os metadados (inclusive localização) e ganham versões WebP de 400, 800 e 1600 px."
      />
      <FilterBar
        searchPlaceholder="Nome do arquivo ou texto alternativo"
        fields={[
          { type: "toggle", name: "sem-alt", label: "Sem texto alternativo" },
          { type: "toggle", name: "nao-usadas", label: "Não utilizadas" },
          {
            type: "select",
            name: "teste",
            label: "Dados de teste",
            options: [
              { value: "1", label: "Só de teste" },
              { value: "0", label: "Só reais" },
            ],
          },
        ]}
      />
      <MediaLibrary
        canUpload={can(user, "media.upload")}
        canDelete={can(user, "media.delete")}
        items={assets.map((asset) => ({
          ...toMediaItem(asset),
          sizeLabel:
            asset.sizeBytes >= 1024 * 1024
              ? `${(asset.sizeBytes / 1024 / 1024).toFixed(1)} MB`
              : `${Math.round(asset.sizeBytes / 1024)} KB`,
          createdAt: formatDate(asset.createdAt),
          isSample: asset.isSample,
          usage: mediaUsage(asset),
        }))}
      />
      <nav
        aria-label="Paginação"
        className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground"
      >
        <p>
          {total} {total === 1 ? "imagem" : "imagens"}
        </p>
        <div className="flex items-center gap-2">
          {params.page > 1 ? (
            <Button asChild size="sm" variant="outline">
              <Link href={query(params.page - 1)}>Anterior</Link>
            </Button>
          ) : null}
          <span>
            Página {params.page} de {pages}
          </span>
          {params.page < pages ? (
            <Button asChild size="sm" variant="outline">
              <Link href={query(params.page + 1)}>Próxima</Link>
            </Button>
          ) : null}
        </div>
      </nav>
    </>
  );
}
