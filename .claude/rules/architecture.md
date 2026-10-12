# Architecture rules (SKLOP)

Project-level rules that every change must respect. The full architecture lives in `docs/ARCHITECTURE.md`; the design system in `docs/design/DESIGN-SYSTEM.md`. This file holds the rules that are easy to break by accident.

## Reveal

Everything on the site arrives once as it scrolls into view, through one system. Copy arrives word by word; everything else — cards, images, CTA blocks, form groups, rows, tables — arrives as blocks, in sequence. The system is already wired into the root layout.

- **Copy** needs nothing except plain semantic markup (`h1`–`h6`, `p`, `li`, `dt`, `dd`, `blockquote`, `figcaption`, or `data-reveal="text"`).
- **Blocks** are marked: `data-reveal="block"` on one element, or `data-reveal-group` on a container with `data-reveal="item"` on its direct children. Components: `Reveal`, `RevealGroup`, `RevealItem` from `components/reveal/Reveal.tsx`.
- **First screen**: copy uses `RevealText`, blocks use `eager` (`data-reveal-eager`). Both start from a visible frame, so the LCP element is never hidden.

### The one rule

**Never write an entrance animation.** No fade/stagger on headings, paragraphs, cards or sections, no SplitText for copy, no local splitter, no ScrollTrigger entrance, no hand-written `opacity: 0`. A second animation on the same element fights over one `opacity`, and only the generated stylesheet may hide anything, because only it is paired with something that reveals it.

### Files

| File | Role |
|---|---|
| `constants/revealConfig.ts` | What copy and blocks share and what blocks add: `REVEAL_LINE` (0.18 — the one trigger line), `REVEAL_TALL_RATIO` (0.6), `BLOCK_REVEAL` (timings for default / lite / eager / fade, attribute names), `blockSelector`, `blockHiddenSelector`, `eagerSelector`, `staggerDelayMs`. |
| `constants/textRevealConfig.ts` | Copy: `candidateSelector`, `skipSelector`, `containerSelector`, `hiddenSelector`, `TEXT_REVEAL` (`maxWords: 60`, `enterRatio` = `REVEAL_LINE`, `failsafeMs: 3500`, word/block/LCP timings, class and attribute names). |
| `lib/textRevealCss.ts` | Generates the inline stylesheet (hiding rules and every keyframe: `tr-word`, `tr-word-lite`, `tr-block`, `tr-lcp`, `rv-rise`, `rv-rise-narrow`, `rv-fade`, `rv-eager`), the `<noscript>` stylesheet and the boot script from the two configs. |
| `app/layout.tsx` | Inlines the stylesheet, the boot script (adds `tr-js` and `tr-hide` to `<html>`, arms the `tr-failsafe` timer) and the `<noscript>` fallback in `<head>`; mounts `<TextRevealGlobal />`. `<html>` has `suppressHydrationWarning` because the boot script adds classes before hydration. |
| `components/TextRevealGlobal.tsx` | **The engine, for copy and blocks**: one IntersectionObserver (root shrunk from the bottom by `REVEAL_LINE`, thresholds 0 and 0.5), one MutationObserver for streamed, client-navigated and newly listed content. It only splits words, sets `--i` / `--n` / `--rv-d` and flips `data-reveal-state`; CSS keyframes animate. No GSAP. |
| `lib/textReveal.ts` | `splitWords(el)` / `restoreWords(el)` — the only splitter. Moves each original text node into the first word span of its run (never clones), splits on breaking whitespace only (a no-break space keeps „12.990 RSD“ together), and restores the exact original nodes and values. Also `countWords`, `hasFlexOrGridText`, `shuffledOrder` (deterministic, seeded by the text). |
| `components/reveal/Reveal.tsx` | `Reveal`, `RevealGroup`, `RevealItem` — Server Components that only write the attributes. |
| `components/text-reveal/RevealText.tsx` | **LCP-safe copy** for above the fold (Server Component): words split on the server into `span.rw` with `--i` and `--n`; pure CSS keyframes start at first paint from a readable frame (opacity .35 + blur 10 px + .3 em lift), ≤ 900 ms in total. A newline in the text forces a line break. Wrapper is `data-reveal="off"`. |

### The trigger rule

An element starts when its **vertical centre** crosses the line `REVEAL_LINE` (18 % of the viewport height above the bottom edge). An element taller than 60 % of the viewport starts when its **top** crosses the same line. One constant, for copy and blocks. The decision is made from the observer entry's own rectangles — no layout read while scrolling.

### What is hidden, exactly

