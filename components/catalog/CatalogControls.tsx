"use client";

/**
 * Category filters, sort and applied chips (§9.6, ARCHITECTURE §G2 URL state). Every change
 * becomes a URL (`router.replace`, no scroll); the server renders the new listing. Desktop:
 * a sticky 280 px rail; phones: „Filteri (n)“ opens a bottom sheet with the same groups and
 * a sticky „Prikaži n rezultata“.
 */
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  CarIcon,
  CaretDownIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import {
  catalogQuery,
  filterDimensions,
  SORT_LABEL,
  type CatalogFilters,
  type Quality,
  type SortKey,
} from "@/lib/catalog/filters";
import { formatNumber } from "@/lib/format/number";
import { countSr, pluralSr } from "@/lib/format/plural";
import { QUALITY_LABEL } from "@/lib/i18n/sr/catalog";
import { openVehiclePicker } from "@/lib/vehicle/picker";
import { useSelectedVehicle, useVehicleStore, vehicleFullLabel } from "@/lib/vehicle/store";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";

export type FacetOption = { slug: string; name: string; count: number };

export type CatalogFacets = {
  manufacturers: FacetOption[];
  qualities: { quality: Quality; count: number }[];
  inStockCount: number;
  allCount: number;
  price: { minDinars: number; maxDinars: number } | null;
};

type Ctx = { pending: boolean; navigate: (next: CatalogFilters) => void };
const CatalogContext = createContext<Ctx | null>(null);

function useCatalog(): Ctx {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("CatalogControls must be inside <CatalogShell>");
  return ctx;
}

const QUALITY_HELP: Readonly<Record<Quality, string>> = {
  original: "Deo u pakovanju proizvođača vozila.",
  oem: "Proizvođač koji isti deo isporučuje fabrici, u svom pakovanju.",
  aftermarket: "Zamenski deo drugog proizvođača, obično povoljniji.",
};

