/**
 * Explode choreography maths shared by the 3D scene, the stage UI and the tests
 * (docs/3D-CONTRACT.md §F3, §F6; DESIGN-SYSTEM §7.7). Pure — no three.js, no DOM.
 *
 * Progress `p ∈ [0, 1]` is the scroll position inside the hero track. Every part moves from
 * its pivot along `dir × distance` with `power2.inOut` inside its stage window, staggered by
 * `order` (≤ 35 % of the window). Mobile runs the grouped stages sequentially inside their
 * shared window — first stage over the first 55 %, second over the last 55 % (D78) — exactly
 * the timeline the Blender collision checks use (`3d/blender/lib/views.py`).
 */
import { STAGES, type TaxonomyStage } from "@/lib/catalog/taxonomy";

export type Timeline = "desktop" | "mobile";
export type StageWindow = readonly [number, number];

/** Last stage index (stages are 0 … 7; 0 is the assembled hold). */
export const LAST_STAGE = 7;

/** The exploded hold starts here on both timelines (contract F6: 0.92–1.00). */
export const HOLD_EXPLODED = 0.92;

/** Camera dolly + orbit window (contract F6). */
export const CAMERA_WINDOW: StageWindow = [0.08, 0.92];

/** X-ray shell fades during stage 1 (contract F6): 0.22 → 0.10. */
export const SHELL_FADE_STAGE = 1;

type StageLike = Pick<TaxonomyStage, "stage" | "scroll">;

/**
 * Effective window of every animated stage (1 … 7) on a timeline. Stages that share a mobile
 * window run one after the other (first over [a, a + 0.55·w], second over [a + 0.45·w, b]).
 */
export function stageWindows(
  timeline: Timeline,
  stages: readonly StageLike[] = STAGES,
): Map<number, StageWindow> {
  const out = new Map<number, StageWindow>();
  const animated = stages.filter((s) => s.stage > 0);
  if (timeline === "desktop") {
    for (const s of animated) out.set(s.stage, [s.scroll.desktop[0], s.scroll.desktop[1]]);
    return out;
  }
  const groups = new Map<string, number[]>();
  for (const s of animated) {
    const key = `${s.scroll.mobile[0]}|${s.scroll.mobile[1]}`;
    groups.set(key, [...(groups.get(key) ?? []), s.stage]);
  }
  for (const [key, members] of groups) {
    const [a, b] = key.split("|").map(Number) as [number, number];
    members.sort((x, y) => x - y);
    if (members.length === 1) {
      out.set(members[0], [a, b]);
      continue;
    }
    const w = b - a;
    out.set(members[0], [a, a + 0.55 * w]);
    out.set(members[1], [a + 0.45 * w, b]);
  }
  return out;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** GSAP `power2.inOut` (the contract's explode ease). */
export function power2InOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** Local progress (before easing) of a part with stagger `order` inside `window` at `p`. */
export function localProgress(p: number, window: StageWindow, order: number): number {
  const [s, e] = window;
  const u = clamp01((p - s) / (e - s));
  return clamp01((u - 0.35 * order) / 0.65);
}

/** Eased explode factor 0 … 1 of a part (multiplies `dir × distance`). */
export function partFactor(p: number, window: StageWindow, order: number): number {
  return power2InOut(localProgress(p, window, order));
}

/**
 * Where a part's motion sits on the 0 … 1 timeline: start and duration of its tween
 * (the GSAP timeline places one `power2.inOut` tween per part at exactly this slot).
 */
export function partSlot(window: StageWindow, order: number): { start: number; duration: number } {
  const [s, e] = window;
  return { start: s + 0.35 * order * (e - s), duration: 0.65 * (e - s) };
}

/**
 * Stage shown by the stage index and caption at `p`: the first stage that has not finished
 * yet (0 while the assembled car is held, 7 through the exploded hold). Windows overlap, so
 * „the latest stage that started“ would label the end of stage 1 as stage 2 — landing on a
 * stage's end must show that stage. Boundaries are hard cuts (DS §7.7).
 *
 * `tolerance` is how far past a stage's end still counts as that stage. The scroll position is
 * a whole (device) pixel, so a stage end that falls between two pixels can land up to one
 * pixel late (MOT-03: 0.46 → 1325.8 px → 1326 px → p 0.460069 → „04“); pass one scroll pixel
 * in progress units (`progressPerPixel`) so a detent always names the stage it was aimed at.
 */
export function currentStage(
  p: number,
  windows: Map<number, StageWindow>,
  tolerance = 1e-6,
): number {
  const first = windows.get(1);
  if (!first || p < first[0] + 1e-6) return 0;
  const ordered = [...windows.entries()].sort((a, b) => a[0] - b[0]);
  for (const [k, [, end]] of ordered) {
    if (p <= end + tolerance) return k;
  }
  return ordered[ordered.length - 1]?.[0] ?? 0;
}

/** One scroll pixel in progress units for a track scrolled from `start` to `end` (px). */
export function progressPerPixel(start: number, end: number): number {
  return 1 / Math.max(1, end - start);
}

/**
 * Whole-pixel scroll position for progress `p` on a track scrolled from `start` to `end`.
 * Rounded down: a fractional target is rounded by the browser (usually up), which would land a
 * stage-end detent one pixel inside the next stage; one pixel early stays inside the stage
 * (windows are hundreds of pixels long). Never before `start` (progress 0 stays 0).
 */
export function scrollTargetFor(p: number, start: number, end: number): number {
  const exact = start + clamp01(p) * (end - start);
  return Math.max(Math.ceil(start), Math.floor(exact));
}

/** Progress at which a stage is fully exploded (deep links and the stage index jump here). */
export function stageEnd(stage: number, windows: Map<number, StageWindow>): number {
  if (stage <= 0) return 0;
  const w = windows.get(stage);
  return w ? w[1] : 0;
}

/** Progress inside the current stage window (0 … 1), for the index bar. */
export function stageLocal(p: number, stage: number, windows: Map<number, StageWindow>): number {
  if (stage <= 0) {
    const first = windows.get(1);
    return first ? clamp01(p / first[0]) : 0;
  }
  const w = windows.get(stage);
  return w ? clamp01((p - w[0]) / (w[1] - w[0])) : 0;
}

/**
 * Camera blend 0 → 1 between the hero and exploded cameras across 0.08–0.92 (contract F6).
 * power2.out: the dolly leads the explode, so the body panels that leave first (stage 1) stay
 * inside the stage instead of sliding under the copy column while the camera is still close.
 */
export function cameraBlend(p: number): number {
  const t = clamp01((p - CAMERA_WINDOW[0]) / (CAMERA_WINDOW[1] - CAMERA_WINDOW[0]));
  return 1 - (1 - t) * (1 - t);
}

/** Shell base alpha during stage 1 (0.22 → 0.10), eased like the parts. */
export function shellFade(p: number, windows: Map<number, StageWindow>): number {
  const w = windows.get(SHELL_FADE_STAGE);
  if (!w) return 0;
  return power2InOut(clamp01((p - w[0]) / (w[1] - w[0])));
}
