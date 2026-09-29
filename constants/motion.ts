/**
 * Motion tokens — personality „Instrument“ (DESIGN-SYSTEM §8): rigid metal, 0 % overshoot,
 * decisive deceleration. Mirrors the CSS variables in app/globals.css (`--ease-sk-*`,
 * `--dur-*`). GSAP reads durations in seconds.
 */

/** Durations in milliseconds (CSS) — see `DUR` for GSAP seconds. */
export const DURATION_MS = {
  instant: 80,
  quick: 140,
  base: 220,
  panel: 360,
  panelExit: 240,
  stage: 600,
  camera: 900,
  reveal: 620,
} as const;

export type DurationToken = keyof typeof DURATION_MS;

/** Durations in seconds for GSAP. */
export const DUR: { readonly [K in DurationToken]: number } = Object.freeze(
  Object.fromEntries(Object.entries(DURATION_MS).map(([key, ms]) => [key, ms / 1000])) as {
    [K in DurationToken]: number;
  },
);

/** Cubic-bezier control points; registered as GSAP CustomEases in lib/gsap/client.ts. */
export const EASE_CURVES = {
  "sk.out": "0.16,1,0.3,1",
  "sk.inOut": "0.65,0,0.35,1",
  "sk.in": "0.55,0,1,0.45",
  "sk.snap": "0.2,0,0,1",
} as const;

export type EaseName = keyof typeof EASE_CURVES;

/** Ease names for GSAP tweens (strings resolve after registration). */
export const EASE = {
  out: "sk.out",
  inOut: "sk.inOut",
  in: "sk.in",
  snap: "sk.snap",
  /** 3D explode, per node (3D contract). */
  explode: "power2.inOut",
  /** Camera glide (3D contract). */
  camera: "power3.inOut",
  /** Scrubbed timelines: the scroll is the ease. */
  scrub: "none",
} as const;

/** Enter distances in px (§8.3). */
export const DISTANCE = {
  ui: 8,
  toast: 16,
  panel: 24,
} as const;

/** Stagger limits (§8.4): ≤ 30 ms per item, ≤ 360 ms in total. */
export const STAGGER = {
  eachMax: 0.03,
  totalMax: 0.36,
} as const;

/** Bottom sheet physics (§8.5). */
export const SHEET = {
  peek: 0.42,
  full: 0.92,
  dismissBelow: 0.25,
  flickVelocity: 800,
  resistance: 0.55,
} as const;

export const MEDIA = {
  reducedMotion: "(prefers-reduced-motion: reduce)",
  motionOk: "(prefers-reduced-motion: no-preference)",
  desktop: "(min-width: 64rem)",
  mobile: "(max-width: 63.999rem)",
} as const;
