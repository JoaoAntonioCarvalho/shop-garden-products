import { formatDateTime } from "@/lib/dates";
import { getCarrierTracking } from "@/server/services/tracking";

/**
 * Eventos de rastreio da transportadora, abaixo do código. Não mostra nada quando não há
 * integração ligada ou a consulta falhou.
 */
export async function CarrierTracking({
  code,
  variant = "store",
}: {
  code: string | null;
  variant?: "store" | "admin";
}) {
  const tracking = await getCarrierTracking(code);
  if (!tracking) return null;
  const muted = variant === "admin" ? "text-muted-foreground" : "text-ink-muted";
  const text = variant === "admin" ? "text-sm" : "type-small";

  if (tracking.events.length === 0)
    return (
      <p className={`mt-2 ${text} ${muted}`}>
        Os Correios ainda não registraram movimentação para este código. Os primeiros eventos
        costumam aparecer algumas horas depois da postagem.
      </p>
    );

  return (
    <ol aria-label="Movimentação nos Correios" className={`mt-3 flex flex-col gap-3 ${text}`}>
      {tracking.events.map((event, index) => (
        <li key={`${event.code}-${event.type}-${event.date.getTime()}-${index}`}>
          <span className={index === 0 ? "font-semibold" : undefined}>{event.description}</span>
          {event.detail ? <span className="block">{event.detail}</span> : null}
          <span className={`block ${muted}`}>
            {formatDateTime(event.date)}
            {event.location ? `, ${event.location}` : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}
