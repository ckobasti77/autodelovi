/**
 * Site-wide text reveal — the single configuration (DESIGN-SYSTEM §8.6, text-reveal skill).
 *
 * The same selector strings drive BOTH the inline stylesheet that hides copy before first
 * paint (lib/textRevealCss.ts) and the observer that reveals it (components/TextRevealGlobal),
 * so anything the CSS hides is guaranteed to be found by the JS. Change selectors only here.
 */

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
 * (Price, StockBadge, counters and toasts mark themselves `data-reveal="off"`), and
 * screen-reader-only text.
 */
export const skipSelector = [
  '[data-reveal="off"]',
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
  /** Root margin shrinks the viewport from the bottom: elements reveal 15 % into view. */
  enterRatio: 0.15,
  /** Boot-script safety net: everything becomes visible if JS has not taken over. */
  failsafeMs: 3500,
  /** Word animation (GSAP). */
  word: {
    duration: 0.62,
    ease: "sk.out",
    blurPx: 8,
    liftEm: 0.35,
    /** Stagger = min(each, budget / words) in shuffled order. */
    staggerEach: 0.028,
    staggerBudget: 0.52,
  },
  /** Block fade for long copy and lines inside flex/grid boxes. */
  block: {
    duration: 0.5,
    ease: "sk.out",
    liftPx: 6,
  },
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
    /** Added after `failsafeMs` if the observer never started; disables hiding. */
    failsafe: "tr-failsafe",
    word: "reveal-word",
    lcpWord: "rw",
  },
  attrs: {
    state: "data-reveal-state",
    /** Marks a split element so tooling (translation, tests) can leave it alone. */
    split: "data-no-translate",
  },
} as const;

export type RevealState = "pending" | "running" | "done";
