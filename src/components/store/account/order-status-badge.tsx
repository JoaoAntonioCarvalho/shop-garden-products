import { CircleCheck, CircleX, Clock, Package, Truck } from "lucide-react";
import { cn } from "@/lib/cn";
import { orderStatusLabels, type OrderStatusCode } from "@/server/services/order-status";

const styles: Record<OrderStatusCode, { className: string; icon: typeof Clock }> = {
  PENDING_PAYMENT: { className: "border-warning text-warning bg-white", icon: Clock },
  PAID: { className: "bg-moss-100 text-moss-900", icon: CircleCheck },
  PREPARING: { className: "bg-moss-100 text-moss-900", icon: Package },
  READY_FOR_PICKUP: { className: "bg-moss-100 text-moss-900", icon: Package },
  SHIPPED: { className: "bg-moss-100 text-moss-900", icon: Truck },
  OUT_FOR_DELIVERY: { className: "bg-moss-100 text-moss-900", icon: Truck },
  DELIVERED: { className: "bg-moss-700 text-white", icon: CircleCheck },
  CANCELED: { className: "bg-cream-100 text-ink border-line", icon: CircleX },
  EXPIRED: { className: "bg-cream-100 text-ink border-line", icon: CircleX },
  RETURNED: { className: "bg-cream-100 text-ink border-line", icon: CircleX },
};

/** Selo de status do pedido: sempre com texto e ícone, nunca só cor. */
export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatusCode;
  className?: string;
}) {
  const { className: tone, icon: Icon } = styles[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-photo border border-transparent px-2 py-0.5 text-[13px] leading-5 font-medium whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
      {orderStatusLabels[status]}
    </span>
  );
}
