/**
 * Hero v2 pages (docs/3d/HERO-V2.md §4): the parts leave the car one page at a time and dock in
 * the grid. A page is a run of whole catalog systems in disassembly order, at most 9 slots; a
 * category's page is a property of the category. Pure — no three.js, no DOM; shared by the
 * grid markup, the navigator, the scene and the tests.
 *
 * Progress `p ∈ [0, 1]` is the scroll position inside the hero track:
 *   0 … PAGE_FIRST      the assembled car (it shrinks into its band over DOCK_WINDOW)
 *   PAGE_FIRST … PAGE_LAST   six pages of equal length
 *   PAGE_LAST … 1       the end state
 * Inside a page (`u` = 0 … 1): the previous page leaves over LEAVE, then every part flies for
 * FLIGHT, starts staggered across STAGGER by slot order, and the rest is a plateau.
 */
import {
  CATEGORIES,
  SYSTEMS,
  type SystemSlug,
  type TaxonomyCategory,
} from "@/lib/catalog/taxonomy";
import { clamp01, power2InOut } from "@/lib/three/explode";
import { categoryRevealStage } from "@/lib/three/stages";

export const PAGE_FIRST = 0.06;
export const PAGE_LAST = 0.94;
/** The car moves into its band while the progress crosses this window. */
export const DOCK_WINDOW: readonly [number, number] = [0.01, PAGE_FIRST];

/** Share of a page the previous page takes to leave. */
export const LEAVE = 0.1;
/** Share of a page one part's flight takes. */
export const FLIGHT = 0.3;
/** Share of a page the flight starts are spread over. */
export const STAGGER = 0.18;
/** Where a chip or a slot link lands inside a page (on the plateau). */
export const REST = 0.8;

type PageDef = { systems: SystemSlug[]; filter?: (category: TaxonomyCategory) => boolean };

/** `motor-i-usis` is 13 categories: the ancillaries (manifest stage 4) leave before the core. */
const isAncillary = (c: TaxonomyCategory) => (categoryRevealStage(c.slug) ?? 0) <= 4;

const PAGE_DEFS: readonly PageDef[] = [
  { systems: ["karoserija"] },
  { systems: ["elektrika-i-svetla", "tockovi", "kocnice"] },
  { systems: ["vesanje-i-upravljanje", "hladjenje-i-klima"] },
  { systems: ["motor-i-usis"], filter: isAncillary },
  { systems: ["motor-i-usis"], filter: (c) => !isAncillary(c) },
  { systems: ["transmisija", "izduvni-sistem", "servis"] },
];

export type HeroPage = {
  /** 1 … PAGE_COUNT (0 is the assembled car). */
  page: number;
  systems: readonly SystemSlug[];
  categories: readonly TaxonomyCategory[];
};

export const HERO_PAGES: readonly HeroPage[] = PAGE_DEFS.map((def, index) => ({
  page: index + 1,
  systems: def.systems,
  categories: def.systems.flatMap((system) =>
    CATEGORIES.filter((c) => c.system === system && (def.filter ? def.filter(c) : true)),
  ),
}));

export const PAGE_COUNT = HERO_PAGES.length;
export const PAGE_LENGTH = (PAGE_LAST - PAGE_FIRST) / PAGE_COUNT;
export const SLOT_TOTAL = HERO_PAGES.reduce((n, p) => n + p.categories.length, 0);
/** Most slots any page holds (the grid reserves room for this many). */
export const SLOT_MAX = Math.max(...HERO_PAGES.map((p) => p.categories.length));

export type SlotAddress = { page: number; index: number; count: number };

const ADDRESS = new Map<string, SlotAddress>();
for (const page of HERO_PAGES) {
  page.categories.forEach((c, index) =>
    ADDRESS.set(c.slug, { page: page.page, index, count: page.categories.length }),
  );
}

/** Page and position of a category's slot; undefined for an unknown slug. */
export function slotOf(slug: string): SlotAddress | undefined {
  return ADDRESS.get(slug);
}

