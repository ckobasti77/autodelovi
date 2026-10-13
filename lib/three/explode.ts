/**
 * Scroll maths shared by the hero's scene, its overlays and the tests. Pure — no three.js, no
 * DOM. Progress `p ∈ [0, 1]` is the scroll position inside the hero track; what happens along
 * it is defined by the pages of the parts grid (`lib/three/pages.ts`, docs/3d/HERO-V2.md §4).
 *
 * The manifest still carries the old per-stage explode (direction, distance, stage, order —
 * contract F3/F6). The grid uses the direction and the distance for the lift leg of a part's
 * flight; `explodeFactor` in `lib/three/manifest.ts` keeps the contract's formula testable.
 */

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** GSAP `power2.inOut` (every leg of a part's flight). */
export function power2InOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** One scroll pixel in progress units for a track scrolled from `start` to `end` (px). */
export function progressPerPixel(start: number, end: number): number {
  return 1 / Math.max(1, end - start);
}

/**
 * Whole-pixel scroll position for progress `p` on a track scrolled from `start` to `end`.
 * Rounded down: a fractional target is rounded by the browser (usually up), which could land a
 * target one pixel inside the next page; one pixel early stays inside the page (pages are
 * hundreds of pixels long). Never before `start` (progress 0 stays 0).
 */
export function scrollTargetFor(p: number, start: number, end: number): number {
  const exact = start + clamp01(p) * (end - start);
  return Math.max(Math.ceil(start), Math.floor(exact));
}
