import "server-only";
import type { ReactNode } from "react";
import { Badge } from "@/components/admin/ui/badge";
import type { PickedImage } from "@/components/admin/media-picker";
import { formatDateTime } from "@/lib/dates";
import { toMediaItem } from "../media";

export const yesNoBadge = (value: boolean, yes = "Ativo", no = "Inativo"): ReactNode => (
  <Badge variant={value ? "default" : "secondary"}>{value ? yes : no}</Badge>
);

export const muted = (content: ReactNode): ReactNode => (
  <span className="text-muted-foreground">{content}</span>
);

export const dateCell = (date: Date | null | undefined): ReactNode =>
  date ? (
    <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(date)}</span>
  ) : (
    muted("Sem data")
  );

type Media = Parameters<typeof toMediaItem>[0];

/** Imagem no formato do campo de imagem do formulário. */
export function pickedImage(media: Media | null | undefined): PickedImage {
  if (!media) return null;
  const item = toMediaItem(media);
  return { id: item.id, url: item.thumb, alt: item.alt };
}

/** Período de validade em uma frase. */
export function periodText(startsAt: Date | null, endsAt: Date | null): string {
  if (!startsAt && !endsAt) return "Sem prazo";
  if (startsAt && endsAt) return `De ${formatDateTime(startsAt)} até ${formatDateTime(endsAt)}`;
  return startsAt
    ? `A partir de ${formatDateTime(startsAt)}`
    : `Até ${formatDateTime(endsAt as Date)}`;
}
