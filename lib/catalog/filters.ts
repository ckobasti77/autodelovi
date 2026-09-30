/**
 * Catalog filter state ⇄ URL (ARCHITECTURE §G2 „URL state“, ROUTES §B4 canonical rules).
 * Pure and shared by the server page (parsing `searchParams`) and the client filter UI
 * (building the next URL). Parameter names are Serbian and stable:
 *   marka · model · generacija · motor · proizvodjac (slug list) · kvalitet (list) ·
 *   dostupnost=na-stanju · cena=od-do (dinars) · sort · strana
 */

export type Quality = "original" | "oem" | "aftermarket";
export type SortKey = "popular" | "price_asc" | "price_desc" | "new";

export type VehicleSlugs = {
  brand: string;
  model?: string;
  generation?: string;
  engine?: string;
};

export type CatalogFilters = {
  vehicle: VehicleSlugs | null;
  manufacturers: string[];
  qualities: Quality[];
  inStock: boolean;
  /** Dinars (whole). */
  priceMin: number | null;
  priceMax: number | null;
  sort: SortKey;
  page: number;
};

export type SearchParamsInput = Record<string, string | string[] | undefined>;

export const QUALITIES: readonly Quality[] = ["original", "oem", "aftermarket"];

const SORT_PARAM: Readonly<Record<SortKey, string>> = {
  popular: "popularno",
  price_asc: "cena-rastuce",
  price_desc: "cena-opadajuce",
  new: "novo",
};

export const SORT_LABEL: Readonly<Record<SortKey, string>> = {
  popular: "Popularno",
  price_asc: "Cena: od najniže",
  price_desc: "Cena: od najviše",
  new: "Najnovije",
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_LIST = 30;
const MAX_PAGE = 500;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
}

function slug(value: string | string[] | undefined): string | undefined {
  const v = first(value)?.toLowerCase();
  return v && v.length <= 80 && SLUG.test(v) ? v : undefined;
}

function slugList(value: string | string[] | undefined): string[] {
  const raw = first(value);
  if (!raw) return [];
  const out = new Set<string>();
  for (const part of raw.toLowerCase().split(",")) {
    const s = part.trim();
    if (s && s.length <= 80 && SLUG.test(s)) out.add(s);
    if (out.size >= MAX_LIST) break;
  }
  return [...out].sort();
}

function wholeNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[.\s]/g, "");
  if (!/^\d{1,9}$/.test(digits)) return null;
  return Number(digits);
}

export function parseSort(value: string | string[] | undefined): SortKey {
  const v = first(value);
  const hit = (Object.keys(SORT_PARAM) as SortKey[]).find((k) => SORT_PARAM[k] === v);
  return hit ?? "popular";
}

export function parseCatalogFilters(params: SearchParamsInput): CatalogFilters {
  const brand = slug(params.marka);
  const model = brand ? slug(params.model) : undefined;
  const generation = model ? slug(params.generacija) : undefined;
  const engine = generation ? slug(params.motor) : undefined;
  const vehicle: VehicleSlugs | null = brand
    ? {
        brand,
        ...(model ? { model } : {}),
        ...(generation ? { generation } : {}),
        ...(engine ? { engine } : {}),
      }
    : null;

  const qualities = slugList(params.kvalitet).filter((q): q is Quality =>
    (QUALITIES as readonly string[]).includes(q),
  );

  let priceMin: number | null = null;
  let priceMax: number | null = null;
  const price = first(params.cena);
  if (price) {
    const [from, to] = price.split("-");
    priceMin = wholeNumber(from);
    priceMax = wholeNumber(to);
    if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
      [priceMin, priceMax] = [priceMax, priceMin];
    }
  }

  const pageRaw = wholeNumber(first(params.strana));
  const page = pageRaw && pageRaw >= 1 ? Math.min(MAX_PAGE, pageRaw) : 1;

  return {
    vehicle,
    manufacturers: slugList(params.proizvodjac),
    qualities: QUALITIES.filter((q) => qualities.includes(q)),
    inStock: first(params.dostupnost) === "na-stanju",
    priceMin,
    priceMax,
    sort: parseSort(params.sort),
    page,
  };
}

/** Query string for the given state (stable order; defaults omitted). */
export function catalogQuery(f: CatalogFilters): string {
  const p = new URLSearchParams();
  if (f.vehicle) {
    p.set("marka", f.vehicle.brand);
    if (f.vehicle.model) p.set("model", f.vehicle.model);
    if (f.vehicle.generation) p.set("generacija", f.vehicle.generation);
    if (f.vehicle.engine) p.set("motor", f.vehicle.engine);
  }
  if (f.manufacturers.length) p.set("proizvodjac", [...f.manufacturers].sort().join(","));
  if (f.qualities.length) p.set("kvalitet", QUALITIES.filter((q) => f.qualities.includes(q)).join(","));
  if (f.inStock) p.set("dostupnost", "na-stanju");
  if (f.priceMin !== null || f.priceMax !== null) {
    p.set("cena", `${f.priceMin ?? ""}-${f.priceMax ?? ""}`);
  }
  if (f.sort !== "popular") p.set("sort", SORT_PARAM[f.sort]);
  if (f.page > 1) p.set("strana", String(f.page));
  const s = p.toString();
  return s ? `?${s.replace(/%2C/g, ",")}` : "";
}

export function emptyFilters(): CatalogFilters {
  return {
    vehicle: null,
    manufacturers: [],
    qualities: [],
    inStock: false,
    priceMin: null,
    priceMax: null,
    sort: "popular",
    page: 1,
  };
}

/** Number of active filter dimensions (vehicle, manufacturer, quality, availability, price). */
export function filterDimensions(f: CatalogFilters): number {
  return (
    Number(f.vehicle !== null) +
    Number(f.manufacturers.length > 0) +
    Number(f.qualities.length > 0) +
    Number(f.inStock) +
    Number(f.priceMin !== null || f.priceMax !== null)
  );
}

/**
 * Indexing rule for a category listing (ROUTES §B1): the base URL and `?strana=n` are
 * self-canonical and indexable; any filter or sort points the canonical at the base; two or
 * more filter dimensions, or a sort, are `noindex, follow`.
 */
export function listingIndexing(
  basePath: string,
  f: CatalogFilters,
): { canonical: string; index: boolean } {
  const dims = filterDimensions(f);
  if (dims === 0 && f.sort === "popular") {
    return { canonical: f.page > 1 ? `${basePath}?strana=${f.page}` : basePath, index: true };
  }
  return { canonical: basePath, index: dims < 2 && f.sort === "popular" };
}

/** Normalized key for caching a listing (same filters → same key). */
export function filtersKey(f: CatalogFilters): string {
  return catalogQuery(f) || "-";
}
