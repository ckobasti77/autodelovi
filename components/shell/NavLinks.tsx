"use client";

import { RouteLink as NextLink } from "@/components/ui/RouteLink";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { PRIMARY_NAV } from "@/constants/routes";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Primary navigation links; the current section is marked with aria-current and an accent bar. */
export function NavLinks({
  layout = "row",
  onNavigate,
}: {
  layout?: "row" | "column";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <ul className={cn(layout === "row" ? "flex items-center gap-1" : "flex flex-col")}>
      {PRIMARY_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <NextLink
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center rounded-xs transition-control",
                layout === "row"
                  ? "h-11 px-3 text-[0.9375rem] font-medium text-ink-2 hover:text-ink-1 aria-[current=page]:text-ink-1 aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-3 aria-[current=page]:after:bottom-1 aria-[current=page]:after:h-0.5 aria-[current=page]:after:bg-accent"
                  : "min-h-13 border-b border-line text-[1.0625rem] font-semibold text-ink-1 aria-[current=page]:text-accent-text",
              )}
            >
              {item.label}
            </NextLink>
          </li>
        );
      })}
    </ul>
  );
}
