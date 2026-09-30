"use client";

/** `/admin/obavestenja` — all in-app notifications of the signed-in staff member. */
import { useMutation, usePaginatedQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { compactDateTime } from "@/lib/admin/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { RouteLink } from "@/components/ui/RouteLink";
import { Skeleton } from "@/components/ui/Skeleton";
import { ADMIN } from "@/constants/routes";

import { useNowMinute } from "../hooks";
import { LoadMoreFooter, PageHeader } from "../ui";

export function NotificationsAdmin() {
  const nowMinute = useNowMinute();
  const { results, status, loadMore } = usePaginatedQuery(
    api.notifications.mine,
    {},
    { initialNumItems: 30 },
  );
  const markRead = useMutation(api.notifications.markRead);
  const markAll = useMutation(api.notifications.markAllRead);
  const unread = results.filter((n) => !n.read).length;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Obaveštenja"
        description={
          <>
            Nove porudžbine, upiti, registracije i zalihe. Šta dobijate birate u{" "}
            <RouteLink
              href={ADMIN.settingsTab("obavestenja")}
              className="text-accent-text underline-offset-2 hover:underline"
            >
              podešavanjima
            </RouteLink>
            .
          </>
        }
        actions={
          unread > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => void markAll({})}>
              Označi sve kao pročitano
            </Button>
          ) : null
        }
      />
      <div className="rounded-sm border border-line bg-surface-1">
        {status === "LoadingFirstPage" ? (
          <Skeleton className="m-4 h-60" />
        ) : results.length === 0 ? (
          <p className="px-4 py-10 text-center type-body-s text-ink-2">Nema obaveštenja.</p>
        ) : (
          <ul className="divide-y divide-line-faint">
            {results.map((n) => (
              <li key={n._id}>
                <RouteLink
                  href={n.href}
                  onClick={() =>
                    !n.read && void markRead({ notificationId: n._id as Id<"notifications"> })
                  }
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 hover:bg-surface-2 focus-ring-inset",
                    !n.read && "bg-surface-2/60",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      n.read ? "bg-transparent" : "bg-accent",
                    )}
                    aria-hidden="true"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={cn(
                        "type-body-s",
                        n.read ? "text-ink-2" : "font-semibold text-ink-1",
                      )}
                    >
                      {n.title}
                      {!n.read ? <span className="sr-only"> (nepročitano)</span> : null}
                    </span>
                    <span className="type-caption text-ink-3">{n.body}</span>
                  </span>
                  <span className="whitespace-nowrap type-caption tabular-nums text-ink-3">
                    {compactDateTime(n.createdAt, nowMinute)}
                  </span>
                </RouteLink>
              </li>
            ))}
          </ul>
        )}
      </div>
      <LoadMoreFooter
        shown={results.length}
        status={status}
        onMore={loadMore}
        pageSize={30}
        forms={["obaveštenje", "obaveštenja", "obaveštenja"]}
      />
    </div>
  );
}
