"use client";

import { Tabs as RadixTabs } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TabEntry = { id: string; label: ReactNode; content: ReactNode };

type TabsProps = {
  items: TabEntry[];
  defaultTab?: string;
  /** Rótulo acessível do conjunto de abas. */
  label: string;
  className?: string;
};

export function Tabs({ items, defaultTab, label, className }: TabsProps) {
  return (
    <RadixTabs.Root defaultValue={defaultTab ?? items[0]?.id} className={className}>
      <RadixTabs.List
        aria-label={label}
        className="flex gap-1 overflow-x-auto border-b border-line"
      >
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.id}
            value={item.id}
            className={cn(
              "-mb-px min-h-11 flex-none border-b-2 border-transparent px-4 text-[15px] whitespace-nowrap text-ink-muted transition-colors",
              "hover:text-moss-700 data-[state=active]:border-moss-700 data-[state=active]:font-medium data-[state=active]:text-moss-700",
            )}
          >
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map((item) => (
        <RadixTabs.Content key={item.id} value={item.id} className="pt-6">
          {item.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
