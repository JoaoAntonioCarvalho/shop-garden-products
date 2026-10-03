import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Rating } from "@/components/ui/rating";
import { formatDate } from "@/lib/dates";
import { getProductReviews } from "@/server/services/catalog";

type Props = {
  productId: string;
  productSlug: string;
  ratingAverage: number;
  page: number;
};

export async function ProductReviews({ productId, productSlug, ratingAverage, page }: Props) {
  const { reviews, total, totalPages, distribution } = await getProductReviews(productId, page);

  return (
    <section id="avaliacoes" aria-labelledby="titulo-avaliacoes" className="mt-20 scroll-mt-28">
      <h2 id="titulo-avaliacoes" className="type-h2 text-moss-900">
        Avaliações
      </h2>

      {total === 0 ? (
        <p className="mt-4 type-body text-ink-muted">
          Este produto ainda não tem avaliações. Quem compra recebe por e-mail o convite para
          avaliar.
        </p>
      ) : (
        <div className="mt-6 grid gap-10 lg:grid-cols-[280px_1fr]">
          <div>
            <p className="flex items-baseline gap-2">
              <span className="text-[44px] leading-none font-semibold text-ink tabular-nums">
                {ratingAverage.toLocaleString("pt-BR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
              </span>
              <span className="type-small text-ink-muted">de 5</span>
            </p>
            <Rating value={ratingAverage} size="md" className="mt-2" />
            <p className="mt-1 type-small text-ink-muted">
              {total} {total === 1 ? "avaliação" : "avaliações"}
            </p>
            <ul className="mt-5 flex flex-col gap-1.5">
              {distribution.map(({ rating, count }) => (
                <li key={rating} className="flex items-center gap-3 type-caption text-ink-muted">
                  <span className="w-16 flex-none">
                    {rating} {rating === 1 ? "estrela" : "estrelas"}
                  </span>
                  <span
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-moss-100"
                    aria-hidden="true"
                  >
                    <span
                      className="block h-full bg-moss-700"
                      style={{ width: `${total ? (count / total) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="w-6 flex-none text-right tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
            <Link
              href={`/conta/avaliar/${productSlug}`}
              className="mt-6 inline-flex min-h-11 items-center type-small font-medium text-moss-700 underline underline-offset-3 hover:text-moss-900"
            >
              Escrever avaliação
            </Link>
          </div>

          <div>
            <ul className="divide-y divide-line border-y border-line">
              {reviews.map((review) => (
                <li key={review.id} className="py-6">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Rating value={review.rating} />
                    {review.isVerifiedPurchase ? <Badge kind="verified" /> : null}
                  </div>
                  {review.title ? (
                    <h3 className="mt-2 type-body font-semibold text-ink">{review.title}</h3>
                  ) : null}
                  <p className="mt-1 measure type-body text-ink">{review.body}</p>
                  <p className="mt-2 type-caption text-ink-muted">
                    {review.authorName}
                    {review.authorCity ? `, ${review.authorCity}` : ""}, em{" "}
                    <time dateTime={review.createdAt.toISOString()}>
                      {formatDate(review.createdAt)}
                    </time>
                  </p>
                  {review.adminReply ? (
                    <div className="mt-4 border-l-2 border-moss-700 bg-cream-100 py-3 pr-4 pl-4">
                      <p className="type-caption font-medium text-moss-700">Resposta da loja</p>
                      <p className="mt-1 type-small text-ink">{review.adminReply}</p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            <Pagination
              className="mt-8"
              page={page}
              totalPages={totalPages}
              hrefFor={(target) =>
                `/produto/${productSlug}${target > 1 ? `?avaliacoes=${target}` : ""}#avaliacoes`
              }
            />
          </div>
        </div>
      )}
    </section>
  );
}
