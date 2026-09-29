/**
 * Builds the text-reveal stylesheet and boot script from constants/textRevealConfig.ts.
 * The root layout inlines both in <head>, so copy is hidden before first paint only when
 * the boot script has run (html.tr-js) — and only for elements the observer will reveal.
 */
import { TEXT_REVEAL, hiddenSelector } from "@/constants/textRevealConfig";

const { classes, attrs, lcp } = TEXT_REVEAL;
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

/** Minify whitespace of a CSS template (keeps it readable in source). */
function compact(css: string): string {
  return css
    .replace(/\s+/g, " ")
    .replace(/\s*([{};,])\s*/g, "$1")
    .trim();
}

export function buildTextRevealCss(): string {
  const pending = `html.${classes.js}:not(.${classes.failsafe}) :is(${hiddenSelector}):not([${attrs.state}="running"]):not([${attrs.state}="done"])`;
  return compact(`
    @media screen and (prefers-reduced-motion: no-preference) {
      ${pending} { opacity: 0; }
    }
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
 * Boot script: marks <html> as JS-capable (enables hiding) and arms the failsafe that reveals
 * everything if TextRevealGlobal has not taken over within `failsafeMs`.
 */
export function buildTextRevealBootScript(): string {
  return `(function(){var d=document.documentElement;d.classList.add(${JSON.stringify(
    classes.js,
  )});window.__trFailsafe=window.setTimeout(function(){d.classList.add(${JSON.stringify(
    classes.failsafe,
  )})},${TEXT_REVEAL.failsafeMs})})();`;
}
