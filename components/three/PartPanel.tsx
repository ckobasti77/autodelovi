"use client";

/**
 * Part panel (contract F8, DESIGN-SYSTEM §9.10): right drawer ≥ 1024 px (440 / 480 px, no
 * scrim — the car stays interactive), bottom sheet below (peek 42 % / full 92 %).
 *
 * Data: `catalog.partPanel({ categorySlug, vehicle?, limit: 12 })` — fitting parts first when
 * a vehicle is selected (shared with the header picker), then in stock, role-aware price
 * (mechanics see „Vaša cena“). Rows: thumb, maker · quality, name, OEM, stock, fitment,
 * price, add to cart. Footer: all parts of the category (with the vehicle) + inquiry.
 * States: loading (6 skeleton rows), empty (inquiry), error (retry), mismatch notice.
 * Esc / close → the selection clears, the camera returns, focus goes back to where the
 * selection started (parts-list trigger or the stage).
 */
import { useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Component, useState, type ReactNode } from "react";
import {
  ArrowRightIcon,
  CarIcon,
  CheckCircleIcon,
  CheckIcon,
  QuestionIcon,
  ShoppingCartSimpleIcon,
  WarningIcon,
} from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/cn";
import { findCategory } from "@/lib/catalog/taxonomy";
import { PART_NOTES } from "@/lib/catalog/partNotes";
import { countSr } from "@/lib/format/plural";
import { ARTICLE_FORMS, QUALITY_LABEL, leadTimeLabel, stockStatusOf } from "@/lib/i18n/sr/catalog";
import { PANEL_COPY } from "@/lib/i18n/sr/hero";
import { useAddToCart } from "@/lib/cart/guestCart";
import { openVehiclePicker } from "@/lib/vehicle/picker";
import {
  useSelectedVehicle,
  vehicleLabel,
  vehicleShortName,
  type SelectedVehicle,
} from "@/lib/vehicle/store";
import { useVehicleFilter } from "@/lib/vehicle/useVehicleFilter";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Link } from "@/components/ui/Link";
import { Price } from "@/components/ui/Price";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { StockBadge } from "@/components/ui/StockBadge";
import { toast } from "@/components/ui/Toast";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { MEDIA } from "@/constants/motion";
import { clearSelection, heroStore, useHeroStore } from "@/components/three/heroStore";
import { heroDom } from "@/components/three/heroDom";
import { useCategoryCounts } from "@/components/three/useCategoryCounts";

type PanelData = NonNullable<ReturnType<typeof useQuery<typeof api.catalog.products.partPanel>>>;
type PanelItem = PanelData["items"][number];

function categoryHref(slug: string, vehicle: SelectedVehicle | null): string {
  const params = new URLSearchParams();
  if (vehicle) {
    params.set("marka", vehicle.brand.slug);
    params.set("model", vehicle.model.slug);
    if (vehicle.generation) params.set("generacija", vehicle.generation.slug);
    if (vehicle.engine) params.set("motor", vehicle.engine.slug);
  }
  const query = params.toString();
  return query ? `${ROUTES.category(slug)}?${query}` : ROUTES.category(slug);
}

// ---------------------------------------------------------------------------- rows

function FitLine({ fit, vehicle }: { fit: PanelItem["fit"]; vehicle: SelectedVehicle | null }) {
  if (!fit || !vehicle) return null;
  const name = vehicleShortName(vehicle);
  if (fit === "fits")
    return (
      <span className="inline-flex items-center gap-1.5 type-caption text-success">
        <CheckCircleIcon size={14} weight="fill" aria-hidden="true" />
        {PANEL_COPY.fits(vehicleLabel(vehicle))}
      </span>
    );
  if (fit === "generation_only")
    return (
      <span className="inline-flex items-center gap-1.5 type-caption text-warning">
        <QuestionIcon size={14} aria-hidden="true" />
        {PANEL_COPY.generationOnly(name)}
      </span>
    );
  if (fit === "universal")
    return (
      <span className="inline-flex items-center gap-1.5 type-caption text-success">
        <CheckCircleIcon size={14} weight="fill" aria-hidden="true" />
        {PANEL_COPY.universal}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 type-caption text-ink-3">
      <QuestionIcon size={14} aria-hidden="true" />
      {PANEL_COPY.unknownFit}
    </span>
  );
}

