import Link from "next/link";
import type { NavLink } from "@/config/navigation";
import { cn } from "@/lib/cn";

/** Lista compacta de links de categoria, usada em estados vazios, na busca e no 404. */
export function CategoryLinks({ links, className }: { links: NavLink[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap justify-center gap-2", className)}>
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className="flex min-h-11 items-center rounded-control border border-moss-700 px-4 text-[15px] text-moss-700 transition-colors hover:bg-moss-100"
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
