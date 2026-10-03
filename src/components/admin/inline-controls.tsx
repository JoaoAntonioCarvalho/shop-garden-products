"use client";

import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/admin/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { AdminResult } from "@/server/admin/action";

/** Interruptor que grava na hora: ativo, no menu, na home... */
export function InlineToggle({
  checked,
  label,
  action,
  disabled,
}: {
  checked: boolean;
  label: string;
  action: (value: boolean) => Promise<AdminResult<unknown>>;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(checked);
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex min-h-8 cursor-pointer items-center gap-1.5 text-sm whitespace-nowrap">
      <input
        type="checkbox"
        className="control-check size-4"
        checked={value}
        disabled={disabled || pending}
        onChange={(event) => {
          const next = event.target.checked;
          setValue(next);
          startTransition(async () => {
            const result = await action(next);
            if (result.ok) {
              toast(result.message);
              router.refresh();
            } else {
              setValue(!next);
              toast(result.error, { tone: "error" });
            }
          });
        }}
      />
      {label}
    </label>
  );
}

export type SortableItem = { id: string; label: string; content: ReactNode };

/** Lista ordenável por arrastar e por botões (para quem usa teclado). Grava a nova ordem ao soltar. */
export function SortableList({
  items,
  onReorder,
  onDragChange,
  className,
}: {
  items: SortableItem[];
  onReorder: (ids: string[]) => Promise<AdminResult<unknown>>;
  /** Avisa qual item está sendo arrastado, para quem desenha outros destinos em volta da lista. */
  onDragChange?: (id: string | null) => void;
  className?: string;
}) {
  const router = useRouter();
  // Guarda só a ordem dos ids: o conteúdo de cada item vem sempre das props mais recentes.
  const serverOrder = items.map((item) => item.id);
  const serverKey = serverOrder.join(",");
  const [orderIds, setOrderIds] = useState(serverOrder);
  const [seenKey, setSeenKey] = useState(serverKey);
  const [dragging, setDragging] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // A lista do servidor mudou (item novo, removido ou reordenado): passa a valer.
  if (seenKey !== serverKey) {
    setSeenKey(serverKey);
    setOrderIds(serverOrder);
  }
  const order = orderIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is SortableItem => Boolean(item));
  const setOrder = (next: SortableItem[]) => setOrderIds(next.map((item) => item.id));

  function move(from: number, to: number) {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    startTransition(async () => {
      const result = await onReorder(next.map((item) => item.id));
      if (result.ok) {
        toast(result.message);
        router.refresh();
      } else toast(result.error, { tone: "error" });
    });
  }

  return (
    <ol className={cn("flex flex-col gap-1.5", className)} aria-busy={pending || undefined}>
      {order.map((item, index) => (
        <li
          key={item.id}
          draggable
          onDragStart={(event) => {
            event.stopPropagation();
            setDragging(item.id);
            onDragChange?.(item.id);
          }}
          onDragEnd={(event) => {
            event.stopPropagation();
            setDragging(null);
            onDragChange?.(null);
          }}
          onDragOver={(event) => {
            if (dragging && order.some((entry) => entry.id === dragging)) event.preventDefault();
          }}
          onDrop={(event) => {
            const from = order.findIndex((entry) => entry.id === dragging);
            if (from < 0) return;
            event.stopPropagation();
            move(from, index);
            setDragging(null);
          }}
          className={cn(
            "flex items-start gap-2 rounded-md border border-border bg-background p-2",
            dragging === item.id && "opacity-50",
          )}
        >
          <GripVertical
            aria-hidden="true"
            className="mt-2 size-4 shrink-0 cursor-grab text-muted-foreground"
          />
          <div className="min-w-0 flex-1">{item.content}</div>
          <div className="flex shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Mover ${item.label} para cima`}
              disabled={index === 0 || pending}
              onClick={() => move(index, index - 1)}
            >
              <ArrowUp aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Mover ${item.label} para baixo`}
              disabled={index === order.length - 1 || pending}
              onClick={() => move(index, index + 1)}
            >
              <ArrowDown aria-hidden="true" />
            </Button>
          </div>
        </li>
      ))}
    </ol>
  );
}
