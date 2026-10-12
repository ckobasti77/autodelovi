"use client";

/**
 * `/majstor` overview beside the quick-order box (§10.9), in one panel language: the
 * mechanic's terms (level, rabat, deferred payment), the last orders with „Poruči ponovo“ and
 * link tiles to what sits behind „Još“ in the tab row. Live queries.
 */
import { useMutation, useQuery } from "convex/react";
import {
  ArrowCounterClockwiseIcon,
  ArrowRightIcon,
  CarIcon,
  ChatCircleTextIcon,
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
import { Reveal, RevealGroup, RevealItem } from "@/components/reveal/Reveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
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

const TERMS_GRID =
  "grid grid-cols-2 panel sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.7fr)]";
const TERMS_CELL = "flex flex-col gap-1.5 p-4 sm:p-5";

/**
 * The mechanic's terms as one panel. The level is what is his — the one orange of the region;
 * the rabat is a number to read, the credit a line of facts.
 */
function Terms() {
  const o = useQuery(api.mechanicPortal.overview, {});
  if (o === undefined) {
    return (
      <SkeletonRegion>
        <div className={TERMS_GRID}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={
                i === 2
                  ? `${TERMS_CELL} col-span-2 border-t border-line sm:col-span-1 sm:border-t-0`
                  : `${TERMS_CELL} ${i === 0 ? "border-r border-line" : "sm:border-r sm:border-line"}`
              }
            >
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-32 max-w-full" />
            </div>
          ))}
        </div>
      </SkeletonRegion>
    );
  }
  if (!o) return null;
  const rabat = o.personalDiscountBp ?? o.tierDiscountBp;
  const credit = o.credit;
  return (
    <Reveal as="dl" eager className={TERMS_GRID} data-testid={TEST_IDS.mechanicTierBadge}>
      <div className={`${TERMS_CELL} border-r border-line`}>
        <dt className="type-caption text-ink-3">Vaš nivo</dt>
        <dd className="type-h2 text-accent-text">{o.tierName ?? "—"}</dd>
      </div>
      <div className={`${TERMS_CELL} sm:border-r sm:border-line`}>
        <dt className="type-caption text-ink-3">Osnovni rabat</dt>
        <dd className="type-numeral-l tabular-nums text-ink-1">
          {rabat !== null ? formatPercent(rabat / 10_000) : "—"}
        </dd>
      </div>
      <div className={`${TERMS_CELL} col-span-2 border-t border-line sm:col-span-1 sm:border-t-0`}>
        <dt className="type-caption text-ink-3">Odloženo plaćanje</dt>
        {credit.enabled ? (
          <dd className="flex flex-col gap-1">
            {credit.availablePara !== null ? (
              <span className="flex flex-wrap items-baseline gap-x-2 type-body-s text-ink-2">
                Preostalo
                <span className="type-numeral-m tabular-nums text-ink-1">
                  {formatRSD(credit.availablePara)}
                </span>
                od {formatRSD(credit.limitPara ?? 0)}
              </span>
            ) : (
              <span className="type-body text-ink-1">Uključeno, bez limita</span>
            )}
            <span className="type-caption font-normal text-ink-3">
              Rok {countSr(credit.paymentTermsDays, ["dan", "dana", "dana"])}
              {credit.openCount > 0 ? ` · otvoreno: ${formatRSD(credit.usedPara)}` : ""}
            </span>
          </dd>
        ) : (
          <dd className="type-body-s text-ink-2">
            Nije uključeno — dogovara se posle prvih porudžbina.
          </dd>
        )}
      </div>
    </Reveal>
  );
}

/**
 * One row geometry for the list and its skeleton, the same columns as `/majstor/porudzbine`:
 * number, status chip, date, total, action — one line from 48 rem of panel width.
 */
const ORDER_ROW =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 sm:px-5 @3xl:grid-cols-[10rem_11rem_minmax(0,1fr)_7rem_auto]";

