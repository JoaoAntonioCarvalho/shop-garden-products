import { Heart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProductGrid } from "@/components/store/product-card";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireAccountUser } from "@/lib/account-guard";
import { db } from "@/lib/db";
import { getCards } from "@/server/services/catalog";
import { getStoreSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Favoritos" };

export default async function WishlistPage() {
  const user = await requireAccountUser("/conta/favoritos");
  const [settings, wishlist] = await Promise.all([
    getStoreSettings(),
    db.wishlist.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { productId: true },
    }),
  ]);
  const cards = await getCards(
    wishlist.map((item) => item.productId),
    settings,
  );

  return (
    <div>
      <h1 className="type-h1 text-moss-900">Favoritos</h1>
      {cards.length === 0 ? (
        <EmptyState
          icon={<Heart aria-hidden="true" strokeWidth={1.5} />}
          title="Você ainda não tem favoritos"
          description="Toque no coração dos produtos para guardá-los aqui."
          action={
            <Link href="/colecao/mais-vendidos" className={buttonClasses("secondary")}>
              Ver mais vendidos
            </Link>
          }
        />
      ) : (
        <ProductGrid products={cards} listName="Favoritos" className="mt-6 lg:grid-cols-3" />
      )}
    </div>
  );
}
