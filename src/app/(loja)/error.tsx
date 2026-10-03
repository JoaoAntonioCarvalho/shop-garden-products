"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function StoreError({
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
    <div className="container-store py-12">
      <EmptyState
        headingLevel="h1"
        title="Esta página não carregou"
        description="Houve uma falha ao buscar as informações. Tente de novo ou volte para a página inicial."
        action={
          <>
            <Button onClick={reset}>Tentar de novo</Button>
            <Link href="/" className={buttonClasses("secondary")}>
              Ir para a página inicial
            </Link>
          </>
        }
      />
    </div>
  );
}
