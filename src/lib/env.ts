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
  // Lista separada por vírgula: "mock" (tabela do painel) ou as transportadoras ligadas, como "correios,jadlog".
  SHIPPING_PROVIDER: z
    .preprocess(emptyToUndefined, z.string().default("mock"))
    .transform((value) =>
      value
        .split(",")
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean),
    )
    .pipe(z.array(z.enum(["mock", "correios", "jadlog"])).min(1)),
  // Comum às transportadoras: de onde os pedidos saem e quantos dias úteis a loja leva para postar.
  SHIPPING_ORIGIN_CEP: optionalString,
  SHIPPING_HANDLING_DAYS: z.coerce.number().int().min(0).max(10).default(1),
  // Correios (contrato): usuário do Meu Correios, código de acesso às APIs e cartão de postagem.
  CORREIOS_USER: optionalString,
  CORREIOS_ACCESS_CODE: optionalString,
  CORREIOS_POSTING_CARD: optionalString,
  CORREIOS_CONTRACT: optionalString,
  CORREIOS_DR: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
  CORREIOS_BASE_URL: z.url().default("https://api.correios.com.br"),
  CORREIOS_SERVICE_ECONOMY: z.string().default("03298"),
  CORREIOS_SERVICE_EXPRESS: z.string().default("03220"),
  // Jadlog: token fornecido pela Jadlog, CNPJ do tomador e modalidades contratadas.
  JADLOG_TOKEN: optionalString,
  JADLOG_CNPJ: optionalString,
  JADLOG_ACCOUNT: optionalString,
  JADLOG_CONTRACT: optionalString,
  JADLOG_BASE_URL: z.url().default("https://www.jadlog.com.br"),
  JADLOG_TRACKING_URL: z.url().default("https://prd-traffic.jadlogtech.com.br"),
  JADLOG_MODALITY_ECONOMY: z.preprocess(emptyToUndefined, z.coerce.number().int().default(3)),
  JADLOG_MODALITY_EXPRESS: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
  ENABLE_PAYMENT_SIMULATOR: booleanFlag(false),
  CRON_SECRET: optionalString,
  VIACEP_ENABLED: booleanFlag(true),
});

const REQUIRED_BY_CARRIER = {
  correios: ["CORREIOS_USER", "CORREIOS_ACCESS_CODE", "CORREIOS_POSTING_CARD"],
  jadlog: ["JADLOG_TOKEN", "JADLOG_CNPJ"],
} as const;

const checkedEnvSchema = serverEnvSchema.superRefine((env, context) => {
  const carriers = env.SHIPPING_PROVIDER.filter((name) => name !== "mock");
  if (carriers.length === 0) return;
  if (env.SHIPPING_PROVIDER.includes("mock"))
    context.addIssue({
      code: "custom",
      path: ["SHIPPING_PROVIDER"],
      message: '"mock" não combina com transportadoras: use só "mock" ou só as transportadoras',
    });
  for (const carrier of carriers) {
    for (const key of REQUIRED_BY_CARRIER[carrier]) {
      if (!env[key])
        context.addIssue({
          code: "custom",
          path: [key],
          message: `obrigatória quando SHIPPING_PROVIDER inclui ${carrier}`,
        });
    }
  }
  if (!env.SHIPPING_ORIGIN_CEP || !/^\d{5}-?\d{3}$/.test(env.SHIPPING_ORIGIN_CEP))
    context.addIssue({
      code: "custom",
      path: ["SHIPPING_ORIGIN_CEP"],
      message: "CEP de origem obrigatório (8 dígitos) quando há transportadora ligada",
    });
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Valida um conjunto de variáveis sem guardar o resultado (usado nos testes). */
export const parseEnv = (source: Record<string, string | undefined>) =>
  checkedEnvSchema.safeParse(source);

let cached: ServerEnv | undefined;

/** Variáveis de ambiente do servidor, validadas na primeira leitura. Nunca importar em Client Components. */
export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = checkedEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Variáveis de ambiente inválidas:\n${issues.join("\n")}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = process.env.NODE_ENV === "production";
