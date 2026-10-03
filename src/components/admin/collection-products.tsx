"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { SortableList } from "@/components/admin/inline-controls";
import { SearchPicker } from "@/components/admin/search-picker";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { toast } from "@/components/ui/toast";
import { setCollectionProductsAction } from "@/server/actions/admin/catalog-tools";
import { searchProductsAction } from "@/server/actions/admin/products";

type Item = { id: string; name: string; sku: string; active: boolean };

/** Produtos de uma coleção manual: adicionar pela busca, ordenar e remover. Cada mudança é gravada na hora. */
export function CollectionProducts({
  collectionId,
  items,
}: {
  collectionId: string;
  items: Item[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const save = (ids: string[]) => setCollectionProductsAction(collectionId, ids);
  const change = (ids: string[]) =>
    startTransition(async () => {
      const result = await save(ids);
      if (result.ok) {
        toast(result.message);
        router.refresh();
      } else toast(result.error, { tone: "error" });
    });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Produtos da coleção</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <SearchPicker
          id="colecao-adicionar"
          label="Adicionar produto"
          placeholder="Nome ou SKU"
          search={searchProductsAction}
          render={(hit) => `${hit.name}, ${hit.sku}`}
          onPick={(hit) =>
            !items.some((item) => item.id === hit.id) &&
            change([...items.map((item) => item.id), hit.id])
          }
        />
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produto na coleção.</p>
        ) : null}
        <SortableList
          onReorder={save}
          items={items.map((item) => ({
            id: item.id,
            label: item.name,
            content: (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {item.name}
                  <span className="block text-xs text-muted-foreground">
                    {item.sku}
                    {item.active ? "" : ", fora da loja"}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover ${item.name} da coleção`}
                  disabled={pending}
                  onClick={() =>
                    change(items.filter((entry) => entry.id !== item.id).map((entry) => entry.id))
                  }
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            ),
          }))}
        />
      </CardContent>
    </Card>
  );
}
