import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Pagination } from "@/components/ui/pagination";
import { Rating } from "@/components/ui/rating";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { breadcrumbJsonLd, JsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { getStoreRating } from "@/server/services/catalog";
import { getTestimonials } from "@/server/services/content";

type Props = PageProps<"/avaliacoes">;
const PAGE_SIZE = 12;

const pageOf = (value: string | string[] | undefined) =>
  Math.max(1, Number(Array.isArray(value) ? value[0] : value) || 1);

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const page = pageOf((await searchParams).pagina);
  return pageMetadata({
    title: page > 1 ? `Avaliações de clientes, página ${page}` : "Avaliações de clientes",
    description:
      "O que os clientes dizem sobre os produtos e a entrega da loja. Só publicamos avaliações de compras verificadas ou moderadas.",
    path: page > 1 ? `/avaliacoes?pagina=${page}` : "/avaliacoes",
  });
}

export default async function ReviewsPage({ searchParams }: Props) {
  const page = pageOf((await searchParams).pagina);
  const [rating, testimonials, reviews] = await Promise.all([
    getStoreRating(),
    getTestimonials(),
    db.review.findMany({
      where: { status: "APPROVED", product: { status: "ACTIVE" } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        authorName: true,
        authorCity: true,
        rating: true,
        title: true,
        body: true,
        isVerifiedPurchase: true,
        adminReply: true,
        createdAt: true,
        product: { select: { name: true, slug: true } },
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(rating.count / PAGE_SIZE));
  const crumbs = [{ label: "Início", href: "/" }, { label: "Avaliações" }];
  return (
    <div className="container-store py-8 md:py-12">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumb items={crumbs} />
      <h1 className="mt-6 type-h1 text-moss-900">Avaliações de clientes</h1>
      {rating.count > 0 ? (
        <p className="mt-3 flex flex-wrap items-center gap-3 type-body text-ink">
          <Rating value={rating.average} size="md" />
          <span>
            Nota média {rating.average.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} de 5,
            em {rating.count} {rating.count === 1 ? "avaliação" : "avaliações"} de produtos
          </span>
        </p>
      ) : (
        <p className="mt-3 type-body text-ink">
          Ainda não há avaliações publicadas. Quem compra recebe por e-mail o convite para avaliar.
        </p>
      )}

      {page === 1 && testimonials.length > 0 ? (
        <section aria-labelledby="depoimentos" className="mt-10">
          <h2 id="depoimentos" className="type-h2 text-moss-900">
            Sobre a loja
          </h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            {testimonials.map((item) => (
              <li key={item.id} className="border border-line bg-cream-100 p-5">
                <Rating value={item.rating} />
                <p className="mt-3 type-body text-ink">{item.body}</p>
                <p className="mt-3 type-small text-ink-muted">
                  {item.authorName}
                  {item.authorCity ? `, ${item.authorCity}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="avaliacoes-produtos" className="mt-10">
        <h2 id="avaliacoes-produtos" className="type-h2 text-moss-900">
          Sobre os produtos
        </h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {reviews.map((review) => (
            <li key={review.id} className="border border-line bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Rating value={review.rating} />
                <span className="type-caption text-ink-muted">{formatDate(review.createdAt)}</span>
              </div>
              {review.title ? (
                <h3 className="mt-3 type-small font-semibold text-ink">{review.title}</h3>
              ) : null}
              <p className="mt-2 type-body text-ink">{review.body}</p>
              <p className="mt-3 type-small text-ink-muted">
                {review.authorName}
                {review.authorCity ? `, ${review.authorCity}` : ""}
                {review.isVerifiedPurchase ? ". Compra verificada" : ""}
              </p>
              <p className="mt-1 type-small">
                <Link
                  href={`/produto/${review.product.slug}`}
                  className="text-moss-700 underline underline-offset-4"
                >
                  {review.product.name}
                </Link>
              </p>
              {review.adminReply ? (
                <p className="mt-3 border-l-2 border-moss-700 pl-3 type-small text-ink">
                  Resposta da loja: {review.adminReply}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        {totalPages > 1 ? (
          <Pagination
            className="mt-8"
            page={page}
            totalPages={totalPages}
            hrefFor={(target) => (target > 1 ? `/avaliacoes?pagina=${target}` : "/avaliacoes")}
          />
        ) : null}
      </section>
    </div>
  );
}
