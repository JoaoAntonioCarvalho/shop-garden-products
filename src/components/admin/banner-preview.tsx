"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormValues } from "@/components/admin/entity-form";
import type { PickedImage } from "@/components/admin/media-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { colors, contrastRatio, rgbToHex, surfaceBlendsIn } from "@/lib/color";

/** Onde o painel de texto fica sobre a foto do destaque no computador, em fração da imagem 16:7. */
const PANEL_AREA = { x: 0.04, y: 0.15, width: 0.42, height: 0.7 };
const SAMPLE = { width: 64, height: 28 };

type Check = { status: "none" | "unknown" } | { status: "done"; ratio: number; low: boolean };

/** Cor média da foto na área atrás do painel, com o mesmo corte (cover, 16:7) usado na loja. */
function usePanelContrast(url: string | null): Check {
  const [result, setResult] = useState<{ url: string; check: Check } | null>(null);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const done = (check: Check) => {
      if (!cancelled) setResult({ url, check });
    };
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE.width;
        canvas.height = SAMPLE.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return done({ status: "unknown" });
        const scale = Math.max(
          SAMPLE.width / image.naturalWidth,
          SAMPLE.height / image.naturalHeight,
        );
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        context.drawImage(
          image,
          (SAMPLE.width - width) / 2,
          (SAMPLE.height - height) / 2,
          width,
          height,
        );
        const area = context.getImageData(
          Math.round(PANEL_AREA.x * SAMPLE.width),
          Math.round(PANEL_AREA.y * SAMPLE.height),
          Math.round(PANEL_AREA.width * SAMPLE.width),
          Math.round(PANEL_AREA.height * SAMPLE.height),
        ).data;
        let r = 0;
        let g = 0;
        let b = 0;
        const pixels = area.length / 4;
        for (let i = 0; i < area.length; i += 4) {
          r += area[i];
          g += area[i + 1];
          b += area[i + 2];
        }
        const behind = rgbToHex(r / pixels, g / pixels, b / pixels);
        done({
          status: "done",
          ratio: contrastRatio(colors["cream-50"], behind),
          low: surfaceBlendsIn(colors["cream-50"], behind),
        });
      } catch {
        // Imagem servida de outro domínio sem permissão de leitura: não dá para medir.
        done({ status: "unknown" });
      }
    };
    image.onerror = () => done({ status: "unknown" });
    image.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);
  if (!url) return { status: "none" };
  return result?.url === url ? result.check : { status: "unknown" };
}

const text = (value: unknown) => String(value ?? "").trim();

function Caption({ values }: { values: FormValues }) {
  const name = text(values.imageCaption);
  if (!name) return null;
  return (
    <p className="absolute right-2 bottom-2 border border-moss-700 bg-cream-100 px-2 py-1 text-xs text-ink">
      {name}
      {text(values.imageCaptionScientific) ? (
        <span className="block text-moss-700 italic">{text(values.imageCaptionScientific)}</span>
      ) : null}
    </p>
  );
}

function Buttons({ values }: { values: FormValues }) {
  const primary = text(values.ctaLabel);
  const secondary = text(values.secondaryCtaLabel);
  if (!primary && !secondary) return null;
  return (
    <p className="mt-3 flex flex-wrap gap-2 text-sm">
      {primary ? (
        <span className="rounded-sm bg-moss-700 px-3 py-1.5 text-white">{primary}</span>
      ) : null}
      {secondary ? (
        <span className="rounded-sm border border-moss-700 px-3 py-1.5 text-moss-900">
          {secondary}
        </span>
      ) : null}
    </p>
  );
}

