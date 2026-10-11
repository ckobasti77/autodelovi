"use client";

/**
 * Customer account views (ROUTES §B1 `/nalog…`): live Convex subscriptions scoped to the
 * signed-in user (identity never comes from arguments).
 */
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ArrowCounterClockwiseIcon,
  CarIcon,
  ChatCircleTextIcon,
  ReceiptIcon,
  TrashIcon,
} from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate } from "@/lib/format/date";
import { formatRSD } from "@/lib/format/money";
import { normalizePhone } from "@/lib/format/phone";
import { openCartDrawer } from "@/lib/cart/drawer";
import {
  convexErrorMessage,
  ERRORS,
  INQUIRY_STATUS_LABEL,
  INQUIRY_STATUS_TONE,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
} from "@/lib/i18n/sr/shop";
import { openVehiclePicker } from "@/lib/vehicle/picker";
import { useSelectedVehicle, useVehicleStore, vehicleFullLabel } from "@/lib/vehicle/store";
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

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <SkeletonRegion>
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </SkeletonRegion>
  );
}

// ------------------------------------------------------------------ orders

export function OrdersList({ limit }: { limit?: number }) {
  const orders = useQuery(api.orders.myOrders, {});
  if (orders === undefined) return <ListSkeleton />;
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<ReceiptIcon size={40} />}
        action={
          <Button asChild variant="primary">
            <Link href={ROUTES.parts} variant="unstyled">
              Pretražite delove
            </Link>
          </Button>
        }
      >
        Još nemate porudžbina.
      </EmptyState>
    );
  }
  const shown = limit ? orders.slice(0, limit) : orders;
  return (
    <ul className="flex flex-col divide-y divide-line border-y border-line" data-reveal="off">
      {shown.map((o) => (
        <li key={o.number}>
          <RouteLink
            href={ROUTES.accountOrder(o.number)}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-4 transition-control hover:bg-surface-1 sm:grid-cols-[12rem_minmax(0,1fr)_auto_auto] sm:px-2"
          >
            <span className="type-code text-ink-1">{o.number}</span>
            <span className="type-caption font-normal text-ink-3 sm:order-none">
              {formatDate(o.createdAt)} · {o.itemCount} kom.
            </span>
            <Badge tone={ORDER_STATUS_TONE[o.status]} size="text" className="justify-self-start">
              {ORDER_STATUS_LABEL[o.status]}
            </Badge>
            <span className="text-right type-numeral-s tabular-nums text-ink-1">
              {formatRSD(o.totalPara)}
            </span>
          </RouteLink>
        </li>
      ))}
    </ul>
  );
}

export function AccountOrderDetail({ number }: { number: string }) {
  const order = useQuery(api.orders.myOrder, { number });
  const reorder = useMutation(api.orders.reorder);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (order === undefined) return <ListSkeleton rows={4} />;
  if (order === null) {
    return (
      <EmptyState
        icon={<ReceiptIcon size={40} />}
        action={
          <Link href={ROUTES.accountOrders} variant="standalone">
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
  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-(--gutter)" data-reveal="off">
      <div className="flex flex-col gap-6 lg:col-span-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className="type-code-l text-ink-1">{order.number}</span>
          <Badge tone={ORDER_STATUS_TONE[order.status]} size="text">
            {ORDER_STATUS_LABEL[order.status]}
          </Badge>
        </div>
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-4 py-3 type-body-s">
              <span>
                <span className="block text-ink-1">{i.name}</span>
                <span className="type-caption text-ink-3">
                  {i.manufacturerName} · {i.quantity} × {formatRSD(i.unitPricePara)}
                </span>
              </span>
              <span className="tabular-nums text-ink-1">{formatRSD(i.lineTotalPara)}</span>
            </li>
          ))}
        </ul>
        <p className="flex items-baseline justify-between">
          <span className="font-semibold text-ink-1">Ukupno</span>
          <span className="type-numeral-m tabular-nums text-ink-1">
            {formatRSD(order.totals.totalPara)}
          </span>
        </p>
        <Button
          variant="secondary"
          icon={<ArrowCounterClockwiseIcon size={20} />}
          loading={busy}
          onClick={onReorder}
          className="self-start"
        >
          Poruči ponovo
        </Button>
      </div>
      <div className="lg:col-span-5">
        <h2 className="mb-4 type-h3 text-ink-1">Tok porudžbine</h2>
        <OrderTimeline
          status={order.status}
          deliveryMethod={order.delivery.method}
          createdAt={order.createdAt}
          events={order.timeline}
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ inquiries

export function InquiriesList() {
  const rows = useQuery(api.inquiries.mine, {});
  if (rows === undefined) return <ListSkeleton />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<ChatCircleTextIcon size={40} />}
        action={
          <Button asChild variant="primary">
            <Link href={ROUTES.inquiry} variant="unstyled">
              Pošaljite upit
            </Link>
          </Button>
        }
      >
        Još niste slali upite. Ne nalazite deo? Pošaljite broj šasije.
      </EmptyState>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-line border-y border-line" data-reveal="off">
      {rows.map((i) => (
        <li
          key={i.number}
          className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
        >
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-3">
              <span className="type-code text-ink-1">{i.number}</span>
              <Badge tone={INQUIRY_STATUS_TONE[i.status]} size="text">
                {INQUIRY_STATUS_LABEL[i.status]}
              </Badge>
            </p>
            <p className="mt-1 line-clamp-2 type-body-s text-ink-2">{i.message}</p>
            {i.vehicleLabel ? (
              <p className="type-caption font-normal text-ink-3">{i.vehicleLabel}</p>
            ) : null}
          </div>
          <span className="shrink-0 type-caption font-normal tabular-nums text-ink-3">
            {formatDate(i.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ vehicles

export function SavedVehicles() {
  const rows = useQuery(api.account.savedVehicles, {});
  const add = useMutation(api.account.addSavedVehicle);
  const remove = useMutation(api.account.removeSavedVehicle);
  const selected = useSelectedVehicle();
  const setVehicle = useVehicleStore((s) => s.setVehicle);
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
    <div className="flex flex-col gap-6" data-reveal="off">
      <div className="flex flex-wrap items-center gap-3 panel p-4">
        <CarIcon size={20} aria-hidden="true" className="text-ink-3" />
        {selected ? (
          <>
            <span className="type-body-s text-ink-1">Izabrano: {vehicleFullLabel(selected)}</span>
            <Button variant="secondary" size="sm" loading={busy} onClick={saveSelected}>
              Sačuvaj ovo vozilo
            </Button>
          </>
        ) : (
          <>
            <span className="type-body-s text-ink-2">
              Izaberite vozilo, pa ga sačuvajte za sledeći put.
            </span>
            <Button variant="secondary" size="sm" onClick={openVehiclePicker}>
              Izaberite vozilo
            </Button>
          </>
        )}
      </div>
      {rows === undefined ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <p className="type-body text-ink-2">Nemate sačuvana vozila.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
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
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block type-body text-ink-1">{v.label ?? label}</span>
                  {v.vin || v.plate ? (
                    <span className="type-code-s text-ink-3">
                      {[v.vin, v.plate].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2">
                  {v.brandSlug && v.modelSlug && v.brandName && v.modelName ? (
                    <Button
                      variant="ghost"
                      size="sm"
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
                      Izaberi
                    </Button>
                  ) : null}
                  {href ? (
                    <Link href={href} variant="standalone" className="type-body-s">
                      Delovi
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
      )}
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
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid max-w-[40rem] gap-5 sm:grid-cols-2"
      data-reveal="off"
    >
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
  );
}
