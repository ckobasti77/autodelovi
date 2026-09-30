"use client";

/**
 * Night sidebar (DESIGN-SYSTEM §10.10, §9.15): task groups, live counts of work waiting
 * (accent pills), 232 px from 1366 px, a 64 px icon rail between 1024 and 1365 px (labels
 * visually hidden, counts as small badges), a drawer below 1024 px.
 */
import { useQuery } from "convex/react";
import { usePathname } from "next/navigation";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/cn";
import { BrandMark, Wordmark } from "@/components/shell/BrandMark";
import { CountBadge } from "@/components/ui/Badge";
import { useMediaQuery } from "@/components/ui/motion";
import { RouteLink } from "@/components/ui/RouteLink";
import { Tooltip } from "@/components/ui/Tooltip";
import { ADMIN } from "@/constants/routes";

import { ADMIN_NAV, isActive } from "./nav";

export function AdminSidebar({
  isOwner,
  variant,
  onNavigate,
}: {
  isOwner: boolean;
  /** `auto`: rail below 1366 px; `full`: always labelled (drawer). */
  variant: "auto" | "full";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const counts = useQuery(api.dashboard.navCounts, {});
  const rail = variant === "auto";
  // Icon-only rail: labels are sr-only, so sighted users get them as tooltips (hover and focus).
  const narrow = useMediaQuery("(max-width: 1365px)");
  const railShown = rail && narrow;
  return (
    <nav aria-label="Administracija" className="flex h-full flex-col" data-reveal="off">
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-line px-5",
          rail && "max-[1365px]:justify-center max-[1365px]:px-0",
        )}
      >
        <span className={cn(rail && "max-[1365px]:hidden")}>
          <Wordmark size="sidebar" href={ADMIN.home} />
        </span>
        {rail ? (
          <RouteLink
            href={ADMIN.home}
            aria-label="Pregled"
            className="hidden size-10 items-center justify-center rounded-xs text-ink-1 max-[1365px]:inline-flex focus-ring-inset"
          >
            <BrandMark size={20} />
          </RouteLink>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto py-3">
        {ADMIN_NAV.map((group, gi) => {
          const items = group.items.filter((i) => isOwner || !i.ownerOnly);
          if (items.length === 0) return null;
          return (
            <div key={gi} className="mb-3">
              {group.label ? (
                <p
                  className={cn(
                    "px-5 pb-1 pt-2 type-label uppercase text-ink-3",
                    rail && "max-[1365px]:sr-only",
                  )}
                >
                  {group.label}
                </p>
              ) : null}
              <ul>
                {items.map((item) => {
                  const active = isActive(pathname, item);
                  const count = item.count ? (counts?.[item.count] ?? 0) : 0;
                  const Icon = item.icon;
                  const countLabel =
                    item.count === "lowStock"
                      ? "bez zaliha"
                      : item.count === "mechanics"
                        ? "na čekanju"
                        : "novih";
                  const link = (
                    <RouteLink
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative mx-2 flex h-10 items-center gap-3 rounded-xs px-3 type-body-s transition-control focus-ring-inset",
                        active
                          ? "bg-surface-2 font-semibold text-ink-1"
                          : "text-ink-2 hover:bg-surface-1 hover:text-ink-1",
                        rail && "max-[1365px]:justify-center max-[1365px]:px-0",
                      )}
                    >
                      {active ? (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-2 left-0 w-0.5 bg-accent"
                        />
                      ) : null}
                      <Icon
                        size={20}
                        weight={active ? "fill" : "regular"}
                        aria-hidden="true"
                        className="shrink-0"
                      />
                      <span className={cn("flex-1 truncate", rail && "max-[1365px]:sr-only")}>
                        {item.label}
                      </span>
                      {count > 0 ? (
                        item.count === "lowStock" ? (
                          <span
                            className={cn(
                              "type-caption tabular-nums text-ink-3",
                              rail &&
                                "max-[1365px]:absolute max-[1365px]:right-1.5 max-[1365px]:top-0.5 max-[1365px]:text-[0.6875rem]",
                            )}
                          >
                            {count > 99 ? "99+" : count}
                            <span className="sr-only"> {countLabel}</span>
                          </span>
                        ) : (
                          <>
                            <CountBadge
                              count={count}
                              max={99}
                              className={cn(
                                rail &&
                                  "max-[1365px]:absolute max-[1365px]:right-1 max-[1365px]:top-0.5 max-[1365px]:h-[18px] max-[1365px]:min-w-[18px] max-[1365px]:px-1 max-[1365px]:text-[0.6875rem]",
                              )}
                            />
                            <span className="sr-only"> {countLabel}</span>
                          </>
                        )
                      ) : null}
                    </RouteLink>
                  );
                  return (
                    <li key={item.href}>
                      {railShown ? (
                        <Tooltip content={item.label} side="right" delayDuration={150}>
                          {link}
                        </Tooltip>
                      ) : (
                        link
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
