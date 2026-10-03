import nodemailer, { type Transporter } from "nodemailer";
import { storeConfig } from "@/config/store.config";
import type { EmailMessage, EmailProvider } from "./types";

/** Envio por SMTP. Em desenvolvimento aponta para o Mailpit (http://localhost:8025). */
export class SmtpEmailProvider implements EmailProvider {
  private transporter: Transporter | undefined;

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    const port = Number(process.env.SMTP_PORT ?? 1025);
    const user = process.env.SMTP_USER;
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "localhost",
      port,
      secure: port === 465,
      auth: user ? { user, pass: process.env.SMTP_PASS ?? "" } : undefined,
    });
    return this.transporter;
  }

  async send(message: EmailMessage): Promise<void> {
    await this.getTransporter().sendMail({
      from: process.env.EMAIL_FROM || `${storeConfig.name} <${storeConfig.email}>`,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: message.headers,
    });
  }
}
