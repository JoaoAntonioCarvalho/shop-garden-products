"use client";

import { ChevronDown, Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Drawer } from "@/components/ui/dialog";
import type { NavItem, NavLink } from "@/config/navigation";
import { track } from "@/lib/analytics/events";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { WhatsAppIcon } from "./icons";

type MobileMenuProps = {
  items: NavItem[];
  /** Conta, rastreio, ajuda. */
  secondaryLinks: NavLink[];
  whatsapp: string;
  instagram: string;
};

const linkClass = "flex min-h-12 items-center text-[16px] text-ink";

export function MobileMenu({ items, secondaryLinks, whatsapp, instagram }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      side="left"
      bottomOnMobile={false}
      title="Menu"
      trigger={
        <button
          type="button"
          aria-label="Abrir menu"
          className="-ml-2.5 flex size-11 items-center justify-center text-moss-700 lg:hidden"
        >
          <Menu aria-hidden="true" strokeWidth={1.5} className="size-6" />
        </button>
      }
    >
      <nav aria-label="Categorias">
        <ul className="divide-y divide-line border-b border-line">
          {items.map((item) =>
            item.children?.length ? (
              <li key={item.href}>
                <details className="group">
                  <summary
                    className={`${linkClass} list-none justify-between [&::-webkit-details-marker]:hidden`}
                  >
                    {item.label}
                    <ChevronDown
                      aria-hidden="true"
                      strokeWidth={1.5}
                      className="size-5 text-moss-700 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <ul className="pb-3 pl-4">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          onClick={close}
                          className="flex min-h-11 items-center text-[15px] text-ink"
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                    <li>
                      <Link
                        href={item.href}
                        onClick={close}
                        className="flex min-h-11 items-center text-[15px] font-medium text-moss-700 underline underline-offset-3"
                      >
                        Ver tudo em {item.label.toLowerCase()}
                      </Link>
                    </li>
                  </ul>
                </details>
              </li>
            ) : (
              <li key={item.href}>
                <Link href={item.href} onClick={close} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ),
          )}
        </ul>
      </nav>

      <ul className="mt-4">
        {secondaryLinks.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              onClick={close}
              className="flex min-h-11 items-center text-[15px] text-ink-muted"
            >
              {link.label}
            </Link>
          </li>
        ))}
        <li>
          <a
            href={buildWhatsAppUrl(whatsapp, "Olá! Vim pelo site e gostaria de ajuda.")}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              track("whatsapp_click", { position: "menu", page: window.location.pathname })
            }
            className="flex min-h-11 items-center gap-2 text-[15px] text-moss-700"
          >
            <WhatsAppIcon className="size-5" />
            Falar pelo WhatsApp
          </a>
        </li>
        {instagram ? (
          <li>
            <a
              href={instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center text-[15px] text-ink-muted"
            >
              Instagram
            </a>
          </li>
        ) : null}
      </ul>
    </Drawer>
  );
}
