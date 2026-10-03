"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatCep, isValidCep } from "@/lib/validators/cep";
import { UF } from "@/lib/validators/checkout";
import { formatCpf } from "@/lib/validators/cpf";
import { formatPhone } from "@/lib/validators/phone";
import {
  changeEmailAction,
  changePasswordAction,
  deleteAddressAction,
  reorderAction,
  requestAccountDeletionAction,
  resendVerificationAction,
  saveAddressAction,
  setDefaultAddressAction,
  submitReviewAction,
  updateCommunicationAction,
  updateProfileAction,
  type AccountResult,
} from "@/server/actions/account";

/** Estado comum: envia, mostra o aviso de sucesso com o nome da ação e os erros por campo. */
function useAccountForm(onSuccess?: () => void) {
  const router = useRouter();
  const [result, setResult] = useState<AccountResult | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<AccountResult>) =>
    startTransition(async () => {
      const response = await action();
      setResult(response);
      if (response.ok) {
        toast(response.message);
        onSuccess?.();
        router.refresh();
      }
    });
  const fieldError = (name: string) =>
    result && !result.ok ? result.fieldErrors?.[name] : undefined;
  const error = result && !result.ok && !result.fieldErrors ? result.error : null;
  return { result, pending, run, fieldError, error };
}

const formValues = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
};

function FormError({ message }: { message: string | null }) {
  return message ? (
    <Alert tone="error" live>
      {message}
    </Alert>
  ) : null;
}

export function ProfileForm({
  profile,
}: {
  profile: { name: string; phone: string | null; cpf: string | null; birthDate: string | null };
}) {
  const form = useAccountForm();
  const [phone, setPhone] = useState(profile.phone ? formatPhone(profile.phone) : "");
  const [cpf, setCpf] = useState(profile.cpf ? formatCpf(profile.cpf) : "");
  return (
    <form
      noValidate
      className="flex max-w-xl flex-col gap-4"
      onSubmit={(event) => {
        const data = formValues(event);
        form.run(() =>
          updateProfileAction({ name: data.name, birthDate: data.birthDate, phone, cpf }),
        );
      }}
    >
      <FormError message={form.error} />
      <Field label="Nome completo" error={form.fieldError("name")}>
        <Input name="name" autoComplete="name" defaultValue={profile.name} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Celular com DDD" optional error={form.fieldError("phone")}>
          <MaskedInput mask="phone" value={phone} onValueChange={setPhone} />
        </Field>
        <Field label="CPF" optional error={form.fieldError("cpf")}>
          <MaskedInput mask="cpf" value={cpf} onValueChange={setCpf} />
        </Field>
      </div>
      <Field
        label="Data de nascimento"
        optional
        error={form.fieldError("birthDate")}
        className="max-w-56"
      >
        <Input name="birthDate" type="date" defaultValue={profile.birthDate ?? ""} />
      </Field>
      <Button type="submit" loading={form.pending} className="self-start">
        Salvar dados
      </Button>
    </form>
  );
}

export function EmailForm({ email }: { email: string }) {
  const form = useAccountForm();
  return (
    <form
      noValidate
      className="flex max-w-xl flex-col gap-4"
      onSubmit={(event) => {
        const data = formValues(event);
        form.run(() => changeEmailAction({ email: data.email, password: data.password }));
      }}
    >
      <FormError message={form.error} />
      {form.result?.ok ? <Alert tone="success">{form.result.message}</Alert> : null}
      <p className="type-small text-ink-muted">E-mail atual: {email}</p>
      <Field label="Novo e-mail" error={form.fieldError("email")}>
        <Input name="email" type="email" autoComplete="email" />
      </Field>
      <Field
        label="Senha atual"
        hint="Para confirmar que é você."
        error={form.fieldError("password")}
      >
        <Input name="password" type="password" autoComplete="current-password" />
      </Field>
      <Button type="submit" variant="secondary" loading={form.pending} className="self-start">
        Alterar e-mail
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [key, setKey] = useState(0);
  const form = useAccountForm(() => setKey((value) => value + 1));
  return (
    <form
      key={key}
      noValidate
      className="flex max-w-xl flex-col gap-4"
      onSubmit={(event) => {
        const data = formValues(event);
        form.run(() =>
          changePasswordAction({
            currentPassword: data.currentPassword,
            newPassword: data.newPassword,
          }),
        );
      }}
    >
      <FormError message={form.error} />
      <Field label="Senha atual" error={form.fieldError("currentPassword")}>
        <Input name="currentPassword" type="password" autoComplete="current-password" />
      </Field>
      <Field
        label="Nova senha"
        hint="Pelo menos 8 caracteres."
        error={form.fieldError("newPassword")}
      >
        <Input name="newPassword" type="password" autoComplete="new-password" />
      </Field>
      <Button type="submit" loading={form.pending} className="self-start">
        Alterar senha
      </Button>
    </form>
  );
}

export function ResendVerificationButton() {
  const form = useAccountForm();
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={form.pending}
      onClick={() => form.run(resendVerificationAction)}
    >
      Reenviar e-mail de confirmação
    </Button>
  );
}

