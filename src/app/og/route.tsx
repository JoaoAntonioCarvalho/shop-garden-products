import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getStoreSettings } from "@/server/services/settings";

const size = { width: 1200, height: 630 };
let font: Promise<Buffer> | null = null;
const loadFont = () =>
  (font ??= readFile(
    join(
      process.cwd(),
      "node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff",
    ),
  ));

/**
 * Imagem Open Graph da home, das categorias e das páginas institucionais: fundo creme, título em
 * serifa e faixa musgo com o nome da loja. A página de produto usa a foto de capa.
 */
export async function GET(request: Request) {
  const settings = await getStoreSettings();
  const title = (new URL(request.url).searchParams.get("titulo") ?? settings.tagline).slice(0, 90);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#fbf8f2",
        fontFamily: "Cormorant",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
        }}
      >
        <div style={{ width: 120, height: 2, background: "#4d5236", marginBottom: 6 }} />
        <div style={{ width: 120, height: 2, background: "#4d5236", marginBottom: 40 }} />
        <div style={{ fontSize: title.length > 48 ? 64 : 80, lineHeight: 1.1, color: "#2f3221" }}>
          {title}
        </div>
      </div>
      <div
        style={{
          height: 110,
          display: "flex",
          alignItems: "center",
          padding: "0 96px",
          background: "#4d5236",
          color: "#fbf8f2",
          fontSize: 40,
        }}
      >
        {settings.name}
      </div>
    </div>,
    {
      ...size,
      fonts: [{ name: "Cormorant", data: await loadFont(), weight: 600, style: "normal" }],
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
    },
  );
}
