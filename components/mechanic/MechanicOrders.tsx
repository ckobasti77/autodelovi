"use client";

/**
 * `/majstor/porudzbine`: own orders with status, payment (deferred → due date) and an
 * inline „Poruči ponovo“; filter chips for open / completed / cancelled.
 */
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { ArrowCounterClockwiseIcon, ReceiptIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format/date";
import { formatRSD } from "@/lib/format/money";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, PAYMENT_LABEL } from "@/lib/i18n/sr/shop";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/components/ui/Link";
import { RouteLink } from "@/components/ui/RouteLink";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { useReorder } from "@/components/mechanic/PortalOverview";
import { ROUTES } from "@/constants/routes";

type Filter = "all" | "open" | "done" | "cancelled";

const OPEN = new Set(["nova", "potvrdjena", "ceka_deo", "spremna_za_preuzimanje", "poslata"]);
const DONE = new Set(["preuzeta", "isporucena", "zavrsena"]);

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Sve" },
  { value: "open", label: "U toku" },
  { value: "done", label: "Završene" },
  { value: "cancelled", label: "Otkazane" },
];

export function MechanicOrders() {
  const orders = useQuery(api.orders.myOrders, {});
  const { run, busy } = useReorder();
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const list = orders ?? [];
    return {
      all: list.length,
      open: list.filter((o) => OPEN.has(o.status)).length,
      done: list.filter((o) => DONE.has(o.status)).length,
      cancelled: list.filter((o) => o.status === "otkazana").length,
    };
  }, [orders]);

  if (orders === undefined) {
    return (
      <SkeletonRegion>
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </SkeletonRegion>
    );
  }
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<ReceiptIcon size={40} />}
        action={
          <Button asChild>
            <Link href={ROUTES.mechanicQuickOrderPage} variant="unstyled">
              Brza porudžbina
            </Link>
          </Button>
        }
      >
        Još nemate porudžbina.
      </EmptyState>
    );
  }
  const shown = orders.filter((o) =>
    filter === "all"
      ? true
      : filter === "open"
        ? OPEN.has(o.status)
        : filter === "done"
          ? DONE.has(o.status)
          : o.status === "otkazana",
  );

  return (
    <div className="flex flex-col gap-4" data-reveal="off">
      <div role="group" aria-label="Filter porudžbina" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "inline-flex h-11 cursor-pointer items-center gap-2 rounded-xs border px-3 type-body-s transition-control",
              filter === f.value
                ? "border-accent bg-accent-subtle text-ink-1"
                : "border-line-strong text-ink-2 hover:border-ink-3 hover:text-ink-1",
            )}
          >
            {f.label}
            <span className="tabular-nums text-ink-3">{counts[f.value]}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="py-6 type-body text-ink-2">Nema porudžbina sa ovim statusom.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {shown.map((o) => (
            <li
              key={o.number}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-4 md:grid-cols-[11rem_minmax(0,1fr)_auto_auto]"
            >
              <RouteLink
                href={ROUTES.mechanicOrder(o.number)}
                className="type-code text-ink-1 underline decoration-line-strong underline-offset-4 hover:decoration-accent"
              >
                {o.number}
              </RouteLink>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 max-md:col-span-2 max-md:row-start-2">
                <Badge tone={ORDER_STATUS_TONE[o.status]} size="text">
                  {ORDER_STATUS_LABEL[o.status]}
                </Badge>
                <span className="type-caption tabular-nums text-ink-3">
                  {formatDate(o.createdAt)} · {o.itemCount} kom. · {PAYMENT_LABEL[o.paymentMethod]}
                  {o.paymentMethod === "deferred" && o.dueAt && o.paymentStatus === "unpaid" && o.status !== "otkazana"
                    ? ` do ${formatDate(o.dueAt)}`
                    : ""}
                </span>
              </span>
              <span className="text-right type-numeral-s tabular-nums text-ink-1">{formatRSD(o.totalPara)}</span>
              <Button
                variant="secondary"
                size="sm"
                icon={<ArrowCounterClockwiseIcon size={16} />}
                loading={busy === o.number}
                onClick={() => void run(o.number)}
                className="max-md:col-start-2 max-md:row-start-3 max-md:justify-self-end"
              >
                Poruči ponovo
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