function ProductRow({
  item,
  vehicle,
  thumbnail,
}: {
  item: PanelItem;
  vehicle: SelectedVehicle | null;
  thumbnail: string;
}) {
  const { card, yourPricePara } = item;
  const add = useAddToCart("three_d");
  const [state, setState] = useState<"idle" | "busy" | "added">("idle");
  const isPhone = useMediaQuery(MEDIA.mobile);
  const orderable =
    card.stockState === "in_stock" ||
    card.stockState === "low_stock" ||
    (card.stockState === "on_order" && card.allowBackorder) ||
    (card.stockState === "out_of_stock" && card.allowBackorder);

  const onAdd = async () => {
    if (state === "busy") return;
    setState("busy");
    try {
      await add(card._id as Id<"products">, 1);
      setState("added");
      const region = document.getElementById("part-panel-live");
      if (region) region.textContent = PANEL_COPY.addedToast(card.name);
      if (isPhone) {
        toast.success(PANEL_COPY.addedToast(card.name), {
          action: { label: PANEL_COPY.viewCart, href: ROUTES.cart },
        });
      }
      window.setTimeout(() => setState("idle"), 1600);
    } catch (error) {
      setState("idle");
      const data = error instanceof ConvexError ? (error.data as { message?: unknown }) : null;
      toast.error(
        typeof data?.message === "string"
          ? data.message
          : "Artikal trenutno ne može u korpu. Pokušajte ponovo ili nas pozovite.",
      );
    }
  };

  const retail = card.retailPricePara;
  return (
    <li
      data-testid={TEST_IDS.partPanelProduct}
      className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b border-line py-3 last:border-b-0"
    >
      <div className="relative size-14 overflow-hidden rounded-xs bg-[radial-gradient(circle_at_50%_40%,var(--color-surface-2),var(--color-surface-1))]">
        {/* eslint-disable-next-line @next/next/no-img-element -- Convex storage URL or a 768 px category render shown at 56 px */}
        <img
          src={card.imageUrl ?? thumbnail}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-contain p-1"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate type-caption text-ink-3">
          {card.manufacturerName} · {QUALITY_LABEL[card.quality]}
        </span>
        <Link
          href={ROUTES.product(card.slug)}
          variant="unstyled"
          // Two lines: the end of a name („…, nova“, the engine code) is what tells articles apart.
          className="line-clamp-2 text-[0.9375rem] font-semibold leading-snug text-ink-1 hover:underline hover:decoration-accent hover:underline-offset-4"
        >
          {card.name}
        </Link>
        {card.oemPrimary ? (
          <span className="truncate type-caption text-ink-3">
            OEM <span className="type-code text-ink-2">{card.oemPrimary}</span>
          </span>
        ) : null}
        <StockBadge
          status={stockStatusOf(card.stockState)}
          quantity={card.stockQty}
          leadTime={leadTimeLabel(card.leadTimeDays)}
        />
        <FitLine fit={item.fit} vehicle={vehicle} />
      </div>
      <div className="flex flex-col items-end justify-between gap-2">
        {retail !== null ? (
          yourPricePara !== null && yourPricePara < retail ? (
            <Price para={yourPricePara} retailPara={retail} variant="mechanic" size="s" align="end" />
          ) : (
            <Price para={yourPricePara ?? retail} size="s" align="end" />
          )
        ) : (
          <span className="type-caption text-ink-3">{PANEL_COPY.signInForPrice}</span>
        )}
        {orderable ? (
          <IconButton
            variant="quiet"
            label={`${card.stockState === "on_order" || card.stockState === "out_of_stock" ? PANEL_COPY.backorder : PANEL_COPY.addToCart}: ${card.name}`}
            icon={
              state === "added" ? (
                <CheckIcon size={20} className="text-success" />
              ) : (
                <ShoppingCartSimpleIcon size={20} />
              )
            }
            loading={state === "busy"}
            onClick={onAdd}
          />
        ) : (
          <Link
            href={ROUTES.inquiryWith({ proizvod: card.slug })}
            variant="quiet"
            className="type-caption"
          >
            {PANEL_COPY.inquiry}
          </Link>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------- list

function PanelList({ slug }: { slug: string }) {
  const vehicle = useSelectedVehicle();
  const { filter, pending } = useVehicleFilter(vehicle);
  const data = useQuery(
    api.catalog.products.partPanel,
    pending ? "skip" : { categorySlug: slug, vehicle: filter, limit: 12 },
  );
  const thumbnail = `/images/parts/${slug}.webp`;

  if (data === undefined) {
    return (
      <SkeletonRegion label={PANEL_COPY.loading}>
        <ul className="flex flex-col">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="grid grid-cols-[3.5rem_1fr_4.5rem] gap-3 border-b border-line py-3">
              <Skeleton className="size-14" />
              <span className="flex flex-col gap-2 pt-1">
                <Skeleton className="h-3 w-[40%]" />
                <Skeleton className="h-3.5 w-[85%]" />
                <Skeleton className="h-3 w-[55%]" />
              </span>
              <span className="flex flex-col items-end gap-2 pt-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="size-11" />
              </span>
            </li>
          ))}
        </ul>
      </SkeletonRegion>
    );
  }

  if (data === null || data.items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 py-6">
        <p className="type-body text-ink-2">
          {vehicle ? PANEL_COPY.emptyForVehicle(vehicleShortName(vehicle)) : PANEL_COPY.empty}
        </p>
        <Button asChild variant="primary">
          <Link href={ROUTES.inquiryWith({ deo: slug })} variant="unstyled">
            {PANEL_COPY.inquiry}
          </Link>
        </Button>
      </div>
    );
  }

  const shownUnmatched = data.items.filter((i) => i.fit === "unknown").length;
  return (
    <>
      {vehicle && shownUnmatched > 0 && shownUnmatched < data.items.length ? (
        <p className="mb-2 flex items-start gap-2 rounded-xs bg-warning-subtle px-3 py-2 type-caption text-warning">
          <WarningIcon size={16} aria-hidden="true" className="mt-px shrink-0" />
          {PANEL_COPY.mismatch(countSr(data.unmatched, ARTICLE_FORMS))}
        </p>
      ) : null}
      <ul className="flex flex-col" aria-label={`Artikli: ${data.category.name}`}>
        {data.items.map((item) => (
          <ProductRow key={item.card._id} item={item} vehicle={vehicle} thumbnail={thumbnail} />
        ))}
      </ul>
    </>
  );
}

class PanelErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean; attempt: number }
> {
  state = { error: false, attempt: 0 };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-start gap-3 py-6">
          <p className="type-body text-ink-2">{PANEL_COPY.error}</p>
          <Button
            variant="secondary"
            onClick={() => this.setState((s) => ({ error: false, attempt: s.attempt + 1 }))}
          >
            {PANEL_COPY.retry}
          </Button>
        </div>
      );
    }
    return <div key={this.state.attempt}>{this.props.children}</div>;
  }
}

// ---------------------------------------------------------------------------- panel

export function PartPanel() {
  const selected = useHeroStore((s) => s.selected);
  const slug = useHeroStore((s) => s.panelSlug);
  const vehicle = useSelectedVehicle();
  const counts = useCategoryCounts(slug !== null);
  const category = slug ? findCategory(slug) : undefined;
  const total = slug ? counts?.get(slug)?.productCount : undefined;

  // From the list (keyboard) focus goes to the first control; a click on the car or a deep link
  // moves focus to the panel itself, without a ring on a random control.
  const onOpenAutoFocus = (event: Event) => {
    if (heroStore.getState().panelSource === "list") return;
    event.preventDefault();
    (event.currentTarget as HTMLElement | null)?.focus({ preventScroll: true });
  };

  const onCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    const source = heroStore.getState().panelSource;
    const target = source === "list" ? heroDom.listTrigger : heroDom.stage;
    target?.focus({ preventScroll: true });
  };

  return (
    <Sheet
      open={selected !== null}
      onOpenChange={(open) => {
        if (!open) clearSelection();
      }}
      modal={false}
      size="md"
      side="responsive"
      initialSnap="peek"
      belowHeader
      testId={TEST_IDS.partPanel}
      onOpenAutoFocus={onOpenAutoFocus}
      onCloseAutoFocus={onCloseAutoFocus}
      title={<span className="type-display-m">{category?.labelSr ?? ""}</span>}
      description={slug ? PART_NOTES[slug] : undefined}
      header={
        <div className="flex flex-col gap-2 pt-1">
          {total !== undefined ? (
            <span className="type-code-s uppercase text-ink-3" data-reveal="off">
              {countSr(total, ARTICLE_FORMS)}
            </span>
          ) : null}
          <button
            type="button"
            onClick={openVehiclePicker}
            className={cn(
              "inline-flex h-9 max-w-full cursor-pointer items-center gap-2 self-start rounded-xs border px-3 type-button-s transition-control",
              vehicle
                ? "border-accent-edge bg-accent-subtle text-ink-1"
                : "border-control text-ink-1 hover:border-ink-3 hover:bg-surface-4",
            )}
          >
            <CarIcon size={18} aria-hidden="true" />
            <span className="truncate">
              {vehicle ? vehicleLabel(vehicle) : PANEL_COPY.chooseVehicle}
            </span>
            {vehicle ? <span className="sr-only">. {PANEL_COPY.changeVehicle}</span> : null}
          </button>
        </div>
      }
      footer={
        slug ? (
          <>
            <Link
              href={categoryHref(slug, vehicle)}
              variant="standalone"
              icon={<ArrowRightIcon size={14} />}
              className="w-full justify-between"
            >
              {PANEL_COPY.allParts}: {category?.labelSr}
              {total !== undefined ? ` (${total})` : ""}
            </Link>
            <Button asChild variant="secondary" fullWidth>
              <Link href={ROUTES.inquiryWith({ deo: slug })} variant="unstyled">
                {PANEL_COPY.inquiry}
              </Link>
            </Button>
          </>
        ) : null
      }
    >
      <span id="part-panel-live" className="sr-only" role="status" aria-live="polite" />
      {slug ? (
        <PanelErrorBoundary key={slug}>
          <PanelList slug={slug} />
        </PanelErrorBoundary>
      ) : null}
    </Sheet>
  );
}
