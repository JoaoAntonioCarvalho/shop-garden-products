import "server-only";
import { db } from "@/lib/db";
import { AdminError, type AdminContext } from "./action";
import { redirectOldPath } from "./products";

/**
 * Muda a categoria de nível: vira subcategoria de uma principal ou volta a ser principal.
 * O endereço muda, então o antigo passa a redirecionar. Entra no fim da nova lista.
 * Devolve a mensagem para o painel.
 */
export async function moveCategory(
  data: { id: string; parentId: string | null },
  { audit }: Pick<AdminContext, "audit">,
): Promise<string> {
  const category = await db.category.findUnique({
    where: { id: data.id },
    include: { parent: { select: { name: true } }, _count: { select: { children: true } } },
  });
  if (!category) throw new AdminError("Categoria não encontrada.");
  if (category.parentId === data.parentId) throw new AdminError("A categoria já está neste lugar.");
  const parent = data.parentId
    ? await db.category.findUnique({
        where: { id: data.parentId },
        select: { id: true, name: true, path: true, parentId: true },
      })
    : null;
  if (data.parentId) {
    if (!parent || parent.parentId || parent.id === category.id)
      throw new AdminError("A categoria pai precisa ser uma categoria principal.");
    // A árvore tem dois níveis.
    if (category._count.children > 0)
      throw new AdminError(
        "Esta categoria tem subcategorias, então fica como principal. Mova as subcategorias antes.",
      );
  }
  const path = parent ? `${parent.path}/${category.slug}` : category.slug;
  if (await db.category.findUnique({ where: { path }, select: { id: true } }))
    throw new AdminError(
      "Já existe uma categoria com este endereço no destino. Mude o endereço (slug) antes de mover.",
    );

  await db.$transaction(async (tx) => {
    const last = await tx.category.aggregate({
      where: { parentId: data.parentId },
      _max: { position: true },
    });
    await tx.category.update({
      where: { id: category.id },
      data: { parentId: data.parentId, path, position: (last._max.position ?? 0) + 1 },
    });
    await redirectOldPath(
      tx,
      `/categoria/${category.path}`,
      `/categoria/${path}`,
      "Categoria movida de nível no painel",
    );
  });
  await audit({
    action: "category.move",
    entityType: "Category",
    entityId: category.id,
    diff: {
      pai: { de: category.parent?.name ?? null, para: parent?.name ?? null },
      endereco: { de: category.path, para: path },
    },
  });
  return parent
    ? `${category.name} agora fica dentro de ${parent.name}`
    : `${category.name} agora é uma categoria principal`;
}
