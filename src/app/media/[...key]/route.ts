import { getStorage } from "@/server/providers/storage";

const contentTypes: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

/** Serve os arquivos do armazenamento local. Com STORAGE_DRIVER=s3 as URLs apontam direto para o bucket. */
export async function GET(_request: Request, context: RouteContext<"/media/[...key]">) {
  const { key } = await context.params;
  const path = key.join("/");
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  const contentType = contentTypes[extension];

  if (!contentType || key.some((part) => part === ".." || part.startsWith("."))) {
    return new Response("Arquivo não encontrado", { status: 404 });
  }

  const data = await getStorage().get(path);
  if (!data) return new Response("Arquivo não encontrado", { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      // Os nomes são gerados pelo sistema e nunca reaproveitados, então o cache pode ser longo.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
