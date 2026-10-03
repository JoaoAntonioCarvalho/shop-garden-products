"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/admin/ui/alert-dialog";
import { SortableList } from "@/components/admin/inline-controls";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { moveCategoryAction, reorderCategoriesAction } from "@/server/actions/admin/catalog-tools";

type Node = { id: string; name: string; slug: string; path: string; content: ReactNode };
export type CategoryTreeRoot = Node & { children: Node[] };

type Move = { node: Node; parent: CategoryTreeRoot | null };

/** Destino que só aparece durante o arrasto. Soltar aqui muda a categoria de nível. */
function DropZone({
  label,
  onDrop,
  className,
}: {
  label: string;
  onDrop: () => void;
  className?: string;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setOver(false);
        onDrop();
      }}
      className={cn(
        "rounded-md border border-dashed border-primary px-3 py-2 text-sm text-primary",
        over ? "bg-accent" : "bg-background",
        className,
      )}
    >
      {label}
    </div>
  );
}

/**
 * Árvore de categorias em dois níveis. Arrastar dentro da lista muda a ordem; soltar em um dos
 * destinos tracejados muda a categoria pai, sempre com confirmação, porque o endereço muda.
 */
export function CategoryTree({ roots, canEdit }: { roots: CategoryTreeRoot[]; canEdit: boolean }) {
  const router = useRouter();
  const [dragged, setDragged] = useState<string | null>(null);
  const [move, setMove] = useState<Move | null>(null);
  const [pending, startTransition] = useTransition();

  // Mexer na página no mesmo instante em que o arrasto começa faz o navegador cancelar o arrasto.
  const onDragChange = canEdit
    ? (id: string | null) => setTimeout(() => setDragged(id), 0)
    : undefined;

  const draggedRoot = roots.find((root) => root.id === dragged);
  const draggedParent = roots.find((root) => root.children.some((child) => child.id === dragged));
  const draggedNode: Node | undefined =
    draggedRoot ?? draggedParent?.children.find((child) => child.id === dragged);
  // Uma principal com subcategorias não pode virar subcategoria: a árvore tem dois níveis.
  const canNest = Boolean(draggedNode) && !(draggedRoot && draggedRoot.children.length > 0);

  const ask = (parent: CategoryTreeRoot | null) => {
    if (draggedNode) setMove({ node: draggedNode, parent });
    setDragged(null);
  };
  const newPath = move
    ? move.parent
      ? `${move.parent.path}/${move.node.slug}`
      : move.node.slug
    : "";

  return (
    <>
      {draggedParent && draggedNode ? (
        <DropZone
          className="sticky top-2 z-10 mb-2"
          label={`Solte aqui para ${draggedNode.name} virar categoria principal`}
          onDrop={() => ask(null)}
        />
      ) : null}
      <SortableList
        onReorder={reorderCategoriesAction}
        onDragChange={onDragChange}
        items={roots.map((root) => ({
          id: root.id,
          label: root.name,
          content: (
            <>
              {root.content}
              {root.children.length ? (
                <SortableList
                  className="mt-2 ml-2 border-l border-border pl-3"
                  onReorder={reorderCategoriesAction}
                  onDragChange={onDragChange}
                  items={root.children.map((child) => ({
                    id: child.id,
                    label: child.name,
                    content: child.content,
                  }))}
                />
              ) : null}
              {canNest && draggedNode && root.id !== dragged && root.id !== draggedParent?.id ? (
                <DropZone
                  className="mt-2 ml-2"
                  label={`Solte aqui para mover ${draggedNode.name} para dentro de ${root.name}`}
                  onDrop={() => ask(root)}
                />
              ) : null}
            </>
          ),
        }))}
      />
      <AlertDialog open={Boolean(move)} onOpenChange={(open) => (open ? null : setMove(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {move?.parent
                ? `Mover ${move.node.name} para dentro de ${move.parent.name}`
                : `Tornar ${move?.node.name} uma categoria principal`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              O endereço muda de /categoria/{move?.node.path} para /categoria/{newPath}. O endereço
              antigo passa a redirecionar para o novo, e os produtos continuam na categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                if (!move) return;
                startTransition(async () => {
                  const result = await moveCategoryAction(move.node.id, move.parent?.id ?? null);
                  setMove(null);
                  if (result.ok) {
                    toast(result.message);
                    router.refresh();
                  } else toast(result.error, { tone: "error", duration: 8000 });
                });
              }}
            >
              Mover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
