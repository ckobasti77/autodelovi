"use client";

/**
 * Notification bell (DESIGN-SYSTEM §9.21): realtime Convex subscription to the viewer's
 * in-app notifications. New rows arrive with a short stagger (≤ 220 ms, reduced motion:
 * none) and are announced once in a polite live region.
 */
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { Popover } from "radix-ui";
import { useEffect, useId, useRef, useState } from "react";
import {
  AlarmIcon,
  BellIcon,
  ChatCircleTextIcon,
  EnvelopeSimpleIcon,
  PackageIcon,
  ReceiptIcon,
  WrenchIcon,
} from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatAgo } from "@/lib/admin/format";
import { cn } from "@/lib/cn";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap/client";
import { CountBadge } from "@/components/ui/Badge";
import { RouteLink } from "@/components/ui/RouteLink";
import { ADMIN } from "@/constants/routes";
import { DISTANCE, DUR, EASE } from "@/constants/motion";
import { TEST_IDS } from "@/constants/testIds";

// notifications.unreadCount stops counting at 100 (take(100)): at the cap the exact number is unknown.
const UNREAD_CAP = 100;

function kindIcon(kind: string) {
  if (kind === "reminder") return <AlarmIcon size={18} />;
  if (kind.startsWith("email_")) return <EnvelopeSimpleIcon size={18} />;
  if (kind.startsWith("order") || kind.startsWith("quote_accepted"))
    return <ReceiptIcon size={18} />;
  if (kind.startsWith("inquiry") || kind.startsWith("quote"))
    return <ChatCircleTextIcon size={18} />;
  if (kind.startsWith("mechanic")) return <WrenchIcon size={18} />;
  return <PackageIcon size={18} />;
}

export function NotificationBell({ nowMinute }: { nowMinute: number }) {
  const unread = useQuery(api.notifications.unreadCount, {}) ?? 0;
  const titleId = useId();
  const { results } = usePaginatedQuery(api.notifications.mine, {}, { initialNumItems: 8 });
  const markRead = useMutation(api.notifications.markRead);
  const markAll = useMutation(api.notifications.markAllRead);
  const [open, setOpen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const seen = useRef<Set<string> | null>(null);
  const fresh = useRef<Set<string>>(new Set());
  const listRef = useRef<HTMLUListElement>(null);

  // Announce and mark rows that arrived after the first load.
  useEffect(() => {
    if (results.length === 0 && seen.current === null) return;
    if (seen.current === null) {
      seen.current = new Set(results.map((n) => n._id));
      return;
    }
    const added = results.filter((n) => !seen.current!.has(n._id));
    for (const n of added) {
      seen.current.add(n._id);
      fresh.current.add(n._id);
    }
    const first = added[0];
    if (first) setAnnounce(`Novo obaveštenje: ${first.title}`);
  }, [results]);

  useGSAP(
    () => {
      if (!open || !listRef.current || fresh.current.size === 0) return;
      const rows = [...fresh.current]
        .map((id) => listRef.current!.querySelector(`[data-id="${id}"]`))
        .filter(Boolean);
      fresh.current.clear();
      if (rows.length === 0 || prefersReducedMotion()) return;
      gsap.fromTo(
        rows,
        { opacity: 0, y: -DISTANCE.ui / 2 },
        {
          opacity: 1,
          y: 0,
          duration: DUR.base,
          ease: EASE.out,
          stagger: Math.min(0.03, 0.22 / rows.length),
        },
      );
    },
    { dependencies: [open, results], scope: listRef },
  );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-testid={TEST_IDS.adminNotificationBell}
          aria-label={
            unread >= UNREAD_CAP
              ? "Obaveštenja, nepročitano: više od 99"
              : unread > 0
                ? `Obaveštenja, nepročitano: ${unread}`
                : "Obaveštenja"
          }
          className="relative inline-flex size-10 cursor-pointer items-center justify-center rounded-xs text-ink-2 transition-control hover:bg-surface-2 hover:text-ink-1 focus-ring-inset"
        >
          <BellIcon size={20} aria-hidden="true" />
          {unread > 0 ? (
            <CountBadge count={unread} className="absolute -right-0.5 -top-0.5" />
          ) : null}
        </button>
      </Popover.Trigger>
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          data-theme="paper"
          data-reveal="off"
          aria-labelledby={titleId}
          className="z-dropdown w-[min(380px,calc(100vw-24px))] rounded-md bg-surface-3 text-ink-1 shadow-overlay outline-none"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 id={titleId} className="type-body-s font-semibold">
              Obaveštenja
            </h2>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void markAll({})}
                className="cursor-pointer rounded-xs type-caption text-accent-text underline-offset-2 hover:underline focus-ring-inset"
              >
                Označi sve kao pročitano
              </button>
            ) : null}
          </div>
          <ul ref={listRef} className="max-h-[420px] overflow-y-auto py-1">
            {results.length === 0 ? (
              <li className="px-4 py-8 text-center type-body-s text-ink-2">
                Nema novih obaveštenja.
              </li>
            ) : (
              results.map((n) => (
                <li key={n._id} data-id={n._id}>
                  <RouteLink
                    href={n.href}
                    onClick={() => {
                      if (!n.read) void markRead({ notificationId: n._id as Id<"notifications"> });
                      setOpen(false);
                    }}
                    className={cn(
                      "flex min-h-14 items-start gap-3 px-4 py-2.5 transition-control hover:bg-surface-2 focus-ring-inset",
                      !n.read && "bg-surface-1",
                    )}
                  >
                    <span className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true">
                      {kindIcon(n.kind)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span
                        className={cn(
                          "type-body-s",
                          n.read ? "text-ink-2" : "font-semibold text-ink-1",
                        )}
                      >
                        {n.title}
                      </span>
                      <span className="truncate type-caption text-ink-3">
                        {formatAgo(n.createdAt, nowMinute)} · {n.body}
                      </span>
                    </span>
                    {!n.read ? (
                      <span
                        className="mt-2 size-2 shrink-0 rounded-full bg-accent"
                        aria-label="nepročitano"
                      />
                    ) : null}
                  </RouteLink>
                </li>
              ))
            )}
          </ul>
          <div className="border-t border-line px-4 py-2.5">
            <RouteLink
              href={ADMIN.notifications}
              onClick={() => setOpen(false)}
              className="type-body-s text-accent-text underline-offset-2 hover:underline"
            >
              Sva obaveštenja
            </RouteLink>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
