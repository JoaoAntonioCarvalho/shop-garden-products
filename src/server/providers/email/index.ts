import { SmtpEmailProvider } from "./smtp";
import type { EmailProvider } from "./types";

let instance: EmailProvider | undefined;

/** Provider de e-mail ativo. */
export function getEmailProvider(): EmailProvider {
  // TODO(integracao): para Resend ou SES por API, implementar EmailProvider e escolher aqui por variável de ambiente.
  instance ??= new SmtpEmailProvider();
  return instance;
}

/** Usado pelos testes para capturar os envios. */
export function setEmailProvider(provider: EmailProvider): void {
  instance = provider;
}
