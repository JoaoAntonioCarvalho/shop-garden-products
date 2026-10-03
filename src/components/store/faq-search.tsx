"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { Accordion } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";

type FaqGroup = { name: string; items: Array<{ id: string; question: string; answer: string }> };

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Central de ajuda: perguntas por grupo, com busca que filtra enquanto a pessoa digita. */
export function FaqSearch({ groups }: { groups: FaqGroup[] }) {
  const [query, setQuery] = useState("");
  const term = normalize(query.trim());
  const visible = groups
    .map((group) => ({
      ...group,
      items: term
        ? group.items.filter((item) => normalize(`${item.question} ${item.answer}`).includes(term))
        : group.items,
    }))
    .filter((group) => group.items.length > 0);
  const total = visible.reduce((sum, group) => sum + group.items.length, 0);
  return (
    <div>
      <div className="relative max-w-xl">
        <label htmlFor="busca-ajuda" className="sr-only">
          Buscar na ajuda
        </label>
        <Search
          aria-hidden="true"
          strokeWidth={1.5}
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted"
        />
        <Input
          id="busca-ajuda"
          type="search"
          value={query}
          placeholder="Buscar por entrega, pagamento, troca..."
          onChange={(event) => setQuery(event.target.value)}
          className="pl-10"
        />
      </div>
      <p aria-live="polite" className="sr-only">
        {term ? `${total} ${total === 1 ? "pergunta encontrada" : "perguntas encontradas"}` : ""}
      </p>
      {visible.length === 0 ? (
        <p className="mt-8 type-body text-ink">
          Nenhuma pergunta com esse termo. Tente outra palavra ou fale com a gente.
        </p>
      ) : null}
      {visible.map((group) => (
        <section
          key={group.name}
          aria-labelledby={`grupo-${normalize(group.name).replace(/\s+/g, "-")}`}
          className="mt-10"
        >
          <h2
            id={`grupo-${normalize(group.name).replace(/\s+/g, "-")}`}
            className="type-h2 text-moss-900"
          >
            {group.name}
          </h2>
          <Accordion
            className="mt-3"
            items={group.items.map((item) => ({
              id: item.id,
              title: item.question,
              content: (
                <p className="measure type-body whitespace-pre-line text-ink">{item.answer}</p>
              ),
            }))}
          />
        </section>
      ))}
    </div>
  );
}
