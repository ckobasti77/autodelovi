"use client";

/**
 * Customer account views (ROUTES §B1 `/nalog…`): live Convex subscriptions scoped to the
 * signed-in user (identity never comes from arguments).
 *
 * One panel language (UI-BOOST §7.7): every list is rows inside one `panel`, with the status
 * chip in a fixed column; a view on the first screen is an eager block. On the account
 * overview a list takes a `header` (title + „Sve“) and a `limit`, and its empty state shrinks
 * to one line.
 */
import { useMutation, useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CarIcon,
  ChatCircleTextIcon,
  ReceiptIcon,
  TrashIcon,
  TruckIcon,
} from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate } from "@/lib/format/date";
import { formatRSD } from "@/lib/format/money";
import { normalizePhone } from "@/lib/format/phone";
import { openCartDrawer } from "@/lib/cart/drawer";
import {
  convexErrorMessage,
  DELIVERY_LABEL,
  ERRORS,
  INQUIRY_STATUS_LABEL,
  INQUIRY_STATUS_TONE,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_LABEL,
} from "@/lib/i18n/sr/shop";
import { openVehiclePicker } from "@/lib/vehicle/picker";
import { useSelectedVehicle, useVehicleStore, vehicleFullLabel } from "@/lib/vehicle/store";
import { Reveal } from "@/components/reveal/Reveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Link } from "@/components/ui/Link";
import { RouteLink } from "@/components/ui/RouteLink";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { OrderTimeline } from "@/components/order/OrderTimeline";
import { ROUTES } from "@/constants/routes";

/** Rows of a record list: two lines, one line from 48 rem of panel width. */
const RECORD_ROW =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3.5 sm:px-5";

/** The first row of a panel on the overview: title on the left, „Sve“ on the right. */
export function PanelHeader({
  id,
  title,
  href,
  linkLabel = "Sve",
}: {
  id: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex min-h-13 items-center justify-between gap-3 border-b border-line py-1 pl-4 pr-3 sm:pl-5 sm:pr-4">
      <h2 id={id} className="type-h4 text-ink-1">
        {title}
      </h2>
      {href ? (
        <Link href={href} variant="standalone" className="min-h-11 px-1 type-body-s">
          {linkLabel}
          <span className="sr-only">: {title}</span>
        </Link>
      ) : null}
    </div>
  );
}

