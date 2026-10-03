"use client";

import { ChevronDown } from "lucide-react";
import { Accordion as RadixAccordion } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AccordionEntry = { id: string; title: ReactNode; content: ReactNode };

type AccordionProps = {
  items: AccordionEntry[];
  /** Ids abertos ao carregar. */
  defaultOpen?: string[];
  /** Nível do título de cada item, para manter a hierarquia da página. */
  headingLevel?: "h2" | "h3" | "h4";
  className?: string;
};

export function Accordion({ items, defaultOpen, headingLevel = "h3", className }: AccordionProps) {
  const Heading = headingLevel;
  return (
    <RadixAccordion.Root
      type="multiple"
      defaultValue={defaultOpen}
      className={cn("border-t border-line", className)}
    >
      {items.map((item) => (
        <RadixAccordion.Item key={item.id} value={item.id} className="border-b border-line">
          <RadixAccordion.Header asChild>
            <Heading>
              <RadixAccordion.Trigger className="group flex min-h-14 w-full items-center justify-between gap-4 py-3 text-left text-[16px] font-medium text-ink hover:text-moss-700">
                {item.title}
                <ChevronDown
                  aria-hidden="true"
                  strokeWidth={1.5}
                  className="size-5 flex-none text-moss-700 transition-transform group-data-[state=open]:rotate-180"
                />
              </RadixAccordion.Trigger>
            </Heading>
          </RadixAccordion.Header>
          <RadixAccordion.Content className="pb-5 text-ink data-[state=closed]:hidden">
            {item.content}
          </RadixAccordion.Content>
        </RadixAccordion.Item>
      ))}
    </RadixAccordion.Root>
  );
}
