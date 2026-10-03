import { Gift, PenLine, Truck } from "lucide-react";
import type { Metadata } from "next";
import { CategoryTile } from "@/components/store/category-tile";
import { ProductGrid } from "@/components/store/product-card";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { formatBRL } from "@/lib/money";
import { pageMetadata } from "@/lib/seo/metadata";
import { formatCutoff } from "@/lib/template";
import { getCards, getCatalogIndex, getOccasions } from "@/server/services/catalog";
import { getStoreSettings } from "@/server/services/settings";

export const metadata: Metadata = pageMetadata({
  title: "Presentes",
  description:
    "Orquídeas, arranjos, plantas e peças de decoração para presentear, com cartão com a sua mensagem e entrega no mesmo dia em São Paulo.",
  path: "/presentes",
});

export default async function GiftsPage() {
  const [settings, occasions, index] = await Promise.all([
    getStoreSettings(),
    getOccasions(),
    getCatalogIndex(),
  ]);
  const giftIds = index
    .filter((row) => row.isGiftable && row.totalAvailable > 0)
    .sort((a, b) => b.salesCount30d - a.salesCount30d)
    .slice(0, 8)
    .map((row) => row.id);
  const cards = await getCards(giftIds, settings);

  const benefits = [
    { icon: PenLine, text: "Cartão com a sua mensagem, sem custo" },
    { icon: Gift, text: `Embalagem para presente por ${formatBRL(settings.giftWrapPriceCents)}` },
    ...(settings.sameDay.enabled
      ? [
          {
            icon: Truck,
            text: `Entrega hoje em São Paulo para pedidos até ${formatCutoff(settings.sameDay.cutoffTime)}`,
          },
        ]
      : []),
  ];

  return (
    <div className="container-store pt-6 pb-16">
      <Breadcrumb items={[{ label: "Início", href: "/" }, { label: "Presentes" }]} />
      <header className="mt-6">
        <h1 className="type-h1 text-moss-900">Presentes</h1>
        <p className="mt-3 measure type-body-lg text-ink-muted">
          Escolha pela ocasião. Na sacola, escreva a mensagem do cartão e informe quem vai receber.
        </p>
        <ul className="mt-6 flex flex-col gap-3 md:flex-row md:gap-10">
          {benefits.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2 type-small text-ink">
              <Icon
                aria-hidden="true"
                strokeWidth={1.5}
                className="size-5 flex-none text-moss-700"
              />
              {text}
            </li>
          ))}
        </ul>
      </header>

      <section aria-labelledby="ocasioes" className="mt-12">
        <h2 id="ocasioes" className="mb-6 type-h2 text-moss-900">
          Para cada ocasião
        </h2>
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {occasions.map((occasion) => (
            <li key={occasion.id}>
              <CategoryTile
                name={occasion.name}
                href={`/presentes/${occasion.slug}`}
                image={occasion.image}
                sizes="(min-width: 1024px) 20vw, 50vw"
              />
            </li>
          ))}
        </ul>
      </section>

      {cards.length > 0 ? (
        <section aria-labelledby="mais-presenteados" className="mt-16">
          <h2 id="mais-presenteados" className="mb-6 type-h2 text-moss-900">
            Os mais presenteados
          </h2>
          <ProductGrid products={cards} listName="Presentes: mais presenteados" />
        </section>
      ) : null}
    </div>
  );
}
