"use client";

import { ImagePlus, Upload } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { listMediaAction } from "@/server/actions/admin/media";
import type { MediaItem } from "@/server/admin/media";

type UploadState = { name: string; progress: number; error?: string };

/** Envia um arquivo para a biblioteca, informando o progresso. */
function uploadFile(file: File, onProgress: (percent: number) => void): Promise<MediaItem> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);
    request.upload.onprogress = (event) =>
      event.lengthComputable && onProgress(Math.round((event.loaded / event.total) * 100));
    request.onload = () => {
      try {
        const body = JSON.parse(request.responseText) as MediaItem & { error?: string };
        if (request.status === 200) resolve(body);
        else reject(new Error(body.error ?? "Não foi possível enviar a imagem."));
      } catch {
        reject(new Error("Não foi possível enviar a imagem."));
      }
    };
    request.onerror = () => reject(new Error("Falha de conexão ao enviar a imagem."));
    request.open("POST", "/admin/midia/upload");
    request.send(form);
  });
}

/** Área de envio com arrastar e soltar, vários arquivos e progresso por arquivo. */
export function ImageUploader({
  onUploaded,
  compact,
}: {
  onUploaded: (item: MediaItem) => void;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [over, setOver] = useState(false);

  async function send(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const update = (changes: Partial<UploadState>) =>
        setUploads((current) =>
          current.map((item) => (item.name === file.name ? { ...item, ...changes } : item)),
        );
      setUploads((current) => [
        ...current.filter((item) => item.name !== file.name),
        { name: file.name, progress: 0 },
      ]);
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        update({ error: "Formato não aceito. Envie JPG, PNG ou WebP." });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        update({ error: "A imagem passa de 10 MB." });
        continue;
      }
      try {
        const item = await uploadFile(file, (progress) => update({ progress }));
        onUploaded(item);
        setUploads((current) => current.filter((entry) => entry.name !== file.name));
      } catch (error) {
        update({ error: error instanceof Error ? error.message : "Não foi possível enviar." });
      }
    }
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          void send(event.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-input bg-background text-center text-sm text-muted-foreground",
          compact ? "p-3" : "p-6",
          over && "bg-accent",
        )}
      >
        <Upload aria-hidden="true" className="size-5" />
        <p>Arraste imagens para cá ou</p>
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
          Escolher arquivos
        </Button>
        <p className="text-xs">JPG, PNG ou WebP, até 10 MB cada</p>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          aria-label="Enviar imagens"
          onChange={(event) => event.target.files && void send(event.target.files)}
        />
      </div>
      {uploads.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1 text-sm" aria-live="polite">
          {uploads.map((upload) => (
            <li key={upload.name} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{upload.name}</span>
              {upload.error ? (
                <span className="text-destructive">{upload.error}</span>
              ) : (
                <progress
                  value={upload.progress}
                  max={100}
                  aria-label={`Envio de ${upload.name}`}
                  className="h-2 w-32"
                />
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Janela para escolher uma imagem da biblioteca ou enviar uma nova. */
export function MediaLibraryDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (item: MediaItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await listMediaAction(query, page);
      if (cancelled) return;
      setItems((current) => (page === 1 ? result.items : [...current, ...result.items]));
      setHasMore(result.hasMore);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, page]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Biblioteca de imagens</DialogTitle>
          <DialogDescription>Escolha uma imagem já enviada ou envie uma nova.</DialogDescription>
        </DialogHeader>
        <ImageUploader
          compact
          onUploaded={(item) => {
            onPick(item);
            onOpenChange(false);
          }}
        />
        <label htmlFor="biblioteca-busca" className="sr-only">
          Buscar na biblioteca
        </label>
        <Input
          id="biblioteca-busca"
          type="search"
          placeholder="Buscar por nome ou texto alternativo"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(item);
                  onOpenChange(false);
                }}
                className="block w-full overflow-hidden rounded-md border border-border hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Image
                  src={item.thumb}
                  alt={item.alt || item.name}
                  width={160}
                  height={200}
                  unoptimized
                  className="aspect-[4/5] w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma imagem encontrada.</p>
        ) : null}
        {hasMore ? (
          <Button type="button" variant="outline" onClick={() => setPage((current) => current + 1)}>
            Carregar mais
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export type PickedImage = { id: string; url: string; alt: string } | null;

/** Campo de imagem dos formulários: mostra a escolhida e abre a biblioteca. */
export function MediaField({
  value,
  onChange,
  disabled,
}: {
  value: PickedImage;
  onChange: (value: PickedImage) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-3">
      {value ? (
        <Image
          src={value.url}
          alt={value.alt}
          width={96}
          height={96}
          unoptimized
          className="size-24 rounded-md border border-border object-cover"
        />
      ) : (
        <div className="flex size-24 items-center justify-center rounded-md border border-dashed border-input text-muted-foreground">
          <ImagePlus aria-hidden="true" className="size-6" />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          {value ? "Trocar imagem" : "Escolher imagem"}
        </Button>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            Remover
          </Button>
        ) : null}
      </div>
      <MediaLibraryDialog
        open={open}
        onOpenChange={setOpen}
        onPick={(item) => {
          if (!item.alt)
            toast("Esta imagem está sem texto alternativo. Preencha em Mídia.", { tone: "error" });
          onChange({ id: item.id, url: item.thumb, alt: item.alt });
        }}
      />
    </div>
  );
}
