import type { SVGProps } from "react";

/** Ícone próprio para o WhatsApp, em traço fino e na cor do texto (não usamos o verde da marca deles). */
export function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3.5 20.5l1.2-4.3A8.5 8.5 0 1 1 8 19.4l-4.5 1.1Z" />
      <path d="M9 8.2c-.3.9-.1 2.3 1.3 3.9 1.5 1.7 3 2.3 4 2.2.7-.1 1.3-.7 1.5-1.3l-1.9-1.1-.9.8c-.7-.3-1.6-1.2-2-2l.7-.9L10.5 8 9 8.2Z" />
    </svg>
  );
}

const cardFrame = (
  <rect
    x="0.75"
    y="0.75"
    width="42.5"
    height="26.5"
    rx="3.25"
    stroke="currentColor"
    strokeWidth="1"
    fill="none"
  />
);

const textProps = {
  fill: "currentColor",
  fontFamily: "var(--font-sans), sans-serif",
  fontWeight: 600,
  textAnchor: "middle" as const,
};

export const paymentMethods = [
  "Pix",
  "Visa",
  "Mastercard",
  "Elo",
  "American Express",
  "Hipercard",
  "Boleto",
] as const;

export type PaymentMethodName = (typeof paymentMethods)[number];

/**
 * Ícones de pagamento desenhados para o site: neutros, monocromáticos e na cor do texto.
 * Não reproduzem os logotipos oficiais das bandeiras.
 */
export function PaymentIcon({ method }: { method: PaymentMethodName }) {
  const common = {
    viewBox: "0 0 44 28",
    width: 44,
    height: 28,
    role: "img" as const,
    "aria-label": method,
  };
  switch (method) {
    case "Pix":
      return (
        <svg {...common}>
          {cardFrame}
          <path
            d="M22 7.5l6.5 6.5-6.5 6.5-6.5-6.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M18.8 10.7l3.2 3.3 3.2-3.3M18.8 17.3l3.2-3.3 3.2 3.3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "Boleto":
      return (
        <svg {...common}>
          {cardFrame}
          <path
            d="M11 8v12M14 8v12M16 8v12M20 8v12M22.5 8v12M26 8v12M28 8v12M31 8v12M33 8v12"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      );
    case "Mastercard":
      return (
        <svg {...common}>
          {cardFrame}
          <circle cx="18.5" cy="14" r="6" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="25.5" cy="14" r="6" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case "American Express":
      return (
        <svg {...common}>
          {cardFrame}
          <text x="22" y="17.5" fontSize="8.5" {...textProps}>
            Amex
          </text>
        </svg>
      );
    case "Hipercard":
      return (
        <svg {...common}>
          {cardFrame}
          <text x="22" y="17.5" fontSize="8" {...textProps}>
            Hiper
          </text>
        </svg>
      );
    default:
      return (
        <svg {...common}>
          {cardFrame}
          <text x="22" y="18" fontSize="10" {...textProps}>
            {method}
          </text>
        </svg>
      );
  }
}
