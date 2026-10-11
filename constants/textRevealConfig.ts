/**
 * Site-wide text reveal — the single configuration (DESIGN-SYSTEM §8.6, text-reveal skill).
 *
 * The same selector strings drive BOTH the inline stylesheet that hides copy before first
 * paint (lib/textRevealCss.ts) and the observer that reveals it (components/TextRevealGlobal),
 * so anything the CSS hides is guaranteed to be found by the JS. Change selectors only here.
 *
 * The trigger line and the block reveal (cards, images, groups) are in constants/revealConfig.ts;
 * copy inside a block arrives with its block, so block targets are skipped here.
 */
import { REVEAL_LINE, blockSelector } from "@/constants/revealConfig";

/** Elements that carry copy. */
export const copySelectors = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "li",
  "dt",
  "dd",
  "blockquote",
  "figcaption",
] as const;

/**
 * Candidates: copy elements, spans that are not inside copy/links/buttons/labels (eyebrows,
 * kickers, stat captions) and anything explicitly marked `data-reveal="text"`.
 */
export const candidateSelector = [
  ...copySelectors,
  `span:not(:is(${copySelectors.join(", ")}, a, button, label) span)`,
  '[data-reveal="text"]',
].join(", ");

/**
 * Subtrees the site-wide pass never touches: chrome that must be readable the instant it
 * appears (navigation, forms, dialogs, menus, tooltips), live regions and live values
 * (Price, StockBadge, counters and toasts mark themselves `data-reveal="off"`),
 * screen-reader-only text, and block-reveal targets (a block carries its own copy).
 */
export const skipSelector = [
  '[data-reveal="off"]',
  blockSelector,
  "nav",
  "form",
  "button",
  "label",
  "input",
  "select",
  "textarea",
  "option",
  "dialog",
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[role="listbox"]',
  '[role="tooltip"]',
  '[role="tablist"]',
  '[role="status"]',
  '[role="alert"]',
  '[role="log"]',
  "[aria-live]",
  "[data-radix-popper-content-wrapper]",
  '[contenteditable]:not([contenteditable="false"])',
  ".sr-only",
].join(", ");

/**
 * A candidate that contains any of these is a container, not a line of copy: it is never
 * hidden (cards, media, controls, prices and nested lists stay visible — §8.1 principle 5),
 * and its own copy children become the candidates instead.
 */
export const containerSelector = [
  "img",
  "picture",
  "video",
  "canvas",
  "iframe",
  "button",
  "input",
  "select",
  "textarea",
  "form",
  "table",
  "article",
  "section",
  "ul",
  "ol",
  "dl",
  '[data-reveal="off"]',
  '[role="status"]',
  "[aria-live]",
].join(", ");

const eligible = `:is(${candidateSelector}):not(:has(${containerSelector}))`;

/**
 * The elements the stylesheet hides and the observer reveals: eligible candidates that are
 * not inside another eligible candidate and not inside a skipped subtree.
 */
export const hiddenSelector =
  `${eligible}:not(:is(${eligible}) *)` + `:not(${skipSelector}):not(:is(${skipSelector}) *)`;

export const TEXT_REVEAL = {
  /** Above this many words an element fades as one block instead of splitting. */
  maxWords: 60,
  /** The shared trigger line: an element reveals when its centre crosses it (revealConfig). */
  enterRatio: REVEAL_LINE,
  /** Boot-script safety net: everything becomes visible if JS has not taken over. */
  failsafeMs: 3500,
  /**
   * Word animation — CSS keyframes (`tr-word`) driven by `--i` (shuffled index) and `--n`
   * (word count) on each word span; TextRevealGlobal only splits, sets the variables and
   * flips the state (PERF-05). Coarse pointers and narrow screens skip the blur
   * (`tr-word-lite`): filter is the expensive part on phones.
   */
  word: {
    durationMs: 620,
    blurPx: 8,
    liftEm: 0.35,
    /** Delay step = min(each, budget / words), in shuffled order. */
    staggerEachMs: 28,
    staggerBudgetMs: 520,
  },
  /** Block fade (`tr-block`) for long copy and lines inside flex/grid boxes. */
  block: {
    durationMs: 500,
    liftPx: 6,
  },
  /** Media features under any of which word spans animate without blur. */
  liteMedia: ["(pointer: coarse)", "(max-width: 47.99rem)"],
  /** LCP-safe server variant (components/text-reveal/RevealText). */
  lcp: {
    durationMs: 540,
    fromOpacity: 0.35,
    blurPx: 10,
    liftEm: 0.3,
    /** Delays spread over at most this window… */
    spreadMs: 360,
    /** …with at most this step between consecutive (shuffled) words. */
    stepMaxMs: 40,
  },
  classes: {
    /** Added to <html> by the boot script; hiding only applies under it. */
    js: "tr-js",
    /**
     * Added with `tr-js` by the boot script: enables the selector-based hiding rule (the
     * `:has()` one) for server HTML React has not hydrated yet. TextRevealGlobal removes it
     * once every element on the page carries an explicit state, so the costly rule stops
     * being evaluated; from then on only `[data-reveal-state="pending"]` hides (PERF-05).
     */
    boot: "tr-hide",
    /** Added after `failsafeMs` if the observer never started; disables hiding. */
    failsafe: "tr-failsafe",
    word: "reveal-word",
    lcpWord: "rw",
  },
  attrs: {
    state: "data-reveal-state",
    /** `block` while an element fades as one block (`tr-block`). */
    mode: "data-reveal-mode",
    /** Marks a split element so tooling (translation, tests) can leave it alone. */
    split: "data-no-translate",
  },
} as const;

export type RevealState = "pending" | "running" | "done";
