import { describe, expect, it } from "vitest";
import { getEnv } from "@/lib/env";

describe("variáveis de ambiente", () => {
  it("são válidas e usam os provedores simulados por padrão", () => {
    const env = getEnv();
    expect(env.PAYMENT_PROVIDER).toBe("mock");
    expect(env.SHIPPING_PROVIDER).toBe("mock");
    expect(env.SMTP_PORT).toBe(1025);
  });
});
