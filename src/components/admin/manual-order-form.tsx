"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { SearchPicker } from "@/components/admin/search-picker";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Textarea } from "@/components/admin/ui/textarea";
import { describeShippingOption } from "@/components/store/shipping-calculator";
import { toast } from "@/components/ui/toast";
import { formatBRL, formatCentsPlain, parseBRLToCents } from "@/lib/money";
import { formatCep, isValidCep } from "@/lib/validators/cep";
import { UF } from "@/lib/validators/checkout";
import { formatCpf } from "@/lib/validators/cpf";
import { formatPhone } from "@/lib/validators/phone";
import {
  createManualOrderAction,
  previewManualOrderAction,
  searchCustomersAction,
  searchVariantsAction,
  type CustomerHit,
  type VariantHit,
} from "@/server/actions/admin/manual-order";
import type { ManualOrderPreview } from "@/server/admin/manual-order";

type Item = {
  variantId: string;
  name: string;
  sku: string;
  listPriceCents: number;
  available: number;
  quantity: number;
  price: string;
  reason: string;
};
type PaymentKey = "PIX_RECEIVED" | "GENERATE_PIX" | "CARD_MACHINE" | "CASH" | "PAYMENT_LINK";

const selectClass = "h-9 rounded-md border border-input bg-background px-2 text-sm";
const paymentOptions: Array<[PaymentKey, string]> = [
  ["PIX_RECEIVED", "Pix já recebido"],
  ["GENERATE_PIX", "Gerar Pix"],
  ["CARD_MACHINE", "Cartão na maquininha"],
  ["CASH", "Dinheiro"],
  ["PAYMENT_LINK", "Link de pagamento"],
];