/** Prévia ao vivo do banner, com o que está digitado no formulário, e aviso de contraste baixo. */
export function BannerPreview({ values }: { values: FormValues }) {
  const placement = text(values.placement);
  const desktop = (values.imageDesktopId as PickedImage) ?? null;
  const mobile = (values.imageMobileId as PickedImage) ?? desktop;
  const title = text(values.title) || "Título do banner";
  const subtitle = text(values.subtitle);
  const isHero = placement === "HOME_HERO";
  const check = usePanelContrast(isHero ? (desktop?.url ?? null) : null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Prévia</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {placement === "TOP_BAR" ? (
          <p className="rounded-md bg-moss-700 px-3 py-2 text-center text-sm text-white">{title}</p>
        ) : isHero ? (
          <div className="grid gap-3 md:grid-cols-[3fr_1fr]">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Computador</p>
              <div className="relative aspect-16/7 overflow-hidden rounded-md border border-border bg-cream-100">
                {desktop ? (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura da biblioteca, só no painel
                  <img src={desktop.url} alt="" className="size-full object-cover" />
                ) : null}
                <div className="absolute inset-y-0 left-[4%] flex w-[42%] items-center">
                  <div className="w-full rounded-sm bg-cream-50 p-3">
                    <p className="font-serif text-[22px] leading-tight font-semibold text-moss-900">
                      {title}
                    </p>
                    {subtitle ? <p className="mt-1 text-xs text-ink-muted">{subtitle}</p> : null}
                    <Buttons values={values} />
                  </div>
                </div>
                <Caption values={values} />
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Celular</p>
              <div className="overflow-hidden rounded-md border border-border bg-cream-100">
                <div className="relative aspect-4/5">
                  {mobile ? (
                    // eslint-disable-next-line @next/next/no-img-element -- miniatura da biblioteca, só no painel
                    <img src={mobile.url} alt="" className="size-full object-cover" />
                  ) : null}
                  <Caption values={values} />
                </div>
                <div className="p-3">
                  <p className="font-serif text-[22px] leading-tight font-semibold text-moss-900">
                    {title}
                  </p>
                  {subtitle ? <p className="mt-1 text-xs text-ink-muted">{subtitle}</p> : null}
                  <Buttons values={values} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid overflow-hidden rounded-md border border-border bg-cream-100 md:grid-cols-2">
            <div className="flex flex-col justify-center p-5">
              <p className="font-serif text-[24px] leading-tight font-semibold text-moss-900">
                {title}
              </p>
              {subtitle ? <p className="mt-2 text-sm text-ink-muted">{subtitle}</p> : null}
            </div>
            <div className="relative min-h-32">
              {desktop ? (
                // eslint-disable-next-line @next/next/no-img-element -- miniatura da biblioteca, só no painel
                <img src={desktop.url} alt="" className="absolute inset-0 size-full object-cover" />
              ) : null}
              <Caption values={values} />
            </div>
          </div>
        )}

        <div aria-live="polite" className="flex flex-col gap-2 text-sm">
          {check.status === "done" && check.low ? (
            <p className="flex items-start gap-2 rounded-md border border-warning bg-background p-3 text-warning">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                Contraste baixo: no computador, a foto é clara demais atrás do painel de texto (
                {check.ratio.toFixed(2).replace(".", ",")}:1) e o painel se confunde com a imagem.
                Prefira uma foto mais escura ou com mais cor no lado esquerdo.
              </span>
            </p>
          ) : null}
          {check.status === "done" && !check.low ? (
            <p className="text-muted-foreground">
              O painel de texto se destaca bem da foto ({check.ratio.toFixed(2).replace(".", ",")}
              :1).
            </p>
          ) : null}
          {isHero && desktop && check.status === "unknown" ? (
            <p className="text-muted-foreground">
              Não foi possível medir o contraste do painel com esta imagem. Confira a prévia a olho.
            </p>
          ) : null}
          {isHero && !desktop ? (
            <p className="text-muted-foreground">
              Escolha a imagem para computador para conferir o contraste do painel com a foto.
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            O texto fica sempre sobre uma área de cor sólida, então a leitura não depende da foto. A
            prévia mostra o que está no formulário, mesmo antes de salvar.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
