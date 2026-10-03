import { headers } from "next/headers";
import Link from "next/link";
import { ProductGrid } from "@/components/store/product-card";
import { SearchBox } from "@/components/store/search-box";
import { getCards, getCatalogIndex, getNavigation } from "@/server/services/catalog";
import { logNotFound } from "@/server/services/legacy-redirects";
import { getStoreSettings } from "@/server/services/settings";

/** Página 404: explica, oferece a busca, as categorias e os mais vendidos, e registra o endereço pedido. */
export async function NotFoundContent() {
  const [settings, navigation, index, list] = await Promise.all([
    getStoreSettings(),
    getNavigation(),
    getCatalogIndex(),
    headers(),
  ]);
  const path = list.get("x-nsg-path");
  if (path) await logNotFound(path);
  const bestsellers = [...index].sort((a, b) => b.salesCount30d - a.salesCount30d).slice(0, 4);
  const cards = await getCards(
    bestsellers.map((row) => row.id),
    settings,
  );
  return (
    <div className="container-store py-12">
      <h1 className="type-h1 text-moss-900">Não encontramos esta página</h1>
      <p className="mt-3 measure type-body text-ink">
        O endereço pode ter mudado ou o produto pode ter saído do catálogo. Busque pelo que você
        procura ou siga por uma das categorias.
      </p>
      <div className="mt-6 max-w-xl">
        <SearchBox className="w-full" />
      </div>
      <nav aria-label="Categorias" className="mt-8">
        <ul className="flex flex-wrap gap-3">
          {navigation.categories.map((category) => (
            <li key={category.href}>
              <Link
                href={category.href}
                className="inline-flex min-h-11 items-center rounded-control border border-moss-700 px-4 type-small text-moss-700 hover:bg-moss-100"
              >
                {category.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {cards.length > 0 ? (
        <section aria-labelledby="mais-vendidos-404" className="mt-12">
          <h2 id="mais-vendidos-404" className="type-h2 text-moss-900">
            Mais vendidos
          </h2>
          <ProductGrid products={cards} listName="Página não encontrada" className="mt-6" />
        </section>
      ) : null}
    </div>
  );
}
