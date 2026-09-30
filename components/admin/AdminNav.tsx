"use client";

import { useQuery } from "convex/react";
import { usePathname } from "next/navigation";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/cn";
import { CountBadge } from "@/components/ui/Badge";
import { RouteLink } from "@/components/ui/RouteLink";
import { ROUTES } from "@/constants/routes";

/** Step-14 admin navigation (step 15 replaces it with the sidebar shell). */
export function AdminNav() {
  const pathname = usePathname();
  const counts = useQuery(api.mechanicsAdmin.counts, {});
  const items = [
    { href: "/admin", label: "Pregled", exact: true, count: 0 },
    { href: ROUTES.adminMechanics, label: "Majstori", exact: false, count: counts?.pending ?? 0 },
  ];
  return (
    <nav aria-label="Administracija" className="hidden sm:block">
      <ul className="flex gap-5">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <RouteLink
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-14 items-center gap-2 border-b-2 type-body-s font-medium transition-control",
                  active ? "border-accent text-ink-1" : "border-transparent text-ink-2 hover:text-ink-1",
                )}
              >
                {item.label}
                {item.count > 0 ? (
                  <>
                    <CountBadge count={item.count} />
                    <span className="sr-only"> na čekanju</span>
                  </>
                ) : null}
              </RouteLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
