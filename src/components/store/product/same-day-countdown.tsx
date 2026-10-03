"use client";

import { Truck } from "lucide-react";
import { useEffect, useState } from "react";
import type { StoreSettings } from "@/config/store.config";
import { formatMinutesLeft, getSameDayStatus } from "@/lib/dates";

type Props = {
  sameDay: StoreSettings["sameDay"];
  holidays: string[];
};

/**
 * "Peça nas próximas 2h14min e receba hoje em São Paulo". É calculado no navegador depois da
 * hidratação, para o servidor e o cliente não renderizarem horários diferentes.
 */
export function SameDayCountdown({ sameDay, holidays }: Props) {
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const status = getSameDayStatus(sameDay, holidays, new Date());
      setMinutesLeft(status.open ? status.minutesLeft : null);
    };
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, [sameDay, holidays]);

  if (minutesLeft === null) return null;

  return (
    <p className="flex items-start gap-3 rounded-control border border-moss-700 bg-moss-100 p-4 type-small text-ink">
      <Truck
        aria-hidden="true"
        strokeWidth={1.5}
        className="mt-0.5 size-5 flex-none text-moss-700"
      />
      <span>
        Peça nas próximas{" "}
        <strong className="font-semibold tabular-nums">{formatMinutesLeft(minutesLeft)}</strong> e
        receba hoje em São Paulo.
      </span>
    </p>
  );
}
