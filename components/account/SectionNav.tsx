"use client";

/**
 * Chrome shared by the mechanic portal and the customer account (UI-BOOST §7.7): the page
 * heading and the tab row.
 *
 * `SectionNav` shows at most four primary tabs as links; everything else, and „Odjavi se“, sits
 * in the „Još“ menu, so the row never offers more than five choices. The tabs scroll with an
 * edge fade when the row is narrower than they are; „Još“ stays pinned beside them.
 * `SectionHeading` names the open view in the H1 — with half of the views behind „Još“ the tab
 * row alone no longer says where you are.
 */
import { useAuthActions } from "@convex-dev/auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { CaretDownIcon, CheckIcon, SignOutIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { RouteLink } from "@/components/ui/RouteLink";
import { useEdgeFade } from "@/components/account/useEdgeFade";

export type SectionNavItem = {
  href: string;
  label: string;
  /** Active only on the exact path (the overview). */
  exact?: boolean;
  /** Glyph shown in the „Još“ menu (16 px). */
  icon?: ReactNode;
};

function isActive(pathname: string, item: SectionNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

const tab =
  "inline-flex h-11 shrink-0 cursor-pointer items-center whitespace-nowrap border-b-2 type-body-s font-medium transition-control focus-ring-inset";
const tabOn = "border-accent text-ink-1";
const tabOff = "border-transparent text-ink-2 hover:text-ink-1";

export function SectionNav({
  label,
  primary,
  more,
  testId,
}: {
  /** Accessible name of the navigation landmark. */
  label: string;
  /** At most four tabs. */
  primary: SectionNavItem[];
  /** The rest, behind „Još“ (sign-out is appended). */
  more: SectionNavItem[];
  testId?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { ref: listRef, style: fadeStyle } = useEdgeFade<HTMLUListElement>();
  const current = more.find((item) => isActive(pathname, item));

  // Phones: the open tab is never left outside the visible part of the row.
  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !active) return;
    const item = active.parentElement ?? active;
    if (item.offsetLeft + item.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = item.offsetLeft + item.offsetWidth - list.clientWidth + 20;
    } else if (item.offsetLeft < list.scrollLeft) {
      list.scrollLeft = Math.max(0, item.offsetLeft - 20);
    }
  }, [pathname, listRef]);

  const menu: MenuItem[] = [
    ...more.map((item): MenuItem => {
      const active = item === current;
      return {
        label: (
          <span className="flex flex-1 items-center justify-between gap-4">
            <span className={active ? "font-semibold" : undefined}>
              {item.label}
              {active ? <span className="sr-only"> (otvorena strana)</span> : null}
            </span>
            {active ? (
              <CheckIcon size={16} weight="bold" aria-hidden="true" className="text-accent-text" />
            ) : null}
          </span>
        ),
        icon: item.icon,
        onSelect: () => router.push(item.href),
      };
    }),
    { type: "separator" },
    {
      label: "Odjavi se",
      icon: <SignOutIcon size={16} />,
      onSelect: () => {
        void signOut().then(() => router.refresh());
      },
    },
  ];

  return (
    <div className="border-b border-line" data-reveal="off" data-testid={testId}>
      <nav aria-label={label} className="-mb-px flex items-end gap-5 sm:gap-6">
        <ul
          ref={listRef}
          style={fadeStyle}
          className="flex min-w-0 gap-5 overflow-x-auto [scrollbar-width:none] sm:gap-6 [&::-webkit-scrollbar]:hidden"
        >
          {primary.map((item) => {
            const active = isActive(pathname, item);
            return (
              <li key={item.href} className="shrink-0">
                <RouteLink
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(tab, active ? tabOn : tabOff)}
                >
                  {item.label}
                </RouteLink>
              </li>
            );
          })}
        </ul>
        <Menu
          align="start"
          items={menu}
          trigger={
            <button
              type="button"
              className={cn(
                tab,
                "group gap-1 data-[state=open]:text-ink-1",
                current ? tabOn : tabOff,
              )}
            >
              <span>
                Još
                {current ? (
                  <span className="sr-only"> — otvorena strana: {current.label}</span>
                ) : null}
              </span>
              <CaretDownIcon
                size={14}
                aria-hidden="true"
                className="transition-transform duration-(--dur-base) ease-sk-snap group-data-[state=open]:rotate-180 motion-reduce:transition-none"
              />
            </button>
          }
        />
      </nav>
    </div>
  );
}

/**
 * The heading of an area with tabs: the area's name on its overview, the open view's name
 * everywhere else (with the area and whose it is on the line above). A record page — an order —
 * carries its number in the H1.
 */
export function SectionHeading({
  area,
  rootHref,
  context,
  overviewContext,
  items,
  records = [],
}: {
  /** „Majstorski portal“, „Moj nalog“. */
  area: string;
  rootHref: string;
  /** Whose area this is: the company, the e-mail. */
  context: string;
  /** The line above the H1 on the overview, when it reads differently there. */
  overviewContext?: string;
  /** Every view of the area except the overview. */
  items: SectionNavItem[];
  /** Record pages: `${prefix}/<number>` → „{title} <number>“. */
  records?: { prefix: string; title: string }[];
}) {
  const pathname = usePathname();
  const record = records.find((r) => pathname.startsWith(`${r.prefix}/`));
  let title = area;
  let code: string | null = null;
  if (record) {
    title = record.title;
    const raw = pathname.slice(record.prefix.length + 1);
    try {
      code = decodeURIComponent(raw);
    } catch {
      code = raw;
    }
  } else if (pathname !== rootHref) {
    title = items.find((item) => isActive(pathname, item))?.label ?? area;
  }
  const onOverview = title === area && !record;
  return (
    <header className="flex flex-col gap-1" data-reveal="off">
      <p className="truncate type-body-s text-ink-3">
        {onOverview ? (overviewContext ?? context) : `${area} · ${context}`}
      </p>
      <h1 className="type-h1 text-ink-1">
        {title}
        {code ? (
          <>
            {" "}
            <span className="font-mono text-[0.72em] font-medium tracking-tight text-ink-2">
              {code}
            </span>
          </>
        ) : null}
      </h1>
    </header>
  );
}
