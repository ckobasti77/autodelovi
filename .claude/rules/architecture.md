# Architecture rules (SKLOP)

Project-level rules that every change must respect. The full architecture lives in `docs/ARCHITECTURE.md`; the design system in `docs/design/DESIGN-SYSTEM.md`. This file holds the rules that are easy to break by accident.

## Text Reveal

Every line of copy on the site arrives word by word as it enters the viewport. The system is already wired into the root layout — new copy needs nothing except plain semantic markup (`h1`–`h6`, `p`, `li`, `dt`, `dd`, `blockquote`, `figcaption`, or `data-reveal="text"`).

### The one rule

**Never write a text entrance animation.** No fade/stagger on headings or paragraphs, no SplitText for copy, no local splitter. A second animation on the same element fights over one `opacity`.

### Files

| File | Role |
|---|---|
| `constants/textRevealConfig.ts` | The only place selectors and timings live: `candidateSelector`, `skipSelector`, `containerSelector`, `hiddenSelector`, `TEXT_REVEAL` (`maxWords: 60`, `enterRatio: 0.15`, `failsafeMs: 3500`, word/block/LCP timings, class and attribute names). |
| `lib/textRevealCss.ts` | Generates the inline stylesheet (hides `hiddenSelector` under `html.tr-js` until the element is `running`/`done`), the `<noscript>` stylesheet and the boot script from the config. |
| `app/layout.tsx` | Inlines the stylesheet, the boot script (adds `tr-js` to `<html>`, arms the `tr-failsafe` timer) and the `<noscript>` fallback in `<head>`; mounts `<TextRevealGlobal />`. `<html>` has `suppressHydrationWarning` because the boot script adds a class before hydration. |
| `lib/textReveal.ts` | `splitWords(el)` / `restoreWords(el)` — the only splitter. Moves each original text node into the first word span of its run (never clones), splits on breaking whitespace only (a no-break space keeps „12.990 RSD“ together), and restores the exact original nodes and values. Also `countWords`, `hasFlexOrGridText`, `shuffledOrder` (deterministic, seeded by the text). |
| `components/TextRevealGlobal.tsx` | One IntersectionObserver (root shrunk from the bottom by `enterRatio`), one MutationObserver for streamed and client-navigated content, random word order, DOM restored after each animation. |
| `components/text-reveal/RevealText.tsx` | **LCP-safe variant** for above-the-fold copy (Server Component): words split on the server into `span.rw` with `--i` (shuffled index) and `--n` (word count); pure CSS keyframes start at first paint from a readable frame (opacity .35 + blur 10 px + .3 em lift), ≤ 900 ms in total. A newline in the text forces a line break. Wrapper is `data-reveal="off"`. |

### What is hidden, exactly

`hiddenSelector` = eligible candidates that are not inside another eligible candidate and not inside a skipped subtree. A candidate is **not eligible** (so never hidden) when it contains a container: `img, picture, video, canvas, iframe, button, input, select, textarea, form, table, article, section, ul, ol, dl, [data-reveal="off"], [role="status"], [aria-live]`. That keeps cards, media, controls, prices and nested lists visible (DESIGN-SYSTEM §8.1 principle 5) — their inner copy elements become the candidates instead.

The stylesheet and the observer use the **same selector string**, so anything hidden is guaranteed to be found. Never hide copy with your own CSS.

### Behaviour

