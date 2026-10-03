import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());
const booleanFlag = (defaultValue: boolean) =>
  z
    .preprocess(
      emptyToUndefined,
      z.enum(["true", "false"]).default(defaultValue ? "true" : "false"),
    )
    .transform((value) => value === "true");

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL não definida"),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET precisa ter ao menos 16 caracteres"),
  APP_URL: z.url().default("http://localhost:3100"),
  ADMIN_EMAIL: z.email().default("admin@netshopgarden.com.br"),
  ADMIN_PASSWORD: optionalString,
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  EMAIL_FROM: z.string().default("Net Shop Garden <contato@netshopgarden.com.br>"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_ENDPOINT: optionalString,
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY: optionalString,
  S3_SECRET_KEY: optionalString,
  S3_PUBLIC_URL: optionalString,
  PAYMENT_PROVIDER: z.enum(["mock"]).default("mock"),
  SHIPPING_PROVIDER: z.enum(["mock"]).default("mock"),
  ENABLE_PAYMENT_SIMULATOR: booleanFlag(false),
  CRON_SECRET: optionalString,
  VIACEP_ENABLED: booleanFlag(true),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/** Variáveis de ambiente do servidor, validadas na primeira leitura. Nunca importar em Client Components. */
export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Variáveis de ambiente inválidas:\n${issues.join("\n")}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = process.env.NODE_ENV === "production";
