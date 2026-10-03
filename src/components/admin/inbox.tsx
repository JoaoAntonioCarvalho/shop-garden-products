import type { ReactNode } from "react";
import { MiniForm, type FieldOption, type FormValues } from "@/components/admin/entity-form";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { toWhatsappNumber } from "@/lib/validators/phone";
import type { AdminResult } from "@/server/admin/action";

export type InboxItem = {
  id: string;
  title: string;
  meta: string;
  body: ReactNode;
  status: string;
  statusLabel: string;
  isNew: boolean;
  isSample: boolean;
  email: string;
  phone: string | null;
  name: string;
  assignedToId: string | null;
  internalNotes: string | null;
};

type InboxProps = {
  items: InboxItem[];
  statusOptions: FieldOption[];
  team: FieldOption[];
  /** Mensagem inicial ao responder pelo WhatsApp ou por e-mail. */
  greeting: (item: InboxItem) => string;
  subject: (item: InboxItem) => string;
  save: (id: string) => (values: FormValues) => Promise<AdminResult<unknown>>;
  emptyMessage: string;
};

/** Caixa de entrada de solicitações de produto e de mensagens de contato. */
export function Inbox({
  items,
  statusOptions,
  team,
  greeting,
  subject,
  save,
  emptyMessage,
}: InboxProps) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-md border border-border bg-background p-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.meta}</p>
            </div>
            <span className="flex gap-1.5">
              {item.isSample ? <Badge variant="secondary">Teste</Badge> : null}
              <Badge variant={item.isNew ? "destructive" : "secondary"}>{item.statusLabel}</Badge>
            </span>
          </div>
          <div className="mt-2 whitespace-pre-line">{item.body}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.phone ? (
              <Button asChild size="sm" variant="outline">
                <a
                  href={buildWhatsAppUrl(toWhatsappNumber(item.phone), greeting(item))}
                  target="_blank"
                  rel="noreferrer"
                >
                  Responder pelo WhatsApp
                </a>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="outline">
              <a
                href={`mailto:${item.email}?subject=${encodeURIComponent(subject(item))}&body=${encodeURIComponent(greeting(item))}`}
              >
                Responder por e-mail
              </a>
            </Button>
          </div>
          <details className="mt-3 rounded-md border border-border px-3 py-1.5">
            <summary className="cursor-pointer">Status, responsável e notas internas</summary>
            <div className="mt-2">
              <MiniForm
                fields={[
                  { name: "status", label: "Status", type: "select", options: statusOptions },
                  {
                    name: "assignedToId",
                    label: "Responsável",
                    type: "select",
                    options: [{ value: "", label: "Ninguém" }, ...team],
                  },
                  {
                    name: "internalNotes",
                    label: "Notas internas",
                    type: "textarea",
                    rows: 3,
                    wide: true,
                  },
                ]}
                initial={{
                  status: item.status,
                  assignedToId: item.assignedToId ?? "",
                  internalNotes: item.internalNotes ?? "",
                }}
                action={save(item.id)}
                submitLabel="Salvar"
              />
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