- Word mode (≤ 60 words): `opacity 0 → 1`, `blur(8px) → 0`, `translateY(.35em) → 0`, 620 ms `sk.out`, stagger `min(28 ms, 520 ms / words)`, random order.
- Block mode (> 60 words, or text sitting directly in a flex/grid box): the element fades as one block (opacity + 6 px lift, 500 ms).
- Copy already scrolled past (anchor jumps, scroll restoration, fast flings) and copy that receives keyboard focus is shown instantly; the last lines of a page that can never cross the shrunk root are flushed when the page is scrolled to the end.
- The observer never touches an element before React has hydrated it (streamed Suspense boundaries hydrate after the root). It waits for the element's React fiber and proceeds after 4 s at the latest.
- Reduced motion: nothing is hidden (CSS gate) and every element is marked `done` immediately.
- No JavaScript: `tr-js` is never added, so nothing is hidden; `<noscript>` and `@media (scripting: none)` force visibility anyway. If JS loads but the observer never starts, `tr-failsafe` reveals everything after 3.5 s.
- Print: never hidden (the hiding rule is `screen` only).

### Opting out — and what you owe

`data-reveal="off"` removes a subtree from the site-wide pass. It is correct only for:

1. **Chrome that must be readable immediately** — navigation, forms, dialogs, menus, tooltips, live regions. Most are already in `skipSelector`; check before adding the attribute.
2. **Copy whose opacity another animation owns** (the 3D hero overlays, a stepped panel that replays).

Case 2 still owes a word-by-word arrival: use `splitWords` / `restoreWords` from `lib/textReveal.ts`, never a local splitter, and restore on cleanup. Live values (Price, StockBadge, counters, toasts, cart count) carry `data-reveal="off"` themselves. The admin shell sets `data-reveal="off"` on its root.

### The things that break it

1. **Splitting without restoring** — always `restoreWords` in cleanup.
2. **`autoAlpha` on copy that must stay in the accessibility tree** — it writes `visibility: hidden`; use `opacity`.
3. **Hiding copy from CSS yourself** — only the generated stylesheet may hide copy, because only it is paired with something that reveals it.
4. **Cloning text nodes** — React loses the node it owns. Move it.
5. **Touching server HTML before hydration** — any DOM mutation on dehydrated markup causes a hydration mismatch; TextRevealGlobal guards against it, other code must too.

### Checking your work

After loading a page and scrolling it end to end, this must return an empty array:

```js
[...document.querySelectorAll('*')].filter(e => e.offsetParent && e.textContent.trim() && getComputedStyle(e).opacity === '0')
```

Also `document.querySelectorAll('[data-reveal-state="pending"]').length === 0` and no `.reveal-word` left in the DOM. `tests/e2e/foundation.spec.ts` automates these checks (plus reduced motion and no-JS) for `/styleguide` and `/`.

## Motion (GSAP)

- Import `gsap`, plugins and `useGSAP` from `@/lib/gsap/client` only — it registers ScrollTrigger, ScrollToPlugin, Draggable, InertiaPlugin, CustomEase and the `sk.*` eases once.
- All tweens inside `useGSAP({ scope })`; event handlers through `contextSafe`; reduced motion and breakpoints through `useMotionMedia` (`gsap.matchMedia`) or `prefersReducedMotion()` at animation time.
- `ScrollTriggerRefresher` (root layout) refreshes after route changes and `document.fonts.ready`; call `requestScrollTriggerRefresh()` after any other layout change (poster → canvas swap).
- CSS transitions are allowed only for state feedback (hover colour 80 ms, press 1 px 140 ms `sk.snap`, switch knob) and loops (spinner, skeleton shimmer); every entrance/exit uses GSAP (`components/ui/motion.ts` for overlays).
- Transforms, opacity and filter only; no ScrollSmoother; no `markers` in committed code.

## Tokens and styling

- Colours, type, radii, shadows, z-index and durations come from `app/globals.css` (`@theme`); Tailwind's default palette, type scale, radii and shadows are reset, so a raw colour utility does not exist. Themes switch with `data-theme="paper"` / `"night"` on a subtree.
- next/font variables are `--nf-*` (see `lib/fonts.ts`); the theme maps them to `--font-display`, `--font-ui`, `--font-condensed`, `--font-mono`.
- Type styles are single utilities (`type-h1`, `type-body-s`, `type-code`, …) carrying family, size, weight, line height and tracking.
