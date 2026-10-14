"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { composeStandardPhoto } from "@/lib/photo-standard";
import type { MediaItem } from "@/server/admin/media";
import type { CutoutMessage, CutoutRequest } from "./cutout.worker";

type Stage =
  | { name: "loading" }
  | { name: "download"; percent: number }
  | { name: "cutout" }
  | { name: "preview"; before: string; after: string; file: Blob }
  | { name: "saving"; before: string; after: string; file: Blob }
  | { name: "error"; message: string };

const messages: Record<"loading" | "download" | "cutout", string> = {
  loading: "Abrindo a foto.",
  download:
    "Preparando o recorte. Na primeira vez neste computador ele baixa um arquivo grande (cerca de 220 MB) e pode levar alguns minutos.",
  cutout: "Recortando o fundo. Pode levar até um minuto.",
};

// Um só processo de recorte para a página: o modelo fica carregado entre uma foto e outra.
let worker: Worker | null = null;
const getWorker = () =>
  (worker ??= new Worker(new URL("./cutout.worker.ts", import.meta.url), { type: "module" }));

function cutout(image: Blob, onProgress: (stage: Stage) => void): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const target = getWorker();
    target.onmessage = (event: MessageEvent<CutoutMessage>) => {
      const message = event.data;
      if (message.type === "progress")
        onProgress(
          message.stage === "download"
            ? { name: "download", percent: message.percent }
            : { name: "cutout" },
        );
      else if (message.type === "done")
        resolve(new ImageData(new Uint8ClampedArray(message.data), message.width, message.height));
      else reject(new Error(message.message));
    };
    target.onerror = () => {
      worker = null;
      reject(new Error("O recorte não pôde ser carregado."));
    };
    target.postMessage({ image } satisfies CutoutRequest);
  });
}

async function upload(file: Blob, name: string, alt: string): Promise<MediaItem> {
  const form = new FormData();
  form.append("file", new File([file], name, { type: "image/jpeg" }));
  form.append("alt", alt);
  const response = await fetch("/admin/midia/upload", { method: "POST", body: form });
  const body = (await response.json()) as MediaItem & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Não foi possível enviar a foto.");
  return body;
}

/**
 * "Padronizar foto": recorta o fundo, põe o produto em fundo branco no formato do catálogo e
 * mostra o antes e depois. Só troca a foto do produto se a pessoa aceitar; a original continua
 * na biblioteca de mídia.
 */
export function PhotoStandardizer({
  image,
  onClose,
  onReplace,
}: {
  image: { mediaId: string; alt: string; name: string } | null;
  onClose: () => void;
  onReplace: (item: MediaItem) => void;
}) {
  const [stage, setStage] = useState<Stage>({ name: "loading" });
  const mediaId = image?.mediaId;

  useEffect(() => {
    if (!mediaId) return;
    let active = true;
    const urls: string[] = [];
    const show = (next: Stage) => active && setStage(next);
    show({ name: "loading" });
    (async () => {
      try {
        const response = await fetch(`/admin/midia/${mediaId}/arquivo`);
        if (!response.ok) throw new Error("Não foi possível abrir a foto.");
        const original = await response.blob();
        show({ name: "download", percent: 0 });
        const file = await composeStandardPhoto(await cutout(original, show));
        const before = URL.createObjectURL(original);
        const after = URL.createObjectURL(file);
        urls.push(before, after);
        show({ name: "preview", before, after, file });
      } catch (error) {
        // O motivo técnico fica no console do navegador, para o suporte.
        console.error("Padronizar foto:", error);
        show({
          name: "error",
          message:
            "Não foi possível padronizar a foto neste computador. Tente de novo ou use outro navegador (Chrome ou Edge atualizados).",
        });
      }
    })();
    return () => {
      active = false;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [mediaId]);

  async function accept() {
    if (stage.name !== "preview" || !image) return;
    setStage({ ...stage, name: "saving" });
    try {
      onReplace(await upload(stage.file, `${image.name}-padronizada.jpg`, image.alt));
      onClose();
    } catch (error) {
      setStage({
        name: "error",
        message: error instanceof Error ? error.message : "Não foi possível enviar a foto.",
      });
    }
  }

  const done = stage.name === "preview" || stage.name === "saving";
  return (
    <Dialog open={Boolean(image)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Padronizar foto</DialogTitle>
          <DialogDescription>
            O fundo é recortado e o produto vai para um fundo branco, no mesmo formato das outras
            fotos da loja. A foto original continua guardada na biblioteca.
          </DialogDescription>
        </DialogHeader>

        {stage.name === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            {stage.message}
          </p>
        ) : done ? (
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                ["Antes", stage.before],
                ["Depois", stage.after],
              ] as const
            ).map(([label, src]) => (
              <figure key={label}>
                <figcaption className="mb-1 text-sm font-medium">{label}</figcaption>
                <Image
                  src={src}
                  alt={`${label}: ${image?.alt ?? "foto do produto"}`}
                  width={320}
                  height={400}
                  unoptimized
                  className="aspect-4/5 w-full rounded-md border border-border bg-white object-contain"
                />
              </figure>
            ))}
          </div>
        ) : (
          <div role="status" className="flex flex-col gap-3 text-sm">
            <p>{messages[stage.name]}</p>
            {stage.name === "download" && stage.percent > 0 && stage.percent < 100 ? (
              <progress
                value={stage.percent}
                max={100}
                aria-label="Download do recorte"
                className="h-2 w-full"
              />
            ) : null}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {done ? "Manter a foto atual" : "Fechar"}
          </Button>
          {done ? (
            <Button type="button" disabled={stage.name === "saving"} onClick={accept}>
              {stage.name === "saving" ? "Enviando" : "Usar a foto padronizada"}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
