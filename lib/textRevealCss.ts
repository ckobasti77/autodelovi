/**
 * Builds the text-reveal stylesheet and boot script from constants/textRevealConfig.ts.
 * The root layout inlines both in <head>, so copy is hidden before first paint only when
 * the boot script has run (html.tr-js) — and only for elements the observer will reveal.
 *
 * Two hiding rules:
 * - boot (`html.tr-hide`): the shared `hiddenSelector` (uses `:has()`), for server HTML before
 *   TextRevealGlobal has marked it; dropped once every element carries an explicit state;
 * - runtime: `[data-reveal-state="pending"]` — a plain attribute match.
 * The word and block animations are CSS keyframes; JS only sets `--i`/`--n` and the state.
 */
import { TEXT_REVEAL, hiddenSelector } from "@/constants/textRevealConfig";

const { classes, attrs, lcp, word, block, liteMedia } = TEXT_REVEAL;
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

/** Minify whitespace of a CSS template (keeps it readable in source). */
function compact(css: string): string {
  return css
    .replace(/\s+/g, " ")
    .replace(/\s*([{};,])\s*/g, "$1")
    .trim();
}

export function buildTextRevealCss(): string {
  const live = `html.${classes.js}:not(.${classes.failsafe})`;
  const boot = `html.${classes.boot}:not(.${classes.failsafe}) :is(${hiddenSelector}):not([${attrs.state}])`;
  const running = `[${attrs.state}="running"]`;
  return compact(`
    @media screen and (prefers-reduced-motion: no-preference) {
      ${boot}, ${live} [${attrs.state}="pending"] { opacity: 0; }
      ${running} .${classes.word} {
        animation: tr-word ${word.durationMs}ms ${EASE_OUT} both;
        animation-delay: calc(var(--i, 0) * min(${word.staggerEachMs}ms, ${word.staggerBudgetMs}ms / var(--n, 1)));
      }
      ${running}[${attrs.mode}="block"] { animation: tr-block ${block.durationMs}ms ${EASE_OUT} both; }
    }
    ${liteMedia
      .map(
        (feature) => `@media screen and (prefers-reduced-motion: no-preference) and ${feature} {
          ${running} .${classes.word} { animation-name: tr-word-lite; }
        }`,
      )
      .join(" ")}
    .${classes.word} { display: inline-block; }
    @media (scripting: none) {
      :is(${hiddenSelector}) { opacity: 1 !important; }
    }
    .${classes.lcpWord} { display: inline-block; }
    @media screen and (prefers-reduced-motion: no-preference) {
      .${classes.lcpWord} {
        animation: tr-lcp ${lcp.durationMs}ms ${EASE_OUT} both;
        animation-delay: calc(var(--i, 0) * min(${lcp.stepMaxMs}ms, ${lcp.spreadMs}ms / var(--n, 1)));
      }
    }
    @keyframes tr-word {
      from { opacity: 0; filter: blur(${word.blurPx}px); transform: translateY(${word.liftEm}em); }
    }
    @keyframes tr-word-lite {
      from { opacity: 0; transform: translateY(${word.liftEm}em); }
    }
    @keyframes tr-block {
      from { opacity: 0; transform: translateY(${block.liftPx}px); }
    }
    @keyframes tr-lcp {
      from { opacity: ${lcp.fromOpacity}; filter: blur(${lcp.blurPx}px); transform: translateY(${lcp.liftEm}em); }
    }
  `);
}

/** Stylesheet for <noscript>: never hide anything. */
export function buildTextRevealNoscriptCss(): string {
  return compact(`:is(${hiddenSelector}) { opacity: 1 !important; }`);
}

/**
 * Boot script: marks <html> as JS-capable (enables hiding: `tr-js` + the boot rule `tr-hide`)
 * and arms the failsafe that reveals everything if TextRevealGlobal has not taken over within
 * `failsafeMs`. Once the failsafe has fired, TextRevealGlobal never hides anything again.
 */
export function buildTextRevealBootScript(): string {
  return `(function(){var d=document.documentElement;d.classList.add(${JSON.stringify(
    classes.js,
  )},${JSON.stringify(classes.boot)});window.__trFailsafe=window.setTimeout(function(){d.classList.add(${JSON.stringify(
    classes.failsafe,
  )})},${TEXT_REVEAL.failsafeMs})})();`;
}
