import { describe, expect, test } from "vitest";

import { CATEGORIES, SYSTEMS } from "@/lib/catalog/taxonomy";
import {
  FLIGHT,
  HERO_PAGES,
  LEAVE,
  NAV_SYSTEMS,
  PAGE_COUNT,
  PAGE_FIRST,
  PAGE_LAST,
  PAGE_LENGTH,
  REST,
  SLOT_MAX,
  SLOT_TOTAL,
  STAGGER,
  dockBlend,
  flightOf,
  foundCount,
  foundInSystem,
  isEnded,
  isSeated,
  leaveOf,
  pageAt,
  pageLocal,
  pageRest,
  pageReveal,
  pageStart,
  pagesOfSystem,
  slotOf,
} from "@/lib/three/pages";
import { categoryRevealStage } from "@/lib/three/stages";

describe("pages of the parts grid (HERO-V2 §4.1)", () => {
  test("six pages hold every category exactly once", () => {
    expect(PAGE_COUNT).toBe(6);
    const slugs = HERO_PAGES.flatMap((p) => p.categories.map((c) => c.slug));
    expect(slugs.length).toBe(CATEGORIES.length);
    expect(new Set(slugs).size).toBe(CATEGORIES.length);
    expect(SLOT_TOTAL).toBe(44);
    expect(HERO_PAGES.map((p) => p.categories.length)).toEqual([7, 9, 8, 6, 7, 7]);
  });

  test("a page never holds more than nine slots (two labelled rows of five; three of three)", () => {
    expect(SLOT_MAX).toBeLessThanOrEqual(9);
    for (const page of HERO_PAGES) expect(page.categories.length).toBeGreaterThan(0);
  });

  test("pages are whole systems; only the engine spans two", () => {
    for (const system of SYSTEMS) {
      const pages = pagesOfSystem(system.slug);
      expect(pages.length, system.slug).toBe(system.slug === "motor-i-usis" ? 2 : 1);
    }
    expect(pagesOfSystem("motor-i-usis")).toEqual([4, 5]);
    for (const page of HERO_PAGES) {
      for (const c of page.categories) expect(page.systems).toContain(c.system);
    }
  });

  test("pages follow the disassembly order", () => {
    // The battery and the three sensors dock with their system, earlier than the manifest
    // stage of some of their nodes (HERO-V2 §4.1); everything else leaves in stage order.
    const early = new Set(["akumulator", "senzori"]);
    let previous = 0;
    for (const page of HERO_PAGES) {
      const stages = page.categories
        .filter((c) => c.instances.length > 0 && !early.has(c.slug))
        .map((c) => categoryRevealStage(c.slug) ?? 0);
      if (stages.length === 0) continue;
      expect(Math.min(...stages), `page ${page.page}`).toBeGreaterThanOrEqual(previous);
      previous = Math.min(...stages);
    }
  });

  test("the navigator lists the ten systems with their counts", () => {
    expect(NAV_SYSTEMS.length).toBe(10);
    expect(NAV_SYSTEMS.reduce((n, s) => n + s.count, 0)).toBe(44);
    expect(NAV_SYSTEMS[0].system).toBe("karoserija");
    expect(NAV_SYSTEMS[NAV_SYSTEMS.length - 1].system).toBe("servis");
  });

  test("every slot has an address", () => {
    for (const c of CATEGORIES) {
      const address = slotOf(c.slug);
      expect(address, c.slug).toBeDefined();
      expect(address!.index).toBeLessThan(address!.count);
    }
    expect(slotOf("nepostojeci")).toBeUndefined();
  });
});

describe("the clock (HERO-V2 §4.2)", () => {
  test("pages tile the track between the assembled car and the end state", () => {
    expect(pageStart(1)).toBe(PAGE_FIRST);
    expect(pageStart(PAGE_COUNT) + PAGE_LENGTH).toBeCloseTo(PAGE_LAST, 9);
    expect(pageAt(0)).toBe(0);
    expect(pageAt(PAGE_FIRST - 0.001)).toBe(0);
    for (let page = 1; page <= PAGE_COUNT; page += 1) {
      expect(pageAt(pageStart(page))).toBe(page);
      expect(pageAt(pageRest(page))).toBe(page);
      expect(pageAt(pageStart(page) + PAGE_LENGTH - 1e-4)).toBe(page);
    }
    expect(pageAt(1)).toBe(PAGE_COUNT);
    expect(isEnded(PAGE_LAST - 0.01)).toBe(false);
    expect(isEnded(PAGE_LAST)).toBe(true);
    expect(isEnded(1)).toBe(true);
  });

  test("the car is docked before the first part moves", () => {
    expect(dockBlend(0)).toBe(0);
    expect(dockBlend(PAGE_FIRST)).toBe(1);
    expect(dockBlend(1)).toBe(1);
  });

  test("leave, flights and the plateau fit in a page, in that order", () => {
    expect(LEAVE + STAGGER + FLIGHT).toBeLessThan(REST);
    expect(REST).toBeLessThan(1);
  });

  test("at a page's rest point everything on it is seated and the page before is gone", () => {
    let total = 0;
    for (const page of HERO_PAGES) {
      const p = pageRest(page.page);
      for (const c of page.categories) expect(isSeated(p, slotOf(c.slug)!), c.slug).toBe(true);
      if (page.page > 1) expect(leaveOf(p, page.page - 1)).toBe(1);
      expect(leaveOf(p, page.page)).toBe(0);
      total += page.categories.length;
      expect(foundCount(p)).toBe(total);
    }
    expect(foundCount(0)).toBe(0);
    expect(foundCount(1)).toBe(44);
  });

  test("at a page's reveal point its parts are still on the car and the page before is gone", () => {
    for (const page of HERO_PAGES) {
      const p = pageReveal(page.page);
      for (const c of page.categories) expect(flightOf(p, slotOf(c.slug)!), c.slug).toBe(0);
      if (page.page > 1) expect(leaveOf(p, page.page - 1)).toBe(1);
    }
  });

  test("flights are staggered in slot order and never run backwards", () => {
    for (const page of HERO_PAGES) {
      const addresses = page.categories.map((c) => slotOf(c.slug)!);
      const mid = pageStart(page.page) + (LEAVE + STAGGER / 2 + FLIGHT / 2) * PAGE_LENGTH;
      const flights = addresses.map((a) => flightOf(mid, a));
      for (let i = 1; i < flights.length; i += 1) expect(flights[i]).toBeLessThanOrEqual(flights[i - 1]);
    }
    const address = slotOf("kocioni-diskovi")!;
    let last = 0;
    for (let p = 0; p <= 1.0001; p += 0.002) {
      const f = flightOf(p, address);
      expect(f).toBeGreaterThanOrEqual(last);
      last = f;
    }
    expect(last).toBe(1);
  });

  test("the counter only grows with the scroll, and counts per system add up", () => {
    let last = 0;
    for (let p = 0; p <= 1.0001; p += 0.001) {
      const found = foundCount(p);
      expect(found).toBeGreaterThanOrEqual(last);
      last = found;
    }
    for (const p of [0.2, 0.47, 0.71, 1]) {
      const bySystem = SYSTEMS.reduce((n, s) => n + foundInSystem(p, s.slug), 0);
      expect(bySystem).toBe(foundCount(p));
    }
  });

  test("progress inside a page is clamped", () => {
    expect(pageLocal(0, 3)).toBe(0);
    expect(pageLocal(1, 3)).toBe(1);
    expect(pageLocal(pageStart(3) + PAGE_LENGTH / 2, 3)).toBeCloseTo(0.5, 9);
  });
});
