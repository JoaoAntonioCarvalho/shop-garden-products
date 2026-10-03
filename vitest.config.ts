import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // "server-only" lança erro fora do servidor do Next; nos testes vira um módulo vazio.
      "server-only": fileURLToPath(new URL("./tests/empty-module.ts", import.meta.url)),
      "next/cache": fileURLToPath(new URL("./tests/stubs/next-cache.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: [
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/integration/**/*.test.ts",
      "src/**/*.test.{ts,tsx}",
    ],
    setupFiles: ["tests/unit/setup.ts"],
    // Aplica as migrações no banco de teste antes dos testes de integração.
    globalSetup: ["tests/integration/global-setup.ts"],
    // Os testes de integração compartilham o banco de teste: um arquivo por vez.
    fileParallelism: false,
  },
});
