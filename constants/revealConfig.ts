/**
 * Site-wide reveal — the trigger line and the block reveal (DESIGN-SYSTEM §8.6, §8.8).
 *
 * One engine (components/TextRevealGlobal) reveals copy word by word and everything else as
 * blocks: cards, images, CTA blocks, form groups, list rows, tables. Both use the same line,
 * the same boot class, failsafe and pending state. Copy selectors and word timings live in
 * constants/textRevealConfig.ts; this file holds what the two share and what blocks add.
 */
import { DURATION_MS } from "@/constants/motion";

/**
 * The trigger line, as a fraction of the viewport height above the bottom edge. An element
 * reveals when its vertical centre crosses it (ScrollTrigger `start: "center 82%"`).
 *
 * The owner's rule is 0.15, with leave to go higher where the entrance happens too low to be
 * noticed. Chosen by looking at frames of the category page and the reveal lab at 390 × 844 and
 * 1440 × 900 for 0.15, 0.18 and 0.22 (`scripts/qa/ui-boost/reveal-frames.mjs --line=…`,
 * docs/design/UI-BOOST.md §5.2):
 * - phones: the action bar covers the bottom 60 px, so 0.15 of the screen is only 67 px above
 *   what is visible — a line of copy or a 46 px row started right on top of the bar. At 0.18 the
 *   line is 92 px clear of it (11 % of the visible height, close to the 15 % the owner meant).
 * - desktop: a 454 px product card stays hidden until 355 px of it are on screen at 0.15, 387 px
 *   at 0.18 and 410 px at 0.22 — every step up widens the empty band under the grid, so no
 *   higher than the phones need.
 */
export const REVEAL_LINE = 0.18;

/**
 * Elements taller than this share of the viewport reveal when their top crosses the line
 * instead of their centre, so a tall block never sits hidden while it is on screen.
 */
export const REVEAL_TALL_RATIO = 0.6;

export type BlockTone = "default" | "lite";

export const BLOCK_REVEAL = {
  /** One block: opacity 0 → 1 and a short lift, `sk.out` (`--dur-rise`). */
  default: {
    durationMs: DURATION_MS.rise,
    liftPx: 16,
    /** Lift on narrow screens (distance, not duration, is reduced on phones — §8.2). */
    liftNarrowPx: 12,
    /** Gap between items of one batch… */
    stepMs: 60,
    /** …shrunk so the last item starts at most this long after the first (batch ≈ 700 ms). */
    budgetMs: 180,
  },
  /**
   * Dense work surfaces (admin, `data-reveal-tone="lite"`): opacity only. Nothing moves, so a
   * control is where it will stay from the frame it appears (D272, D331).
   */
  lite: {
    durationMs: 320,
    stepMs: 30,
    budgetMs: 150,
  },
  /**
   * Above the fold (`data-reveal-eager`): pure CSS from the first paint, starting from a
   * visible frame — the element is never at opacity 0, so it can be the LCP element.
   */
  eager: {
    durationMs: 480,
    fromOpacity: 0.4,
    liftPx: 10,
    stepMs: 50,
    /** Highest delay an eager item may carry. */
    budgetMs: 200,
  },
  /** Opacity only (wide tables, panels where a lift would read as a layout jump). */
  fade: { durationMs: 360 },
  /** Media features under which the lift uses `liftNarrowPx`. */
  narrowMedia: "(max-width: 47.99rem)",
  attrs: {
    /** On a container: its `data-reveal="item"` children reveal as one staggered batch. */
    group: "data-reveal-group",
    /** On a block or a group child: CSS-only entrance on load, never hidden. */
    eager: "data-reveal-eager",
    /** On an ancestor: `lite` selects the lighter timings. */
    tone: "data-reveal-tone",
    /** On a block: `fade` drops the lift. */
    variant: "data-reveal-variant",
  },
  /** Custom property carrying the stagger delay of one item (set by the engine or the server). */
  delayVar: "--rv-d",
  /** `data-reveal-mode` values of a running block (`block` is the text block fade). */
  modes: { rise: "rise", fade: "fade" },
} as const;

/**
 * Everything that moves as one block: marked elements, and the marked items of a group.
 *
 * Items carry `data-reveal="item"` themselves (`RevealItem`). A selector that ended in
 * `[data-reveal-group] > *` has a universal subject: any rule built on it that also depends on
 * a class of <html> (`tr-js`, `tr-failsafe`) makes the browser restyle the whole document each
 * time such a class changes — measured as two extra full-document style passes per load (D330).
 */
export const blockSelector = `[data-reveal="block"], [${BLOCK_REVEAL.attrs.group}] > [data-reveal="item"]`;

/**
 * The blocks the stylesheet hides and the engine reveals: outermost block targets that are
 * not eager and not opted out. No `:has()`, so the rule stays cheap for the life of the page.
 */
export const blockHiddenSelector =
  `:is(${blockSelector})` +
  `:not([${BLOCK_REVEAL.attrs.eager}], [data-reveal="off"], [hidden], script, style, template, noscript)` +
  `:not(:is(${blockSelector}) *)`;

/** Eager blocks (CSS-only): marked blocks and marked group children. */
export const eagerSelector = `:is(${blockSelector})[${BLOCK_REVEAL.attrs.eager}]`;

/** Delay of item `index` in a batch of `count` (ms): `stepMs` apart, capped by `budgetMs`. */
export function staggerDelayMs(
  index: number,
  count: number,
  timing: { stepMs: number; budgetMs: number },
): number {
  if (index <= 0 || count <= 1) return 0;
  const step = Math.min(timing.stepMs, timing.budgetMs / (count - 1));
  return Math.round(Math.min(index, count - 1) * step);
}
