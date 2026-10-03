import type { StoreSettings } from "@/config/store.config";
import { formatBRLShort } from "@/lib/money";
import { formatCutoff } from "@/lib/template";
import { TopBarRotator } from "./top-bar-rotator";

/** Mensagens padrão da barra superior, sempre a partir da configuração. */
export function defaultTopBarMessages(settings: StoreSettings): string[] {
  const messages: string[] = [];
  if (settings.sameDay.enabled) {
    messages.push(
      `Entrega hoje em São Paulo para pedidos até ${formatCutoff(settings.sameDay.cutoffTime)}`,
    );
  }
  if (settings.pixDiscountPercent > 0) {
    messages.push(`${settings.pixDiscountPercent}% de desconto no Pix`);
  }
  if (settings.freeShippingThresholdCents > 0) {
    messages.push(
      `Frete grátis na Grande SP acima de ${formatBRLShort(settings.freeShippingThresholdCents)}`,
    );
  }
  return messages;
}

type TopBarProps = {
  /** Até três mensagens: dos banners TOP_BAR ou, na falta deles, da configuração. */
  messages: string[];
};

export function TopBar({ messages }: TopBarProps) {
  const visible = messages.slice(0, 3);
  if (visible.length === 0) return null;

  return (
    <div className="on-dark bg-moss-700 text-cream-50">
      <div className="container-store">
        {/* Desktop: lado a lado. */}
        <ul className="hidden h-9 items-center justify-center gap-10 type-caption lg:flex">
          {visible.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
        {/* Mobile: uma por vez, com troca manual. */}
        <TopBarRotator messages={visible} />
      </div>
    </div>
  );
}
