import { NextResponse } from "next/server";
import { ForbiddenError, auditContext, requirePermission } from "@/lib/admin-guard";
import { logAudit } from "@/lib/audit";
import { createMediaFromUpload } from "@/server/admin/media";
import { InvalidImageError, MAX_UPLOAD_BYTES } from "@/server/services/media";

/** Upload de imagem do painel. O tipo é conferido pelo conteúdo, e o nome no armazenamento é gerado. */
export async function POST(request: Request) {
  try {
    const user = await requirePermission("media.upload");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return NextResponse.json({ error: "Envie um arquivo de imagem." }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES)
      return NextResponse.json(
        { error: "A imagem passa de 10 MB. Envie um arquivo menor." },
        { status: 413 },
      );
    const item = await createMediaFromUpload(
      { name: file.name, buffer: Buffer.from(await file.arrayBuffer()) },
      String(form.get("alt") ?? ""),
      user.id,
    );
    await logAudit({
      userId: user.id,
      action: "media.upload",
      entityType: "MediaAsset",
      entityId: item.id,
      diff: { arquivo: file.name },
      ...(await auditContext()),
    });
    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof ForbiddenError)
      return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof InvalidImageError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
