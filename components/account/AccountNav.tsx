"use client";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { RouteLink } from "@/components/ui/RouteLink";
import { SignOutButton } from "@/components/auth/SignInForm";
import { ROUTES } from "@/constants/routes";

const ITEMS = [
  { href: ROUTES.account, label: "Pregled", exact: true },
  { href: ROUTES.accountOrders, label: "Porudžbine" },
  { href: ROUTES.accountInquiries, label: "Upiti" },
  { href: ROUTES.accountVehicles, label: "Vozila" },
  { href: ROUTES.accountProfile, label: "Profil" },
];

/** Account navigation (underline tabs as links; horizontal scroll on phones). */
export function AccountNav() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line" data-reveal="off">
      <nav aria-label="Nalog" className="-mb-px flex overflow-x-auto">
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
      <div className="pb-1.5">
        <SignOutButton />
      </div>
    </div>
  );
}
