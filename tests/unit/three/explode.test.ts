import { describe, expect, test } from "vitest";

import { clamp01, power2InOut, progressPerPixel, scrollTargetFor } from "@/lib/three/explode";
import { PAGE_COUNT, pageAt, pageRest, pageReveal } from "@/lib/three/pages";

describe("scroll maths", () => {
  test("power2.inOut is symmetric and clamped at the ends", () => {
    expect(power2InOut(0)).toBe(0);
    expect(power2InOut(1)).toBe(1);
    expect(power2InOut(0.5)).toBeCloseTo(0.5, 6);
    expect(power2InOut(0.25) + power2InOut(0.75)).toBeCloseTo(1, 6);
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
  });

  test("scroll targets are whole pixels inside the track", () => {
    expect(scrollTargetFor(0, 100.4, 2980.4)).toBe(101);
    expect(scrollTargetFor(1, 100, 2980)).toBe(2980);
    expect(scrollTargetFor(0.5, 100, 2980)).toBe(1540);
    expect(scrollTargetFor(-1, 100, 2980)).toBe(100);
    expect(progressPerPixel(100, 2980)).toBeCloseTo(1 / 2880, 9);
  });

  // MOT-03: a target that falls between two pixels is rounded to a whole one. Whatever the
  // browser lands on, the page shown must be the page that was aimed at.
  test.each([
    ["desktop 1440×900, 300vh", 76, 76 + 2700],
    ["phone 390×844, 240vh", 500, 500 + 2026],
    ["phone 360×640, 240vh", 420.5, 420.5 + 1536],
  ])("every page target lands on its own page: %s", (_name, start, end) => {
    const tolerance = progressPerPixel(start, end);
    for (let page = 1; page <= PAGE_COUNT; page += 1) {
      for (const target of [pageRest(page), pageReveal(page)]) {
        const y = scrollTargetFor(target, start, end);
        for (const landed of [y, y + 1]) {
          const p = (landed - start) / (end - start);
          expect(pageAt(p, tolerance), `page ${page} at ${landed}px`).toBe(page);
        }
      }
    }
  });
});
