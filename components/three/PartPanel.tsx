"use client";

/**
 * Part panel (contract F8, DESIGN-SYSTEM §9.10): right drawer ≥ 1024 px (440 / 480 px, no
 * scrim — the car stays interactive), bottom sheet below (peek 42 % / full 92 %). The drawer,
 * the sheet, their entrance and the drag are `components/ui/Sheet`; this file is what they hold.
 *
 * Data: `catalog.partPanel({ categorySlug, vehicle?, limit: 12 })` — fitting parts first when
 * a vehicle is selected (shared with the header picker), then in stock, role-aware price
 * (mechanics see „Vaša cena“).
 *
 * Rows speak the storefront card's language (§9.7) inside wells (`panel-inset`, 6 px): the
 * 56 px render on its graphite ground, maker · quality, name, OEM in mono, stock as icon and
 * word, fitment, price numerals and a labelled 44 px quiet button („U korpu“ / „Poruči“ /
 * „Pošaljite upit“). The row measures its own width: price over button in a third column from
 * 25 rem (the 480 px drawer, tablets), price left and button right under the facts below that.
 * Footer: all parts of the category (with the vehicle) + inquiry — the panel's one outline.
 * States: loading (6 skeleton rows built from the row's own grid and line boxes), empty (the
 * category's render in a drawing frame, the inquiry as the one primary), error (retry; the
 * inquiry stays in the footer), mismatch notice.
 * Esc / close → the selection clears, the camera returns, focus goes back to where the
 * selection started (parts-list trigger or the stage).
 */
import { useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Component, useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowRightIcon,
  CarIcon,
  CaretDownIcon,
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
import { Link } from "@/components/ui/Link";
import { Price } from "@/components/ui/Price";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { StockBadge } from "@/components/ui/StockBadge";
import { toast } from "@/components/ui/Toast";
import { ProductThumb } from "@/components/catalog/ProductThumb";
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

/**
 * One grid for the row and for its skeleton, so the two cannot drift: a well (6 px) with the
 * render, the facts and — measured on the list, not on the screen — the price and the action
 * either as a third column (≥ 25 rem) or across the row under the facts.
 */
const ROW_GRID =
  "grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 p-3 " +
  "@min-[25rem]:grid-cols-[3.5rem_minmax(0,1fr)_auto]";
const ROW = `${ROW_GRID} panel-inset`;
/** The well's outline without its fill: skeleton bars are surface-2, as the well itself is. */
const ROW_OUTLINE = `${ROW_GRID} rounded-sm border border-line`;
const ROW_ASIDE =
  "col-span-2 flex items-end justify-between gap-3 " +
  "@min-[25rem]:col-span-1 @min-[25rem]:col-start-3 @min-[25rem]:row-start-1 @min-[25rem]:flex-col";
/** A thumbnail ≤ 64 px takes the press radius (§5.3); the well's padding exceeds its own radius. */
const ROW_THUMB = "size-14 rounded-sm";
const ROW_ACTION = "min-w-[7.5rem]";

function FitLine({ fit, vehicle }: { fit: PanelItem["fit"]; vehicle: SelectedVehicle | null }) {
  if (!fit || !vehicle) return null;
  const name = vehicleShortName(vehicle);
  const line = "inline-flex items-start gap-1.5 type-caption";
  const icon = "mt-0.5 shrink-0";
  if (fit === "fits")
    return (
      <span className={cn(line, "text-success")}>
        <CheckCircleIcon size={14} weight="fill" aria-hidden="true" className={icon} />
        {PANEL_COPY.fits(vehicleLabel(vehicle))}
      </span>
    );
  if (fit === "generation_only")
    return (
      <span className={cn(line, "text-warning")}>
        <QuestionIcon size={14} aria-hidden="true" className={icon} />
        {PANEL_COPY.generationOnly(name)}
      </span>
    );
  if (fit === "universal")
    return (
      <span className={cn(line, "text-success")}>
        <CheckCircleIcon size={14} weight="fill" aria-hidden="true" className={icon} />
        {PANEL_COPY.universal}
      </span>
    );
  return (
    <span className={cn(line, "text-ink-3")}>
      <QuestionIcon size={14} aria-hidden="true" className={icon} />
      {PANEL_COPY.unknownFit}
    </span>
  );
}

function ProductRow({ item, vehicle }: { item: PanelItem; vehicle: SelectedVehicle | null }) {
  const { card, yourPricePara } = item;
  const add = useAddToCart("three_d");
  const [state, setState] = useState<"idle" | "busy" | "added">("idle");
  const isPhone = useMediaQuery(MEDIA.mobile);
  const orderable =
    card.stockState === "in_stock" ||
    card.stockState === "low_stock" ||
    (card.stockState === "on_order" && card.allowBackorder) ||
    (card.stockState === "out_of_stock" && card.allowBackorder);
  const backorder = card.stockState === "on_order" || card.stockState === "out_of_stock";

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
  const href = ROUTES.product(card.slug);
  // The visible label starts the accessible name (WCAG 2.5.3); the product tells rows apart.
  const label =
    state === "added" ? PANEL_COPY.added : backorder ? PANEL_COPY.backorder : PANEL_COPY.addShort;
  const priceAlign = "@min-[25rem]:items-end @min-[25rem]:text-right";
  // „Original VAG“ is both a maker and a quality: say it once.
  const quality = QUALITY_LABEL[card.quality];
  const source =
    card.manufacturerName === quality ? quality : `${card.manufacturerName} · ${quality}`;
  return (
    <li data-testid={TEST_IDS.partPanelProduct} className={ROW}>
      {/* The picture opens the product too; the name is the link a keyboard and a reader get. */}
      <Link
        href={href}
        variant="unstyled"
        tabIndex={-1}
        aria-hidden="true"
        className="block self-start"
      >
        <ProductThumb
          imageUrl={card.imageUrl}
          categorySlug={card.categorySlug}
          alt=""
          sizes="56px"
          className={ROW_THUMB}
        />
      </Link>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate type-caption text-ink-3">{source}</span>
        <Link
          href={href}
          variant="unstyled"
          // The hit area is 6 px taller than the text on each side: the 4 px gaps and 2 px of
          // the lines around it, so the OEM number below stays selectable.
          className="-my-1.5 block py-1.5 text-[0.9375rem] font-semibold leading-snug text-ink-1 hover:underline hover:decoration-accent hover:underline-offset-4"
        >
          {/* Up to three lines: the end of a name („…, nova“, the engine code) is what tells
              articles apart. */}
          <span className="line-clamp-3 text-balance">{card.name}</span>
        </Link>
        {card.oemPrimary ? (
          <span className="break-words type-caption text-ink-3">
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
      <div className={ROW_ASIDE}>
        {retail !== null ? (
          yourPricePara !== null && yourPricePara < retail ? (
            <Price
              para={yourPricePara}
              retailPara={retail}
              variant="mechanic"
              size="s"
              className={priceAlign}
            />
          ) : (
            <Price para={yourPricePara ?? retail} size="s" className={priceAlign} />
          )
        ) : (
          <span className="type-caption text-ink-3">{PANEL_COPY.signInForPrice}</span>
        )}
        {orderable ? (
          <Button
            variant="quiet"
            size="md"
            icon={
              state === "added" ? <CheckIcon size={20} /> : <ShoppingCartSimpleIcon size={20} />
            }
            loading={state === "busy"}
            onClick={onAdd}
            aria-label={`${label}: ${card.name}`}
            className={ROW_ACTION}
          >
            {label}
          </Button>
        ) : (
          <Button asChild variant="quiet" size="md" className={ROW_ACTION}>
            <Link
              href={ROUTES.inquiryWith({ proizvod: card.slug })}
              variant="unstyled"
              aria-label={`${PANEL_COPY.inquiry}: ${card.name}`}
            >
              {PANEL_COPY.inquiry}
            </Link>
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * A bar inside the line box of the text it stands in for: the box takes the type style and is
 * one line of it tall, so a skeleton row is as tall as the row that replaces it.
 */
function Line({ type, bar }: { type?: string; bar: string }) {
  return (
    <span className={cn("flex h-[1lh] items-center", type)}>
      <Skeleton className={bar} />
    </span>
  );
}

function SkeletonRow() {
  return (
    <li className={ROW_OUTLINE}>
      <Skeleton className={ROW_THUMB} />
      <span className="flex min-w-0 flex-col gap-1">
        <Line type="type-caption" bar="h-3 w-[42%]" />
        {/* The name: one line where the facts have the row's width, two beside the price column. */}
        <span className="flex h-[1lh] flex-col justify-around text-[0.9375rem] leading-snug @min-[25rem]:h-[2lh]">
          <Skeleton className="h-3.5 w-[88%]" />
          <span className="hidden @min-[25rem]:block">
            <Skeleton className="h-3.5 w-[46%]" />
          </span>
        </span>
        <Line type="type-code" bar="h-3 w-[56%]" />
        <Line type="type-caption" bar="h-3 w-[38%]" />
      </span>
      <span className={ROW_ASIDE}>
        {/* Price: the value sits in a body-sized line, „sa PDV-om“ under it (as `Price` does). */}
        <span className="flex flex-col gap-0.5 @min-[25rem]:items-end">
          <Line bar="h-4 w-16" />
          <Line type="type-caption-s" bar="h-2.5 w-14" />
        </span>
        <Skeleton className={cn("h-11", ROW_ACTION)} />
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------- states

/** Empty and error: what is the matter, in a sentence beside a drawing frame, then one step. */
function PanelNotice({
  figure,
  children,
  actions,
}: {
  figure: ReactNode;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    // Compact on purpose: at the sheet's peek (42 % of a phone) the sentence and the step are
    // both on screen.
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <div
          aria-hidden="true"
          className="corner-ticks flex size-16 shrink-0 items-center justify-center text-ink-3"
        >
          {figure}
        </div>
        <p className="type-body text-ink-2">{children}</p>
      </div>
      <div className="flex flex-wrap gap-3">{actions}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------- list

function PanelList({ slug, onEmpty }: { slug: string; onEmpty: (empty: boolean) => void }) {
  const vehicle = useSelectedVehicle();
  const { filter, pending } = useVehicleFilter(vehicle);
  const data = useQuery(
    api.catalog.products.partPanel,
    pending ? "skip" : { categorySlug: slug, vehicle: filter, limit: 12 },
  );
  const empty = data !== undefined && (data === null || data.items.length === 0);
  // The footer drops its inquiry button while the list shows the same step as its primary.
  useEffect(() => {
    onEmpty(empty);
  }, [empty, onEmpty]);

  if (data === undefined) {
    return (
      <SkeletonRegion label={PANEL_COPY.loading}>
        <ul className="@container flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonRow key={i} />
          ))}
        </ul>
      </SkeletonRegion>
    );
  }

  if (data === null || data.items.length === 0) {
    return (
      <PanelNotice
        figure={
          <ProductThumb
            imageUrl={null}
            categorySlug={slug}
            alt=""
            sizes="44px"
            className="size-11 rounded-xs"
          />
        }
        actions={
          <Button asChild variant="primary">
            <Link href={ROUTES.inquiryWith({ deo: slug })} variant="unstyled">
              {PANEL_COPY.inquiry}
            </Link>
          </Button>
        }
      >
        {vehicle ? PANEL_COPY.emptyForVehicle(vehicleShortName(vehicle)) : PANEL_COPY.empty}
      </PanelNotice>
    );
  }

  const shownUnmatched = data.items.filter((i) => i.fit === "unknown").length;
  return (
    <>
      {vehicle && shownUnmatched > 0 && shownUnmatched < data.items.length ? (
        <p className="mb-3 flex items-start gap-2 rounded-sm bg-warning-subtle px-3 py-2.5 type-caption text-warning">
          <WarningIcon size={16} aria-hidden="true" className="mt-px shrink-0" />
          {PANEL_COPY.mismatch(countSr(data.unmatched, ARTICLE_FORMS))}
        </p>
      ) : null}
      <ul
        className="@container flex flex-col gap-2"
        aria-label={PANEL_COPY.listLabel(data.category.name)}
      >
        {data.items.map((item) => (
          <ProductRow key={item.card._id} item={item} vehicle={vehicle} />
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
        <PanelNotice
          figure={<WarningIcon size={28} />}
          actions={
            <Button
              variant="quiet"
              onClick={() => this.setState((s) => ({ error: false, attempt: s.attempt + 1 }))}
            >
              {PANEL_COPY.retry}
            </Button>
          }
        >
          {PANEL_COPY.error}
        </PanelNotice>
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
  const count = slug ? counts?.get(slug) : undefined;
  const total = count?.productCount;
  // Which category the list reported as empty (a new selection starts as „not empty“).
  const [emptySlug, setEmptySlug] = useState<string | null>(null);
  const empty = slug !== null && emptySlug === slug;
  const reportEmpty = useCallback(
    (isEmpty: boolean) => setEmptySlug(isEmpty ? slug : null),
    [slug],
  );

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
        <div className="flex flex-col gap-2.5 pt-1.5">
          {/* The line is there from the first frame, so the count never pushes the chip down. */}
          <p
            className="flex min-h-[1lh] items-center type-code-s uppercase text-ink-3"
            data-reveal="off"
          >
            {total !== undefined ? (
              <>
                {countSr(total, ARTICLE_FORMS)}
                {count && count.inStockCount > 0
                  ? ` · ${PANEL_COPY.inStock(count.inStockCount)}`
                  : ""}
              </>
            ) : (
              <Skeleton className="h-2.5 w-28" />
            )}
          </p>
          {/* A field-like chip, the same family as the header's: filled, quiet edge; the chosen
              vehicle is orange-tinted (yours). 44 px on touch screens, 40 px in the drawer. */}
          <button
            type="button"
            onClick={openVehiclePicker}
            className={cn(
              "inline-flex h-11 max-w-full cursor-pointer items-center gap-2 rounded-sm border px-3 type-button-s text-ink-1 transition-control lg:h-10 lg:self-start",
              vehicle
                ? "border-accent-edge bg-accent-subtle"
                : "border-line-strong bg-surface-2 shadow-rest hover:border-ink-4 hover:bg-surface-4",
            )}
          >
            <CarIcon size={18} aria-hidden="true" className="shrink-0 text-ink-2" />
            <span className="min-w-0 flex-1 truncate text-left">
              {vehicle ? vehicleLabel(vehicle) : PANEL_COPY.chooseVehicle}
            </span>
            {vehicle ? <span className="sr-only">. {PANEL_COPY.changeVehicle}</span> : null}
            <CaretDownIcon size={14} aria-hidden="true" className="shrink-0 text-ink-3" />
          </button>
        </div>
      }
      footer={
        slug ? (
          <>
            <Link
              href={categoryHref(slug, vehicle)}
              variant="standalone"
              icon={<ArrowRightIcon size={16} />}
              className="min-h-11 w-full justify-between"
            >
              <span className="min-w-0">
                {PANEL_COPY.allParts}: {category?.labelSr}
                {total !== undefined ? ` (${total})` : ""}
              </span>
            </Link>
            {empty ? null : (
              <Button asChild variant="secondary" fullWidth>
                <Link href={ROUTES.inquiryWith({ deo: slug })} variant="unstyled">
                  {PANEL_COPY.inquiry}
                </Link>
              </Button>
            )}
          </>
        ) : null
      }
    >
      <span id="part-panel-live" className="sr-only" role="status" aria-live="polite" />
      {slug ? (
        <PanelErrorBoundary key={slug}>
          <PanelList slug={slug} onEmpty={reportEmpty} />
        </PanelErrorBoundary>
      ) : null}
    </Sheet>
  );
}
