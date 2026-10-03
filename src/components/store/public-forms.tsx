"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, useFieldControl } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { track } from "@/lib/analytics/events";
import {
  sendContactAction,
  sendProductRequestAction,
  type PublicFormResult,
} from "@/server/actions/leads";

/** Campo-isca: fica fora da tela e fora da ordem de tabulação. Só robôs preenchem. */
function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
      <label>
        Não preencha este campo
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

/** Campo de arquivo ligado ao rótulo e às mensagens do Field. */
function FileInput({ name, accept }: { name: string; accept: string }) {
  const control = useFieldControl({});
  return (
    <input
      {...control}
      type="file"
      name={name}
      accept={accept}
      className="type-small text-ink file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-control file:border file:border-moss-700 file:bg-white file:px-4 file:text-moss-700"
    />
  );
}

function useFormState() {
  const startedAt = useRef(0);
  const [result, setResult] = useState<PublicFormResult | null>(null);
  const [pending, startTransition] = useTransition();
  const errors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  return {
    startedAt,
    result,
    setResult,
    pending,
    startTransition,
    errors,
    elapsed: () => (startedAt.current ? Date.now() - startedAt.current : 0),
    start: () => (startedAt.current ||= Date.now()),
  };
}

function Feedback({ result }: { result: PublicFormResult | null }) {
  if (!result) return null;
  return (
    <Alert tone={result.ok ? "success" : "error"} live>
      {result.ok ? result.message : result.error}
    </Alert>
  );
}

const SUBJECTS = [
  "Dúvida sobre um produto",
  "Meu pedido",
  "Entrega",
  "Troca ou devolução",
  "Pagamento",
  "Arranjo sob medida",
  "Outro assunto",
];

export function ContactForm({ defaults }: { defaults?: { name?: string; email?: string } }) {
  const state = useFormState();
  const [phone, setPhone] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (key: string) => String(data.get(key) ?? "");
    state.startTransition(async () => {
      const result = await sendContactAction({
        name: text("name"),
        email: text("email"),
        phone,
        orderNumber: text("orderNumber"),
        subject: text("subject"),
        message: text("message"),
        website: text("website"),
        elapsedMs: state.elapsed(),
      });
      state.setResult(result);
      if (result.ok) {
        form.reset();
        setPhone("");
        track("generate_lead", { lead_source: "CONTACT" });
      }
    });
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      onFocus={state.start}
      className="relative flex flex-col gap-5"
    >
      <Feedback result={state.result} />
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Nome" required error={state.errors.name}>
          <Input name="name" autoComplete="name" defaultValue={defaults?.name} />
        </Field>
        <Field label="E-mail" required error={state.errors.email}>
          <Input name="email" type="email" autoComplete="email" defaultValue={defaults?.email} />
        </Field>
        <Field label="Telefone ou WhatsApp" optional error={state.errors.phone}>
          <MaskedInput
            mask="phone"
            name="phone"
            autoComplete="tel"
            value={phone}
            onValueChange={setPhone}
          />
        </Field>
        <Field
          label="Número do pedido"
          optional
          hint="Começa com NSG, como NSG-000123."
          error={state.errors.orderNumber}
        >
          <Input name="orderNumber" />
        </Field>
      </div>
      <Field label="Assunto" required error={state.errors.subject}>
        <Select name="subject" defaultValue={SUBJECTS[0]}>
          {SUBJECTS.map((subject) => (
            <option key={subject}>{subject}</option>
          ))}
        </Select>
      </Field>
      <Field label="Mensagem" required error={state.errors.message}>
        <Textarea name="message" rows={6} maxLength={4000} />
      </Field>
      <Honeypot />
      <div>
        <Button type="submit" loading={state.pending}>
          Enviar mensagem
        </Button>
      </div>
    </form>
  );
}

const BUDGETS = [
  "Até R$ 150",
  "De R$ 150 a R$ 300",
  "De R$ 300 a R$ 600",
  "Acima de R$ 600",
  "Ainda não sei",
];

export function ProductRequestForm({ defaults }: { defaults?: { name?: string; email?: string } }) {
  const state = useFormState();
  const [whatsapp, setWhatsapp] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("whatsapp", whatsapp);
    data.set("elapsedMs", String(state.elapsed()));
    state.startTransition(async () => {
      const result = await sendProductRequestAction(data);
      state.setResult(result);
      if (result.ok) {
        form.reset();
        setWhatsapp("");
        track("generate_lead", { lead_source: "PRODUCT_REQUEST" });
      }
    });
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      onFocus={state.start}
      className="relative flex flex-col gap-5"
    >
      <Feedback result={state.result} />
      <Field
        label="O que você procura?"
        required
        hint="Conte o tipo de planta ou peça, o tamanho, a cor e para onde vai. Quanto mais detalhes, melhor."
        error={state.errors.description}
      >
        <Textarea name="description" rows={6} maxLength={4000} />
      </Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Quanto pretende investir?" optional error={state.errors.budgetRange}>
          <Select name="budgetRange" defaultValue="">
            <option value="">Escolha uma faixa</option>
            {BUDGETS.map((budget) => (
              <option key={budget}>{budget}</option>
            ))}
          </Select>
        </Field>
        <Field
          label="Foto de referência"
          optional
          hint="JPG, PNG ou WebP, até 10 MB."
          error={state.errors.photo}
        >
          <FileInput name="photo" accept="image/jpeg,image/png,image/webp" />
        </Field>
        <Field label="Nome" required error={state.errors.name}>
          <Input name="name" autoComplete="name" defaultValue={defaults?.name} />
        </Field>
        <Field label="E-mail" required error={state.errors.email}>
          <Input name="email" type="email" autoComplete="email" defaultValue={defaults?.email} />
        </Field>
        <Field label="WhatsApp" optional error={state.errors.whatsapp}>
          <MaskedInput
            mask="phone"
            name="whatsapp-visivel"
            autoComplete="tel"
            value={whatsapp}
            onValueChange={setWhatsapp}
          />
        </Field>
      </div>
      <Honeypot />
      <div>
        <Button type="submit" loading={state.pending}>
          Enviar solicitação
        </Button>
      </div>
    </form>
  );
}
