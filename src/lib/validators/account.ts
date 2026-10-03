import { z } from "zod";
import { addressSchema, emailSchema } from "./checkout";
import { isValidCpf } from "./cpf";
import { isValidPhone } from "./phone";

export const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(128);

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Digite o seu nome completo.")
    .max(120)
    .refine((value) => value.split(/\s+/).length >= 2, "Digite nome e sobrenome."),
  email: emailSchema,
  password: passwordSchema,
  phone: z
    .string()
    .optional()
    .default("")
    .refine(
      (value) => !value || isValidPhone(value),
      "Digite o celular com DDD, como (11) 90000-0000.",
    ),
  marketingOptIn: z.boolean().default(false),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Digite a sua senha."),
});

export const profileSchema = z.object({
  name: signupSchema.shape.name,
  phone: signupSchema.shape.phone,
  cpf: z
    .string()
    .optional()
    .default("")
    .refine((value) => !value || isValidCpf(value), "Este CPF não é válido. Confira os números."),
  birthDate: z
    .string()
    .optional()
    .default("")
    .refine(
      (value) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value) < new Date()),
      "Digite uma data de nascimento válida.",
    ),
});

export const savedAddressSchema = addressSchema.extend({
  label: z.string().trim().max(40).optional().default(""),
  recipientName: z.string().trim().min(2, "Digite o nome de quem recebe.").max(120),
  recipientPhone: z
    .string()
    .optional()
    .default("")
    .refine((value) => !value || isValidPhone(value), "Digite o telefone com DDD."),
  isDefault: z.boolean().default(false),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Escolha uma nota de 1 a 5 estrelas.").max(5),
  title: z.string().trim().max(80).optional().default(""),
  body: z.string().trim().min(10, "Conte um pouco mais: pelo menos 10 caracteres.").max(1500),
});

/** Força da senha, de 0 a 4, para o indicador do cadastro. */
export function passwordStrength(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  if (/^(.)\1+$/.test(password) || /^(1234|abcd|senha|password)/i.test(password))
    score = Math.min(score, 1);
  return { score, label: ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"][score] };
}
