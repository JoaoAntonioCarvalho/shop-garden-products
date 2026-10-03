"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronDown, Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  describeShippingOption,
  formatDeliveryEstimate,
} from "@/components/store/shipping-calculator";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { track, type AnalyticsItem } from "@/lib/analytics/events";
import { cn } from "@/lib/cn";
import { formatDateKey } from "@/lib/dates";
import { centsToReais, formatBRL } from "@/lib/money";
import { formatCep, isValidCep } from "@/lib/validators/cep";
import { cardBrandLabels, type CardBrand } from "@/lib/validators/card";
import {
  addressSchema,
  deliveryWindowLabels,
  identificationSchema,
  recipientSchema,
  UF,
  type CheckoutDraft,
  type IdentificationInput,
  type ShippingChoice,
} from "@/lib/validators/checkout";
import { formatCpf } from "@/lib/validators/cpf";
import { formatPhone } from "@/lib/validators/phone";
import {
  checkoutQuoteAction,
  placeOrderAction,
  removeLocalOnlyItemsAction,
  saveCheckoutDraftAction,
  type CheckoutQuote,
} from "@/server/actions/checkout";
import type { Totals } from "@/server/services/totals";
import { CardForm, type CardTokenData } from "./card-form";

export type CheckoutLine = {
  id: string;
  name: string;
  variantName: string | null;
  quantity: number;
  totalCents: number;
  imageUrl: string | null;
};

type PaymentMethod = "PIX" | "CREDIT_CARD" | "BOLETO";

type CheckoutFlowProps = {
  lines: CheckoutLine[];
  analyticsItems: AnalyticsItem[];
  initialTotals: Totals;
  draft: CheckoutDraft;
  couponCode: string | null;
  giftMessage: string | null;
  pixDiscountPercent: number;
  showTestCards: boolean;
  initialNotices: string[];
  savedAddresses?: SavedCheckoutAddress[];
};

export type SavedCheckoutAddress = {
  id: string;
  label: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  reference: string;
};

const deliverySchema = z.object({ address: addressSchema, recipient: recipientSchema });
type DeliveryForm = z.input<typeof deliverySchema>;

const paymentLabels: Record<PaymentMethod, string> = {
  PIX: "Pix",
  CREDIT_CARD: "Cartão de crédito",
  BOLETO: "Boleto",
};

function StepShell({
  number,
  title,
  state,
  summary,
  onEdit,
  children,
}: {
  number: number;
  title: string;
  state: "open" | "done" | "todo";
  summary?: ReactNode;
  onEdit?: () => void;
  children: ReactNode;
}) {
  const headingId = `etapa-${number}`;
  return (
    <section aria-labelledby={headingId} className="border-b border-line py-6">
      <div className="flex items-center justify-between gap-4">
        <h2
          id={headingId}
          className={cn(
            "flex items-center gap-3 type-h3",
            state === "todo" ? "text-ink-muted" : "text-moss-900",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex size-8 flex-none items-center justify-center rounded-full font-sans text-[15px] font-semibold",
              state === "done"
                ? "bg-moss-700 text-white"
                : state === "open"
                  ? "border border-moss-700 text-moss-700"
                  : "border border-line text-ink-muted",
            )}
          >
            {state === "done" ? <Check strokeWidth={2} className="size-4" /> : number}
          </span>
          <span>
            <span className="sr-only">Etapa {number}: </span>
            {title}
            {state === "done" ? <span className="sr-only"> (concluída)</span> : null}
          </span>
        </h2>
        {state === "done" && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="min-h-11 type-small font-medium text-moss-700 underline underline-offset-3 hover:text-moss-900"
          >
            Alterar<span className="sr-only"> {title.toLowerCase()}</span>
          </button>
        ) : null}
      </div>
      {state === "done" && summary ? (
        <div className="mt-2 pl-11 type-small text-ink-muted">{summary}</div>
      ) : null}
      {state === "open" ? <div className="mt-5 md:pl-11">{children}</div> : null}
    </section>
  );
}

