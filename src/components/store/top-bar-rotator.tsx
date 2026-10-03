"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";

/** Uma mensagem por vez no mobile. A troca é sempre manual, por toque: nada gira sozinho. */
export function TopBarRotator({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0);
  const hasMany = messages.length > 1;

  return (
    <div className="flex h-9 items-center justify-center type-caption lg:hidden">
      <p aria-live="polite" className="truncate">
        {messages[index]}
      </p>
      {hasMany ? (
        <button
          type="button"
          onClick={() => setIndex((current) => (current + 1) % messages.length)}
          aria-label="Ver próxima mensagem"
          className="-mr-3 flex h-9 w-11 flex-none items-center justify-center"
        >
          <ChevronRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
