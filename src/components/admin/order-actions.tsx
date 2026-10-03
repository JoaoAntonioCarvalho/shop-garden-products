"use client";

import { Copy, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ActionButton } from "@/components/admin/action-button";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Textarea } from "@/components/admin/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  addOrderNoteAction,
  changeOrderStatusAction,
  markOrderPaidAction,
  requestReviewAction,
  resendOrderEmailAction,
  revealOrderCpfAction,
} from "@/server/actions/admin/orders";
import type { AdminResult } from "@/server/admin/action";
import type { OrderStatusCode } from "@/server/services/order-status";

type ActionKind = "markPaid" | "ship" | "cancel" | "return" | null;

type OrderActionsProps = {
  orderId: string;
  number: string;
  status: OrderStatusCode;
  /** O pedido já foi pago: cancelar exige decidir estorno e devolução ao estoque. */
  paid: boolean;
  usesTransport: boolean;
  isPickup: boolean;
  canRefund: boolean;
  canMarkPaid: boolean;
};

/** Diálogo com formulário que executa uma ação do admin e mostra o resultado. */
function FormDialog({
  open,
  onClose,
  title,
  description,
  submitLabel,
  destructive,
  action,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  submitLabel: string;
  destructive?: boolean;
  action: (form: FormData) => Promise<AdminResult<unknown>>;
  children: ReactNode;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await action(form);
      if (result.ok) {
        toast(result.message);
        setError(null);
        onClose();
        router.refresh();
      } else {
        setError(result.fieldErrors ? Object.values(result.fieldErrors).join(" ") : result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive bg-wine-50 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          {children}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Voltar
            </Button>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              disabled={pending}
              aria-busy={pending || undefined}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CheckRow({
  name,
  label,
  defaultChecked = true,
  hint,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="control-check mt-0.5 size-4"
      />
      <span>
        {label}
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

/** Ações principais do pedido, conforme o status atual (seção 12.4). */
export function OrderActions({
  orderId,
  number,
  status,
  paid,
  usesTransport,
  isPickup,
  canRefund,
  canMarkPaid,
}: OrderActionsProps) {
  const [dialog, setDialog] = useState<ActionKind>(null);
  const close = () => setDialog(null);
  const simple = (toStatus: OrderStatusCode) =>
    changeOrderStatusAction.bind(null, { orderId, toStatus });
  const closable = ["PENDING_PAYMENT", "PAID", "PREPARING"].includes(status);

  return (
    <div className="flex flex-wrap gap-2">
      {status === "PENDING_PAYMENT" && canMarkPaid ? (
        <Button onClick={() => setDialog("markPaid")}>Marcar como pago</Button>
      ) : null}
      {status === "PAID" ? (
        <ActionButton action={simple("PREPARING")}>Iniciar preparação</ActionButton>
      ) : null}
      {status === "PREPARING" && usesTransport ? (
        <Button onClick={() => setDialog("ship")}>Marcar como enviado</Button>
      ) : null}
      {status === "PREPARING" && !usesTransport && !isPickup ? (
        <ActionButton action={simple("OUT_FOR_DELIVERY")}>Saiu para entrega</ActionButton>
      ) : null}
      {status === "PREPARING" && isPickup ? (
        <ActionButton action={simple("READY_FOR_PICKUP")}>Pronto para retirada</ActionButton>
      ) : null}
      {["SHIPPED", "OUT_FOR_DELIVERY", "READY_FOR_PICKUP"].includes(status) ? (
        <ActionButton action={simple("DELIVERED")}>Marcar como entregue</ActionButton>
      ) : null}
      {status === "OUT_FOR_DELIVERY" ? (
        <ActionButton
          variant="outline"
          action={changeOrderStatusAction.bind(null, {
            orderId,
            toStatus: "PREPARING",
            note: "Tentativa de entrega sem sucesso",
            notifyCustomer: false,
          })}
        >
          Entrega não realizada
        </ActionButton>
      ) : null}
      {["SHIPPED", "DELIVERED"].includes(status) && canRefund ? (
        <Button variant="outline" onClick={() => setDialog("return")}>
          Registrar devolução
        </Button>
      ) : null}
      {closable && (!paid || canRefund) ? (
        <Button variant="destructive" onClick={() => setDialog("cancel")}>
          Cancelar pedido
        </Button>
      ) : null}

      <FormDialog
        open={dialog === "markPaid"}
        onClose={close}
        title={`Marcar ${number} como pago`}
        description="Use quando o pagamento foi confirmado por fora do site, por exemplo com comprovante de Pix no WhatsApp."
        submitLabel="Marcar como pago"
        action={(form) => markOrderPaidAction({ orderId, note: String(form.get("note") ?? "") })}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pago-observacao">Observação</Label>
          <Textarea
            id="pago-observacao"
            name="note"
            required
            placeholder="Como o pagamento foi confirmado"
          />
        </div>
      </FormDialog>

      <FormDialog
        open={dialog === "ship"}
        onClose={close}
        title={`Marcar ${number} como enviado`}
        submitLabel="Marcar como enviado"
        action={(form) =>
          changeOrderStatusAction({
            orderId,
            toStatus: "SHIPPED",
            carrier: String(form.get("carrier") ?? ""),
            trackingCode: String(form.get("trackingCode") ?? ""),
            notifyCustomer: form.get("notify") === "on",
          })
        }
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="envio-transportadora">Transportadora</Label>
          <Input id="envio-transportadora" name="carrier" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="envio-rastreio">Código de rastreio</Label>
          <Input id="envio-rastreio" name="trackingCode" required />
        </div>
        <CheckRow name="notify" label="Avisar o cliente por e-mail" />
      </FormDialog>

      <FormDialog
        open={dialog === "cancel"}
        onClose={close}
        title={`Cancelar o pedido ${number}`}
        description={
          paid
            ? "O pedido já foi pago. Escolha o que fazer com o pagamento e com os itens."
            : "A reserva de estoque é liberada."
        }
        submitLabel="Cancelar pedido"
        destructive
        action={(form) =>
          changeOrderStatusAction({
            orderId,
            toStatus: "CANCELED",
            note: String(form.get("note") ?? ""),
            refund: form.get("refund") === "on",
            restock: form.get("restock") === "on",
            notifyCustomer: form.get("notify") === "on",
          })
        }
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cancelar-motivo">Motivo</Label>
          <Textarea
            id="cancelar-motivo"
            name="note"
            required
            placeholder="O cliente vê este motivo no e-mail"
          />
        </div>
        {paid ? (
          <>
            <CheckRow name="refund" label="Estornar o pagamento" />
            <CheckRow
              name="restock"
              label="Devolver os itens ao estoque"
              defaultChecked={false}
              hint="Marque só se os produtos voltaram em condição de venda."
            />
          </>
        ) : null}
        <CheckRow name="notify" label="Avisar o cliente por e-mail" />
      </FormDialog>

      <FormDialog
        open={dialog === "return"}
        onClose={close}
        title={`Registrar devolução do pedido ${number}`}
        submitLabel="Registrar devolução"
        destructive
        action={(form) =>
          changeOrderStatusAction({
            orderId,
            toStatus: "RETURNED",
            note: String(form.get("note") ?? ""),
            refund: form.get("refund") === "on",
            restock: form.get("restock") === "on",
            notifyCustomer: false,
          })
        }
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="devolucao-motivo">Observação</Label>
          <Textarea id="devolucao-motivo" name="note" placeholder="Motivo e estado dos produtos" />
        </div>
        <CheckRow name="refund" label="Estornar o pagamento" />
        <CheckRow
          name="restock"
          label="Devolver os itens ao estoque"
          defaultChecked={false}
          hint="Marque só se os produtos voltaram em condição de venda."
        />
      </FormDialog>
    </div>
  );
}

export function OrderNoteForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [key, setKey] = useState(0);
  return (
    <form
      key={key}
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const body = String(new FormData(event.currentTarget).get("body") ?? "");
        startTransition(async () => {
          const result = await addOrderNoteAction({ orderId, body });
          if (result.ok) {
            toast(result.message);
            setKey((value) => value + 1);
            router.refresh();
          } else toast(result.fieldErrors?.body ?? result.error, { tone: "error" });
        });
      }}
    >
      <Label htmlFor="nota-interna">Adicionar nota interna</Label>
      <Textarea id="nota-interna" name="body" rows={2} placeholder="Visível só para a equipe" />
      <Button type="submit" size="sm" variant="outline" className="self-start" disabled={pending}>
        Adicionar nota
      </Button>
    </form>
  );
}

const emailOptions = [
  ["order-received", "Pedido recebido"],
  ["payment-approved", "Pagamento aprovado"],
  ["order-preparing", "Em preparação"],
  ["order-shipped", "Enviado ou saiu para entrega"],
  ["order-delivered", "Entregue (com convite para avaliar)"],
  ["order-canceled", "Cancelado"],
  ["order-manual-summary", "Resumo e link de pagamento"],
] as const;

export function ResendEmailForm({ orderId, delivered }: { orderId: string; delivered: boolean }) {
  const [template, setTemplate] = useState<(typeof emailOptions)[number][0]>("order-received");
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="reenviar-modelo">Reenviar e-mail</Label>
      <div className="flex flex-wrap gap-2">
        <select
          id="reenviar-modelo"
          value={template}
          onChange={(event) => setTemplate(event.target.value as typeof template)}
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
        >
          {emailOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <ActionButton
          size="sm"
          variant="outline"
          className="h-9"
          action={() => resendOrderEmailAction({ orderId, template })}
        >
          Reenviar e-mail
        </ActionButton>
      </div>
      {delivered ? (
        <ActionButton
          size="sm"
          variant="ghost"
          className="self-start"
          action={() => requestReviewAction({ orderId })}
        >
          Solicitar avaliação
        </ActionButton>
      ) : null}
    </div>
  );
}

/** CPF mascarado por padrão. "Mostrar" revela e registra na auditoria. */
export function CpfReveal({ orderId, masked }: { orderId: string; masked: string }) {
  const [cpf, setCpf] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      {cpf ?? masked}
      {cpf ? null : (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await revealOrderCpfAction({ orderId });
              if (result.ok && result.data) setCpf(result.data);
              else if (!result.ok) toast(result.error, { tone: "error" });
            })
          }
        >
          <Eye aria-hidden="true" />
          Mostrar<span className="sr-only"> CPF completo</span>
        </Button>
      )}
    </span>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast(`${label}: copiado`);
        } catch {
          toast("Não foi possível copiar.", { tone: "error" });
        }
      }}
    >
      <Copy aria-hidden="true" />
      {label}
    </Button>
  );
}
