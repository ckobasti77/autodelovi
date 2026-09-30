"use client";

/**
 * `/majstor` overview below the quick-order box (§10.9): the mechanic's terms as a title
 * block (tier, rabat, deferred payment) and link tiles to the rest of the portal — last
 * orders with „Poruči ponovo“, favorites, customer vehicles, price list. Live queries.
 */
import { useMutation, useQuery } from "convex/react";
import {
  ArrowCounterClockwiseIcon,
  ArrowRightIcon,
  CarIcon,
  FileXlsIcon,
  StarIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";

import { api } from "@/convex/_generated/api";
import { openCartDrawer } from "@/lib/cart/drawer";
import { formatDate } from "@/lib/format/date";
import { formatRSD } from "@/lib/format/money";
import { formatPercent } from "@/lib/format/number";
import { countSr } from "@/lib/format/plural";
import { convexErrorMessage, ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/i18n/sr/shop";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RouteLink } from "@/components/ui/RouteLink";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";

export function useReorder() {
  const reorder = useMutation(api.orders.reorder);
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (number: string) => {
    setBusy(number);
    try {
      const r = await reorder({ number });
      if (r.unavailable.length) {
        toast.warning(
          `Dodato: ${r.added}. Nije dostupno: ${r.unavailable.map((u) => u.name).join(", ")}.`,
          { action: { label: "Pogledaj korpu", onClick: openCartDrawer } },
        );
      } else {
        toast.success(`U korpi: ${countSr(r.added, ["stavka", "stavke", "stavki"])}.`, {
          action: { label: "Pogledaj korpu", onClick: openCartDrawer },
        });
      }
    } catch (error) {
      toast.error(convexErrorMessage(error, "Stavke nisu dodate. Pokušajte ponovo."));
    } finally {
      setBusy(null);
    }
  };
  return { run, busy };
}

function Terms() {
  const o = useQuery(api.mechanicPortal.overview, {});
  if (o === undefined) {
    return (
      <SkeletonRegion>
        <Skeleton className="h-28 w-full" />
      </SkeletonRegion>
    );
  }
  if (!o) return null;
  const rabat = o.personalDiscountBp ?? o.tierDiscountBp;
  const credit = o.credit;
  return (
    <dl className="grid grid-cols-2 border-y border-line sm:grid-cols-4" data-testid={TEST_IDS.mechanicTierBadge}>
      <div className="flex flex-col gap-1 border-r border-line py-4 pr-4">
        <dt className="type-label text-ink-3">Nivo</dt>
        <dd className="type-h3 text-ink-1">{o.tierName ?? "—"}</dd>
      </div>
      <div className="flex flex-col gap-1 py-4 pl-4 sm:border-r sm:border-line sm:pr-4">
        <dt className="type-label text-ink-3">Osnovni rabat</dt>
        <dd className="type-numeral-l tabular-nums text-accent-text">
          {rabat !== null ? formatPercent(rabat / 10_000) : "—"}
        </dd>
      </div>
      <div className="col-span-2 flex flex-col gap-1 border-t border-line py-4 sm:col-span-2 sm:border-t-0 sm:pl-4">
        <dt className="type-label text-ink-3">Odloženo plaćanje</dt>
        {credit.enabled ? (
          <dd className="flex flex-col gap-0.5">
            <span className="type-body text-ink-1">
              {credit.availablePara !== null
                ? `Preostalo ${formatRSD(credit.availablePara)} od ${formatRSD(credit.limitPara ?? 0)}`
                : "Uključeno, bez limita"}
            </span>
            <span className="type-caption text-ink-3">
              Rok {countSr(credit.paymentTermsDays, ["dan", "dana", "dana"])}
              {credit.openCount > 0 ? ` · otvoreno: ${formatRSD(credit.usedPara)}` : ""}
            </span>
          </dd>
        ) : (
          <dd className="type-body-s text-ink-2">Nije uključeno — dogovara se posle prvih porudžbina.</dd>
        )}
      </div>
    </dl>
  );
}

function RecentOrders() {
  const orders = useQuery(api.orders.myOrders, {});
  const { run, busy } = useReorder();
  if (orders === undefined) {
    return (
      <SkeletonRegion>
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </SkeletonRegion>
    );
  }
  if (orders.length === 0) {
    return <p className="type-body-s text-ink-3">Još nemate porudžbina. Prva ide preko brze porudžbine iznad.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-line">
      {orders.slice(0, 5).map((o) => (
        <li key={o.number} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
          <RouteLink href={ROUTES.mechanicOrder(o.number)} className="type-code text-ink-1 underline decoration-line-strong underline-offset-4 hover:decoration-accent">
            {o.number}
          </RouteLink>
          <span className="type-caption tabular-nums text-ink-3">{formatDate(o.createdAt)}</span>
          <Badge tone={ORDER_STATUS_TONE[o.status]} size="text">
            {ORDER_STATUS_LABEL[o.status]}
          </Badge>
          <span className="ml-auto type-numeral-s tabular-nums text-ink-1">{formatRSD(o.totalPara)}</span>
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowCounterClockwiseIcon size={16} />}
            loading={busy === o.number}
            onClick={() => void run(o.number)}
          >
            Poruči ponovo
          </Button>
        </li>
      ))}
    </ul>
  );
}

function Tile({
  href,
  icon,
  title,
  meta,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  meta: string;
}) {
  return (
    <RouteLink
      href={href}
      className="group flex min-h-20 items-center gap-4 border-t border-line py-4 transition-control hover:bg-surface-1 sm:px-2"
    >
      <span aria-hidden="true" className="text-ink-3 transition-control group-hover:text-accent">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="type-body font-semibold text-ink-1">{title}</span>
        <span className="type-caption text-ink-3">{meta}</span>
      </span>
      <ArrowRightIcon size={18} aria-hidden="true" className="ml-auto text-ink-3 group-hover:text-ink-1" />
    </RouteLink>
  );
}

export function PortalOverview() {
  const o = useQuery(api.mechanicPortal.overview, {});
  return (
    <div className="flex flex-col gap-12" data-reveal="off">
      <Terms />
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <section aria-labelledby="po-orders" className="lg:col-span-7">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="po-orders" className="type-h3 text-ink-1">
              Poslednje porudžbine
            </h2>
            <RouteLink href={ROUTES.mechanicOrders} className="inline-flex min-h-11 items-center type-body-s text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink-1">
              Sve porudžbine
            </RouteLink>
          </div>
          <RecentOrders />
        </section>
        <nav aria-label="Portal" className="flex flex-col lg:col-span-5">
          <Tile
            href={ROUTES.mechanicFavorites}
            icon={<StarIcon size={24} />}
            title="Omiljeno"
            meta={o ? countSr(o.counts.favorites, ["deo koji često poručujete", "dela koje često poručujete", "delova koje često poručujete"]) : "Delovi koje često poručujete"}
          />
          <Tile
            href={ROUTES.mechanicVehicles}
            icon={<CarIcon size={24} />}
            title="Vozila mušterija"
            meta={o ? `${countSr(o.counts.vehicles, ["vozilo", "vozila", "vozila"])} · VIN, tablice, napomena` : "VIN, tablice, napomena"}
          />
          <Tile
            href={ROUTES.mechanicPriceList}
            icon={<FileXlsIcon size={24} />}
            title="Cenovnik"
            meta="Vaše cene za izabrane kategorije, Excel"
          />
        </nav>
      </div>
    </div>
  );
}