function RecentOrders() {
  const orders = useQuery(api.orders.myOrders, {});
  const { run, busy } = useReorder();
  if (orders === undefined) {
    return (
      <SkeletonRegion>
        <div className="flex flex-col divide-y divide-line">
          {[0, 1, 2].map((i) => (
            <div key={i} className={ORDER_ROW}>
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-6 w-24 @max-3xl:row-start-2" />
              <Skeleton className="hidden h-4 w-20 @3xl:block" />
              <Skeleton className="h-5 w-20 justify-self-end @max-3xl:col-start-2 @max-3xl:row-start-1" />
              <Skeleton className="h-11 w-36 justify-self-end lg:h-9" />
            </div>
          ))}
        </div>
      </SkeletonRegion>
    );
  }
  if (orders.length === 0) {
    return (
      <p className="px-4 py-5 type-body-s text-ink-2 sm:px-5">
        Još nemate porudžbina. Prva ide preko brze porudžbine.
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-line">
      {orders.slice(0, 5).map((o) => (
        <li key={o.number} className={ORDER_ROW}>
          <RouteLink
            href={ROUTES.mechanicOrder(o.number)}
            className="justify-self-start rounded-xs type-code text-ink-1 link-underline"
          >
            {o.number}
          </RouteLink>
          <span className="flex items-center gap-3 @max-3xl:row-start-2 @3xl:contents">
            <Badge tone={ORDER_STATUS_TONE[o.status]} size="text" className="justify-self-start">
              {ORDER_STATUS_LABEL[o.status]}
            </Badge>
            <span className="type-caption font-normal tabular-nums text-ink-3">
              {formatDate(o.createdAt)}
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
            className="justify-self-end max-lg:h-11"
          >
            Poruči ponovo<span className="sr-only"> {o.number}</span>
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
      className="group flex h-full min-h-20 items-center gap-4 panel card-interactive p-4"
    >
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center panel-inset text-ink-2 transition-control group-hover:text-ink-1"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="type-body font-semibold text-ink-1">{title}</span>
        <span className="type-caption font-normal text-ink-3">{meta}</span>
      </span>
      <ArrowRightIcon
        size={18}
        aria-hidden="true"
        className="ml-auto shrink-0 text-ink-3 transition-control group-hover:text-ink-1"
      />
    </RouteLink>
  );
}

export function PortalOverview() {
  const o = useQuery(api.mechanicPortal.overview, {});
  const tiles = [
    {
      href: ROUTES.mechanicFavorites,
      icon: <StarIcon size={22} />,
      title: "Omiljeno",
      meta: o
        ? countSr(o.counts.favorites, [
            "deo koji često poručujete",
            "dela koje često poručujete",
            "delova koje često poručujete",
          ])
        : "Delovi koje često poručujete",
    },
    {
      href: ROUTES.mechanicVehicles,
      icon: <CarIcon size={22} />,
      title: "Vozila mušterija",
      meta: o
        ? `${countSr(o.counts.vehicles, ["vozilo", "vozila", "vozila"])} · VIN, tablice, napomena`
        : "VIN, tablice, napomena",
    },
    {
      href: ROUTES.mechanicInquiries,
      icon: <ChatCircleTextIcon size={22} />,
      title: "Upiti",
      meta: "Poslati upiti i dokle su stigli",
    },
    {
      href: ROUTES.mechanicPriceList,
      icon: <FileXlsIcon size={22} />,
      title: "Cenovnik",
      meta: "Vaše cene za izabrane kategorije, Excel",
    },
  ];
  return (
    <div className="flex flex-col gap-4 sm:gap-5" data-reveal="off">
      <Terms />
      <Reveal as="section" eager index={1} aria-labelledby="po-orders" className="@container panel">
        <div className="flex items-center justify-between gap-3 border-b border-line py-1 pl-4 pr-3 sm:pl-5 sm:pr-4">
          <h2 id="po-orders" className="type-h4 text-ink-1">
            Poslednje porudžbine
          </h2>
          <Link
            href={ROUTES.mechanicOrders}
            variant="standalone"
            className="min-h-11 px-1 type-body-s"
          >
            Sve porudžbine
          </Link>
        </div>
        <RecentOrders />
      </Reveal>
      <nav aria-label="Ostalo u portalu">
        <RevealGroup as="ul" className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {tiles.map((tile, i) => (
            <RevealItem as="li" key={tile.href} eager index={i + 2}>
              <Tile {...tile} />
            </RevealItem>
          ))}
        </RevealGroup>
      </nav>
    </div>
  );
}