- **Copy**: `hiddenSelector` = eligible candidates that are not inside another eligible candidate and not inside a skipped subtree. A candidate is **not eligible** (so never hidden) when it contains a container: `img, picture, video, canvas, iframe, button, input, select, textarea, form, table, article, section, ul, ol, dl, [data-reveal="off"], [role="status"], [aria-live]`. Block targets are in `skipSelector`: copy inside a block arrives with the block and is not split.
- **Blocks**: `blockHiddenSelector` = `[data-reveal="block"]` and `[data-reveal-group] > [data-reveal="item"]`, minus `[data-reveal-eager]` and `[hidden]`, outermost only (a block inside a block is not a target). Items are marked on purpose: a subject like `[data-reveal-group] > *` is universal, and a rule with a universal subject that depends on a class of `<html>` restyles the whole document every time that class changes (D330).

The stylesheet and the observer use the **same selector strings**, so anything hidden is guaranteed to be found. The copy rule uses `:has()` and only applies under `html.tr-hide`, which is dropped once every element carries a state; the block rule is a plain attribute selector and stays for the life of the page (blocks added later are hidden from their first frame). After that only `[data-reveal-state="pending"]` hides.

### Behaviour

- Copy, word mode (≤ 60 words): `opacity 0 → 1`, `blur(8px) → 0`, `translateY(.35em) → 0`, 620 ms `sk.out`, stagger `min(28 ms, 520 ms / words)`, random order; no blur on coarse pointers and below 768 px. Block mode (> 60 words, or text sitting directly in a flex/grid box): the element fades as one (opacity + 6 px lift, 500 ms).
- Blocks: `opacity 0 → 1` + 16 px lift (12 px below 768 px), 520 ms `sk.out`, transform and opacity only, `will-change` only while running. Blocks that cross the line in the same observer callback form a batch per group and start 60 ms apart in document order, the last at most 180 ms after the first (batch ≤ 700 ms) — a grid reveals row by row, card by card.
- `data-reveal-tone="lite"` on an ancestor (the admin shell): opacity only, 320 ms, 30 ms apart — in a working tool nothing moves after it appears (D331). `data-reveal-variant="fade"`: opacity only on the storefront (wide tables).
- `data-reveal-eager`: CSS only from the first paint, `opacity .4 → 1` + 10 px, 480 ms; the engine never touches it.
- Each element once; nothing reverses. The DOM is restored after each animation (word spans removed, `--rv-d` removed).
- Content already scrolled past (anchor jumps, scroll restoration, fast flings) and content that receives keyboard focus is shown instantly; content on the last screen of a page, which can never reach the line, starts 48 px into view, and everything on screen starts at the very end of the page.
- `content-visibility: auto` sections (D121): their content stays pending until the browser draws it, then reveals like the rest.
- The observer never touches an element before React has hydrated it (streamed Suspense boundaries hydrate after the root). It waits for the element's React fiber and proceeds after 4 s at the latest.
- Reduced motion: nothing is hidden (CSS gate) and every element is marked `done` immediately.
- No JavaScript: `tr-js` is never added, so nothing is hidden; `<noscript>` and `@media (scripting: none)` force visibility anyway. If JS loads but the observer never starts, `tr-failsafe` reveals everything after 3.5 s.
- Print: never hidden (the hiding rules are `screen` only).

### Opting out — and what you owe

`data-reveal="off"` removes a subtree from the **copy** pass (explicit block marks inside it still work — that is how the admin shell gets its lite block reveal). It is correct only for:

1. **Chrome that must be readable immediately** — navigation, forms, dialogs, menus, tooltips, live regions. Most are already in `skipSelector`; check before adding the attribute.
2. **Copy whose opacity another animation owns** (the 3D hero overlays, a stepped panel that replays).

Case 2 still owes a word-by-word arrival: use `splitWords` / `restoreWords` from `lib/textReveal.ts`, never a local splitter, and restore on cleanup. Live values (Price, StockBadge, counters, toasts, cart count) carry `data-reveal="off"` themselves. The admin shell sets `data-reveal="off"` and `data-reveal-tone="lite"` on its root.

### The things that break it

1. **Splitting without restoring** — always `restoreWords` in cleanup.
2. **`autoAlpha` on copy that must stay in the accessibility tree** — it writes `visibility: hidden`; use `opacity`.
3. **Hiding anything from CSS yourself** — only the generated stylesheet may hide content, because only it is paired with something that reveals it.
4. **Cloning text nodes** — React loses the node it owns. Move it.
5. **Touching server HTML before hydration** — any DOM mutation on dehydrated markup causes a hydration mismatch; TextRevealGlobal guards against it, other code must too.
6. **A block mark on the first screen without `eager`** — the element stays hidden until hydration; if it is the LCP element, LCP waits for JavaScript.
7. **A rule the whole document depends on** — `:root:has(…)`, a universal subject (`> *`, `*`) behind a class of `<html>`, or a custom property written on the root after first paint. Each one adds a full-document style pass per change (step 26 measured +400 ms of style work on the category page from four of them; `scripts/qa/ui-boost/lh-trace.mjs` shows the passes).
8. **Nesting block targets, or marking chrome** — a block inside a block is ignored; a header, dialog, sheet, menu or toast must be readable at once and has its own GSAP entrance.
9. **A block mark on an element GSAP transforms** — the keyframe and the tween write the same `transform`.

