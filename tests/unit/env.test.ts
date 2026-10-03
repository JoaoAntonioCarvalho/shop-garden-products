import { describe, expect, it } from "vitest";
import { getEnv, parseEnv } from "@/lib/env";

describe("variáveis de ambiente", () => {
  it("são válidas e usam os provedores simulados por padrão", () => {
    const env = getEnv();
    expect(env.PAYMENT_PROVIDER).toBe("mock");
    expect(env.SHIPPING_PROVIDER).toEqual(["mock"]);
    expect(env.SMTP_PORT).toBe(1025);
  });

  it("exige as credenciais de cada transportadora ligada e o CEP de origem", () => {
    const base = { DATABASE_URL: "postgres://x", AUTH_SECRET: "x".repeat(32) };
    const paths = (source: Record<string, string>) =>
      parseEnv({ ...base, ...source }).error?.issues.map((issue) => issue.path[0]);

    expect(paths({ SHIPPING_PROVIDER: "correios" })).toEqual([
      "CORREIOS_USER",
      "CORREIOS_ACCESS_CODE",
      "CORREIOS_POSTING_CARD",
      "SHIPPING_ORIGIN_CEP",
    ]);
    expect(paths({ SHIPPING_PROVIDER: "jadlog", SHIPPING_ORIGIN_CEP: "04002-000" })).toEqual([
      "JADLOG_TOKEN",
      "JADLOG_CNPJ",
    ]);
    expect(paths({ SHIPPING_PROVIDER: "mock,jadlog" })).toContain("SHIPPING_PROVIDER");
    expect(parseEnv({ ...base, SHIPPING_PROVIDER: "sedex" }).success).toBe(false);

    const complete = parseEnv({
      ...base,
      SHIPPING_PROVIDER: "correios, jadlog",
      SHIPPING_ORIGIN_CEP: "04002-000",
      CORREIOS_USER: "usuario",
      CORREIOS_ACCESS_CODE: "codigo",
      CORREIOS_POSTING_CARD: "0012345678",
      JADLOG_TOKEN: "token",
      JADLOG_CNPJ: "12345678000190",
    });
    expect(complete.success).toBe(true);
    expect(complete.data?.SHIPPING_PROVIDER).toEqual(["correios", "jadlog"]);
    expect(complete.data?.CORREIOS_SERVICE_ECONOMY).toBe("03298");
    expect(complete.data?.JADLOG_MODALITY_ECONOMY).toBe(3);
    expect(complete.data?.JADLOG_MODALITY_EXPRESS).toBeUndefined();
    expect(parseEnv({ ...base }).success).toBe(true);
  });
});