/** Provides navigation + pending state to the controls and dims the results while loading. */
export function CatalogShell({
  children,
  navigateBase,
}: {
  children: ReactNode;
  /** Path filters navigate to (landings hand over to the category URL). */
  navigateBase?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const base = navigateBase ?? pathname;
  const navigate = (next: CatalogFilters) => {
    const href = `${base}${catalogQuery(next)}`;
    start(() => (base === pathname ? router.replace(href, { scroll: false }) : router.push(href)));
  };
  return (
    <CatalogContext.Provider value={{ pending, navigate }}>{children}</CatalogContext.Provider>
  );
}

export function CatalogResults({ children }: { children: ReactNode }) {
  const { pending } = useCatalog();
  return (
    <div
      aria-busy={pending || undefined}
      className={cn("transition-opacity duration-150", pending && "opacity-55")}
    >
      {children}
    </div>
  );
}

// ------------------------------------------------------------------------------ groups

function Group({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line py-2 last:border-b-0">
      <h2 className="type-body-s font-semibold text-ink-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="group/title flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xs text-left"
        >
          {title}
          <CaretDownIcon
            size={16}
            aria-hidden="true"
            className={cn(
              "text-ink-3 transition-[color,rotate] duration-200 group-hover/title:text-ink-1",
              open && "rotate-180",
            )}
          />
        </button>
      </h2>
      <div hidden={!open} className="pb-2">
        {children}
      </div>
    </div>
  );
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function VehicleGroup({
  filters,
  vehicleLabel,
}: {
  filters: CatalogFilters;
  vehicleLabel: string | null;
}) {
  const { navigate } = useCatalog();
  const stored = useSelectedVehicle();
  if (filters.vehicle) {
    return (
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center gap-2 rounded-sm border border-accent bg-accent-subtle py-1 pl-3 pr-1">
          <CarIcon size={18} aria-hidden="true" className="shrink-0 text-ink-2" />
          <span className="min-w-0 flex-1 truncate type-body-s font-semibold text-ink-1">
            {vehicleLabel ?? filters.vehicle.brand}
          </span>
          <button
            type="button"
            aria-label="Prikaži za sva vozila"
            onClick={() => navigate({ ...filters, vehicle: null, page: 1 })}
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-sm text-ink-2 transition-control hover:bg-surface-2 hover:text-ink-1"
          >
            <XIcon size={16} aria-hidden="true" />
          </button>
        </div>
        <Button variant="ghost" size="sm" onClick={openVehiclePicker} className="self-start">
          Promeni vozilo
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 pt-1">
      {stored ? (
        <Button
          variant="quiet"
          size="md"
          icon={<CarIcon size={20} />}
          onClick={() =>
            navigate({
              ...filters,
              page: 1,
              vehicle: {
                brand: stored.brand.slug,
                model: stored.model.slug,
                ...(stored.generation ? { generation: stored.generation.slug } : {}),
                ...(stored.engine ? { engine: stored.engine.slug } : {}),
              },
            })
          }
          className="justify-start text-left"
        >
          <span className="truncate">Samo za {vehicleFullLabel(stored)}</span>
        </Button>
      ) : null}
      <Button
        variant="secondary"
        size="md"
        icon={<CarIcon size={20} />}
        onClick={openVehiclePicker}
      >
        {stored ? "Drugo vozilo" : "Izaberite vozilo"}
      </Button>
    </div>
  );
}

function ManufacturerGroup({
  filters,
  options,
}: {
  filters: CatalogFilters;
  options: FacetOption[];
}) {
  const { navigate } = useCatalog();
  const [all, setAll] = useState(false);
  const visible = all ? options : options.slice(0, 8);
  if (options.length === 0) {
    return (
      <p className="py-2 type-caption font-normal text-ink-3">Nema proizvođača za ovaj izbor.</p>
    );
  }
  return (
    <div className="flex flex-col">
      {visible.map((m) => (
        <Checkbox
          key={m.slug}
          label={m.name}
          meta={formatNumber(m.count)}
          checked={filters.manufacturers.includes(m.slug)}
          onCheckedChange={() =>
            navigate({ ...filters, page: 1, manufacturers: toggle(filters.manufacturers, m.slug) })
          }
        />
      ))}
      {options.length > 8 ? (
        <Button variant="ghost" size="sm" onClick={() => setAll((a) => !a)} className="self-start">
          {all ? "Prikaži manje" : `Prikaži još ${options.length - 8}`}
        </Button>
      ) : null}
    </div>
  );
}

function PriceGroup({
  filters,
  range,
}: {
  filters: CatalogFilters;
  range: CatalogFacets["price"];
}) {
  const { navigate } = useCatalog();
  const [min, setMin] = useState(filters.priceMin?.toString() ?? "");
  const [max, setMax] = useState(filters.priceMax?.toString() ?? "");
  const apply = () => {
    const parse = (v: string) => {
      const n = Number(v.replace(/[.\s]/g, ""));
      return v.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
    };
    navigate({ ...filters, page: 1, priceMin: parse(min), priceMax: parse(max) });
  };
  return (
    <form
      className="flex flex-col gap-3 pt-1"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5 type-caption text-ink-2">
          Od
          <Input
            inputMode="numeric"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            placeholder={range ? formatNumber(range.minDinars) : "0"}
            suffix="RSD"
            aria-label="Cena od, u dinarima"
          />
        </label>
        <label className="flex flex-col gap-1.5 type-caption text-ink-2">
          Do
          <Input
            inputMode="numeric"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder={range ? formatNumber(range.maxDinars) : ""}
            suffix="RSD"
            aria-label="Cena do, u dinarima"
          />
        </label>
      </div>
      <Button type="submit" variant="secondary" size="sm" className="self-start">
        Primeni cenu
      </Button>
    </form>
  );
}

function FilterGroups({
  filters,
  facets,
  vehicleLabel,
}: {
  filters: CatalogFilters;
  facets: CatalogFacets;
  vehicleLabel: string | null;
}) {
  const { navigate } = useCatalog();
  const qualityCount = (q: Quality) => facets.qualities.find((x) => x.quality === q)?.count ?? 0;
  return (
    <div className="flex flex-col" data-reveal="off">
      <Group title="Vozilo">
        <VehicleGroup filters={filters} vehicleLabel={vehicleLabel} />
      </Group>
      <Group title="Dostupnost">
        <Checkbox
          label="Samo na stanju"
          meta={formatNumber(facets.inStockCount)}
          checked={filters.inStock}
          disabled={facets.inStockCount === 0 && !filters.inStock}
          onCheckedChange={() => navigate({ ...filters, page: 1, inStock: !filters.inStock })}
        />
      </Group>
      <Group title="Proizvođač">
        <ManufacturerGroup filters={filters} options={facets.manufacturers} />
      </Group>
      <Group title="Kvalitet">
        {(["original", "oem", "aftermarket"] as const).map((q) => (
          <Checkbox
            key={q}
            label={QUALITY_LABEL[q]}
            meta={formatNumber(qualityCount(q))}
            description={QUALITY_HELP[q]}
            checked={filters.qualities.includes(q)}
            disabled={qualityCount(q) === 0 && !filters.qualities.includes(q)}
            onCheckedChange={() =>
              navigate({ ...filters, page: 1, qualities: toggle(filters.qualities, q) })
            }
          />
        ))}
      </Group>
      {facets.price ? (
        <Group title="Cena" defaultOpen={filters.priceMin !== null || filters.priceMax !== null}>
          <PriceGroup filters={filters} range={facets.price} />
        </Group>
      ) : null}
    </div>
  );
}

/**
 * Desktop rail (≥ 1024 px), sticky under the header (§9.6, VIS-08). Taller than the viewport
 * with every group open, so it scrolls on its own (contained, no scroll chaining to the page);
 * the 4 px inline padding keeps the focus rings of full-width rows inside the scrollport.
 */
export function FilterRail(props: {
  filters: CatalogFilters;
  facets: CatalogFacets;
  vehicleLabel: string | null;
}) {
  return (
    <aside
      aria-label="Filteri"
      className="hidden lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:-mx-1 lg:block lg:max-h-[calc(100dvh-var(--header-h)-3rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:px-1 lg:py-1 lg:[scrollbar-width:thin]"
    >
      <div className="panel px-4 py-1">
        <FilterGroups {...props} />
      </div>
    </aside>
  );
}

/** Toolbar: count, sort, mobile filter button, applied chips. */
export function CatalogToolbar({
  filters,
  facets,
  total,
  vehicleLabel,
  manufacturerNames,
}: {
  filters: CatalogFilters;
  facets: CatalogFacets;
  total: number;
  vehicleLabel: string | null;
  manufacturerNames: Record<string, string>;
}) {
  const { navigate, pending } = useCatalog();
  const [sheet, setSheet] = useState(false);
  const dims = filterDimensions(filters);
  const chips: { key: string; label: string; next: CatalogFilters }[] = [];
  if (filters.vehicle)
    chips.push({
      key: "vehicle",
      label: vehicleLabel ?? filters.vehicle.brand,
      next: { ...filters, vehicle: null, page: 1 },
    });
  if (filters.inStock)
    chips.push({ key: "stock", label: "Na stanju", next: { ...filters, inStock: false, page: 1 } });
  for (const slug of filters.manufacturers)
    chips.push({
      key: `m-${slug}`,
      label: manufacturerNames[slug] ?? slug,
      next: { ...filters, manufacturers: filters.manufacturers.filter((m) => m !== slug), page: 1 },
    });
  for (const q of filters.qualities)
    chips.push({
      key: `q-${q}`,
      label: QUALITY_LABEL[q],
      next: { ...filters, qualities: filters.qualities.filter((x) => x !== q), page: 1 },
    });
  if (filters.priceMin !== null || filters.priceMax !== null)
    chips.push({
      key: "price",
      label: `${filters.priceMin !== null ? formatNumber(filters.priceMin) : "0"}–${filters.priceMax !== null ? formatNumber(filters.priceMax) : "…"} RSD`,
      next: { ...filters, priceMin: null, priceMax: null, page: 1 },
    });

  const reset: CatalogFilters = {
    ...filters,
    vehicle: null,
    manufacturers: [],
    qualities: [],
    inStock: false,
    priceMin: null,
    priceMax: null,
    page: 1,
  };

  return (
    // Phones and tablets: the [Filteri (n)] [Sortiraj] row sticks under the header on one line
    // (§10.2, FLOW-11, D261); the count sits above it. The wrapper is `display: contents` there,
    // so the row's sticky range is the whole results column, not this short wrapper. Desktop:
    // count left, sort right, chips below (grid).
    <div
      className="contents lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-3"
      data-reveal="off"
    >
      <p className="type-body-s text-ink-2 max-lg:sr-only" role="status" aria-live="polite">
        <span className="font-semibold tabular-nums text-ink-1">{formatNumber(total)}</span>{" "}
        {pluralSr(total, ["artikal", "artikla", "artikala"])}
        {pending ? <span className="sr-only"> — učitava se</span> : null}
      </p>
      <div className="sticky top-header z-sticky -mx-page -mt-2 flex items-center gap-3 border-b border-line bg-bg/95 px-page py-2 backdrop-blur-header reduced-transparency:bg-bg reduced-transparency:backdrop-blur-none sm:justify-between lg:static lg:mx-0 lg:mt-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <Sheet
          open={sheet}
          onOpenChange={setSheet}
          side="bottom"
          initialSnap="full"
          title="Filteri"
          trigger={
            <Button
              variant="secondary"
              size="md"
              icon={<SlidersHorizontalIcon size={20} />}
              className="shrink-0 lg:hidden"
            >
              Filteri{dims > 0 ? ` (${dims})` : ""}
            </Button>
          }
          footer={
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => navigate(reset)} disabled={dims === 0}>
                Poništi
              </Button>
              <Button variant="primary" fullWidth onClick={() => setSheet(false)} loading={pending}>
                Prikaži {countSr(total, ["rezultat", "rezultata", "rezultata"])}
              </Button>
            </div>
          }
        >
          <FilterGroups filters={filters} facets={facets} vehicleLabel={vehicleLabel} />
        </Sheet>
        {/* The same count for sighted phone users; the status paragraph above announces it. */}
        <p aria-hidden="true" className="order-last shrink-0 type-caption text-ink-3 lg:hidden">
          <span className="font-semibold tabular-nums text-ink-1">{formatNumber(total)}</span>{" "}
          {pluralSr(total, ["artikal", "artikla", "artikala"])}
        </p>
        <label className="flex min-w-0 flex-1 items-center gap-2 type-caption text-ink-2 sm:flex-none">
          <span className="hidden sm:inline">Sortiraj</span>
          <Select
            aria-label="Sortiraj"
            size="md"
            className="min-w-0 sm:w-auto sm:min-w-[11.5rem]"
            value={filters.sort}
            onChange={(e) => navigate({ ...filters, page: 1, sort: e.target.value as SortKey })}
            options={(Object.keys(SORT_LABEL) as SortKey[]).map((k) => ({
              value: k,
              label: SORT_LABEL[k],
            }))}
          />
        </label>
      </div>
      {chips.length > 0 ? (
        <ul
          className="flex flex-wrap items-center gap-2 lg:col-span-2"
          aria-label="Primenjeni filteri"
        >
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={() => navigate(chip.next)}
                aria-label={`Ukloni filter: ${chip.label}`}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xs bg-surface-2 px-2.5 type-caption text-ink-1 transition-control hover:bg-surface-3"
              >
                {chip.label}
                <XIcon size={14} aria-hidden="true" className="text-ink-3" />
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => navigate(reset)}
              className="inline-flex h-8 cursor-pointer items-center px-1 type-caption font-semibold text-ink-2 underline decoration-line-strong underline-offset-4 transition-control hover:text-ink-1 hover:decoration-accent"
            >
              Poništi sve
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Vehicle ⇄ URL: when the visitor picks or clears a vehicle in the shared picker while on a
 * catalog page, the listing follows (the stored vehicle never redirects on arrival).
 */
export function VehicleUrlSync({ filters }: { filters: CatalogFilters }) {
  const { navigate } = useCatalog();
  const latest = useRef(filters);
  useEffect(() => {
    latest.current = filters;
  }, [filters]);
  useEffect(() => {
    return useVehicleStore.subscribe((state, prev) => {
      if (!prev.hydrated || state.vehicle === prev.vehicle) return;
      const v = state.vehicle;
      navigate({
        ...latest.current,
        page: 1,
        vehicle: v
          ? {
              brand: v.brand.slug,
              model: v.model.slug,
              ...(v.generation ? { generation: v.generation.slug } : {}),
              ...(v.engine ? { engine: v.engine.slug } : {}),
            }
          : null,
      });
    });
    // navigate is stable enough for this subscription (router + pathname of this page).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
