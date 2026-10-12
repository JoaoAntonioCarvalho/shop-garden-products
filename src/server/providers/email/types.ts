export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Para onde vai a resposta do cliente: o e-mail de atendimento da loja. */
  replyTo?: string;
  /** Cabeçalhos extras, como List-Unsubscribe nos e-mails de marketing. */
  headers?: Record<string, string>;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}