function Summary({
  lines,
  totals,
  method,
  couponCode,
  shippingChosen,
}: {
  lines: CheckoutLine[];
  totals: Totals;
  method: PaymentMethod;
  couponCode: string | null;
  shippingChosen: boolean;
}) {
  return (
    <>
      <ul className="divide-y divide-line">
        {lines.map((line) => (
          <li key={line.id} className="flex gap-3 py-3">
            <div className="relative aspect-4/5 w-12 flex-none overflow-hidden rounded-photo bg-white">
              {line.imageUrl ? (
                <Image src={line.imageUrl} alt="" fill sizes="48px" className="object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="type-small text-ink">{line.name}</p>
              <p className="type-caption text-ink-muted">
                {line.variantName ? `${line.variantName}, ` : ""}
                {line.quantity} {line.quantity === 1 ? "unidade" : "unidades"}
              </p>
            </div>
            <p className="type-small font-medium whitespace-nowrap text-ink tabular-nums">
              {formatBRL(line.totalCents)}
            </p>
          </li>
        ))}
      </ul>
      <dl className="mt-3 flex flex-col gap-2 border-t border-line pt-4 type-small text-ink">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{formatBRL(totals.subtotalCents)}</dd>
        </div>
        {totals.discountCents > 0 ? (
          <div className="flex justify-between text-moss-700">
            <dt>Cupom {couponCode}</dt>
            <dd className="tabular-nums">- {formatBRL(totals.discountCents)}</dd>
          </div>
        ) : null}
        {totals.pixDiscountCents > 0 ? (
          <div className="flex justify-between text-moss-700">
            <dt>Desconto do Pix</dt>
            <dd className="tabular-nums">- {formatBRL(totals.pixDiscountCents)}</dd>
          </div>
        ) : null}
        {totals.giftWrapCents > 0 ? (
          <div className="flex justify-between">
            <dt>Embalagem para presente</dt>
            <dd className="tabular-nums">{formatBRL(totals.giftWrapCents)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt>Frete</dt>
          <dd className="tabular-nums">
            {!shippingChosen
              ? "A calcular"
              : totals.shippingCents === 0
                ? "Grátis"
                : formatBRL(totals.shippingCents)}
          </dd>
        </div>
        <div className="mt-1 flex justify-between border-t border-line pt-3 text-[18px] font-semibold">
          <dt>Total{method === "PIX" ? " no Pix" : ""}</dt>
          <dd className="tabular-nums">{formatBRL(totals.totalCents)}</dd>
        </div>
      </dl>
    </>
  );
}

export function CheckoutFlow({
  lines,
  analyticsItems,
  initialTotals,
  draft,
  couponCode,
  giftMessage,
  pixDiscountPercent,
  showTestCards,
  initialNotices,
  savedAddresses = [],
}: CheckoutFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [identification, setIdentification] = useState<IdentificationInput | null>(null);
  const [delivery, setDelivery] = useState<DeliveryForm | null>(null);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [shipping, setShipping] = useState<ShippingChoice>({
    code: draft.shipping?.code ?? "",
    deliveryDate: draft.shipping?.deliveryDate,
    window: draft.shipping?.window,
  });
  const [method, setMethod] = useState<PaymentMethod>(draft.paymentMethod ?? "PIX");
  const [card, setCard] = useState<{ token: CardTokenData; installments: number } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const [changes, setChanges] = useState<string[]>(initialNotices);
  const [errors, setErrors] = useState<string[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [quoting, startQuote] = useTransition();
  const [placing, startPlacing] = useTransition();
  const idempotencyKey = useRef<string>("");
  const errorRef = useRef<HTMLDivElement>(null);

  const identificationForm = useForm<IdentificationInput>({
    resolver: zodResolver(identificationSchema),
    defaultValues: {
      email: draft.identification?.email ?? "",
      name: draft.identification?.name ?? "",
      cpf: draft.identification?.cpf ? formatCpf(draft.identification.cpf) : "",
      phone: draft.identification?.phone ? formatPhone(draft.identification.phone) : "",
      marketingOptIn: false,
    },
  });
  const deliveryForm = useForm<DeliveryForm>({
    resolver: zodResolver(deliverySchema),
    defaultValues: {
      address: {
        cep: draft.address?.cep ? formatCep(draft.address.cep) : "",
        street: draft.address?.street ?? "",
        number: draft.address?.number ?? "",
        complement: draft.address?.complement ?? "",
        district: draft.address?.district ?? "",
        city: draft.address?.city ?? "",
        state: (draft.address?.state ?? "") as DeliveryForm["address"]["state"],
        reference: draft.address?.reference ?? "",
      },
      recipient: {
        isGift: draft.recipient?.isGift ?? false,
        name: draft.recipient?.name ?? "",
        phone: draft.recipient?.phone ?? "",
      },
    },
  });
  const cepValue = useWatch({ control: deliveryForm.control, name: "address.cep" });
  const isGift = useWatch({ control: deliveryForm.control, name: "recipient.isGift" });
  const recipientPhone = useWatch({ control: deliveryForm.control, name: "recipient.phone" });
  const cpfValue = useWatch({ control: identificationForm.control, name: "cpf" });
  const phoneValue = useWatch({ control: identificationForm.control, name: "phone" });
  const [cepMessage, setCepMessage] = useState<string | null>(null);

  const option = quote?.options.find((item) => item.code === shipping.code) ?? null;
  const totals = quote?.totals[method] ?? initialTotals;
  const dirty = identificationForm.formState.isDirty || deliveryForm.formState.isDirty;

  useEffect(() => {
    track("begin_checkout", {
      currency: "BRL",
      value: centsToReais(initialTotals.totalCents),
      coupon: couponCode ?? undefined,
      items: analyticsItems,
    });
    // Uma vez ao abrir o checkout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Avisa antes de sair com dados preenchidos e o pedido ainda não feito.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function refreshQuote(cep: string, choice: ShippingChoice) {
    startQuote(async () => {
      const result = await checkoutQuoteAction({
        cep,
        shippingCode: choice.code || null,
        deliveryDate: choice.deliveryDate ?? null,
      });
      if (!result.ok) {
        setQuoteError(result.error);
        return;
      }
      setQuoteError(null);
      setQuote(result);
      if (result.notices.length) setChanges(result.notices);
      // A opção escolhida pode ter deixado de existir (passou do horário de corte, por exemplo).
      if (choice.code && !result.options.some((item) => item.code === choice.code))
        setShipping({ code: "" });
      if (method === "BOLETO" && !result.boleto.available) setMethod("PIX");
    });
  }

  async function lookupCep(value: string) {
    if (!isValidCep(value)) return;
    setCepMessage(null);
    refreshQuote(value, shipping);
    try {
      const response = await fetch(`/api/cep/${value.replace(/\D/g, "")}`);
      const data = (await response.json()) as {
        status: string;
        address?: { street: string; district: string; city: string; state: string };
      };
      if (data.status === "ok" && data.address) {
        const { street, district, city, state } = data.address;
        if (street) deliveryForm.setValue("address.street", street, { shouldValidate: true });
        if (district) deliveryForm.setValue("address.district", district, { shouldValidate: true });
        if (city) deliveryForm.setValue("address.city", city, { shouldValidate: true });
        if (state)
          deliveryForm.setValue("address.state", state as DeliveryForm["address"]["state"], {
            shouldValidate: true,
          });
        deliveryForm.setFocus("address.number");
      } else if (data.status === "not_found") {
        setCepMessage(
          "Este CEP não foi encontrado. Confira os números ou preencha o endereço manualmente.",
        );
      } else {
        setCepMessage("Não conseguimos buscar o endereço agora. Preencha os campos abaixo.");
      }
    } catch {
      setCepMessage("Não conseguimos buscar o endereço agora. Preencha os campos abaixo.");
    }
  }

  function saveDraft(next: Partial<CheckoutDraft>) {
    return saveCheckoutDraftAction({
      identification: identification ?? undefined,
      address: delivery?.address as CheckoutDraft["address"],
      recipient: delivery?.recipient as CheckoutDraft["recipient"],
      shipping,
      paymentMethod: method,
      ...next,
    });
  }

  const submitIdentification = identificationForm.handleSubmit(async (values) => {
    setIdentification(values);
    const result = await saveDraft({ identification: values });
    setHasAccount(Boolean(result.hasAccount));
    setStep(2);
    const cep = deliveryForm.getValues("address.cep");
    if (isValidCep(cep) && !quote) refreshQuote(cep, shipping);
  });

  const submitDelivery = deliveryForm.handleSubmit(async (values) => {
    const stepErrors: string[] = [];
    if (!option) stepErrors.push("Escolha uma opção de entrega.");
    if (option?.requiresScheduling && !shipping.deliveryDate)
      stepErrors.push("Escolha a data da entrega.");
    if (option?.requiresScheduling && !shipping.window)
      stepErrors.push("Escolha o período da entrega: manhã ou tarde.");
    setErrors(stepErrors);
    if (stepErrors.length || !option) return;
    setDelivery(values);
    await saveDraft({
      address: values.address as CheckoutDraft["address"],
      recipient: values.recipient as CheckoutDraft["recipient"],
      shipping,
    });
    track("add_shipping_info", {
      currency: "BRL",
      value: centsToReais(totals.totalCents),
      shipping_tier: option.name,
      items: analyticsItems,
    });
    setStep(3);
  });

  function goToReview(nextCard?: { token: CardTokenData; installments: number }) {
    if (method === "CREDIT_CARD" && !nextCard && !card) {
      setErrors(["Preencha os dados do cartão."]);
      return;
    }
    if (nextCard) setCard(nextCard);
    setErrors([]);
    void saveDraft({ paymentMethod: method });
    track("add_payment_info", {
      currency: "BRL",
      value: centsToReais(totals.totalCents),
      payment_type: paymentLabels[method],
      items: analyticsItems,
    });
    // A chave de idempotência nasce ao abrir a revisão.
    idempotencyKey.current = crypto.randomUUID();
    setStep(4);
  }

  function placeOrder() {
    if (!identification || !delivery || !option) return;
    if (!accepted) {
      setErrors(["Para continuar, aceite os termos de uso e a política de trocas."]);
      errorRef.current?.focus();
      return;
    }
    setErrors([]);
    startPlacing(async () => {
      const result = await placeOrderAction({
        identification,
        address: delivery.address,
        recipient: delivery.recipient,
        shipping,
        payment: {
          method,
          installments: card?.installments ?? 1,
          card: method === "CREDIT_CARD" ? card?.token : null,
        },
        acceptedTerms: true,
        idempotencyKey: idempotencyKey.current,
        expectedTotalCents: totals.totalCents,
      });
      if (result.ok) {
        // Sai sem o aviso de "dados não salvos".
        identificationForm.reset(identificationForm.getValues());
        deliveryForm.reset(deliveryForm.getValues());
        router.push(`/pedido/${result.number}?token=${result.accessToken}`);
        return;
      }
      if (result.kind === "changed") {
        setChanges(result.changes);
        // Recarrega valores e opções; o cliente confere o que mudou e confirma de novo.
        idempotencyKey.current = crypto.randomUUID();
        refreshQuote(delivery.address.cep, shipping);
        router.refresh();
      } else {
        setErrors(result.errors);
      }
      errorRef.current?.focus();
    });
  }

  const stateOf = (number: number) => (step === number ? "open" : step > number ? "done" : "todo");
  const address = delivery?.address;

  return (
    <div className="grid gap-x-12 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">
      {/* Resumo recolhível no mobile */}
      <div className="border-b border-line lg:hidden">
        <button
          type="button"
          aria-expanded={summaryOpen}
          aria-controls="resumo-mobile"
          onClick={() => setSummaryOpen((value) => !value)}
          className="flex min-h-12 w-full items-center justify-between gap-3 type-body text-ink"
        >
          <span>
            {summaryOpen ? "Ocultar resumo" : "Ver resumo"}:{" "}
            <strong className="tabular-nums">{formatBRL(totals.totalCents)}</strong>
          </span>
          <ChevronDown
            aria-hidden="true"
            strokeWidth={1.5}
            className={cn("size-5 text-moss-700 transition-transform", summaryOpen && "rotate-180")}
          />
        </button>
        <div id="resumo-mobile" hidden={!summaryOpen} className="pb-4">
          <Summary
            lines={lines}
            totals={totals}
            method={method}
            couponCode={couponCode}
            shippingChosen={Boolean(option)}
          />
        </div>
      </div>

      <div>
        <div ref={errorRef} tabIndex={-1} className="outline-none">
          {changes.length > 0 ? (
            <Alert
              tone="warning"
              title="Algo mudou desde que você montou a sacola"
              live
              className="mt-4"
            >
              <ul className="list-disc pl-5">
                {changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
              <p className="mt-1">Confira os valores atualizados e confirme o pedido de novo.</p>
            </Alert>
          ) : null}
          {errors.length > 0 ? (
            <Alert tone="error" title="Confira antes de continuar" live className="mt-4">
              <ul className="list-disc pl-5">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
        </div>

        <StepShell
          number={1}
          title="Identificação"
          state={stateOf(1)}
          onEdit={() => setStep(1)}
          summary={identification ? `${identification.name}, ${identification.email}` : null}
        >
          <form onSubmit={submitIdentification} noValidate className="flex flex-col gap-4">
            <Field
              label="E-mail"
              hint="Enviamos a confirmação do pedido para este endereço."
              error={identificationForm.formState.errors.email?.message}
            >
              <Input
                type="email"
                autoComplete="email"
                inputMode="email"
                {...identificationForm.register("email")}
              />
            </Field>
            <Field label="Nome completo" error={identificationForm.formState.errors.name?.message}>
              <Input autoComplete="name" {...identificationForm.register("name")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="CPF"
                hint="Para a nota fiscal."
                error={identificationForm.formState.errors.cpf?.message}
              >
                <MaskedInput
                  mask="cpf"
                  value={cpfValue}
                  onValueChange={(value) =>
                    identificationForm.setValue("cpf", value, { shouldDirty: true })
                  }
                />
              </Field>
              <Field
                label="Celular com DDD"
                hint="Para avisos sobre a entrega."
                error={identificationForm.formState.errors.phone?.message}
              >
                <MaskedInput
                  mask="phone"
                  value={phoneValue}
                  onValueChange={(value) =>
                    identificationForm.setValue("phone", value, { shouldDirty: true })
                  }
                />
              </Field>
            </div>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
              <input
                type="checkbox"
                className="control-check"
                {...identificationForm.register("marketingOptIn")}
              />
              <span className="type-small text-ink">
                Quero receber novidades e ofertas por e-mail
              </span>
            </label>
            <Button
              type="submit"
              loading={identificationForm.formState.isSubmitting}
              className="self-start"
            >
              Continuar para a entrega
            </Button>
          </form>
        </StepShell>

        <StepShell
          number={2}
          title="Entrega"
          state={stateOf(2)}
          onEdit={() => setStep(2)}
          summary={
            address && option ? (
              <>
                <p>
                  {address.street}, {address.number}
                  {address.complement ? `, ${address.complement}` : ""}, {address.district},{" "}
                  {address.city}/{address.state}, CEP {address.cep}
                </p>
                <p>
                  {option.name}
                  {shipping.deliveryDate
                    ? `: ${formatDateKey(shipping.deliveryDate)}${shipping.window ? `, ${deliveryWindowLabels[shipping.window].toLowerCase()}` : ""}`
                    : formatDeliveryEstimate(option)
                      ? `: ${formatDeliveryEstimate(option).toLowerCase()}`
                      : ""}
                </p>
                {delivery?.recipient.isGift ? <p>Presente para {delivery.recipient.name}</p> : null}
              </>
            ) : null
          }
        >
          {hasAccount ? (
            <Alert tone="info" className="mb-4">
              Este e-mail já tem conta.{" "}
              <Link
                href="/entrar?voltar=/checkout"
                className="font-medium text-moss-700 underline underline-offset-3"
              >
                Entrar para usar seus endereços salvos
              </Link>{" "}
              ou continue sem entrar.
            </Alert>
          ) : null}
          <form onSubmit={submitDelivery} noValidate className="flex flex-col gap-4">
            {savedAddresses.length > 0 ? (
              <Field label="Usar um endereço salvo">
                <Select
                  defaultValue=""
                  onChange={(event) => {
                    const saved = savedAddresses.find((item) => item.id === event.target.value);
                    if (!saved) return;
                    for (const key of [
                      "street",
                      "number",
                      "complement",
                      "district",
                      "city",
                      "reference",
                    ] as const) {
                      deliveryForm.setValue(`address.${key}`, saved[key], {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                    deliveryForm.setValue(
                      "address.state",
                      saved.state as DeliveryForm["address"]["state"],
                      { shouldDirty: true },
                    );
                    deliveryForm.setValue("address.cep", formatCep(saved.cep), {
                      shouldDirty: true,
                    });
                    refreshQuote(saved.cep, { code: "" });
                    setShipping({ code: "" });
                  }}
                >
                  <option value="">Escolher endereço</option>
                  {savedAddresses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}, {item.district}, {item.city}/{item.state}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field
              label="CEP"
              error={deliveryForm.formState.errors.address?.cep?.message}
              className="max-w-48"
            >
              <MaskedInput
                mask="cep"
                value={cepValue}
                onValueChange={(value) => {
                  deliveryForm.setValue("address.cep", value, { shouldDirty: true });
                  if (isValidCep(value)) void lookupCep(value);
                }}
              />
            </Field>
            <p aria-live="polite" className="-mt-2 type-small text-ink-muted empty:hidden">
              {cepMessage}
            </p>
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <Field label="Rua" error={deliveryForm.formState.errors.address?.street?.message}>
                <Input autoComplete="address-line1" {...deliveryForm.register("address.street")} />
              </Field>
              <Field label="Número" error={deliveryForm.formState.errors.address?.number?.message}>
                <Input autoComplete="address-line2" {...deliveryForm.register("address.number")} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Complemento" optional>
                <Input
                  placeholder="Apartamento, bloco, casa"
                  {...deliveryForm.register("address.complement")}
                />
              </Field>
              <Field
                label="Bairro"
                error={deliveryForm.formState.errors.address?.district?.message}
              >
                <Input
                  autoComplete="address-level3"
                  {...deliveryForm.register("address.district")}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <Field label="Cidade" error={deliveryForm.formState.errors.address?.city?.message}>
                <Input autoComplete="address-level2" {...deliveryForm.register("address.city")} />
              </Field>
              <Field label="Estado" error={deliveryForm.formState.errors.address?.state?.message}>
                <Select autoComplete="address-level1" {...deliveryForm.register("address.state")}>
                  <option value="">UF</option>
                  {UF.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Ponto de referência" optional>
              <Input
                placeholder="Portaria, cor do portão, loja próxima"
                {...deliveryForm.register("address.reference")}
              />
            </Field>

            <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
              <input
                type="checkbox"
                className="control-check"
                {...deliveryForm.register("recipient.isGift")}
              />
              <span className="type-small text-ink">É um presente para outra pessoa</span>
            </label>
            {isGift ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Nome de quem vai receber"
                  error={deliveryForm.formState.errors.recipient?.name?.message}
                >
                  <Input {...deliveryForm.register("recipient.name")} />
                </Field>
                <Field
                  label="Telefone de quem vai receber"
                  error={deliveryForm.formState.errors.recipient?.phone?.message}
                >
                  <MaskedInput
                    mask="phone"
                    value={recipientPhone ?? ""}
                    onValueChange={(value) =>
                      deliveryForm.setValue("recipient.phone", value, { shouldDirty: true })
                    }
                  />
                </Field>
              </div>
            ) : null}
            {giftMessage ? (
              <p className="type-small text-ink-muted">
                Cartão com a mensagem: &ldquo;{giftMessage}&rdquo;
              </p>
            ) : null}

            <fieldset className="mt-2" aria-busy={quoting || undefined}>
              <legend className="type-body font-semibold text-ink">Opções de entrega</legend>
              <div aria-live="polite">
                {!isValidCep(cepValue ?? "") ? (
                  <p className="mt-2 type-small text-ink-muted">
                    Digite o CEP para ver as opções e os prazos.
                  </p>
                ) : null}
                {quoteError ? <p className="mt-2 type-small text-danger">{quoteError}</p> : null}
                {quote?.notice ? (
                  <Alert tone="warning" className="mt-3">
                    {quote.notice}
                    {quote.blockedByLocalOnly ? (
                      <div className="mt-3">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={async () => {
                            await removeLocalOnlyItemsAction();
                            router.refresh();
                            refreshQuote(cepValue, { code: "" });
                          }}
                        >
                          Remover esses itens da sacola
                        </Button>
                      </div>
                    ) : null}
                  </Alert>
                ) : null}
              </div>
              <div className={cn("mt-3 flex flex-col gap-2", quoting && "opacity-60")}>
                {quote?.options.map((item) => {
                  const selected = shipping.code === item.code;
                  return (
                    <div
                      key={item.code}
                      className={cn(
                        "rounded-control border bg-white",
                        selected ? "border-moss-700" : "border-line",
                      )}
                    >
                      <label className="flex min-h-14 cursor-pointer items-start gap-3 p-4">
                        <input
                          type="radio"
                          name="entrega"
                          className="control-radio mt-0.5"
                          checked={selected}
                          onChange={() => {
                            const next: ShippingChoice = { code: item.code };
                            setShipping(next);
                            refreshQuote(cepValue, next);
                          }}
                        />
                        <span className="flex-1">
                          <span className="block type-body font-medium text-ink">{item.name}</span>
                          <span className="block type-small text-ink-muted">
                            {describeShippingOption(item)}
                          </span>
                        </span>
                        <span className="type-body font-medium whitespace-nowrap text-ink tabular-nums">
                          {item.isFree ? "Grátis" : formatBRL(item.priceCents)}
                        </span>
                      </label>
                      {selected && item.requiresScheduling && item.availableDates ? (
                        <div className="border-t border-line p-4">
                          <fieldset>
                            <legend className="type-small font-medium text-ink">
                              Data da entrega
                            </legend>
                            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {item.availableDates.map((date) => (
                                <label
                                  key={date}
                                  className={cn(
                                    "flex min-h-11 cursor-pointer items-center justify-center rounded-control border px-2 text-center type-small has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-moss-700",
                                    shipping.deliveryDate === date
                                      ? "border-moss-700 bg-moss-100 font-medium text-moss-900"
                                      : "border-moss-500 text-ink hover:border-moss-700",
                                  )}
                                >
                                  <input
                                    type="radio"
                                    name="data-entrega"
                                    className="sr-only"
                                    checked={shipping.deliveryDate === date}
                                    onChange={() => {
                                      const next = { ...shipping, deliveryDate: date };
                                      setShipping(next);
                                      refreshQuote(cepValue, next);
                                    }}
                                  />
                                  {formatDateKey(date)}
                                </label>
                              ))}
                            </div>
                          </fieldset>
                          <fieldset className="mt-4">
                            <legend className="type-small font-medium text-ink">Período</legend>
                            <div className="mt-2 flex gap-2">
                              {(["manha", "tarde"] as const).map((window) => (
                                <label
                                  key={window}
                                  className={cn(
                                    "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-control border type-small has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-moss-700",
                                    shipping.window === window
                                      ? "border-moss-700 bg-moss-100 font-medium text-moss-900"
                                      : "border-moss-500 text-ink hover:border-moss-700",
                                  )}
                                >
                                  <input
                                    type="radio"
                                    name="periodo-entrega"
                                    className="sr-only"
                                    checked={shipping.window === window}
                                    onChange={() => setShipping({ ...shipping, window })}
                                  />
                                  {deliveryWindowLabels[window]}
                                </label>
                              ))}
                            </div>
                          </fieldset>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </fieldset>

            <Button
              type="submit"
              loading={deliveryForm.formState.isSubmitting}
              className="self-start"
            >
              Continuar para o pagamento
            </Button>
          </form>
        </StepShell>

        <StepShell
          number={3}
          title="Pagamento"
          state={stateOf(3)}
          onEdit={() => setStep(3)}
          summary={
            method === "CREDIT_CARD" && card
              ? `${cardBrandLabels[card.token.brand as CardBrand] ?? "Cartão"} final ${card.token.last4}, em ${card.installments}x`
              : paymentLabels[method]
          }
        >
          <fieldset>
            <legend className="sr-only">Forma de pagamento</legend>
            <div className="flex flex-col gap-2">
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-control border bg-white p-4",
                  method === "PIX" ? "border-moss-700" : "border-line",
                )}
              >
                <input
                  type="radio"
                  name="pagamento"
                  className="control-radio mt-0.5"
                  checked={method === "PIX"}
                  onChange={() => setMethod("PIX")}
                />
                <span>
                  <span className="block type-body font-medium text-ink">Pix</span>
                  {quote ? (
                    <span className="block type-small text-moss-700">
                      Pague {formatBRL(quote.totals.PIX.totalCents)} no Pix
                      {quote.totals.PIX.pixSavingsCents > 0
                        ? ` (economize ${formatBRL(quote.totals.PIX.pixSavingsCents)})`
                        : ""}
                    </span>
                  ) : (
                    <span className="block type-small text-moss-700">
                      {pixDiscountPercent}% de desconto
                    </span>
                  )}
                  <span className="block type-small text-ink-muted">Aprovação na hora.</span>
                  {method === "PIX" && quote?.totals.PIX.nonCombinable ? (
                    <span className="mt-1 block type-small text-ink-muted">
                      O cupom {couponCode} não acumula com o desconto do Pix. Aplicamos o maior:{" "}
                      {quote.totals.PIX.nonCombinable.applied === "coupon"
                        ? "o do cupom"
                        : "o do Pix"}{" "}
                      (
                      {formatBRL(
                        Math.max(
                          quote.totals.PIX.nonCombinable.couponCents,
                          quote.totals.PIX.nonCombinable.pixCents,
                        ),
                      )}{" "}
                      contra{" "}
                      {formatBRL(
                        Math.min(
                          quote.totals.PIX.nonCombinable.couponCents,
                          quote.totals.PIX.nonCombinable.pixCents,
                        ),
                      )}
                      ).
                    </span>
                  ) : null}
                </span>
              </label>

              <div
                className={cn(
                  "rounded-control border bg-white p-4",
                  method === "CREDIT_CARD" ? "border-moss-700" : "border-line",
                )}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="radio"
                    name="pagamento"
                    className="control-radio mt-0.5"
                    checked={method === "CREDIT_CARD"}
                    onChange={() => setMethod("CREDIT_CARD")}
                  />
                  <span>
                    <span className="block type-body font-medium text-ink">Cartão de crédito</span>
                    <span className="block type-small text-ink-muted">
                      {quote && quote.installments.length > 1
                        ? `${formatBRL(quote.totals.CREDIT_CARD.totalCents)} em até ${quote.installments.length}x sem juros`
                        : quote
                          ? formatBRL(quote.totals.CREDIT_CARD.totalCents)
                          : "Parcelado sem juros"}
                    </span>
                  </span>
                </label>
                {method === "CREDIT_CARD" ? (
                  <CardForm
                    installments={quote?.installments ?? []}
                    showTestCards={showTestCards}
                    submitLabel="Continuar para a revisão"
                    onTokenized={(token, installments) => goToReview({ token, installments })}
                  />
                ) : null}
              </div>

              <label
                className={cn(
                  "flex items-start gap-3 rounded-control border bg-white p-4",
                  method === "BOLETO" ? "border-moss-700" : "border-line",
                  quote?.boleto.available === false ? "cursor-not-allowed" : "cursor-pointer",
                )}
              >
                <input
                  type="radio"
                  name="pagamento"
                  className="control-radio mt-0.5"
                  checked={method === "BOLETO"}
                  disabled={quote?.boleto.available === false}
                  aria-describedby="boleto-info"
                  onChange={() => setMethod("BOLETO")}
                />
                <span>
                  <span
                    className={cn(
                      "block type-body font-medium",
                      quote?.boleto.available === false ? "text-ink-muted" : "text-ink",
                    )}
                  >
                    Boleto
                  </span>
                  <span id="boleto-info" className="block type-small text-ink-muted">
                    {quote?.boleto.available === false
                      ? quote.boleto.reason
                      : `${quote ? `${formatBRL(quote.totals.BOLETO.totalCents)}. ` : ""}Vence em 3 dias úteis; a confirmação leva até 3 dias úteis.`}
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
          {method !== "CREDIT_CARD" ? (
            <Button className="mt-5" onClick={() => goToReview()}>
              Continuar para a revisão
            </Button>
          ) : null}
        </StepShell>

        <StepShell number={4} title="Revisão" state={stateOf(4)}>
          <div className="hidden lg:block">
            <p className="type-small text-ink-muted">
              Confira os itens e os valores no resumo ao lado.
            </p>
          </div>
          <div className="lg:hidden">
            <Summary
              lines={lines}
              totals={totals}
              method={method}
              couponCode={couponCode}
              shippingChosen={Boolean(option)}
            />
          </div>
          <label className="mt-5 flex min-h-11 cursor-pointer items-start gap-3 py-2">
            <input
              type="checkbox"
              className="control-check"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              aria-required="true"
            />
            <span className="type-small text-ink">
              Li e aceito os{" "}
              <Link
                href="/termos"
                target="_blank"
                className="text-moss-700 underline underline-offset-3"
              >
                termos de uso
              </Link>{" "}
              e a{" "}
              <Link
                href="/trocas-e-devolucoes"
                target="_blank"
                className="text-moss-700 underline underline-offset-3"
              >
                política de trocas
              </Link>
              <span className="sr-only"> (abrem em nova aba)</span>
            </span>
          </label>
          <Button
            size="lg"
            className="mt-4 w-full md:w-auto"
            loading={placing}
            disabled={placing || quoting}
            onClick={placeOrder}
          >
            Fazer pedido
          </Button>
          <p className="mt-3 flex items-center gap-2 type-caption text-ink-muted">
            <Lock aria-hidden="true" strokeWidth={1.5} className="size-4" />
            Total de {formatBRL(totals.totalCents)}, com {paymentLabels[method].toLowerCase()}.
          </p>
        </StepShell>
      </div>

      <aside
        aria-labelledby="resumo-pedido"
        className="hidden self-start rounded-photo bg-white p-6 lg:sticky lg:top-6 lg:mt-6 lg:block"
      >
        <h2 id="resumo-pedido" className="mb-2 type-h3 text-moss-900">
          Resumo do pedido
        </h2>
        <Summary
          lines={lines}
          totals={totals}
          method={method}
          couponCode={couponCode}
          shippingChosen={Boolean(option)}
        />
      </aside>
    </div>
  );
}
