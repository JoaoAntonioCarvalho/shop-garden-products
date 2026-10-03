import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { PageHeader } from "@/components/admin/admin-shell";
import { MiniForm, type FormValues } from "@/components/admin/entity-form";
import { FilterBar } from "@/components/admin/filter-bar";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { normalizeText } from "@/lib/slug";
import { moderateReviewAction } from "@/server/actions/admin/customers";
import { parseListParams } from "@/server/admin/list";

export const metadata: Metadata = { title: "Avaliações" };

const statusLabels = {
  PENDING: "Aguardando moderação",
  APPROVED: "Aprovada",
  REJECTED: "Rejeitada",
} as const;
const PAGE_SIZE = 20;

export default async function AdminReviewsPage({ searchParams }: PageProps<"/admin/avaliacoes">) {
  await requireAdminPage("reviews.manage");
  const params = parseListParams(await searchParams);
  const f = params.filters;
  const and: Prisma.ReviewWhereInput[] = [];
  const status = f.status ?? "PENDING";
  if (status in statusLabels) and.push({ status: status as keyof typeof statusLabels });
  if (["1", "2", "3", "4", "5"].includes(f.nota)) and.push({ rating: Number(f.nota) });
  if (f.verificada === "1") and.push({ isVerifiedPurchase: true });
  if (params.q)
    and.push({
      OR: [
        { body: { contains: params.q, mode: "insensitive" } },
        { authorName: { contains: params.q, mode: "insensitive" } },
        { product: { searchText: { contains: normalizeText(params.q) } } },
      ],
    });
  const where = { AND: and };
  const [reviews, total] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { product: { select: { name: true, slug: true } } },
    }),
    db.review.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (page: number) =>
    `/admin/avaliacoes?${new URLSearchParams({ ...f, status, ...(params.q ? { busca: params.q } : {}), pagina: String(page) })}`;

  return (
    <>
      <PageHeader
        title="Avaliações"
        description="As avaliações só aparecem na loja depois de aprovadas. O motivo da rejeição é interno e não é enviado ao cliente."
      />
      <FilterBar
        searchPlaceholder="Produto, autor ou texto"
        fields={[
          {
            type: "select",
            name: "status",
            label: "Situação (padrão: aguardando)",
            options: [
              ...Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
              { value: "todas", label: "Todas" },
            ],
          },
          {
            type: "select",
            name: "nota",
            label: "Nota",
            options: [5, 4, 3, 2, 1].map((value) => ({
              value: String(value),
              label: `${value} de 5`,
            })),
          },
          { type: "toggle", name: "verificada", label: "Compra verificada" },
        ]}
      />
      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma avaliação com esses filtros.</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {reviews.map((review) => {
          const act = (action: "reject" | "reply" | "edit") => async (values: FormValues) => {
            "use server";
            return moderateReviewAction({
              action,
              id: review.id,
              ...(values as Record<string, string>),
            } as Parameters<typeof moderateReviewAction>[0]);
          };
          return (
            <li
              key={review.id}
              className="rounded-md border border-border bg-background p-4 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    Nota {review.rating} de 5{review.title ? `: ${review.title}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {review.authorName}
                    {review.authorCity ? `, ${review.authorCity}` : ""}, em{" "}
                    {formatDate(review.createdAt)}. Produto:{" "}
                    <Link
                      href={`/produto/${review.product.slug}`}
                      target="_blank"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {review.product.name}
                    </Link>
                  </p>
                </div>
                <span className="flex flex-wrap gap-1.5">
                  {review.isVerifiedPurchase ? (
                    <Badge variant="secondary">Compra verificada</Badge>
                  ) : null}
                  {review.isSample ? <Badge variant="secondary">Teste</Badge> : null}
                  <Badge
                    variant={
                      review.status === "APPROVED"
                        ? "default"
                        : review.status === "REJECTED"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {statusLabels[review.status]}
                  </Badge>
                </span>
              </div>
              <p className="mt-2 whitespace-pre-line">{review.body}</p>
              {review.adminReply ? (
                <p className="mt-2 border-l-2 border-border pl-3 text-muted-foreground">
                  Resposta da loja: {review.adminReply}
                </p>
              ) : null}
              {review.rejectionReason ? (
                <p className="mt-2 text-muted-foreground">
                  Motivo interno da rejeição: {review.rejectionReason}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-start gap-2">
                {review.status !== "APPROVED" ? (
                  <ActionButton
                    size="sm"
                    action={moderateReviewAction.bind(null, { action: "approve", id: review.id })}
                  >
                    Aprovar
                  </ActionButton>
                ) : null}
                {(
                  [
                    [
                      "reject",
                      "Rejeitar",
                      [{ name: "reason", label: "Motivo interno", type: "text", wide: true }],
                      { reason: review.rejectionReason ?? "" },
                      review.status !== "REJECTED",
                    ],
                    [
                      "reply",
                      "Responder",
                      [
                        {
                          name: "reply",
                          label: "Resposta pública da loja",
                          type: "textarea",
                          rows: 3,
                          wide: true,
                        },
                      ],
                      { reply: review.adminReply ?? "" },
                      true,
                    ],
                    [
                      "edit",
                      "Corrigir digitação",
                      [
                        { name: "title", label: "Título", type: "text", wide: true },
                        {
                          name: "body",
                          label: "Texto",
                          type: "textarea",
                          rows: 4,
                          wide: true,
                          help: "Só para erros de digitação. O texto anterior fica registrado na auditoria.",
                        },
                      ],
                      { title: review.title ?? "", body: review.body },
                      true,
                    ],
                  ] as const
                )
                  .filter(([, , , , visible]) => visible)
                  .map(([action, label, fields, initial]) => (
                    <details
                      key={action}
                      className="rounded-md border border-border px-3 py-1.5 open:w-full"
                    >
                      <summary className="cursor-pointer">{label}</summary>
                      <div className="mt-2">
                        <MiniForm
                          fields={[...fields]}
                          initial={initial}
                          action={act(action)}
                          submitLabel={label}
                          variant={action === "reject" ? "destructive" : "outline"}
                        />
                      </div>
                    </details>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>
      <nav
        aria-label="Paginação"
        className="mt-4 flex items-center justify-between text-sm text-muted-foreground"
      >
        <p>
          {total} {total === 1 ? "avaliação" : "avaliações"}
        </p>
        <div className="flex items-center gap-2">
          {params.page > 1 ? (
            <Button asChild size="sm" variant="outline">
              <Link href={pageHref(params.page - 1)}>Anterior</Link>
            </Button>
          ) : null}
          <span>
            Página {params.page} de {pages}
          </span>
          {params.page < pages ? (
            <Button asChild size="sm" variant="outline">
              <Link href={pageHref(params.page + 1)}>Próxima</Link>
            </Button>
          ) : null}
        </div>
      </nav>
    </>
  );
}
