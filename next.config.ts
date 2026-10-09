import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Política de conteúdo: só a própria loja, mais Google Analytics e Meta (que só carregam depois
 * do consentimento) e o ViaCEP. O Next usa scripts e estilos embutidos, por isso 'unsafe-inline'.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://connect.facebook.net`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.facebook.com${isDev ? " ws:" : ""}`,
  "frame-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

// Com armazenamento S3 as imagens vêm de outro endereço (bucket ou CDN), que o otimizador de
// imagens do Next só aceita se estiver declarado aqui.
const storageUrl = process.env.S3_PUBLIC_URL ? new URL(process.env.S3_PUBLIC_URL) : null;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: storageUrl
      ? [
          {
            protocol: storageUrl.protocol.replace(":", "") as "http" | "https",
            hostname: storageUrl.hostname,
          },
        ]
      : [],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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