### Checking your work

After loading a page and scrolling it end to end, this must return an empty array:

```js
[...document.querySelectorAll('*')].filter(e => e.offsetParent && e.textContent.trim() && getComputedStyle(e).opacity === '0')
```

Also `document.querySelectorAll('[data-reveal-state="pending"]').length === 0` and no `.reveal-word` left in the DOM. `tests/e2e/foundation.spec.ts` automates these checks (plus reduced motion and no-JS) for `/styleguide` and `/`; `tests/e2e/reveal.spec.ts` tests the trigger rule, the stagger, eager items, late items and `content-visibility` on `/styleguide/otkrivanje`; `tests/e2e/reveal-routes.spec.ts` tests the rule on real pages and, for every main route (`MAIN_ROUTES` in `tests/e2e/helpers/uiBoost.ts`), that a direct visit owes nothing above the line, that the bottom leaves nothing hidden, reduced motion, anchors and back navigation — add a new template's route to that list. `scripts/qa/ui-boost/shots.mjs` prints the same contract for every page of its set.

## Motion (GSAP)

- Import `gsap`, plugins and `useGSAP` from `@/lib/gsap/client` only — it registers the `sk.*` eases once. ScrollTrigger and ScrollToPlugin come from `@/lib/gsap/scroll` and only the 3D hero imports them (PERF-10). Draggable + InertiaPlugin load on demand via `loadDragPlugins()` from `@/lib/gsap/drag` (bottom-sheet drag only, D113).
- All tweens inside `useGSAP({ scope })`; event handlers through `contextSafe`; reduced motion and breakpoints through `useMotionMedia` (`gsap.matchMedia`) or `prefersReducedMotion()` at animation time.
- `ScrollTriggerRefresher` (root layout) refreshes after route changes and font loads; call `requestScrollTriggerRefresh()` after any other layout change (poster → canvas swap).
- GSAP owns overlays and authored moments: dialogs, sheets, menus, toasts, tabs, accordions, the 3D explode (`components/ui/motion.ts` for overlays).
- CSS owns three things, and nothing else: state feedback (hover colour 80 ms, press 1 px 140 ms `sk.snap`, switch knob, card hover step) and loops (spinner, skeleton shimmer); the site-wide reveal (keyframes generated by `lib/textRevealCss.ts`); scroll- and navigation-linked chrome (the header condense on a CSS scroll timeline, the page transition through the View Transitions API — `components/shell/PageTransition.tsx`).
- Transforms, opacity and filter only; no ScrollSmoother; no `markers` in committed code.

## Tokens and styling

- Colours, type, radii, shadows, z-index and durations come from `app/globals.css` (`@theme`); Tailwind's default palette, type scale, radii and shadows are reset, so a raw colour utility does not exist. Themes switch with `data-theme="paper"` / `"night"` on a subtree.
- **Radius by role** (DESIGN-SYSTEM §5.3): `rounded-xs` 4 px tag · `rounded-sm` 6 px press · `rounded-md` 8 px read · `rounded-lg` 10 px picture · `rounded-xl` 12 px float · `rounded-2xl` 14 px sheet top · `rounded-full` only for what is a pill. No visible box has square corners; nested corners are concentric (inner = outer − padding). `npx playwright test tests/e2e/corners.spec.ts` must pass: the only element that may have a computed radius of 0 is a full-bleed one, whose edges meet the viewport (DESIGN-SYSTEM §5.3). Controls and pictures get a default radius from the base layer; a box that fills one end of a rounded container takes its inner radius on the shared corners (`rounded-t-[calc(var(--radius-md)-1px)]`, a picture inside a frame `rounded-[inherit]`); a control with a rule on one side rounds only the other corners.
- **Surfaces** (§5.5): a new box is `panel` (resting), `panel-raised` (level 2) or `panel-inset` (a well), with `card-interactive` when it is or holds a link — not three hand-written utilities. Shadows: `shadow-rest`, `shadow-raised`, `shadow-overlay`, `shadow-drawer`.
- One outline per region: repeated actions use the `quiet` button (filled), the single alternative beside a primary uses `secondary`.
- Anything fixed to the bottom of the viewport uses `bottom-bar-offset` (the mobile action bar's height, 0 where there is none); a page with its own bottom bar is listed in `OWN_BOTTOM_BAR` (`lib/shell/bottomBar.ts`). `--bottom-bar-h` is declared by `BottomBarSpace`, the first element of the shop layout — never derive a `:root` variable from something rendered late (`:root:has(…)` restyles the whole page after first paint).
- next/font variables are `--nf-*` (see `lib/fonts.ts`); the theme maps them to `--font-display`, `--font-ui`, `--font-condensed`, `--font-mono`.
- Type styles are single utilities (`type-h1`, `type-body-s`, `type-code`, …) carrying family, size, weight, line height and tracking.
