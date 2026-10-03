import { z } from "zod";
import { isValidCep } from "./cep";
import { isValidCpf, onlyDigits } from "./cpf";
import { isValidMobile, isValidPhone } from "./phone";

/** Schemas do checkout, usados no navegador (React Hook Form) e de novo no servidor. */

export const UF = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Digite um e-mail válido, como nome@exemplo.com."));

export const identificationSchema = z.object({
  email: emailSchema,
  name: z
    .string()
    .trim()
    .min(1, "Digite o seu nome completo.")
    .max(120)
    .refine((value) => value.split(/\s+/).length >= 2, "Digite nome e sobrenome."),
  cpf: z.string().refine(isValidCpf, "Este CPF não é válido. Confira os números."),
  phone: z.string().refine(isValidMobile, "Digite o celular com DDD, como (11) 90000-0000."),
  marketingOptIn: z.boolean(),
});

export const addressSchema = z.object({
  cep: z.string().refine(isValidCep, "Digite um CEP com 8 números."),
  street: z.string().trim().min(2, "Digite o nome da rua.").max(160),
  number: z.string().trim().min(1, "Digite o número. Se não houver, escreva S/N.").max(20),
  complement: z.string().trim().max(80).optional().default(""),
  district: z.string().trim().min(2, "Digite o bairro.").max(80),
  city: z.string().trim().min(2, "Digite a cidade.").max(80),
  state: z.enum(UF, "Escolha o estado."),
  reference: z.string().trim().max(160).optional().default(""),
});

export const recipientSchema = z
  .object({
    isGift: z.boolean(),
    name: z.string().trim().max(120).optional().default(""),
    phone: z.string().optional().default(""),
  })
  .superRefine((value, context) => {
    if (!value.isGift) return;
    if (value.name.length < 2)
      context.addIssue({
        code: "custom",
        path: ["name"],
        message: "Digite o nome de quem vai receber.",
      });
    if (!isValidPhone(value.phone))
      context.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Digite o telefone de quem vai receber, com DDD.",
      });
  });

export const shippingChoiceSchema = z.object({
  code: z.string().min(1, "Escolha uma opção de entrega.").max(60),
  deliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  window: z.enum(["manha", "tarde"]).optional(),
});

export const cardTokenSchema = z.object({
  token: z.string().regex(/^mock_tok_[a-z0-9]{8,}$/i),
  brand: z.string().min(1).max(20),
  last4: z.string().regex(/^\d{4}$/),
});

export const paymentChoiceSchema = z
  .object({
    method: z.enum(["PIX", "CREDIT_CARD", "BOLETO"], "Escolha a forma de pagamento."),
    installments: z.number().int().min(1).max(12).default(1),
    card: cardTokenSchema.nullish(),
  })
  .refine((value) => value.method !== "CREDIT_CARD" || Boolean(value.card), {
    path: ["card"],
    message: "Preencha os dados do cartão.",
  });

export const placeOrderSchema = z.object({
  identification: identificationSchema,
  address: addressSchema,
  recipient: recipientSchema,
  shipping: shippingChoiceSchema,
  payment: paymentChoiceSchema,
  acceptedTerms: z.literal(true, "Para continuar, aceite os termos de uso e a política de trocas."),
  /** Gerada ao abrir a revisão: um segundo envio com a mesma chave devolve o mesmo pedido. */
  idempotencyKey: z.string().min(16).max(64),
  /** Total que o cliente viu na revisão. Se o recalculado for diferente, o envio é interrompido. */
  expectedTotalCents: z.number().int().min(0),
});

export type IdentificationInput = z.infer<typeof identificationSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type RecipientInput = z.infer<typeof recipientSchema>;
export type ShippingChoice = z.infer<typeof shippingChoiceSchema>;
export type PaymentChoice = z.infer<typeof paymentChoiceSchema>;
export type PlaceOrderInput = z.input<typeof placeOrderSchema>;

export const deliveryWindowLabels = { manha: "Manhã", tarde: "Tarde" } as const;

/** Dados do checkout em andamento, guardados no carrinho (nunca dados de cartão). */
export type CheckoutDraft = {
  identification?: Partial<IdentificationInput>;
  address?: Partial<AddressInput>;
  recipient?: Partial<RecipientInput>;
  shipping?: Partial<ShippingChoice>;
  paymentMethod?: PaymentChoice["method"];
};

export const cleanCpf = (value: string) => onlyDigits(value);
