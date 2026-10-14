import { NextResponse } from "next/server";
import { ForbiddenError, requirePermission } from "@/lib/admin-guard";
import { db } from "@/lib/db";

/**
 * Devolve a maior versão da imagem pelo próprio endereço do painel. O "Padronizar foto" lê os
 * pixels da imagem no navegador, o que o endereço do armazenamento (outro domínio) não permite.
 */
export async function GET(request: Request, { params }: RouteContext<"/admin/midia/[id]/arquivo">) {
  try {
    await requirePermission("media.upload");
  } catch (error) {
    if (error instanceof ForbiddenError)
      return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
  const { id } = await params;
  const media = await db.mediaAsset.findUnique({ where: { id }, select: { variants: true } });
  const variants = (media?.variants ?? {}) as Record<string, string>;
  const url = variants["1600"] ?? variants["800"] ?? variants["400"];
  if (!url) return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 });
  // Em desenvolvimento o endereço é relativo (/media/...); em produção, o do armazenamento.
  const file = await fetch(new URL(url, request.url));
  if (!file.ok) return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 });
  return new NextResponse(file.body, {
    headers: {
      "Content-Type": file.headers.get("content-type") ?? "image/webp",
      "Cache-Control": "private, max-age=300",
    },
  });
}
