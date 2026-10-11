/**
 * Builds the reveal stylesheet and boot script from constants/textRevealConfig.ts (copy) and
 * constants/revealConfig.ts (blocks). The root layout inlines both in <head>, so content is
 * hidden before first paint only when the boot script has run (html.tr-js) — and only for
 * elements the engine will reveal.
 *
 * Hiding rules:
 * - copy, boot (`html.tr-hide`): the shared `hiddenSelector` (uses `:has()`), for server HTML
 *   before TextRevealGlobal has marked it; dropped once every element carries an explicit state;
 * - blocks, boot: `blockHiddenSelector` without a state — a plain attribute selector, kept for
 *   the life of the page, so blocks added later are hidden from their first frame;
 * - runtime: `[data-reveal-state="pending"]` — a plain attribute match, for both.
 * Every animation is a CSS keyframe; JS only sets `--i`/`--n`/`--rv-d` and the state.
 */
import { BLOCK_REVEAL, blockHiddenSelector, eagerSelector } from "@/constants/revealConfig";
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

function buildBlockRevealCss(live: string): string {
  const { default: rise, lite, eager, fade, modes, narrowMedia, delayVar } = BLOCK_REVEAL;
  const running = `[${attrs.state}="running"]`;
  const riseSel = `${running}[${attrs.mode}="${modes.rise}"]`;
  const fadeSel = `${running}[${attrs.mode}="${modes.fade}"]`;
  const liteScope = `[${BLOCK_REVEAL.attrs.tone}="lite"]`;
  const delay = `var(${delayVar}, 0ms)`;
  return `
    @media screen and (prefers-reduced-motion: no-preference) {
      ${live} :is(${blockHiddenSelector}):not([${attrs.state}]) { opacity: 0; }
      ${riseSel} {
        animation: rv-rise ${rise.durationMs}ms ${EASE_OUT} ${delay} both;
        will-change: transform, opacity;
      }
      ${liteScope} ${riseSel} { animation-name: rv-rise-lite; animation-duration: ${lite.durationMs}ms; }
      ${fadeSel} {
        animation: rv-fade ${fade.durationMs}ms ${EASE_OUT} ${delay} both;
        will-change: opacity;
      }
      ${eagerSelector} { animation: rv-eager ${eager.durationMs}ms ${EASE_OUT} ${delay} both; }
    }
    @media screen and (prefers-reduced-motion: no-preference) and ${narrowMedia} {
      ${riseSel} { animation-name: rv-rise-narrow; }
      ${liteScope} ${riseSel} { animation-name: rv-rise-lite; }
    }
    @media (scripting: none) {
      :is(${blockHiddenSelector}) { opacity: 1 !important; }
    }
    @keyframes rv-rise {
      from { opacity: 0; transform: translate3d(0, ${rise.liftPx}px, 0); }
    }
    @keyframes rv-rise-narrow {
      from { opacity: 0; transform: translate3d(0, ${rise.liftNarrowPx}px, 0); }
    }
    @keyframes rv-rise-lite {
      from { opacity: 0; transform: translate3d(0, ${lite.liftPx}px, 0); }
    }
    @keyframes rv-fade {
      from { opacity: 0; }
    }
    @keyframes rv-eager {
      from { opacity: ${eager.fromOpacity}; transform: translate3d(0, ${eager.liftPx}px, 0); }
    }
  `;
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
    ${buildBlockRevealCss(live)}
  `);
}

/** Stylesheet for <noscript>: never hide anything. */
export function buildTextRevealNoscriptCss(): string {
  return compact(
    `:is(${hiddenSelector}) { opacity: 1 !important; } :is(${blockHiddenSelector}) { opacity: 1 !important; }`,
  );
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