export type SavedAddress = {
  id: string;
  label: string | null;
  recipientName: string;
  recipientPhone: string | null;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  reference: string | null;
  isDefault: boolean;
};

function AddressForm({
  address,
  defaultName,
  onDone,
}: {
  address: SavedAddress | null;
  defaultName: string;
  onDone: () => void;
}) {
  const form = useAccountForm(onDone);
  const [cep, setCep] = useState(address ? formatCep(address.cep) : "");
  const [phone, setPhone] = useState(
    address?.recipientPhone ? formatPhone(address.recipientPhone) : "",
  );
  const [filled, setFilled] = useState({
    street: address?.street ?? "",
    district: address?.district ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
  });
  const [cepMessage, setCepMessage] = useState<string | null>(null);

  async function lookup(value: string) {
    if (!isValidCep(value)) return;
    try {
      const response = await fetch(`/api/cep/${value.replace(/\D/g, "")}`);
      const data = (await response.json()) as { status: string; address?: typeof filled };
      if (data.status === "ok" && data.address) {
        setFilled({
          street: data.address.street,
          district: data.address.district,
          city: data.address.city,
          state: data.address.state,
        });
        setCepMessage(null);
      } else {
        setCepMessage(
          data.status === "not_found"
            ? "Este CEP não foi encontrado. Confira os números ou preencha o endereço manualmente."
            : "Não conseguimos buscar o endereço agora. Preencha os campos abaixo.",
        );
      }
    } catch {
      setCepMessage("Não conseguimos buscar o endereço agora. Preencha os campos abaixo.");
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        const data = formValues(event);
        form.run(() =>
          saveAddressAction(address?.id ?? null, {
            label: data.label,
            recipientName: data.recipientName,
            recipientPhone: phone,
            cep,
            street: data.street,
            number: data.number,
            complement: data.complement,
            district: data.district,
            city: data.city,
            state: data.state as (typeof UF)[number],
            reference: data.reference,
            isDefault: data.isDefault === "on",
          }),
        );
      }}
    >
      <FormError message={form.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do endereço" optional hint="Por exemplo: Casa, Trabalho.">
          <Input name="label" defaultValue={address?.label ?? ""} />
        </Field>
        <Field label="Quem recebe" error={form.fieldError("recipientName")}>
          <Input
            name="recipientName"
            defaultValue={address?.recipientName ?? defaultName}
            autoComplete="name"
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="CEP" error={form.fieldError("cep")}>
          <MaskedInput
            mask="cep"
            value={cep}
            onValueChange={(value) => {
              setCep(value);
              void lookup(value);
            }}
          />
        </Field>
        <Field label="Telefone de quem recebe" optional error={form.fieldError("recipientPhone")}>
          <MaskedInput mask="phone" value={phone} onValueChange={setPhone} />
        </Field>
      </div>
      <p aria-live="polite" className="-mt-2 type-small text-ink-muted empty:hidden">
        {cepMessage}
      </p>
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <Field label="Rua" error={form.fieldError("street")}>
          <Input
            key={filled.street}
            name="street"
            defaultValue={filled.street}
            autoComplete="address-line1"
          />
        </Field>
        <Field label="Número" error={form.fieldError("number")}>
          <Input name="number" defaultValue={address?.number ?? ""} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Complemento" optional>
          <Input name="complement" defaultValue={address?.complement ?? ""} />
        </Field>
        <Field label="Bairro" error={form.fieldError("district")}>
          <Input key={filled.district} name="district" defaultValue={filled.district} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <Field label="Cidade" error={form.fieldError("city")}>
          <Input key={filled.city} name="city" defaultValue={filled.city} />
        </Field>
        <Field label="Estado" error={form.fieldError("state")}>
          <Select key={filled.state} name="state" defaultValue={filled.state}>
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
        <Input name="reference" defaultValue={address?.reference ?? ""} />
      </Field>
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          name="isDefault"
          className="control-check"
          defaultChecked={address?.isDefault ?? false}
        />
        <span className="type-small text-ink">Usar como endereço padrão</span>
      </label>
      <Button type="submit" loading={form.pending} className="self-start">
        Salvar endereço
      </Button>
    </form>
  );
}

