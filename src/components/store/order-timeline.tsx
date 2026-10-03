import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/dates";
import {
  orderStatusLabels,
  timelineSteps,
  type OrderStatusCode,
} from "@/server/services/order-status";

type TimelineProps = {
  status: OrderStatusCode;
  shippingKind: "transport" | "local" | "pickup";
  dates: {
    createdAt: Date;
    paidAt: Date | null;
    preparedAt: Date | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    canceledAt: Date | null;
  };
};

const stepLabels: Partial<Record<OrderStatusCode, string>> = {
  PENDING_PAYMENT: "Pedido recebido",
  PAID: "Pagamento aprovado",
};

/** Linha do tempo do pedido: recebido, pago, em preparação, enviado ou saiu para entrega, entregue. */
export function OrderTimeline({ status, shippingKind, dates }: TimelineProps) {
  const steps = timelineSteps(shippingKind);
  const stepDates = [
    dates.createdAt,
    dates.paidAt,
    dates.preparedAt,
    dates.shippedAt,
    dates.deliveredAt,
  ];
  const closed = status === "CANCELED" || status === "EXPIRED" || status === "RETURNED";
  // Etapa atual: a última que já tem data registrada.
  const reached =
    closed && status !== "RETURNED"
      ? stepDates.findLastIndex(Boolean)
      : Math.max(0, steps.indexOf(status === "RETURNED" ? "DELIVERED" : status));

  return (
    <ol className="flex flex-col gap-0">
      {steps.map((step, index) => {
        const done = index <= reached;
        const current = index === reached && !closed;
        return (
          <li key={step} className="relative flex gap-3 pb-5 last:pb-0">
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-6 left-[11px] h-full w-px",
                  index < reached ? "bg-moss-700" : "bg-line",
                )}
              />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "relative z-10 flex size-6 flex-none items-center justify-center rounded-full border",
                done ? "border-moss-700 bg-moss-700 text-white" : "border-line bg-white",
              )}
            >
              {done ? <Check strokeWidth={2.5} className="size-3.5" /> : null}
            </span>
            <div>
              <p className={cn("type-small", done ? "font-medium text-ink" : "text-ink-muted")}>
                {stepLabels[step] ?? orderStatusLabels[step]}
                {current ? <span className="sr-only"> (etapa atual)</span> : null}
              </p>
              {stepDates[index] && done ? (
                <p className="type-caption text-ink-muted">{formatDateTime(stepDates[index]!)}</p>
              ) : null}
            </div>
          </li>
        );
      })}
      {closed ? (
        <li className="relative mt-5 flex gap-3">
          <span
            aria-hidden="true"
            className="flex size-6 flex-none items-center justify-center rounded-full border border-ink bg-ink text-white"
          >
            <X strokeWidth={2.5} className="size-3.5" />
          </span>
          <div>
            <p className="type-small font-medium text-ink">{orderStatusLabels[status]}</p>
            {dates.canceledAt ? (
              <p className="type-caption text-ink-muted">{formatDateTime(dates.canceledAt)}</p>
            ) : null}
          </div>
        </li>
      ) : null}
    </ol>
  );
}
