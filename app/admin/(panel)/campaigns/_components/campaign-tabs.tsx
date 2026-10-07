"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function CampaignTabs() {
  const pathname = usePathname();
  const { id } = useParams<{ id: string }>();
  const tabs = [
    { href: `/admin/campaigns/${id}/slots`, label: "Часове" },
    { href: `/admin/campaigns/${id}`, label: "Настройки" },
  ];
  return (
    <nav aria-label="Раздели на кампанията" className="border-b border-border">
      <ul className="flex gap-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-block border-b-2 border-transparent px-3 py-2 text-sm hover:text-foreground",
                  active ? "border-primary font-medium" : "text-muted-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
