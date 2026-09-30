"use client";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { RouteLink } from "@/components/ui/RouteLink";
import { SignOutButton } from "@/components/auth/SignInForm";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";

const ITEMS = [
  { href: ROUTES.mechanicPortal, label: "Pregled", exact: true },
  { href: ROUTES.mechanicQuickOrderPage, label: "Brza porudžbina" },
  { href: ROUTES.mechanicOrders, label: "Porudžbine" },
  { href: ROUTES.mechanicFavorites, label: "Omiljeno" },
  { href: ROUTES.mechanicVehicles, label: "Vozila mušterija" },
  { href: ROUTES.mechanicPriceList, label: "Cenovnik" },
  { href: ROUTES.mechanicInquiries, label: "Upiti" },
  { href: ROUTES.mechanicProfile, label: "Profil" },
];

/** Portal navigation: underline tabs as links, horizontal scroll on phones (44 px targets). */
export function PortalNav() {
  const pathname = usePathname();
  return (
    <div
      className="flex flex-wrap items-end justify-between gap-3 border-b border-line"
      data-reveal="off"
      data-testid={TEST_IDS.mechanicPortalNav}
    >
      <nav aria-label="Majstorski portal" className="-mb-px flex max-w-full overflow-x-auto">
        <ul className="flex gap-6">
          {ITEMS.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <RouteLink
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-11 items-center whitespace-nowrap border-b-2 type-body-s font-medium transition-control",
                    active ? "border-accent text-ink-1" : "border-transparent text-ink-2 hover:text-ink-1",
                  )}
                >
                  {item.label}
                </RouteLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="hidden pb-1.5 sm:block">
        <SignOutButton />
      </div>
    </div>
  );
}