export function ManualOrderForm({ canOverridePrice }: { canOverridePrice: boolean }) {
  const router = useRouter();
  const [customer, setCustomer] = useState({ id: "", name: "", email: "", phone: "", cpf: "" });
  const [items, setItems] = useState<Item[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [shippingMode, setShippingMode] = useState<"quote" | "manual" | "none">("quote");
  const [shippingCode, setShippingCode] = useState("");
  const [manualShipping, setManualShipping] = useState({ name: "", price: "" });
  const [delivery, setDelivery] = useState({ date: "", window: "" });
  const [address, setAddress] = useState({
    cep: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
  });
  const [payment, setPayment] = useState<PaymentKey>("PIX_RECEIVED");
  const [channel, setChannel] = useState<"WHATSAPP" | "STORE" | "PHONE" | "SITE">("WHATSAPP");
  const [origin, setOrigin] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [notes, setNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [preview, setPreview] = useState<ManualOrderPreview | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const dirty = items.length > 0 || customer.name !== "";

  const payload = () => ({
    customer: {
      id: customer.id || undefined,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      cpf: customer.cpf,
    },
    items: items.map((item) => {
      const cents = parseBRLToCents(item.price);
      const changed = canOverridePrice && cents !== null && cents !== item.listPriceCents;
      return {
        variantId: item.variantId,
        quantity: item.quantity,
        unitPriceCents: changed ? cents : null,
        priceReason: changed ? item.reason : undefined,
      };
    }),
    couponCode,
    shipping: {
      mode: shippingMode,
      code: shippingCode || undefined,
      manualName: manualShipping.name || undefined,
      manualCents: parseBRLToCents(manualShipping.price) ?? 0,
      deliveryDate: delivery.date || undefined,
      window: delivery.window || undefined,
    },
    address: { ...address, state: address.state as (typeof UF)[number] | "" },
    payment,
    channel,
    origin,
    giftMessage,
    notes,
    sendEmail,
  });

  // Prévia calculada no servidor sempre que itens, cupom, CEP, entrega ou pagamento mudam.
  const signature = JSON.stringify([
    items.map((i) => [i.variantId, i.quantity, i.price, i.reason]),
    couponCode,
    address.cep,
    shippingMode,
    shippingCode,
    manualShipping.price,
    payment,
  ]);
  useEffect(() => {
    if (items.length === 0) return;
    const timer = setTimeout(async () => {
      const result = await previewManualOrderAction(payload());
      if (result.ok) setPreview(result.preview);
    }, 400);
    return () => clearTimeout(timer);
    // A assinatura resume tudo o que afeta o cálculo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // Aviso ao sair com alterações não salvas.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function lookupCep(value: string) {
    if (!isValidCep(value)) return;
    try {
      const response = await fetch(`/api/cep/${value.replace(/\D/g, "")}`);
      const data = (await response.json()) as {
        status: string;
        address?: { street: string; district: string; city: string; state: string };
      };
      if (data.status === "ok" && data.address)
        setAddress((current) => ({ ...current, ...data.address }));
    } catch {
      // Sem o autopreenchimento, o endereço é digitado.
    }
  }

  function submit() {
    startTransition(async () => {
      const result = await createManualOrderAction(payload());
      if (result.ok && result.data) {
        toast(result.message);
        setItems([]);
        setCustomer({ id: "", name: "", email: "", phone: "", cpf: "" });
        router.push(`/admin/pedidos/${result.data.number}`);
      } else if (!result.ok) {
        setErrors(
          result.fieldErrors ? [...new Set(Object.values(result.fieldErrors))] : [result.error],
        );
        window.scrollTo({ top: 0 });
      }
    });
  }

  const visibleItems = items.length > 0 ? preview : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-4">
        {errors.length > 0 ? (
          <div
            role="alert"
            className="rounded-md border border-destructive bg-wine-50 p-3 text-sm text-destructive"
          >
            <p className="font-medium">Confira antes de criar o pedido</p>
            <ul className="list-disc pl-5">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cliente</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <SearchPicker<CustomerHit>
              id="buscar-cliente"
              label="Buscar cliente existente"
              placeholder="Nome, e-mail, CPF ou telefone"
              search={searchCustomersAction}
              render={(hit) => `${hit.name}, ${hit.email}`}
              onPick={(hit) =>
                setCustomer({
                  id: hit.id,
                  name: hit.name,
                  email: hit.email,
                  phone: hit.phone ? formatPhone(hit.phone) : "",
                  cpf: hit.cpf ? formatCpf(hit.cpf) : "",
                })
              }
            />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cliente-nome">Nome</Label>
                <Input
                  id="cliente-nome"
                  value={customer.name}
                  onChange={(event) => setCustomer({ ...customer, name: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cliente-email">E-mail</Label>
                <Input
                  id="cliente-email"
                  type="email"
                  value={customer.email}
                  onChange={(event) =>
                    setCustomer({ ...customer, id: "", email: event.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cliente-telefone">Telefone</Label>
                <Input
                  id="cliente-telefone"
                  inputMode="numeric"
                  value={customer.phone}
                  onChange={(event) =>
                    setCustomer({ ...customer, phone: formatPhone(event.target.value) })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cliente-cpf">CPF (opcional)</Label>
                <Input
                  id="cliente-cpf"
                  inputMode="numeric"
                  value={customer.cpf}
                  onChange={(event) =>
                    setCustomer({ ...customer, cpf: formatCpf(event.target.value) })
                  }
                />
              </div>
            </div>
            {customer.id ? (
              <p className="text-xs text-muted-foreground">
                Cliente já cadastrado. O pedido entra no histórico dele.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Produtos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <SearchPicker<VariantHit>
              id="buscar-produto"
              label="Adicionar produto"
              placeholder="Nome ou SKU"
              search={searchVariantsAction}
              render={(hit) =>
                `${hit.name}, ${hit.sku}, ${formatBRL(hit.priceCents)}, ${hit.available} em estoque`
              }
              onPick={(hit) =>
                setItems((current) =>
                  current.some((item) => item.variantId === hit.variantId)
                    ? current.map((item) =>
                        item.variantId === hit.variantId
                          ? { ...item, quantity: item.quantity + 1 }
                          : item,
                      )
                    : [
                        ...current,
                        {
                          variantId: hit.variantId,
                          name: hit.name,
                          sku: hit.sku,
                          listPriceCents: hit.priceCents,
                          available: hit.available,
                          quantity: 1,
                          price: formatCentsPlain(hit.priceCents),
                          reason: "",
                        },
                      ],
                )
              }
            />
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum produto adicionado.</p>
            ) : null}
            <ul className="flex flex-col gap-3">
              {items.map((item, index) => {
                const update = (changes: Partial<Item>) =>
                  setItems((current) =>
                    current.map((entry, i) => (i === index ? { ...entry, ...changes } : entry)),
                  );
                const changed =
                  canOverridePrice && parseBRLToCents(item.price) !== item.listPriceCents;
                return (
                  <li key={item.variantId} className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">
                        {item.name}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {item.sku}. {item.available} em estoque. Preço de tabela:{" "}
                          {formatBRL(item.listPriceCents)}
                        </span>
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover ${item.name}`}
                        onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-end gap-3">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`qtd-${item.variantId}`} className="text-xs">
                          Quantidade
                        </Label>
                        <Input
                          id={`qtd-${item.variantId}`}
                          type="number"
                          min={1}
                          max={item.available}
                          value={item.quantity}
                          onChange={(event) =>
                            update({ quantity: Math.max(1, Number(event.target.value) || 1) })
                          }
                          className="w-20"
                        />
                      </div>
                      {canOverridePrice ? (
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`preco-${item.variantId}`} className="text-xs">
                            Preço unitário (R$)
                          </Label>
                          <Input
                            id={`preco-${item.variantId}`}
                            inputMode="decimal"
                            value={item.price}
                            onChange={(event) => update({ price: event.target.value })}
                            className="w-28"
                          />
                        </div>
                      ) : null}
                      {changed ? (
                        <div className="flex min-w-48 flex-1 flex-col gap-1">
                          <Label htmlFor={`motivo-${item.variantId}`} className="text-xs">
                            Motivo do ajuste de preço
                          </Label>
                          <Input
                            id={`motivo-${item.variantId}`}
                            value={item.reason}
                            onChange={(event) => update({ reason: event.target.value })}
                          />
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex max-w-xs flex-col gap-1.5">
              <Label htmlFor="pedido-cupom">Cupom (opcional)</Label>
              <Input
                id="pedido-cupom"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
              />
              {preview?.couponError && couponCode ? (
                <p className="text-xs text-destructive">{preview.couponError}</p>
              ) : null}
              {preview?.coupon ? (
                <p className="text-xs text-primary">Cupom aplicado: {preview.coupon.summary}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entrega</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <fieldset className="flex flex-wrap gap-4">
              <legend className="sr-only">Tipo de entrega</legend>
              {(
                [
                  ["quote", "Calcular pelo CEP"],
                  ["manual", "Valor combinado"],
                  ["none", "Venda na loja, sem entrega"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="tipo-entrega"
                    className="control-radio size-4"
                    checked={shippingMode === value}
                    onChange={() => setShippingMode(value)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            {shippingMode !== "none" ? (
              <>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="entrega-cep">CEP</Label>
                    <Input
                      id="entrega-cep"
                      inputMode="numeric"
                      value={address.cep}
                      onChange={(event) => {
                        const value = formatCep(event.target.value);
                        setAddress({ ...address, cep: value });
                        void lookupCep(value);
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <Label htmlFor="entrega-rua">Rua</Label>
                    <Input
                      id="entrega-rua"
                      value={address.street}
                      onChange={(event) => setAddress({ ...address, street: event.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="entrega-numero">Número</Label>
                    <Input
                      id="entrega-numero"
                      value={address.number}
                      onChange={(event) => setAddress({ ...address, number: event.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="entrega-complemento">Complemento</Label>
                    <Input
                      id="entrega-complemento"
                      value={address.complement}
                      onChange={(event) =>
                        setAddress({ ...address, complement: event.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="entrega-bairro">Bairro</Label>
                    <Input
                      id="entrega-bairro"
                      value={address.district}
                      onChange={(event) => setAddress({ ...address, district: event.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="entrega-cidade">Cidade</Label>
                    <Input
                      id="entrega-cidade"
                      value={address.city}
                      onChange={(event) => setAddress({ ...address, city: event.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="entrega-uf">Estado</Label>
                    <select
                      id="entrega-uf"
                      value={address.state}
                      onChange={(event) => setAddress({ ...address, state: event.target.value })}
                      className={selectClass}
                    >
                      <option value="">UF</option>
                      {UF.map((uf) => (
                        <option key={uf} value={uf}>
                          {uf}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {shippingMode === "quote" ? (
                  <fieldset>
                    <legend className="text-sm font-medium">Opções para o CEP</legend>
                    {preview?.shippingNotice ? (
                      <p className="mt-1 text-sm text-warning">{preview.shippingNotice}</p>
                    ) : null}
                    {!preview?.shippingOptions.length ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Adicione produtos e o CEP para ver as opções.
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-col gap-1">
                      {preview?.shippingOptions.map((option) => (
                        <label
                          key={option.code}
                          className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2 text-sm"
                        >
                          <input
                            type="radio"
                            name="opcao-entrega"
                            className="control-radio size-4"
                            checked={shippingCode === option.code}
                            onChange={() => setShippingCode(option.code)}
                          />
                          <span className="flex-1">
                            {option.name}
                            <span className="block text-xs text-muted-foreground">
                              {describeShippingOption(option)}
                            </span>
                          </span>
                          <span className="tabular-nums">
                            {option.isFree ? "Grátis" : formatBRL(option.priceCents)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="entrega-nome">Nome da entrega</Label>
                      <Input
                        id="entrega-nome"
                        value={manualShipping.name}
                        placeholder="Por exemplo: motoboy"
                        onChange={(event) =>
                          setManualShipping({ ...manualShipping, name: event.target.value })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="entrega-valor">Valor do frete (R$)</Label>
                      <Input
                        id="entrega-valor"
                        inputMode="decimal"
                        value={manualShipping.price}
                        onChange={(event) =>
                          setManualShipping({ ...manualShipping, price: event.target.value })
                        }
                      />
                    </div>
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="entrega-data">Data combinada (opcional)</Label>
                    <Input
                      id="entrega-data"
                      type="date"
                      value={delivery.date}
                      onChange={(event) => setDelivery({ ...delivery, date: event.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="entrega-periodo">Período (opcional)</Label>
                    <Input
                      id="entrega-periodo"
                      value={delivery.window}
                      placeholder="Manhã, tarde ou horário"
                      onChange={(event) => setDelivery({ ...delivery, window: event.target.value })}
                    />
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pagamento, canal e observações</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pedido-pagamento">Pagamento</Label>
              <select
                id="pedido-pagamento"
                value={payment}
                onChange={(event) => setPayment(event.target.value as PaymentKey)}
                className={selectClass}
              >
                {paymentOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pedido-canal">Canal</Label>
              <select
                id="pedido-canal"
                value={channel}
                onChange={(event) => setChannel(event.target.value as typeof channel)}
                className={selectClass}
              >
                <option value="WHATSAPP">WhatsApp</option>
                <option value="PHONE">Telefone</option>
                <option value="STORE">Loja</option>
                <option value="SITE">Site</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pedido-origem">Origem (opcional)</Label>
              <Input
                id="pedido-origem"
                value={origin}
                placeholder="Por exemplo: instagram"
                onChange={(event) => setOrigin(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-3">
              <Label htmlFor="pedido-cartao">Mensagem do cartão de presente (opcional)</Label>
              <Input
                id="pedido-cartao"
                maxLength={240}
                value={giftMessage}
                onChange={(event) => setGiftMessage(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-3">
              <Label htmlFor="pedido-observacoes">Observações internas</Label>
              <Textarea
                id="pedido-observacoes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm md:col-span-3">
              <input
                type="checkbox"
                className="control-check size-4"
                checked={sendEmail}
                onChange={(event) => setSendEmail(event.target.checked)}
              />
              Enviar resumo e link de pagamento ao cliente por e-mail
            </label>
          </CardContent>
        </Card>
      </div>

      <Card className="self-start xl:sticky xl:top-20">
        <CardHeader>
          <CardTitle className="text-base">Resumo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {visibleItems ? (
            <>
              <ul className="flex flex-col gap-1">
                {visibleItems.lines.map((line) => (
                  <li key={line.variantId} className="flex justify-between gap-2">
                    <span>
                      {line.quantity}x {line.name}
                    </span>
                    <span className="whitespace-nowrap tabular-nums">
                      {formatBRL(line.totalCents)}
                    </span>
                  </li>
                ))}
              </ul>
              <dl className="flex flex-col gap-1 border-t border-border pt-3 tabular-nums">
                <div className="flex justify-between">
                  <dt>Subtotal</dt>
                  <dd>{formatBRL(visibleItems.totals.subtotalCents)}</dd>
                </div>
                {visibleItems.totals.discountCents > 0 ? (
                  <div className="flex justify-between">
                    <dt>Cupom</dt>
                    <dd>- {formatBRL(visibleItems.totals.discountCents)}</dd>
                  </div>
                ) : null}
                {visibleItems.totals.pixDiscountCents > 0 ? (
                  <div className="flex justify-between">
                    <dt>Desconto do Pix</dt>
                    <dd>- {formatBRL(visibleItems.totals.pixDiscountCents)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt>Frete</dt>
                  <dd>
                    {visibleItems.totals.shippingCents
                      ? formatBRL(visibleItems.totals.shippingCents)
                      : "Sem frete"}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                  <dt>Total</dt>
                  <dd>{formatBRL(visibleItems.totals.totalCents)}</dd>
                </div>
              </dl>
              {visibleItems.problems.length > 0 ? (
                <ul role="alert" className="list-disc pl-5 text-destructive">
                  {visibleItems.problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground">Adicione produtos para ver os valores.</p>
          )}
          <Button
            onClick={submit}
            disabled={pending || items.length === 0}
            aria-busy={pending || undefined}
          >
            Criar pedido
          </Button>
          <p className="text-xs text-muted-foreground">
            O pedido reserva e baixa o estoque e entra nos relatórios com o canal escolhido.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
