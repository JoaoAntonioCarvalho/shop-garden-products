import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    // Em desenvolvimento o Next registra os argumentos de cada server action. Isso incluiria
    // senhas (login, cadastro) e dados pessoais (checkout), então fica desligado.
    serverFunctions: false,
  },
};

export default nextConfig;
