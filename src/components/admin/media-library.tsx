"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ActionButton } from "@/components/admin/action-button";
import { ImageUploader } from "@/components/admin/media-picker";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { toast } from "@/components/ui/toast";
import { deleteMediaAction, updateMediaAltAction } from "@/server/actions/admin/media";

export type LibraryItem = {
  id: string;
  url: string;
  thumb: string;
  alt: string;
  name: string;
  width: number;
  height: number;
  sizeLabel: string;
  createdAt: string;
  isSample: boolean;
  usage: Array<{ label: string; href: string }>;
};

/** Grade da biblioteca de mídia, com envio múltiplo e o detalhe de cada imagem. */
export function MediaLibrary({
  items,
  canUpload,
  canDelete,
}: {
  items: LibraryItem[];
  canUpload: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<LibraryItem | null>(null);
  const [alt, setAlt] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <>
      {canUpload ? (
        <div className="mb-4">
          <ImageUploader
            onUploaded={(item) => {
              toast(`Imagem enviada: ${item.name}`);
              router.refresh();
            }}
          />
        </div>
      ) : null}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma imagem encontrada com esses filtros.
        </p>
      ) : null}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => {
                setSelected(item);
                setAlt(item.alt);
              }}
              className="block w-full overflow-hidden rounded-md border border-border bg-background text-left hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Image
                src={item.thumb}
                alt={item.alt || item.name}
                width={200}
                height={250}
                unoptimized
                className="aspect-[4/5] w-full object-cover"
              />
              <span className="block truncate px-2 py-1 text-xs text-muted-foreground">
                {item.alt || "Sem texto alternativo"}
                {item.isSample ? " (teste)" : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.name}</DialogTitle>
                <DialogDescription>
                  {selected.width} × {selected.height} px, {selected.sizeLabel}. Enviada em{" "}
                  {selected.createdAt}.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
                <Image
                  src={selected.thumb}
                  alt={selected.alt}
                  width={200}
                  height={250}
                  unoptimized
                  className="w-full rounded-md border border-border object-cover"
                />
                <div className="flex flex-col gap-3 text-sm">
                  <form
                    className="flex flex-col gap-1.5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      startTransition(async () => {
                        const result = await updateMediaAltAction({ id: selected.id, alt });
                        if (result.ok) {
                          toast(result.message);
                          router.refresh();
                        } else toast(result.error, { tone: "error" });
                      });
                    }}
                  >
                    <Label htmlFor="midia-alt">Texto alternativo</Label>
                    <Input
                      id="midia-alt"
                      value={alt}
                      maxLength={200}
                      disabled={!canUpload}
                      onChange={(event) => setAlt(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Descreva o que a imagem mostra, para quem usa leitor de tela e para o Google.
                    </p>
                    {canUpload ? (
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className="self-start"
                        disabled={pending}
                      >
                        Salvar texto alternativo
                      </Button>
                    ) : null}
                  </form>
                  <div>
                    <p className="font-medium">Onde é usada</p>
                    {selected.usage.length === 0 ? (
                      <p className="text-muted-foreground">Não está em uso.</p>
                    ) : null}
                    <ul>
                      {selected.usage.map((use) => (
                        <li key={use.href + use.label}>
                          <Link
                            href={use.href}
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            {use.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await navigator.clipboard.writeText(
                          new URL(selected.url, window.location.origin).toString(),
                        );
                        toast("Endereço da imagem copiado");
                      }}
                    >
                      Copiar URL
                    </Button>
                    {canDelete ? (
                      <ActionButton
                        size="sm"
                        variant="destructive"
                        disabled={selected.usage.length > 0}
                        action={deleteMediaAction.bind(null, { id: selected.id })}
                        onDone={() => setSelected(null)}
                        confirm={{
                          title: "Excluir imagem",
                          description: `${selected.name} será excluída de vez da biblioteca.`,
                          confirmLabel: "Excluir",
                        }}
                      >
                        Excluir
                      </ActionButton>
                    ) : null}
                  </div>
                  {selected.usage.length > 0 && canDelete ? (
                    <p className="text-xs text-muted-foreground">
                      Imagem em uso não pode ser excluída.
                    </p>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
