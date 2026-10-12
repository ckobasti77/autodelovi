"use client";

/**
 * `/majstor/porudzbine`: own orders as rows of one panel — number, one status chip in a fixed
 * column, date · pieces · payment (deferred → due date), total and a quiet „Poruči ponovo“.
 * The status filter is one track that scrolls with an edge fade instead of wrapping its last
 * segment onto a second line on phones.
 */
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { ArrowCounterClockwiseIcon, ReceiptIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format/date";
import { formatRSD } from "@/lib/format/money";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, PAYMENT_LABEL } from "@/lib/i18n/sr/shop";
import { useEdgeFade } from "@/components/account/useEdgeFade";
import { Reveal } from "@/components/reveal/Reveal";
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

/**
 * Row geometry shared with the skeleton: one line from 48 rem of panel width; below it three
 * lines — number and total, the chip with the action beside it, then the facts.
 */
const ROW =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5 @3xl:grid-cols-[10rem_11rem_minmax(0,1fr)_7rem_auto]";

/** Status filter: one track (8 px) with 4 px segments; pressed = the raised segment. */
function FilterTrack({
  value,
  counts,
  onChange,
}: {
  value: Filter;
  counts: Record<Filter, number>;
  onChange: (value: Filter) => void;
}) {
  const { ref, style } = useEdgeFade<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={style}
      role="group"
      aria-label="Filter porudžbina"
      className="flex max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex gap-0.5 panel p-1 sm:gap-1">
        {FILTERS.map((f) => {
          const active = value === f.value;
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(f.value)}
              className={cn(
                "inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xs px-2 type-body-s font-semibold transition-control focus-ring-inset sm:gap-2 sm:px-3 lg:h-9",
                active
                  ? "bg-surface-3 text-ink-1 shadow-rest"
                  : "text-ink-2 hover:bg-surface-2 hover:text-ink-1",
              )}
            >
              {f.label}
              <span className="font-normal tabular-nums text-ink-3" data-reveal="off">
                {counts[f.value]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
      <SkeletonRegion className="flex flex-col gap-4">
        <Skeleton className="h-[3.25rem] w-80 max-w-full rounded-md lg:h-[2.75rem]" />
        <div className="@container panel">
          <div className="flex flex-col divide-y divide-line">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={ROW}>
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-6 w-24 @max-3xl:row-start-2" />
                <Skeleton className="h-4 w-64 max-w-full @max-3xl:col-span-2 @max-3xl:row-start-3" />
                <Skeleton className="h-5 w-20 justify-self-end @max-3xl:col-start-2 @max-3xl:row-start-1" />
                <Skeleton className="h-11 w-36 justify-self-end lg:h-9 @max-3xl:col-start-2 @max-3xl:row-start-2" />
              </div>
            ))}
          </div>
        </div>
      </SkeletonRegion>
    );
  }
  if (orders.length === 0) {
    return (
      <EmptyState
        align="start"
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
      <FilterTrack value={filter} counts={counts} onChange={setFilter} />
      <Reveal eager className="@container panel">
        {shown.length === 0 ? (
          <div className="flex flex-col items-start gap-3 p-5">
            <p className="type-body text-ink-2">Nema porudžbina sa ovim statusom.</p>
            <Button
              variant="quiet"
              size="sm"
              className="max-lg:h-11"
              onClick={() => setFilter("all")}
            >
              Prikaži sve porudžbine
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {shown.map((o) => (
              <li key={o.number} className={ROW}>
                <RouteLink
                  href={ROUTES.mechanicOrder(o.number)}
                  className="justify-self-start rounded-xs type-code text-ink-1 link-underline"
                >
                  {o.number}
                </RouteLink>
                <span className="contents">
                  <Badge
                    tone={ORDER_STATUS_TONE[o.status]}
                    size="text"
                    className="justify-self-start @max-3xl:row-start-2"
                  >
                    {ORDER_STATUS_LABEL[o.status]}
                  </Badge>
                  <span className="type-caption font-normal tabular-nums text-ink-3 @max-3xl:col-span-2 @max-3xl:row-start-3">
                    {formatDate(o.createdAt)} · {o.itemCount} kom. ·{" "}
                    {PAYMENT_LABEL[o.paymentMethod]}
                    {o.paymentMethod === "deferred" &&
                    o.dueAt &&
                    o.paymentStatus === "unpaid" &&
                    o.status !== "otkazana"
                      ? ` do ${formatDate(o.dueAt)}`
                      : ""}
                  </span>
                </span>
                <span className="text-right type-numeral-s tabular-nums text-ink-1 @max-3xl:col-start-2 @max-3xl:row-start-1">
                  {formatRSD(o.totalPara)}
                </span>
                <Button
                  variant="quiet"
                  size="sm"
                  icon={<ArrowCounterClockwiseIcon size={16} />}
                  loading={busy === o.number}
                  onClick={() => void run(o.number)}
                  className="justify-self-end max-lg:h-11 @max-3xl:col-start-2 @max-3xl:row-start-2"
                >
                  Poruči ponovo<span className="sr-only"> {o.number}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Reveal>
    </div>
  );
}