function ListSkeleton({ rows = 3, header }: { rows?: number; header?: ReactNode }) {
  return (
    <SkeletonRegion>
      <div className="@container panel">
        {header}
        <div className="flex flex-col divide-y divide-line">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className={RECORD_ROW}>
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-6 w-48 max-w-full" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** Empty list inside an overview panel: one line and the next step. */
function CompactEmpty({ children, action }: { children: ReactNode; action: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-5 sm:px-5">
      <p className="type-body-s text-ink-2">{children}</p>
      {action}
    </div>
  );
}

// ------------------------------------------------------------------ orders

export function OrdersList({ limit, header }: { limit?: number; header?: ReactNode }) {
  const orders = useQuery(api.orders.myOrders, {});
  if (orders === undefined) return <ListSkeleton header={header} />;
  if (orders.length === 0) {
    const action = (
      <Button asChild variant={header ? "quiet" : "primary"} size={header ? "sm" : "md"}>
        <Link href={ROUTES.parts} variant="unstyled">
          Pretražite delove
        </Link>
      </Button>
    );
    return header ? (
      <Reveal eager className="panel">
        {header}
        <CompactEmpty action={action}>Još nemate porudžbina.</CompactEmpty>
      </Reveal>
    ) : (
      <EmptyState align="start" icon={<ReceiptIcon size={40} />} action={action}>
        Još nemate porudžbina.
      </EmptyState>
    );
  }
  const shown = limit ? orders.slice(0, limit) : orders;
  return (
    <Reveal eager className="@container overflow-hidden panel">
      {header}
      <ul className="flex flex-col divide-y divide-line">
        {shown.map((o) => (
          <li key={o.number}>
            <RouteLink
              href={ROUTES.accountOrder(o.number)}
              className={`${RECORD_ROW} group transition-control hover:bg-surface-2 focus-ring-inset @3xl:grid-cols-[10rem_11rem_minmax(0,1fr)_7rem_1.25rem]`}
            >
              <span className="type-code text-ink-1">{o.number}</span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 @max-3xl:row-start-2 @3xl:contents">
                <Badge
                  tone={ORDER_STATUS_TONE[o.status]}
                  size="text"
                  className="justify-self-start"
                >
                  {ORDER_STATUS_LABEL[o.status]}
                </Badge>
                <span className="type-caption font-normal tabular-nums text-ink-3">
                  {formatDate(o.createdAt)} · {o.itemCount} kom.
                </span>
              </span>
              <span className="text-right type-numeral-s tabular-nums text-ink-1 @max-3xl:col-start-2 @max-3xl:row-start-1">
                {formatRSD(o.totalPara)}
              </span>
              <ArrowRightIcon
                size={16}
                aria-hidden="true"
                className="justify-self-end text-ink-3 transition-control group-hover:text-ink-1"
              />
            </RouteLink>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

function DetailSkeleton() {
  return (
    <SkeletonRegion className="grid gap-5 lg:grid-cols-12 lg:gap-x-(--gutter)">
      <div className="panel lg:col-span-7">
        <div className="flex items-center gap-3 border-b border-line px-4 py-4 sm:px-5">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex flex-col divide-y divide-line">
          {[0, 1].map((i) => (
            <div key={i} className="flex justify-between gap-4 px-4 py-3.5 sm:px-5">
              <span className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-56 max-w-full" />
                <Skeleton className="h-3.5 w-32" />
              </span>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t border-line px-4 py-4 sm:px-5">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-7 w-28" />
        </div>
      </div>
      <div className="panel p-5 lg:col-span-5">
        <Skeleton className="h-5 w-36" />
        <div className="mt-5 flex flex-col gap-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-48" />
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** Own order as a record: the items and totals, then its course, delivery and payment. */
export function AccountOrderDetail({ number }: { number: string }) {
  const order = useQuery(api.orders.myOrder, { number });
  const reorder = useMutation(api.orders.reorder);
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  // The same view serves the customer account and the mechanic portal.
  const listHref = pathname.startsWith(ROUTES.mechanicPortal)
    ? ROUTES.mechanicOrders
    : ROUTES.accountOrders;
  const back = (
    <Link
      href={listHref}
      variant="quiet"
      className="inline-flex min-h-11 items-center gap-1.5 self-start type-body-s"
    >
      <ArrowLeftIcon size={14} aria-hidden="true" />
      Sve porudžbine
    </Link>
  );
  if (order === undefined) {
    return (
      <div className="flex flex-col gap-2" data-reveal="off">
        {back}
        <DetailSkeleton />
      </div>
    );
  }
  if (order === null) {
    return (
      <EmptyState
        align="start"
        icon={<ReceiptIcon size={40} />}
        action={
          <Link href={listHref} variant="standalone">
            Sve porudžbine
          </Link>
        }
      >
        Porudžbina nije pronađena.
      </EmptyState>
    );
  }
  const onReorder = async () => {
    setBusy(true);
    try {
      const r = await reorder({ number });
      if (r.unavailable.length) {
        toast.warning(
          `Dodato: ${r.added}. Nije dostupno: ${r.unavailable.map((u) => u.name).join(", ")}.`,
        );
      } else {
        toast.success(`Dodato u korpu: ${r.added}.`, {
          action: { label: "Pogledaj korpu", onClick: openCartDrawer },
        });
      }
      router.refresh();
    } catch (error) {
      toast.error(convexErrorMessage(error, "Stavke nisu dodate. Pokušajte ponovo."));
    } finally {
      setBusy(false);
    }
  };
  const { delivery, payment, totals } = order;
  return (
    <div className="flex flex-col gap-2" data-reveal="off">
      {back}
      <div className="grid gap-5 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <Reveal
          as="section"
          eager
          aria-label="Stavke porudžbine"
          className="panel lg:col-span-7 lg:self-start"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-4 sm:px-5">
            <Badge tone={ORDER_STATUS_TONE[order.status]} size="text">
              {ORDER_STATUS_LABEL[order.status]}
            </Badge>
            <span className="type-caption font-normal tabular-nums text-ink-3">
              Poručeno {formatDate(order.createdAt)}
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-line">
            {order.items.map((i, idx) => (
              <li
                key={idx}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 px-4 py-3.5 sm:px-5"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="type-body-s font-semibold text-ink-1">{i.name}</span>
                  <span className="flex flex-wrap gap-x-3 gap-y-0.5 type-caption font-normal text-ink-3">
                    {i.manufacturerName ? <span>{i.manufacturerName}</span> : null}
                    {i.oem ? <span className="type-code-s">{i.oem}</span> : null}
                    <span className="tabular-nums">
                      {i.quantity} × {formatRSD(i.unitPricePara)}
                    </span>
                  </span>
                </span>
                <span className="type-numeral-s tabular-nums text-ink-1">
                  {formatRSD(i.lineTotalPara)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="flex flex-col gap-1.5 border-t border-line px-4 py-4 type-body-s sm:px-5">
            {totals.deliveryPara > 0 ? (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-2">Artikli</dt>
                  <dd className="tabular-nums text-ink-1">{formatRSD(totals.itemsPara)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-2">Dostava</dt>
                  <dd className="tabular-nums text-ink-1">{formatRSD(totals.deliveryPara)}</dd>
                </div>
              </>
            ) : null}
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-semibold text-ink-1">Ukupno</dt>
              <dd className="type-numeral-m tabular-nums text-ink-1">
                {formatRSD(totals.totalPara)}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-4 sm:px-5">
            <Button
              variant="quiet"
              icon={<ArrowCounterClockwiseIcon size={20} />}
              loading={busy}
              onClick={onReorder}
            >
              Poruči ponovo
            </Button>
            <span className="type-caption font-normal text-ink-3">
              Stavke koje su i dalje u ponudi idu u korpu po današnjoj ceni.
            </span>
          </div>
        </Reveal>
        <div className="flex flex-col gap-5 lg:col-span-5">
          <Reveal as="section" eager index={1} aria-labelledby="od-course" className="panel p-5">
            <h2 id="od-course" className="mb-4 type-h4 text-ink-1">
              Tok porudžbine
            </h2>
            <OrderTimeline
              status={order.status}
              deliveryMethod={delivery.method}
              createdAt={order.createdAt}
              events={order.timeline}
            />
          </Reveal>
          <Reveal as="section" eager index={2} aria-labelledby="od-terms" className="panel p-5">
            <h2 id="od-terms" className="type-h4 text-ink-1">
              Dostava i plaćanje
            </h2>
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2.5">
              <dt className="type-caption text-ink-3">Dostava</dt>
              <dd className="type-body-s text-ink-1">
                {DELIVERY_LABEL[delivery.method]}
                {delivery.address ? (
                  <span className="block text-ink-2">
                    {delivery.address.street}, {delivery.address.postalCode} {delivery.address.city}
                  </span>
                ) : null}
              </dd>
              {delivery.trackingNumber ? (
                <>
                  <dt className="type-caption text-ink-3">Pošiljka</dt>
                  <dd className="flex flex-wrap items-center gap-2 type-body-s text-ink-1">
                    <TruckIcon size={18} aria-hidden="true" className="text-ink-3" />
                    {delivery.courierName ? `${delivery.courierName}: ` : ""}
                    {delivery.trackingUrl ? (
                      <Link href={delivery.trackingUrl} variant="inline">
                        {delivery.trackingNumber}
                      </Link>
                    ) : (
                      <span className="type-code">{delivery.trackingNumber}</span>
                    )}
                  </dd>
                </>
              ) : null}
              <dt className="type-caption text-ink-3">Plaćanje</dt>
              <dd className="type-body-s text-ink-1">
                {PAYMENT_LABEL[payment.method]}
                {payment.status === "paid" ? " · plaćeno" : ""}
                {payment.method === "deferred" &&
                payment.dueAt &&
                payment.status === "unpaid" &&
                order.status !== "otkazana" ? (
                  <span className="block tabular-nums text-ink-2">
                    Rok {formatDate(payment.dueAt)}
                  </span>
                ) : null}
              </dd>
            </dl>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ inquiries

export function InquiriesList({ limit, header }: { limit?: number; header?: ReactNode }) {
  const rows = useQuery(api.inquiries.mine, {});
  if (rows === undefined) return <ListSkeleton header={header} />;
  if (rows.length === 0) {
    const action = (
      <Button asChild variant={header ? "quiet" : "primary"} size={header ? "sm" : "md"}>
        <Link href={ROUTES.inquiry} variant="unstyled">
          Pošaljite upit
        </Link>
      </Button>
    );
    return header ? (
      <Reveal eager index={2} className="panel">
        {header}
        <CompactEmpty action={action}>
          Još niste slali upite. Ne nalazite deo? Pošaljite broj šasije.
        </CompactEmpty>
      </Reveal>
    ) : (
      <EmptyState align="start" icon={<ChatCircleTextIcon size={40} />} action={action}>
        Još niste slali upite. Ne nalazite deo? Pošaljite broj šasije.
      </EmptyState>
    );
  }
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <Reveal eager index={header ? 2 : 0} className="@container panel">
      {header}
      <ul className="flex flex-col divide-y divide-line">
        {shown.map((i) => (
          <li
            key={i.number}
            className={`${RECORD_ROW} items-start @3xl:grid-cols-[10rem_11rem_minmax(0,1fr)_6rem]`}
          >
            <span className="type-code text-ink-1 @3xl:pt-0.5">{i.number}</span>
            <Badge
              tone={INQUIRY_STATUS_TONE[i.status]}
              size="text"
              className="justify-self-start @max-3xl:row-start-2"
            >
              {INQUIRY_STATUS_LABEL[i.status]}
            </Badge>
            <div className="flex min-w-0 flex-col gap-0.5 @max-3xl:col-span-2 @max-3xl:row-start-3">
              <p className="line-clamp-2 type-body-s text-ink-2">{i.message}</p>
              {i.vehicleLabel ? (
                <p className="type-caption font-normal text-ink-3">{i.vehicleLabel}</p>
              ) : null}
            </div>
            <span className="text-right type-caption font-normal tabular-nums text-ink-3 @max-3xl:col-start-2 @max-3xl:row-start-1 @3xl:pt-0.5">
              {formatDate(i.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

// ------------------------------------------------------------------ vehicles

/** The vehicle chosen in the picker, with the way to keep it (or to choose one). */
function SelectedVehicle({ className }: { className?: string }) {
  const add = useMutation(api.account.addSavedVehicle);
  const selected = useSelectedVehicle();
  const [busy, setBusy] = useState(false);

  const saveSelected = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await add({
        brandSlug: selected.brand.slug,
        modelSlug: selected.model.slug,
        ...(selected.generation ? { generationSlug: selected.generation.slug } : {}),
        ...(selected.engine ? { engineSlug: selected.engine.slug } : {}),
      });
      toast.success("Vozilo je sačuvano.");
    } catch (error) {
      toast.error(convexErrorMessage(error, "Vozilo nije sačuvano."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-3 ${className ?? ""}`}>
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center panel-inset text-ink-2"
      >
        <CarIcon size={20} />
      </span>
      {selected ? (
        <>
          <span className="min-w-0 flex-1 basis-40 type-body-s text-ink-1">
            <span className="block type-caption font-normal text-ink-3">Izabrano vozilo</span>
            {vehicleFullLabel(selected)}
          </span>
          <Button
            variant="quiet"
            size="sm"
            loading={busy}
            onClick={saveSelected}
            className="max-lg:h-11"
          >
            Sačuvaj ovo vozilo
          </Button>
        </>
      ) : (
        <>
          <span className="min-w-0 flex-1 basis-40 type-body-s text-ink-2">
            Izaberite vozilo, pa ga sačuvajte za sledeći put.
          </span>
          <Button variant="quiet" size="sm" onClick={openVehiclePicker} className="max-lg:h-11">
            Izaberite vozilo
          </Button>
        </>
      )}
    </div>
  );
}

/** Saved vehicles as rows: choose it in the picker, open its parts, remove it. */
function VehicleRows({ className }: { className?: string }) {
  const rows = useQuery(api.account.savedVehicles, {});
  const remove = useMutation(api.account.removeSavedVehicle);
  const setVehicle = useVehicleStore((s) => s.setVehicle);
  if (rows === undefined) {
    return (
      <SkeletonRegion className={`flex flex-col divide-y divide-line ${className ?? ""}`}>
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
            <Skeleton className="h-5 w-48 max-w-full" />
            <Skeleton className="h-9 w-24" />
          </div>
        ))}
      </SkeletonRegion>
    );
  }
  if (rows.length === 0) {
    return (
      <p className={`px-4 py-4 type-body-s text-ink-2 sm:px-5 ${className ?? ""}`}>
        Nemate sačuvana vozila.
      </p>
    );
  }
  return (
    <ul className={`flex flex-col divide-y divide-line ${className ?? ""}`}>
      {rows.map((v) => {
        const label = [v.brandName, v.generationName ?? v.modelName, v.engineName]
          .filter(Boolean)
          .join(" ");
        const href =
          v.brandSlug && v.modelSlug && v.generationSlug
            ? ROUTES.vehicleGeneration(v.brandSlug, v.modelSlug, v.generationSlug) +
              (v.engineSlug ? `?motor=${v.engineSlug}` : "")
            : null;
        return (
          <li
            key={v.id}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5 pl-4 pr-2 sm:pl-5 sm:pr-3"
          >
            <span className="min-w-0">
              <span className="block type-body-s font-semibold text-ink-1">{v.label ?? label}</span>
              {v.vin || v.plate ? (
                <span className="type-code-s text-ink-3">
                  {[v.vin, v.plate].filter(Boolean).join(" · ")}
                </span>
              ) : null}
            </span>
            <span className="flex items-center gap-2">
              {v.brandSlug && v.modelSlug && v.brandName && v.modelName ? (
                <Button
                  variant="quiet"
                  size="sm"
                  className="max-lg:h-11"
                  onClick={() =>
                    setVehicle({
                      brand: { slug: v.brandSlug!, name: v.brandName! },
                      model: { slug: v.modelSlug!, name: v.modelName! },
                      generation:
                        v.generationSlug && v.generationName && v.generationYears
                          ? {
                              slug: v.generationSlug,
                              name: v.generationName,
                              yearFrom: v.generationYears.from,
                              yearTo: v.generationYears.to,
                            }
                          : null,
                      engine:
                        v.engineSlug && v.engineName
                          ? { slug: v.engineSlug, name: v.engineName, codes: v.engineCodes }
                          : null,
                    })
                  }
                >
                  Izaberi<span className="sr-only"> {v.label ?? label}</span>
                </Button>
              ) : null}
              {href ? (
                <Link href={href} variant="standalone" className="min-h-11 px-1 type-body-s">
                  Delovi<span className="sr-only"> za {v.label ?? label}</span>
                </Link>
              ) : null}
              <IconButton
                label={`Ukloni vozilo ${label}`}
                icon={<TrashIcon size={18} />}
                variant="ghost"
                onClick={() =>
                  remove({ id: v.id as Id<"savedVehicles"> }).catch((e) =>
                    toast.error(convexErrorMessage(e, "Vozilo nije uklonjeno.")),
                  )
                }
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Overview panel: the chosen vehicle on top, the saved ones under it. */
export function SavedVehicles({ header }: { header?: ReactNode }) {
  return (
    <Reveal eager index={1} className="panel">
      {header}
      <SelectedVehicle className="px-4 py-4 sm:px-5" />
      <VehicleRows className="border-t border-line" />
    </Reveal>
  );
}

/** `/nalog/vozila`: the saved vehicles in the wide column, the chosen one beside them. */
export function SavedVehiclesView() {
  return (
    <div className="grid gap-5 lg:grid-cols-12 lg:gap-x-(--gutter)">
      <Reveal as="section" eager aria-labelledby="sv-saved" className="panel lg:col-span-7">
        <PanelHeader id="sv-saved" title="Sačuvana vozila" />
        <VehicleRows />
      </Reveal>
      <Reveal
        as="section"
        eager
        index={1}
        aria-labelledby="sv-current"
        className="self-start panel lg:col-span-5 xl:col-span-4 xl:col-start-9"
      >
        <PanelHeader id="sv-current" title="Vozilo u katalogu" />
        <SelectedVehicle className="px-4 py-4 sm:px-5" />
      </Reveal>
    </div>
  );
}

// ------------------------------------------------------------------ profile

export function ProfileForm({
  initial,
}: {
  initial: { firstName: string; lastName: string; phone: string; email: string };
}) {
  const update = useMutation(api.users.updateMyProfile);
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (v.phone && !normalizePhone(v.phone)) return setError(ERRORS.phone);
    setBusy(true);
    try {
      await update({
        firstName: v.firstName,
        lastName: v.lastName,
        ...(v.phone ? { phone: v.phone } : {}),
      });
      toast.success("Sačuvano.");
    } catch (err) {
      setError(convexErrorMessage(err, "Izmene nisu sačuvane."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Reveal eager className="panel p-4 sm:p-6">
      <form onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2" data-reveal="off">
        <h2 className="type-h4 text-ink-1 sm:col-span-2">Lični podaci</h2>
        <Field label="Ime">
          <Input
            autoComplete="given-name"
            value={v.firstName}
            onChange={(e) => setV({ ...v, firstName: e.target.value })}
          />
        </Field>
        <Field label="Prezime">
          <Input
            autoComplete="family-name"
            value={v.lastName}
            onChange={(e) => setV({ ...v, lastName: e.target.value })}
          />
        </Field>
        <Field label="Telefon" error={error}>
          <Input
            type="tel"
            autoComplete="tel"
            value={v.phone}
            onChange={(e) => setV({ ...v, phone: e.target.value })}
          />
        </Field>
        <Field label="E-pošta" help="Ovom adresom se prijavljujete; za promenu nam se javite.">
          <Input type="email" value={v.email} readOnly />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" loading={busy}>
            Sačuvaj
          </Button>
        </div>
      </form>
    </Reveal>
  );
}
