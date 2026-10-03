"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { track } from "@/lib/analytics/events";
import { cn } from "@/lib/cn";
import { passwordStrength } from "@/lib/validators/account";
import {
  forgotPasswordAction,
  loginAction,
  resetPasswordAction,
  signupAction,
  type AuthResult,
} from "@/server/actions/auth";

/** Estado comum dos formulários de autenticação: envio, erro geral, erros por campo e mensagem de sucesso. */
function useAuthForm() {
  const [result, setResult] = useState<AuthResult | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<AuthResult | void>, onSuccess?: () => void) =>
    startTransition(async () => {
      const response = await action();
      // Em caso de redirecionamento a ação não retorna.
      if (!response) return;
      setResult(response);
      if (response.ok) onSuccess?.();
    });
  const fieldError = (name: string) =>
    result && !result.ok ? result.fieldErrors?.[name] : undefined;
  return { result, pending, run, fieldError };
}

function FormMessages({ result }: { result: AuthResult | null }) {
  if (!result) return null;
  return result.ok ? (
    result.message ? (
      <Alert tone="success" live>
        {result.message}
      </Alert>
    ) : null
  ) : (
    <Alert tone="error" live>
      {result.error}
    </Alert>
  );
}

const values = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
};

export function LoginForm({
  returnTo,
  defaultEmail = "",
}: {
  returnTo?: string;
  defaultEmail?: string;
}) {
  const form = useAuthForm();
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        const data = values(event);
        form.run(async () => {
          track("login", { method: "email" });
          return loginAction({ email: data.email, password: data.password, returnTo });
        });
      }}
    >
      <FormMessages result={form.result} />
      <Field label="E-mail" error={form.fieldError("email")}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={defaultEmail}
          required
        />
      </Field>
      <Field label="Senha" error={form.fieldError("password")}>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" loading={form.pending}>
        Entrar
      </Button>
      <Link
        href="/esqueci-a-senha"
        className="self-start py-2 type-small text-moss-700 underline underline-offset-3 hover:text-moss-900"
      >
        Esqueci a senha
      </Link>
    </form>
  );
}

function PasswordField({
  name,
  label,
  error,
  autoComplete,
}: {
  name: string;
  label: string;
  error?: string;
  autoComplete: string;
}) {
  const [value, setValue] = useState("");
  const strength = passwordStrength(value);
  return (
    <Field label={label} hint="Pelo menos 8 caracteres." error={error}>
      <Input
        name={name}
        type="password"
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        required
      />
      {value ? (
        <div className="mt-1 flex items-center gap-3" aria-live="polite">
          <span aria-hidden="true" className="flex flex-1 gap-1">
            {[1, 2, 3, 4].map((level) => (
              <span
                key={level}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  level <= strength.score ? "bg-moss-700" : "bg-moss-100",
                )}
              />
            ))}
          </span>
          <span className="type-caption text-ink-muted">
            Força da senha: {strength.label.toLowerCase()}
          </span>
        </div>
      ) : null}
    </Field>
  );
}

export function SignupForm({
  returnTo,
  defaultEmail = "",
}: {
  returnTo?: string;
  defaultEmail?: string;
}) {
  const form = useAuthForm();
  const [phone, setPhone] = useState("");
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        const data = values(event);
        form.run(async () => {
          track("sign_up", { method: "email" });
          return signupAction({
            name: data.name,
            email: data.email,
            password: data.password,
            phone,
            marketingOptIn: data.marketingOptIn === "on",
            returnTo,
          });
        });
      }}
    >
      <FormMessages result={form.result} />
      <Field label="Nome completo" error={form.fieldError("name")}>
        <Input name="name" autoComplete="name" required />
      </Field>
      <Field label="E-mail" error={form.fieldError("email")}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={defaultEmail}
          required
        />
      </Field>
      <PasswordField
        name="password"
        label="Senha"
        autoComplete="new-password"
        error={form.fieldError("password")}
      />
      <Field label="Celular com DDD" optional error={form.fieldError("phone")}>
        <MaskedInput mask="phone" value={phone} onValueChange={setPhone} />
      </Field>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
        <input type="checkbox" name="marketingOptIn" className="control-check" />
        <span className="type-small text-ink">Quero receber novidades e ofertas por e-mail</span>
      </label>
      <Button type="submit" loading={form.pending}>
        Criar conta
      </Button>
      <p className="type-caption text-ink-muted">
        Ao criar a conta você concorda com os{" "}
        <Link href="/termos" className="text-moss-700 underline underline-offset-3">
          termos de uso
        </Link>{" "}
        e com a{" "}
        <Link href="/privacidade" className="text-moss-700 underline underline-offset-3">
          política de privacidade
        </Link>
        .
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const form = useAuthForm();
  if (form.result?.ok) return <FormMessages result={form.result} />;
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => form.run(() => forgotPasswordAction(values(event).email))}
    >
      <FormMessages result={form.result} />
      <Field label="E-mail da sua conta">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" loading={form.pending}>
        Enviar link para nova senha
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token, after }: { token: string; after: ReactNode }) {
  const form = useAuthForm();
  if (form.result?.ok) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessages result={form.result} />
        {after}
      </div>
    );
  }
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => form.run(() => resetPasswordAction(token, values(event).password))}
    >
      <FormMessages result={form.result} />
      <PasswordField name="password" label="Nova senha" autoComplete="new-password" />
      <Button type="submit" loading={form.pending}>
        Salvar nova senha
      </Button>
    </form>
  );
}