export function AddressManager({
  addresses,
  defaultName,
}: {
  addresses: SavedAddress[];
  defaultName: string;
}) {
  const [editing, setEditing] = useState<SavedAddress | "new" | null>(null);
  const [removing, setRemoving] = useState<SavedAddress | null>(null);
  const form = useAccountForm(() => setRemoving(null));

  return (
    <div>
      {addresses.length === 0 ? (
        <p className="type-body text-ink-muted">
          Você ainda não tem endereços salvos. Adicione um para comprar mais rápido.
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="rounded-control border border-line bg-white p-5">
              <p className="type-body font-medium text-ink">
                {address.label || "Endereço"}
                {address.isDefault ? (
                  <span className="ml-2 rounded-photo bg-moss-100 px-2 py-0.5 type-caption font-medium text-moss-700">
                    Padrão
                  </span>
                ) : null}
              </p>
              <address className="mt-2 type-small text-ink-muted not-italic">
                {address.recipientName}
                <br />
                {address.street}, {address.number}
                {address.complement ? `, ${address.complement}` : ""}
                <br />
                {address.district}, {address.city}/{address.state}
                <br />
                CEP {formatCep(address.cep)}
              </address>
              <div className="mt-3 flex flex-wrap gap-x-4">
                <button
                  type="button"
                  onClick={() => setEditing(address)}
                  className="min-h-11 type-small font-medium text-moss-700 underline underline-offset-3"
                >
                  Editar<span className="sr-only"> {address.label || "endereço"}</span>
                </button>
                {!address.isDefault ? (
                  <button
                    type="button"
                    disabled={form.pending}
                    onClick={() => form.run(() => setDefaultAddressAction(address.id))}
                    className="min-h-11 type-small font-medium text-moss-700 underline underline-offset-3"
                  >
                    Definir como padrão
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setRemoving(address)}
                  className="min-h-11 type-small font-medium text-wine-700 underline underline-offset-3"
                >
                  Excluir<span className="sr-only"> {address.label || "endereço"}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button variant="secondary" className="mt-6" onClick={() => setEditing("new")}>
        Adicionar endereço
      </Button>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === "new" ? "Adicionar endereço" : "Editar endereço"}
        className="max-w-2xl"
      >
        {editing ? (
          <AddressForm
            address={editing === "new" ? null : editing}
            defaultName={defaultName}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Excluir endereço"
        description={
          removing
            ? `${removing.label || "Endereço"}: ${removing.street}, ${removing.number}. Esta ação não pode ser desfeita.`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Manter endereço
            </Button>
            <Button
              loading={form.pending}
              onClick={() => removing && form.run(() => deleteAddressAction(removing.id))}
            >
              Excluir endereço
            </Button>
          </div>
        }
      >
        <FormError message={form.error} />
      </Dialog>
    </div>
  );
}

export function CommunicationForm({
  email,
  whatsapp,
  hasPhone,
  optInAt,
}: {
  email: boolean;
  whatsapp: boolean;
  hasPhone: boolean;
  optInAt: string | null;
}) {
  const form = useAccountForm();
  return (
    <form
      className="flex max-w-xl flex-col gap-2"
      onSubmit={(event) => {
        const data = formValues(event);
        form.run(() =>
          updateCommunicationAction({
            email: data.email === "on",
            whatsapp: data.whatsapp === "on",
          }),
        );
      }}
    >
      <FormError message={form.error} />
      <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5">
        <input type="checkbox" name="email" className="control-check" defaultChecked={email} />
        <span className="type-small text-ink">
          Quero receber novidades e ofertas por e-mail
          <span className="block text-ink-muted">
            Lançamentos, cuidados com plantas e promoções.
          </span>
        </span>
      </label>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5">
        <input
          type="checkbox"
          name="whatsapp"
          className="control-check"
          defaultChecked={whatsapp}
          disabled={!hasPhone}
        />
        <span className="type-small text-ink">
          Quero receber novidades e ofertas por WhatsApp
          <span className="block text-ink-muted">
            {hasPhone
              ? "No celular cadastrado na sua conta."
              : "Cadastre o seu celular em Dados pessoais para ativar."}
          </span>
        </span>
      </label>
      {optInAt ? (
        <p className="type-caption text-ink-muted">Consentimento registrado em {optInAt}.</p>
      ) : null}
      <p className="type-caption text-ink-muted">
        Avisos sobre os seus pedidos são enviados sempre, independentemente destas opções.
      </p>
      <Button type="submit" loading={form.pending} className="mt-2 self-start">
        Salvar preferências
      </Button>
    </form>
  );
}

export function DeleteAccountForm({ pendingRequest }: { pendingRequest: boolean }) {
  const [open, setOpen] = useState(false);
  const form = useAccountForm(() => setOpen(false));
  if (pendingRequest) {
    return (
      <Alert tone="info">
        Seu pedido de exclusão está registrado. Nossa equipe conclui em até 15 dias e avisa por
        e-mail.
      </Alert>
    );
  }
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Excluir minha conta"
      description="Seus dados pessoais serão apagados. Os pedidos são mantidos sem identificação, por obrigação fiscal. Esta ação não pode ser desfeita."
      trigger={<Button variant="secondary">Excluir minha conta</Button>}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) =>
          form.run(() => requestAccountDeletionAction(formValues(event).password))
        }
      >
        <FormError message={form.result && !form.result.ok ? form.result.error : null} />
        <Field label="Digite a sua senha para confirmar">
          <Input name="password" type="password" autoComplete="current-password" />
        </Field>
        <Button type="submit" loading={form.pending} className="self-start">
          Pedir a exclusão da conta
        </Button>
      </form>
    </Dialog>
  );
}

export function ReorderButton({ orderNumber }: { orderNumber: string }) {
  const form = useAccountForm();
  return (
    <div>
      <Button
        variant="secondary"
        loading={form.pending}
        onClick={() => form.run(() => reorderAction(orderNumber))}
      >
        Comprar novamente
      </Button>
      {form.result && !form.result.ok ? (
        <p className="mt-2 type-small text-danger">{form.result.error}</p>
      ) : null}
    </div>
  );
}

export function ReviewForm({
  productSlug,
  productName,
  orderNumber,
  token,
}: {
  productSlug: string;
  productName: string;
  orderNumber?: string;
  token?: string;
}) {
  const form = useAccountForm();
  const [rating, setRating] = useState(0);
  if (form.result?.ok) {
    return (
      <Alert tone="success" title="Avaliação enviada" live>
        Obrigado por avaliar {productName}. Ela aparece no site depois da moderação.
      </Alert>
    );
  }
  return (
    <form
      noValidate
      className="flex max-w-xl flex-col gap-4"
      onSubmit={(event) => {
        const data = formValues(event);
        form.run(() =>
          submitReviewAction({
            productSlug,
            rating,
            title: data.title,
            body: data.body,
            orderNumber,
            token,
            website: data.website,
          }),
        );
      }}
    >
      <FormError message={form.error} />
      <fieldset>
        <legend className="type-small font-medium text-ink">Sua nota</legend>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <label
              key={star}
              className="flex size-11 cursor-pointer items-center justify-center rounded-control has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-moss-700"
            >
              <input
                type="radio"
                name="rating"
                value={star}
                checked={rating === star}
                onChange={() => setRating(star)}
                className="sr-only"
              />
              <Star
                aria-hidden="true"
                strokeWidth={1.5}
                fill={star <= rating ? "currentColor" : "none"}
                className={cn("size-7", star <= rating ? "text-moss-700" : "text-moss-500")}
              />
              <span className="sr-only">
                {star} {star === 1 ? "estrela" : "estrelas"}
              </span>
            </label>
          ))}
        </div>
        {form.fieldError("rating") ? (
          <p className="mt-1 type-small text-danger">{form.fieldError("rating")}</p>
        ) : null}
      </fieldset>
      <Field label="Título" optional>
        <Input name="title" maxLength={80} />
      </Field>
      <Field label="O que você achou" error={form.fieldError("body")}>
        <Textarea name="body" rows={5} maxLength={1500} />
      </Field>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <Button type="submit" loading={form.pending} className="self-start">
        Enviar avaliação
      </Button>
    </form>
  );
}
