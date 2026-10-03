import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

/** Dados da loja que aparecem em todo e-mail. Vêm da configuração central. */
export type EmailStore = {
  name: string;
  url: string;
  email: string;
  phoneDisplay: string;
  whatsapp: string;
  legalName: string;
  cnpj: string;
  address: string;
};

// E-mails não usam as classes do site: clientes de e-mail exigem estilos embutidos.
export const emailColors = {
  moss: "#4D5236",
  mossDark: "#2F3221",
  wine: "#9A1B1F",
  cream: "#FBF8F2",
  cream100: "#F3EDE1",
  ink: "#23251B",
  muted: "#5F624F",
  line: "#DDD6C6",
  white: "#FFFFFF",
};

const serif = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const sans = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

export const emailStyles = {
  text: {
    fontFamily: sans,
    fontSize: "16px",
    lineHeight: "26px",
    color: emailColors.ink,
    margin: "0 0 16px",
  },
  small: {
    fontFamily: sans,
    fontSize: "14px",
    lineHeight: "22px",
    color: emailColors.muted,
    margin: "0 0 8px",
  },
  heading: {
    fontFamily: serif,
    fontSize: "30px",
    lineHeight: "36px",
    fontWeight: 500,
    color: emailColors.mossDark,
    margin: "0 0 16px",
  },
  subheading: {
    fontFamily: serif,
    fontSize: "22px",
    lineHeight: "28px",
    fontWeight: 600,
    color: emailColors.mossDark,
    margin: "24px 0 8px",
  },
  button: {
    backgroundColor: emailColors.wine,
    color: emailColors.white,
    fontFamily: sans,
    fontSize: "16px",
    fontWeight: 600,
    borderRadius: "6px",
    padding: "14px 28px",
    textDecoration: "none",
    display: "inline-block",
  },
  box: {
    backgroundColor: emailColors.cream100,
    border: `1px solid ${emailColors.line}`,
    borderRadius: "6px",
    padding: "16px 20px",
    margin: "0 0 16px",
  },
  code: {
    fontFamily: "Menlo, Consolas, monospace",
    fontSize: "13px",
    lineHeight: "20px",
    color: emailColors.ink,
    backgroundColor: emailColors.white,
    border: `1px dashed ${emailColors.moss}`,
    borderRadius: "6px",
    padding: "12px",
    wordBreak: "break-all",
    margin: "0 0 16px",
  },
} satisfies Record<string, CSSProperties>;

type EmailLayoutProps = {
  store: EmailStore;
  /** Texto de pré-visualização mostrado na caixa de entrada. */
  preview: string;
  heading: string;
  children: ReactNode;
  /** Rodapé extra, como o link de descadastro. */
  footerNote?: ReactNode;
};

/** Estrutura de todo e-mail: fundo creme, cabeçalho musgo, conteúdo em HTML (nunca só imagem). */
export function EmailLayout({ store, preview, heading, children, footerNote }: EmailLayoutProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: emailColors.cream, margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto" }}>
          <Section
            style={{
              backgroundColor: emailColors.moss,
              padding: "20px 32px",
              borderRadius: "6px 6px 0 0",
            }}
          >
            <Link
              href={store.url}
              style={{
                fontFamily: serif,
                fontSize: "26px",
                fontWeight: 600,
                color: emailColors.cream,
                textDecoration: "none",
              }}
            >
              {store.name}
            </Link>
          </Section>
          <Section
            style={{
              backgroundColor: emailColors.white,
              padding: "32px",
              border: `1px solid ${emailColors.line}`,
              borderTop: "none",
            }}
          >
            <Heading as="h1" style={emailStyles.heading}>
              {heading}
            </Heading>
            {children}
          </Section>
          <Section style={{ padding: "24px 32px" }}>
            <Text style={emailStyles.small}>
              Dúvidas? Fale com a gente pelo WhatsApp {store.phoneDisplay} ou responda este e-mail (
              {store.email}).
            </Text>
            {footerNote}
            <Hr style={{ borderColor: emailColors.line, margin: "16px 0" }} />
            <Text style={{ ...emailStyles.small, fontSize: "12px", lineHeight: "18px" }}>
              {store.legalName}, CNPJ {store.cnpj}. {store.address}.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section style={{ margin: "8px 0 24px" }}>
      <Button href={href} style={emailStyles.button}>
        {children}
      </Button>
    </Section>
  );
}

export function Paragraph({ children }: { children: ReactNode }) {
  return <Text style={emailStyles.text}>{children}</Text>;
}
