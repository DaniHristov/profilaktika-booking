"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// Sections are added here as they are built (phase 4b-4d).
const LINKS: { href: string; label: string }[] = [];

export function AdminNav() {
  const pathname = usePathname();
  if (LINKS.length === 0) return null;
  return (
    <nav aria-label="Админ раздели">
      <ul className="flex items-center gap-1">
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted",
                  active && "bg-muted font-medium",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
