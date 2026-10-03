"use client";

import { ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { NavigationMenu } from "radix-ui";
import type { NavItem } from "@/config/navigation";
import { cn } from "@/lib/cn";

const itemClass =
  "flex h-12 items-center gap-1 px-3 text-[15px] whitespace-nowrap text-ink transition-colors hover:text-moss-700 data-[state=open]:text-moss-700";

/**
 * Menu principal do desktop. Abre ao passar o mouse (com 150ms de atraso), por clique e por teclado
 * (Enter, setas, Esc); fecha com atraso para evitar fechamento acidental.
 */
export function MegaMenu({ items }: { items: NavItem[] }) {
  return (
    <NavigationMenu.Root
      delayDuration={150}
      skipDelayDuration={300}
      aria-label="Categorias"
      className="relative hidden border-b border-line bg-cream-50 lg:block"
    >
      <div className="container-store">
        <NavigationMenu.List className="-mx-3 flex items-center">
          {items.map((item) =>
            item.children?.length ? (
              <NavigationMenu.Item key={item.href}>
                <NavigationMenu.Trigger
                  className={cn(itemClass, "group", item.isSecondary && "text-ink-muted")}
                >
                  {item.label}
                  <ChevronDown
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className="size-4 transition-transform group-data-[state=open]:rotate-180"
                  />
                </NavigationMenu.Trigger>
                <NavigationMenu.Content className="absolute top-full left-0 z-40 w-full border-b border-line bg-white shadow-overlay">
                  <div className="container-store flex gap-12 py-8">
                    <div className="flex-1">
                      <ul className="columns-2 gap-10 xl:columns-3">
                        {item.children.map((child) => (
                          <li key={child.href} className="break-inside-avoid">
                            <NavigationMenu.Link asChild>
                              <Link
                                href={child.href}
                                className="flex min-h-10 items-center text-[15px] text-ink underline-offset-3 hover:text-moss-700 hover:underline"
                              >
                                {child.label}
                              </Link>
                            </NavigationMenu.Link>
                          </li>
                        ))}
                      </ul>
                      <NavigationMenu.Link asChild>
                        <Link
                          href={item.href}
                          className="mt-5 inline-flex min-h-10 items-center text-[15px] font-medium text-moss-700 underline underline-offset-3 hover:text-moss-900"
                        >
                          Ver tudo em {item.label.toLowerCase()}
                        </Link>
                      </NavigationMenu.Link>
                    </div>
                    {item.image ? (
                      <figure className="w-[280px] flex-none">
                        <div className="relative aspect-4/3 overflow-hidden rounded-photo bg-cream-100">
                          <Image
                            src={item.image.url}
                            alt={item.image.alt}
                            fill
                            sizes="280px"
                            unoptimized={item.image.url.endsWith(".svg")}
                            className="object-cover"
                          />
                        </div>
                        {item.image.caption ? (
                          <figcaption className="mt-2 type-caption text-ink-muted">
                            {item.image.caption}
                          </figcaption>
                        ) : null}
                      </figure>
                    ) : null}
                  </div>
                </NavigationMenu.Content>
              </NavigationMenu.Item>
            ) : (
              <NavigationMenu.Item key={item.href}>
                <NavigationMenu.Link asChild>
                  <Link href={item.href} className={itemClass}>
                    {item.label}
                  </Link>
                </NavigationMenu.Link>
              </NavigationMenu.Item>
            ),
          )}
        </NavigationMenu.List>
      </div>
    </NavigationMenu.Root>
  );
}
