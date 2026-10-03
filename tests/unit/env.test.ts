import { describe, expect, it } from "vitest";
import { getEnv, parseEnv } from "@/lib/env";

describe("variáveis de ambiente", () => {
  it("são válidas e usam os provedores simulados por padrão", () => {
    const env = getEnv();
    expect(env.PAYMENT_PROVIDER).toBe("mock");
    expect(env.SHIPPING_PROVIDER).toBe("mock");
    expect(env.SMTP_PORT).toBe(1025);
  });

  it("exige as credenciais e o CEP de origem quando o frete é pelos Correios", () => {
    const base = { DATABASE_URL: "postgres://x", AUTH_SECRET: "x".repeat(32) };
    const missing = parseEnv({ ...base, SHIPPING_PROVIDER: "correios" });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues.map((issue) => issue.path[0])).toEqual([
      "CORREIOS_USER",
      "CORREIOS_ACCESS_CODE",
      "CORREIOS_POSTING_CARD",
      "CORREIOS_ORIGIN_CEP",
    ]);

    const complete = parseEnv({
      ...base,
      SHIPPING_PROVIDER: "correios",
      CORREIOS_USER: "usuario",
      CORREIOS_ACCESS_CODE: "codigo",
      CORREIOS_POSTING_CARD: "0012345678",
      CORREIOS_ORIGIN_CEP: "04002-000",
    });
    expect(complete.success).toBe(true);
    expect(complete.data?.CORREIOS_SERVICE_ECONOMY).toBe("03298");
    expect(parseEnv({ ...base }).success).toBe(true);
  });
});
