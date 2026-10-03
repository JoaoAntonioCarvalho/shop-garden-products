import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    // Em desenvolvimento o Next registra os argumentos de cada server action. Isso incluiria
    // senhas (login, cadastro) e dados pessoais (checkout), então fica desligado.
    serverFunctions: false,
  },
  experimental: {
    // A importação de produtos envia o CSV do site antigo por server action.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