/** Pages a system's categories sit on (one, or two for `motor-i-usis`). */
export function pagesOfSystem(system: SystemSlug): number[] {
  return HERO_PAGES.filter((p) => p.systems.includes(system)).map((p) => p.page);
}

/** Systems in navigator order: page by page, as the parts leave the car. */
export const NAV_SYSTEMS: readonly { system: SystemSlug; labelSr: string; pages: number[]; count: number }[] =
  [...new Set(HERO_PAGES.flatMap((p) => p.systems))].map((system) => ({
    system,
    labelSr: SYSTEMS.find((s) => s.slug === system)?.labelSr ?? system,
    pages: pagesOfSystem(system),
    count: CATEGORIES.filter((c) => c.system === system).length,
  }));

export function pageStart(page: number): number {
  return PAGE_FIRST + (page - 1) * PAGE_LENGTH;
}

/** Plateau point of a page: every part docked, nothing leaving yet. */
export function pageRest(page: number): number {
  return pageStart(page) + REST * PAGE_LENGTH;
}

/** The previous page is gone and this page's parts are still on the car. */
export function pageReveal(page: number): number {
  return pageStart(page) + LEAVE * PAGE_LENGTH;
}

/**
 * Page shown at `p`: 0 while the car is assembled, then 1 … PAGE_COUNT (the last page stays
 * through the end state). `tolerance` absorbs the whole-pixel rounding of a scroll target.
 */
export function pageAt(p: number, tolerance = 1e-6): number {
  if (p < PAGE_FIRST - tolerance) return 0;
  return Math.min(PAGE_COUNT, Math.max(1, Math.floor((p - PAGE_FIRST + tolerance) / PAGE_LENGTH) + 1));
}

export function isEnded(p: number, tolerance = 1e-6): boolean {
  return p >= PAGE_LAST - tolerance;
}

/** Progress inside a page, 0 … 1 (clamped). */
export function pageLocal(p: number, page: number): number {
  return clamp01((p - pageStart(page)) / PAGE_LENGTH);
}

/** How far the car has moved into its band (0 assembled … 1 docked), eased. */
export function dockBlend(p: number): number {
  return power2InOut(clamp01((p - DOCK_WINDOW[0]) / (DOCK_WINDOW[1] - DOCK_WINDOW[0])));
}

/** Flight progress of a slot, 0 (on the car) … 1 (seated), before easing. */
export function flightOf(p: number, address: SlotAddress): number {
  const rank = address.count > 1 ? address.index / (address.count - 1) : 0;
  const u = pageLocal(p, address.page);
  const flight = (u - LEAVE - STAGGER * rank) / FLIGHT;
  // Exact ends: a reveal point is „on the car“ and a rest point is „seated“, whatever the
  // floating-point dust of the window arithmetic.
  return flight < 1e-9 ? 0 : flight > 1 - 1e-9 ? 1 : flight;
}

/** How far a page has left the grid, 0 … 1 (eased); the last page never leaves. */
export function leaveOf(p: number, page: number): number {
  if (page >= PAGE_COUNT) return 0;
  return power2InOut(clamp01(pageLocal(p, page + 1) / LEAVE));
}

/** A slot is seated once its flight is complete. */
export function isSeated(p: number, address: SlotAddress): boolean {
  return flightOf(p, address) >= 1;
}

/** Slots seated so far — the „Pronađeno n/44“ counter. */
export function foundCount(p: number): number {
  let found = 0;
  for (const address of ADDRESS.values()) if (isSeated(p, address)) found += 1;
  return found;
}

/** Seated slots of one system at `p`. */
export function foundInSystem(p: number, system: SystemSlug): number {
  let found = 0;
  for (const c of CATEGORIES) {
    if (c.system !== system) continue;
    const address = ADDRESS.get(c.slug);
    if (address && isSeated(p, address)) found += 1;
  }
  return found;
}
