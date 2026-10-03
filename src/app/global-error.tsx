"use client";

import { useEffect } from "react";

/** Erro 500 fora de qualquer layout. Página objetiva, sem depender de componentes da loja. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#fbf8f2",
          color: "#23251b",
        }}
      >
        <main
          style={{ maxWidth: 560, margin: "0 auto", padding: "96px 16px", textAlign: "center" }}
        >
          <h1 style={{ fontSize: 32, fontWeight: 600, color: "#2f3221" }}>
            A loja teve um problema
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.6 }}>
            Não foi possível carregar esta página agora. Tente de novo em instantes. Se você estava
            finalizando uma compra, o pedido não foi cobrado duas vezes.
          </p>
          <p style={{ marginTop: 24 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: 48,
                padding: "0 24px",
                border: 0,
                borderRadius: 4,
                background: "#4D5236",
                color: "#fff",
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              Tentar de novo
            </button>
          </p>
          <p style={{ marginTop: 16 }}>
            {/* Link simples: a navegação do Next pode estar indisponível neste ponto. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ color: "#4D5236" }}>
              Ir para a página inicial
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
