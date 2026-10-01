# Perf gate — step 22, run 3 (2026-10-01)

Lighthouse 13, mobile preset, production build (`NEXT_PUBLIC_TEST_HOOKS=1 npm run build`, `next start -p 3100`),
fresh profile per run (first visit: the cookie-consent banner is open), 3 valid runs per URL, one Chrome at a time.
Budget method = applied throttling (`--throttling devtools`, D112); the simulated method (Lantern) is recorded for
reference. Runner: `MSYS_NO_PATHCONV=1 node tests/lighthouse/run.mjs --runs 3 --throttling devtools|simulate <paths>`.
Reports: `.lighthouse/before/`, `.lighthouse/after/` (git-ignored).

Targets (BRIEF §9, this gate): performance ≥ 85, accessibility ≥ 95, SEO ≥ 95 on each page; aim TBT ≤ 200 ms,
LCP ≤ 2.5 s, CLS ≤ 0.05.

## Fixes in this run

1. **Late LCP from the consent banner (category regression, D287).** `/delovi/kocioni-diskovi` LCP was 6.4 s and the
   LCP element was `p#_r_1_` — the paragraph of the *live* `ConsentBanner`, not the server-rendered `p#consent-desc`.
   `ConsentGate` swapped the static panel for the live banner in idle time (timeout 3 s after hydration, ~6 s on a
   throttled phone); the swap re-creates the panel DOM, and once the web font had replaced the fallback the new
   paragraph was larger than the first-paint one, so Chromium recorded it as a new LCP candidate. Now the banner
   module is only *warmed* in idle time (and on pointer hover over the panel); the swap happens on the first
   interaction (keydown, focusin, pointerdown/touchstart outside the panel, or a held click on a panel button),
   and Chromium stops recording LCP at the first input. A press inside the panel never swaps under the pointer: its
   click is held and replayed on the live button as before. The server-rendered banner still paints with the first
   frame and still works as a form post without JavaScript; nothing is hidden from users or tools.
   After: LCP element `p#consent-desc` at FCP (1994 ms).
2. **ScrollTrigger on every page (D288).** `lib/gsap/client.ts` still re-exported ScrollTrigger (PERF-10 transitional
   line), so every page that used GSAP at all registered ScrollTrigger, whose permanent `requestAnimationFrame`
   repaint loop ran ~70 callbacks/s for the life of the page (probe: 663 rAF callbacks in 9 s from the GSAP chunk on
   the category page; 31 after = GSAP ticker until auto-sleep). Removed; ScrollTrigger now loads only with the 3D
   hero. Category main-thread „Other“ 2006 → 804 ms; the GSAP chunk left the bootup top list on category/product.
3. **Home accessibility 97 → 100 (target-size, D288).** The home category grid (`cv-auto`, 900 px estimate) is
   1718 px tall on a phone; while skipped, its tiles overflowed onto the systems index below and Lighthouse reported
   those links as „partially obscured“. Realistic `contain-intrinsic-size` per breakpoint for the grid
   (1580/1250/1120/820 px) and the footer (1040/700/440 px; 1062 px real on a phone) — also removes the scrollbar
   jump when they render.

Verification: `tsc --noEmit` clean, eslint clean on touched files, e2e `seo.spec.ts` consent tests 4/4 (desktop;
mobile skipped by design — run with the server's `REVALIDATE_SECRET`, otherwise `/api/revalidate` answers 401 and the
tracking ids never reach the page), `foundation.spec.ts` 20/20 (text reveal, reduced motion, no-JS on `/` and
`/styleguide`). Probe (`.lighthouse/probe-consent.mjs`): no swap after 6 s idle (`p#consent-desc`), a touch tap on
„Prihvati sve“ on the static panel decides (cookie set, banner hidden, no console errors), the first Tab swaps in
the live banner, Escape collapses it.

## Applied throttling (budget method) — 3-run medians

| Page | State | Perf | A11y | BP | SEO | LCP ms | CLS | TBT ms |
|---|---|---|---|---|---|---|---|---|
| `/` | 08:00 | 91 | 97 | 100 | 100 | 2344 | 0.001 | 224 |
| `/` | before (this run, unfixed build) | 89 | 97 | 100 | 100 | 2442 | 0.001 | 284 |
| `/` | **after** (re-run, benchmarkIndex ≥ 3500) | **94** | **100** | 100 | 100 | 2305 | 0.001 | 161 |
| `/delovi/kocioni-diskovi` | 08:00 | 69 | 100 | 100 | 100 | 6444 | 0.000 | 298 |
| `/delovi/kocioni-diskovi` | before | 68 | 100 | 100 | 100 | 6451 | 0.000 | 323 |
| `/delovi/kocioni-diskovi` | **after** | **92** | 100 | 100 | 100 | **1994** | 0.000 | 287 |
| `/deo/kocioni-disk-prednji-276-24-mm-demo-0004` | 08:00 | 93 | 100 | 100 | 100 | n/r | 0.000 | 217 |
| `/deo/kocioni-disk-prednji-276-24-mm-demo-0004` | before | 87 | 100 | 100 | 100 | 2225 | 0.000 | 374 |
| `/deo/kocioni-disk-prednji-276-24-mm-demo-0004` | **after** | **94** | 100 | 100 | 100 | 2053 | 0.000 | 203 |

08:00 = the step-22 checkpoint figures handed to this run (that summary file was overwritten; n/r = not
recorded). The before pass of the product page includes one contended run (benchmarkIndex 3335, a typecheck was
running); its median is the 87/374 ms shown. The first after-pass of `/` had two contended runs (benchmarkIndex 3088 and 2556; median perf 88, TBT 330 ms); it
was repeated with `--min-benchmark 3500` as the gate prescribes.

## Simulated throttling (Lantern, reference) — 3-run medians

| Page | State | Perf | A11y | BP | SEO | LCP ms | CLS | TBT ms |
|---|---|---|---|---|---|---|---|---|
| `/` | before | 86 | 100 | 100 | 100 | 4219 | 0.001 | 23 |
| `/` | after | 85 | 100 | 100 | 100 | 4308 | 0.001 | 24 |
| `/delovi/kocioni-diskovi` | before | 86 | 100 | 100 | 100 | 4223 | 0.000 | 39 |
| `/delovi/kocioni-diskovi` | after | 86 | 100 | 100 | 100 | 4168 | 0.000 | 25 |
| `/deo/kocioni-disk-prednji-276-24-mm-demo-0004` | before | 87 | 100 | 100 | 100 | 4039 | 0.000 | 20 |
| `/deo/kocioni-disk-prednji-276-24-mm-demo-0004` | after | 87 | 100 | 100 | 100 | 3991 | 0.000 | 17 |

Simulated LCP sits at ~4 s on every page although the observed (unthrottled) LCP equals FCP (~120 ms): on
localhost every first-load script is requested before the observed LCP, so Lantern's pessimistic LCP graph
includes ~280–300 KB of JavaScript over a simulated 1.6 Mbit/s link (docs/3d/WEB-QA.md). It moves with first-load
JS, not with the fixes above. Home accessibility was already 100 in the simulated pass before the fix: the
target-size artefact depends on what the skipped section has laid out when axe runs.

## Remaining (not gate blockers)

- TBT aim (≤ 200 ms) missed on the category page (287 ms median; runs 232–434 ms). Remaining long tasks: the
  document task right after FCP (~150–200 ms: HTML + ~141 KB inline RSC payload) and the root hydration task
  (~130–200 ms in `react-dom`), then ~100 ms commits. Product sits at the line (203 ms).
- First-load JS 279–298 KB vs the J11 template budgets (160/180 KB) — unchanged by this run.
- Home still runs ScrollTrigger's permanent rAF loop (needed by the 3D hero scroll timeline).

## Raw runs

Before — applied throttling:
    / run 1: perf 89 · LCP 2442 ms · CLS 0.001 · TBT 284 ms · FCP 2254 ms · SI 2271 ms · JS 296 KB · benchmarkIndex 2964
    / run 2: perf 75 · LCP 2705 ms · CLS 0.001 · TBT 733 ms · FCP 2420 ms · SI 2453 ms · JS 296 KB · benchmarkIndex 3991
    / run 3: perf 91 · LCP 2233 ms · CLS 0.001 · TBT 280 ms · FCP 2039 ms · SI 2075 ms · JS 296 KB · benchmarkIndex 4049
    /delovi/kocioni-diskovi run 1: perf 68 · LCP 6493 ms · CLS 0.000 · TBT 323 ms · FCP 2084 ms · SI 2190 ms · JS 308 KB · benchmarkIndex 4012
    /delovi/kocioni-diskovi run 2: perf 72 · LCP 6366 ms · CLS 0.000 · TBT 232 ms · FCP 2013 ms · SI 2120 ms · JS 308 KB · benchmarkIndex 4105
    /delovi/kocioni-diskovi run 3: perf 62 · LCP 6451 ms · CLS 0.000 · TBT 530 ms · FCP 2042 ms · SI 2157 ms · JS 308 KB · benchmarkIndex 3706
    /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 1: perf 87 · LCP 2225 ms · CLS 0.000 · TBT 374 ms · FCP 2225 ms · SI 2353 ms · JS 297 KB · benchmarkIndex 4028
    /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 2: perf 90 · LCP 2243 ms · CLS 0.000 · TBT 287 ms · FCP 2243 ms · SI 2383 ms · JS 297 KB · benchmarkIndex 3936
    /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 3: perf 84 · LCP 1925 ms · CLS 0.000 · TBT 552 ms · FCP 1925 ms · SI 2083 ms · JS 297 KB · benchmarkIndex 3335

Before — simulated:
    / run 1: perf 85 · LCP 4337 ms · CLS 0.001 · TBT 23 ms · FCP 1513 ms · SI 1513 ms · JS 296 KB · benchmarkIndex 3988
    / run 2: perf 86 · LCP 4217 ms · CLS 0.001 · TBT 17 ms · FCP 1510 ms · SI 1510 ms · JS 296 KB · benchmarkIndex 3960
    / attempt 3: discarded (runtimeError NO_NAVSTART: Something went wrong with recording the trace over your page load. Please run Lighthouse again. (NO_NAVSTART))
    / run 3: perf 86 · LCP 4219 ms · CLS 0.001 · TBT 26 ms · FCP 1512 ms · SI 1512 ms · JS 296 KB · benchmarkIndex 3930
    /delovi/kocioni-diskovi run 1: perf 86 · LCP 4222 ms · CLS 0.000 · TBT 22 ms · FCP 1511 ms · SI 1511 ms · JS 308 KB · benchmarkIndex 3992
    /delovi/kocioni-diskovi run 2: perf 86 · LCP 4223 ms · CLS 0.000 · TBT 39 ms · FCP 1511 ms · SI 1546 ms · JS 308 KB · benchmarkIndex 3969
    /delovi/kocioni-diskovi run 3: perf 86 · LCP 4227 ms · CLS 0.000 · TBT 43 ms · FCP 1513 ms · SI 1513 ms · JS 308 KB · benchmarkIndex 3368
    /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 1: perf 86 · LCP 4079 ms · CLS 0.000 · TBT 40 ms · FCP 1364 ms · SI 1364 ms · JS 297 KB · benchmarkIndex 4016
    /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 2: perf 87 · LCP 4039 ms · CLS 0.000 · TBT 20 ms · FCP 1362 ms · SI 1362 ms · JS 297 KB · benchmarkIndex 4015
    /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 3: perf 90 · LCP 3621 ms · CLS 0.000 · TBT 20 ms · FCP 1361 ms · SI 1361 ms · JS 297 KB · benchmarkIndex 3865

After — applied throttling:
    / run 1: perf 79 · LCP 2585 ms · CLS 0.001 · TBT 590 ms · FCP 2300 ms · SI 2329 ms · JS 298 KB · benchmarkIndex 3088
    / run 2: perf 88 · LCP 2338 ms · CLS 0.001 · TBT 330 ms · FCP 2172 ms · SI 2191 ms · JS 298 KB · benchmarkIndex 2556
    / run 3: perf 89 · LCP 2283 ms · CLS 0.001 · TBT 326 ms · FCP 2095 ms · SI 2120 ms · JS 298 KB · benchmarkIndex 4058
    /delovi/kocioni-diskovi run 1: perf 92 · LCP 1993 ms · CLS 0.000 · TBT 287 ms · FCP 1993 ms · SI 2093 ms · JS 290 KB · benchmarkIndex 4051
    /delovi/kocioni-diskovi run 2: perf 93 · LCP 2001 ms · CLS 0.000 · TBT 232 ms · FCP 2001 ms · SI 2103 ms · JS 290 KB · benchmarkIndex 3912
    /delovi/kocioni-diskovi run 3: perf 87 · LCP 1994 ms · CLS 0.000 · TBT 434 ms · FCP 1994 ms · SI 2112 ms · JS 290 KB · benchmarkIndex 3895
    /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 1: perf 97 · LCP 2055 ms · CLS 0.000 · TBT 108 ms · FCP 2055 ms · SI 2192 ms · JS 279 KB · benchmarkIndex 4031
    /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 2: perf 94 · LCP 2053 ms · CLS 0.000 · TBT 203 ms · FCP 2053 ms · SI 2191 ms · JS 279 KB · benchmarkIndex 4069
    /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 3: perf 94 · LCP 2008 ms · CLS 0.000 · TBT 211 ms · FCP 2008 ms · SI 2147 ms · JS 279 KB · benchmarkIndex 3961

After — applied throttling, home re-run (`--min-benchmark 3500`):
    / run 1: perf 93 · LCP 2336 ms · CLS 0.001 · TBT 201 ms · FCP 2173 ms · SI 2188 ms · JS 298 KB · benchmarkIndex 4029
    / run 2: perf 94 · LCP 2305 ms · CLS 0.001 · TBT 161 ms · FCP 2153 ms · SI 2180 ms · JS 298 KB · benchmarkIndex 4190
    / run 3: perf 95 · LCP 2198 ms · CLS 0.001 · TBT 143 ms · FCP 2057 ms · SI 2073 ms · JS 298 KB · benchmarkIndex 3549

After — simulated:
    / run 1: perf 85 · LCP 4316 ms · CLS 0.001 · TBT 24 ms · FCP 1509 ms · SI 1509 ms · JS 298 KB · benchmarkIndex 4021
    / run 2: perf 85 · LCP 4308 ms · CLS 0.001 · TBT 27 ms · FCP 1512 ms · SI 1512 ms · JS 298 KB · benchmarkIndex 4166
    / run 3: perf 85 · LCP 4301 ms · CLS 0.001 · TBT 24 ms · FCP 1510 ms · SI 1510 ms · JS 298 KB · benchmarkIndex 3966
    /delovi/kocioni-diskovi run 1: perf 86 · LCP 4174 ms · CLS 0.000 · TBT 28 ms · FCP 1511 ms · SI 1511 ms · JS 290 KB · benchmarkIndex 4160
    /delovi/kocioni-diskovi run 2: perf 86 · LCP 4168 ms · CLS 0.000 · TBT 25 ms · FCP 1512 ms · SI 1512 ms · JS 290 KB · benchmarkIndex 3976
    /delovi/kocioni-diskovi run 3: perf 86 · LCP 4158 ms · CLS 0.000 · TBT 22 ms · FCP 1509 ms · SI 1509 ms · JS 290 KB · benchmarkIndex 4041
    /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 1: perf 87 · LCP 3997 ms · CLS 0.000 · TBT 17 ms · FCP 1362 ms · SI 1362 ms · JS 279 KB · benchmarkIndex 3909
    /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 2: perf 91 · LCP 3467 ms · CLS 0.000 · TBT 24 ms · FCP 1359 ms · SI 1359 ms · JS 279 KB · benchmarkIndex 4048
    /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 3: perf 87 · LCP 3991 ms · CLS 0.000 · TBT 15 ms · FCP 1361 ms · SI 1361 ms · JS 279 KB · benchmarkIndex 4016

## Gates re-check after the final code (step 22 gates, 2026-10-01)

Re-run because the gates phase changed application code (order status dialog offline pattern, `Dialog` `min-w-0`, admin top bar `data-sticky-header`, PrivacyAdmin copy, inquiry link `generateMetadata`). Fresh `NEXT_PUBLIC_TEST_HOOKS=1 npm run build`, `next start -p 3100`, `MSYS_NO_PATHCONV=1 node tests/lighthouse/run.mjs --runs 3 --throttling devtools --min-benchmark 3500 / /delovi/kocioni-diskovi /deo/kocioni-disk-prednji-276-24-mm-demo-0004` (benchmarkIndex 3923–4173 on every run, none discarded).

| Page | Perf | A11y | BP | SEO | LCP ms | CLS | TBT ms | Gate (perf ≥ 85, a11y ≥ 95, SEO ≥ 95) |
|---|---|---|---|---|---|---|---|---|
| `/` | 94 | 100 | 100 | 100 | 2331 | 0.001 | 170 | pass |
| `/delovi/kocioni-diskovi` | 95 | 100 | 100 | 100 | 2006 | 0.000 | 185 | pass |
| `/deo/kocioni-disk-prednji-276-24-mm-demo-0004` | 94 | 100 | 100 | 100 | 2093 | 0.000 | 202 | pass |

The runner still exits 1 on the internal J11 lab budgets (first-load JS 279–298 KB against 160/180 KB; category and product LCP 2006/2093 ms against 2000 ms; TBT against 150 ms) — the same items as under „Remaining“, not gate criteria. Category TBT median fell from 287 to 185 ms (runs 180–189 ms).

```
    / run 1: perf 90 · LCP 2424 ms · CLS 0.001 · TBT 280 ms · FCP 2243 ms · SI 2263 ms · JS 298 KB · benchmarkIndex 3928
    / run 2: perf 95 · LCP 2331 ms · CLS 0.001 · TBT 116 ms · FCP 2219 ms · SI 2227 ms · JS 298 KB · benchmarkIndex 4156
    / run 3: perf 94 · LCP 2309 ms · CLS 0.001 · TBT 170 ms · FCP 2150 ms · SI 2165 ms · JS 298 KB · benchmarkIndex 4116
    /delovi/kocioni-diskovi run 1: perf 95 · LCP 2006 ms · CLS 0.000 · TBT 180 ms · FCP 2006 ms · SI 2114 ms · JS 290 KB · benchmarkIndex 4173
    /delovi/kocioni-diskovi run 2: perf 95 · LCP 1894 ms · CLS 0.000 · TBT 189 ms · FCP 1894 ms · SI 2006 ms · JS 290 KB · benchmarkIndex 4036
    /delovi/kocioni-diskovi run 3: perf 94 · LCP 2060 ms · CLS 0.000 · TBT 185 ms · FCP 2060 ms · SI 2154 ms · JS 290 KB · benchmarkIndex 4056
    /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 1: perf 94 · LCP 2093 ms · CLS 0.000 · TBT 202 ms · FCP 2093 ms · SI 2222 ms · JS 279 KB · benchmarkIndex 3966
    /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 2: perf 96 · LCP 2134 ms · CLS 0.000 · TBT 121 ms · FCP 2134 ms · SI 2265 ms · JS 279 KB · benchmarkIndex 3923
    /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 3: perf 94 · LCP 1890 ms · CLS 0.000 · TBT 245 ms · FCP 1890 ms · SI 2035 ms · JS 279 KB · benchmarkIndex 4025
```

## PERF-01 close-out (2026-10-01)

Last open P1: `/upit` TBT 250 ms (runs 188–313) and the product page at the line (187–250 ms across passes).
Same method as above: production build (`NEXT_PUBLIC_TEST_HOOKS=1 npm run build`, `next start -p 3100`), Lighthouse 13
mobile, fresh profile per run (consent banner open), `--min-benchmark 3500`. Budget method = applied throttling
(`--throttling devtools`, D112); simulated (Lantern) for reference. Diagnosis: Lighthouse JSON (`long-tasks`,
`bootup-time`) plus CDP traces with JS samples under the same conditions (4× CPU, 562.5 ms RTT, 1.47 Mbit/s), each
sample attributed to the Turbopack module factory being evaluated (`.lighthouse/trace-probe.mjs`, `modcost.mjs`;
git-ignored).

### Root causes

- **/upit hydration (145–190 ms task + 87–136 ms commit at ~5.1 s; baseline this session 338 ms, runs 226–357).** About
  85 % of the hydration task was first-time evaluation of the inquiry form's module graph, not React work:
  `lib/format/date` built an `Intl.DateTimeFormat` with `timeZone: "Europe/Belgrade"` at import (≈ 46 ms; it reached the
  page only through `lib/i18n/sr/shop`, which formats no date while hydrating) and zod with the inquiry schema and
  resolver (a 30 KB gzip chunk, ≈ 25 ms with compile). The form's props also serialized the whole vehicle tree
  (aliases, WMI lists, platforms: 20 KB of the inline RSC payload).
- **Product (document task after FCP 190–209 ms).** Two full relayouts right after the first paint (streamed HTML,
  then the UI font swap). The details block below the buy box had one `cv-auto` wrapper, but Chromium renders
  content-visibility:auto content up to about 1.5 viewport heights below the fold and the wrapper starts at 1286 px on a
  412 × 823 phone, so its ~330 layout objects were laid out in every pass (`contentvisibilityautostatechange`:
  `skipped: false`).
- **Every page with a price (found while re-measuring the other templates).** The first Intl formatter a renderer builds
  initialises ICU: ≈ 30 ms at 4× CPU whichever it is (`.lighthouse/intl-bench.mjs`: first `NumberFormat` 28–30 ms,
  first `DateTimeFormat` 31–32 ms, later ones 3–10 ms). Once the date formatter was lazy, `lib/format/money` paid it
  (`new Intl.NumberFormat("sr-Latn-RS")` at import; 36–43 ms in the hydration of /pretraga and Golf 7). Also on the
  hydration path: GSAP core and the overlay motion module (≈ 23 ms on /pretraga) because `SearchBox` imported
  `useMediaQuery` from `components/ui/motion`; the `next/image` client component (two components, a dozen hooks) in every
  card; a forced style + layout from reading `document.fonts.ready` in the root `ScrollTriggerRefresher` effect (Blink
  updates layout synchronously when `ready` is read after fonts loaded); on the ads landing the generations list, FAQ
  and link lists below the grid were laid out with every relayout (one 163 ms relayout when the UI font swapped in).
- **Not app code:** the framework boot task (evaluating the react-dom/Next chunk; V8 compiles the react-dom factory on
  the main thread) is the same on every page and moves with machine load (103–189 ms in these Lighthouse runs, 93–244 ms in the probe
  traces); on localhost (HTTP/1.1, six
  connections) the first-load chunks queue behind 562 ms round trips. `/pretraga` streams its results through
  `loading.tsx`; React reveals the boundary about 300 ms after the fallback paints, so one relayout of the results
  (~110 ms) always lands after FCP — kept, because the skeleton is what a client-side search shows at once.

### Changes

1. `lib/format/date`: the time-zone formatter is created on first use (D291).
2. `lib/format/number` / `money`: digits without Intl — `String(x)` gives the shortest decimal form, rounding half away
   from zero on it (what ICU does: `1.005` → `1,01`), dot grouping; output identical to
   `Intl.NumberFormat("sr-Latn-RS", { useGrouping: "always", … })`, checked on edge values and 20 000 seeded values in
   `tests/unit/format/number.test.ts`. `components/ui/Textarea` counter uses it (it built a new `NumberFormat` per
   render) (D291).
3. Inquiry form: zod + schema + resolver load on demand (`lib/validation/lazyResolver.ts`,
   `lib/validation/inquiryResolver.ts`), warmed in idle time after hydration and on the first focus in the form, awaited
   by the first validation at the latest; if the chunk cannot load, the submit shows „Upit nije poslat — proverite vezu
   sa internetom i pokušajte ponovo.“ and the next submit retries. The page passes only the fields the form reads from
   the vehicle tree (`InquiryVehicleTree`). `/upit` first-load JS 291 → 261 KB, inline payload −12 KB (D292).
4. Product page: `content-visibility` per detail group (codes/specs, the two product grids, landing links) with measured
   per-breakpoint intrinsic sizes; compatibility still renders on load. Landing (`components/catalog/LandingPage.tsx`):
   the same for the generations list, FAQ and „Srodne strane“ (D293).
5. `ProductThumb`: a plain `<img>` with `getImageProps()` (identical markup, attribute for attribute, to what
   `next/image` rendered; `preload` through `ReactDOM.preload`) — nothing left to hydrate per card (D293).
6. `useMediaQuery` moved to `lib/hooks/useMediaQuery.ts` (re-exported by `components/ui/motion` for the overlays):
   GSAP no longer loads with the search box; on /pretraga it now loads after hydration with the consent banner's idle
   warm-up. `/pretraga` first-load JS 268 → 240 KB (D293).
7. `ScrollTriggerRefresher` listens for `document.fonts` `loadingdone` instead of reading `document.fonts.ready` (D293).
8. `whenIdle` shared in `lib/dom/idle.ts` (ConsentGate and the inquiry form).

Behaviour checked on :3100 (`.lighthouse/inquiry-check.mjs`): an empty submit lists the four messages, blur validation
sets `aria-invalid` and the message, the validation chunk loads in idle time after hydration, a blocked chunk gives the
message above without a page error and the retry validates normally. Screenshots 390 + 1440 in
`docs/qa/fix/close/perf01/` (product groups, landing blocks, category cards, /upit errors); after scrolling end to end
no copy is left at opacity 0, no `pending` reveal state, no `.reveal-word`, no console errors.

### Applied throttling (budget method) — final build, medians

| Page | Runs | Perf | A11y | BP | SEO | LCP ms | CLS | TBT ms (runs) |
|---|---|---|---|---|---|---|---|---|
| `/` | 3 | 95 | 100 | 100 | 100 | 2304 | 0.001 | 141 (76–167) |
| `/delovi/kocioni-diskovi` | 3 | 96 | 100 | 100 | 100 | 1983 | 0.000 | 153 (117–175) |
| `/deo/kocioni-disk-prednji-276-24-mm-demo-0004` | 3 | 97 | 100 | 100 | 100 | 2035 | 0.000 | 89 (86–92) |
| same, second pass (benchmarkIndex 3548–4147) | 3 | 96 | 100 | 100 | 100 | 2063 | 0.000 | 121 (98–174) |
| same, last build (text-reveal race fix) | 3 | 96 | 100 | 100 | 100 | 2036 | 0.000 | 124 (118–151) |
| `/upit` | 3 | 96 | 100 | 96 | 100 | 1958 | 0.000 | 97 (91–148) |
| same, first pass (benchmarkIndex 3639–3663) | 3 | 94 | 100 | 96 | 100 | 1961 | 0.000 | 180 (155–216) |
| same, last build (text-reveal race fix) | 3 | 95 | 100 | 96 | 100 | 2075 | 0.000 | 193 (95–335) |
| `/delovi/kocioni-diskovi/volkswagen/golf` | 3 | 96 | 100 | 100 | 100 | 1951 | 0.000 | 142 (112–153) |
| `/pretraga?q=disk` (noindex) | 5 | 97 | 100 | 100 | 66 | 1804 | 0.000 | 159 (126–186) |
| `/vozila/volkswagen/golf/golf-7` | 3 | 96 | 100 | 100 | 100 | 1950 | 0.001 | 152 (129–155) |
| `/delovi` | 3 | 97 | 100 | 100 | 100 | 1942 | 0.000 | 86 (82–139) |
| `/ponuda/kocione-plocice-golf` (noindex) | 3 | 97 | 100 | 100 | 69 | 2022 | 0.001 | 89 (75–91) |
| `/kontakt` | 3 | 98 | 100 | 100 | 92 | 1905 | 0.000 | 54 (53–82) |
| `/za-majstore` | 3 | 97 | 100 | 100 | 100 | 2025 | 0.000 | 61 (58–62) |

Every storefront template is under 200 ms (`/upit` over its three passes: medians 97, 180 and 193 ms; nine runs
91–335 ms, median 155 ms — the slowest run has the same tasks as the others, each at the slow end of the machine's
noise: boot 148 ms, hydration commit 154 ms, post-FCP layout 153 ms); home, category and product meet performance ≥ 85, accessibility ≥ 95 and
SEO ≥ 95. On the way (same method, intermediate builds of this close-out): `/upit` 338 → 165 (lazy validation + lazy
date formatter) → 143 → final; product 224 → 98 after the per-group content-visibility; before the cross-page fixes
(Intl-free formatting, `useMediaQuery`, thumbnails, landing blocks) `/pretraga` measured 300 and 253 (5 runs), Golf 7
212 and the landing 215–217 ms. `/upit` best practices 96 is an `inspector-issues` entry (Content security policy)
that was there before the close-out. The runner still exits 1 on the internal J11 lab budgets (first-load JS 218–298 KB against 160–200 KB; product LCP 2035 ms
against 2000 ms) — not gate criteria.

### Simulated throttling (Lantern, reference) — final build

| Page | Perf | A11y | BP | SEO | LCP ms | CLS | TBT ms |
|---|---|---|---|---|---|---|---|
| `/` | 85 | 100 | 100 | 100 | 4293 | 0.001 | 15 |
| `/delovi/kocioni-diskovi` | 86 | 100 | 100 | 100 | 4142 | 0.000 | 17 |
| `/deo/kocioni-disk-prednji-276-24-mm-demo-0004` | 87 | 100 | 100 | 100 | 3989 | 0.000 | 14 |

Run with `/kontakt` first as a warm-up URL. In a fresh Chrome the first one or two Lighthouse runs of the runner's
session get a 400 ms main-thread task about 30 ms after navigation start, with no child events (before the HTML
response, so not page work); Lantern multiplies it by four and counts it (TBT 755–932 ms, performance 64–66). It followed
the run order, not the page: with `/kontakt` first it hit `/kontakt` (run 1 here, runs 1–2 in a two-run test) and home
was clean
(`perf01-closeout-home-simulate-rerun.txt` shows the stall on home when home runs first; a one-Chrome trace of three
runs in `.lighthouse/lh-trace-multi.mjs` reproduced it on run 1 only). Applied throttling is not affected (the stall
ends long before FCP).

### Raw runs — applied throttling (final build)

```
    perf01-closeout-devtools: /upit run 1: perf 94 · LCP 2283 ms · CLS 0.000 · TBT 155 ms · FCP 2283 ms · SI 2302 ms · JS 261 KB · benchmarkIndex 3648
    perf01-closeout-devtools: /upit run 2: perf 94 · LCP 1936 ms · CLS 0.000 · TBT 216 ms · FCP 1936 ms · SI 1964 ms · JS 261 KB · benchmarkIndex 3639
    perf01-closeout-devtools: /upit run 3: perf 95 · LCP 1961 ms · CLS 0.000 · TBT 180 ms · FCP 1961 ms · SI 1987 ms · JS 261 KB · benchmarkIndex 3663
    perf01-closeout-devtools: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 1: perf 96 · LCP 2063 ms · CLS 0.000 · TBT 121 ms · FCP 2063 ms · SI 2179 ms · JS 279 KB · benchmarkIndex 3571
    perf01-closeout-devtools: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 2: perf 95 · LCP 2070 ms · CLS 0.000 · TBT 174 ms · FCP 2070 ms · SI 2205 ms · JS 279 KB · benchmarkIndex 3548
    perf01-closeout-devtools: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 attempt 3: discarded (benchmarkIndex 3498 < 3500 (machine too busy))
    perf01-closeout-devtools: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 3: perf 97 · LCP 1969 ms · CLS 0.000 · TBT 98 ms · FCP 1969 ms · SI 2112 ms · JS 279 KB · benchmarkIndex 4147
    perf01-closeout-gate-devtools: / run 1: perf 96 · LCP 2317 ms · CLS 0.001 · TBT 76 ms · FCP 2184 ms · SI 2194 ms · JS 298 KB · benchmarkIndex 4132
    perf01-closeout-gate-devtools: / run 2: perf 94 · LCP 2304 ms · CLS 0.001 · TBT 141 ms · FCP 2185 ms · SI 2191 ms · JS 298 KB · benchmarkIndex 4177
    perf01-closeout-gate-devtools: / run 3: perf 95 · LCP 2144 ms · CLS 0.001 · TBT 167 ms · FCP 2011 ms · SI 2028 ms · JS 298 KB · benchmarkIndex 4041
    perf01-closeout-gate-devtools: /delovi/kocioni-diskovi run 1: perf 97 · LCP 1983 ms · CLS 0.000 · TBT 117 ms · FCP 1983 ms · SI 2089 ms · JS 290 KB · benchmarkIndex 4197
    perf01-closeout-gate-devtools: /delovi/kocioni-diskovi run 2: perf 95 · LCP 1958 ms · CLS 0.000 · TBT 175 ms · FCP 1958 ms · SI 2067 ms · JS 290 KB · benchmarkIndex 4149
    perf01-closeout-gate-devtools: /delovi/kocioni-diskovi run 3: perf 96 · LCP 1993 ms · CLS 0.000 · TBT 153 ms · FCP 1993 ms · SI 2094 ms · JS 290 KB · benchmarkIndex 4091
    perf01-closeout-gate-devtools: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 1: perf 97 · LCP 2035 ms · CLS 0.000 · TBT 89 ms · FCP 2035 ms · SI 2150 ms · JS 279 KB · benchmarkIndex 4125
    perf01-closeout-gate-devtools: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 2: perf 97 · LCP 2035 ms · CLS 0.000 · TBT 86 ms · FCP 2035 ms · SI 2175 ms · JS 279 KB · benchmarkIndex 4011
    perf01-closeout-gate-devtools: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 3: perf 97 · LCP 2034 ms · CLS 0.000 · TBT 92 ms · FCP 2034 ms · SI 2172 ms · JS 279 KB · benchmarkIndex 4098
    perf01-closeout-templates: /upit run 1: perf 96 · LCP 2213 ms · CLS 0.000 · TBT 97 ms · FCP 2213 ms · SI 2234 ms · JS 261 KB · benchmarkIndex 4089
    perf01-closeout-templates: /upit run 2: perf 97 · LCP 1941 ms · CLS 0.000 · TBT 91 ms · FCP 1941 ms · SI 1970 ms · JS 261 KB · benchmarkIndex 4141
    perf01-closeout-templates: /upit run 3: perf 96 · LCP 1958 ms · CLS 0.000 · TBT 148 ms · FCP 1958 ms · SI 1985 ms · JS 261 KB · benchmarkIndex 4057
    perf01-closeout-templates: /delovi run 1: perf 97 · LCP 1942 ms · CLS 0.000 · TBT 86 ms · FCP 1942 ms · SI 2058 ms · JS 221 KB · benchmarkIndex 4110
    perf01-closeout-templates: /delovi run 2: perf 98 · LCP 1897 ms · CLS 0.000 · TBT 82 ms · FCP 1897 ms · SI 2010 ms · JS 221 KB · benchmarkIndex 4056
    perf01-closeout-templates: /delovi run 3: perf 96 · LCP 1972 ms · CLS 0.000 · TBT 139 ms · FCP 1972 ms · SI 2090 ms · JS 221 KB · benchmarkIndex 3937
    perf01-closeout-templates: /vozila/volkswagen/golf/golf-7 run 1: perf 96 · LCP 1899 ms · CLS 0.001 · TBT 152 ms · FCP 1899 ms · SI 1926 ms · JS 234 KB · benchmarkIndex 3994
    perf01-closeout-templates: /vozila/volkswagen/golf/golf-7 run 2: perf 96 · LCP 1950 ms · CLS 0.001 · TBT 155 ms · FCP 1950 ms · SI 1966 ms · JS 234 KB · benchmarkIndex 4153
    perf01-closeout-templates: /vozila/volkswagen/golf/golf-7 run 3: perf 96 · LCP 1976 ms · CLS 0.001 · TBT 129 ms · FCP 1976 ms · SI 1996 ms · JS 234 KB · benchmarkIndex 3869
    perf01-closeout-templates: /delovi/kocioni-diskovi/volkswagen/golf run 1: perf 96 · LCP 1951 ms · CLS 0.000 · TBT 142 ms · FCP 1951 ms · SI 2002 ms · JS 290 KB · benchmarkIndex 4123
    perf01-closeout-templates: /delovi/kocioni-diskovi/volkswagen/golf run 2: perf 96 · LCP 1897 ms · CLS 0.000 · TBT 153 ms · FCP 1897 ms · SI 1954 ms · JS 290 KB · benchmarkIndex 4004
    perf01-closeout-templates: /delovi/kocioni-diskovi/volkswagen/golf run 3: perf 97 · LCP 2004 ms · CLS 0.000 · TBT 112 ms · FCP 2004 ms · SI 2046 ms · JS 290 KB · benchmarkIndex 4135
    perf01-closeout-templates: /ponuda/kocione-plocice-golf run 1: perf 97 · LCP 2022 ms · CLS 0.001 · TBT 91 ms · FCP 2022 ms · SI 2200 ms · JS 227 KB · benchmarkIndex 4201
    perf01-closeout-templates: /ponuda/kocione-plocice-golf run 2: perf 97 · LCP 2002 ms · CLS 0.001 · TBT 75 ms · FCP 2002 ms · SI 2181 ms · JS 227 KB · benchmarkIndex 4090
    perf01-closeout-templates: /ponuda/kocione-plocice-golf run 3: perf 97 · LCP 2025 ms · CLS 0.001 · TBT 89 ms · FCP 2025 ms · SI 2209 ms · JS 227 KB · benchmarkIndex 4093
    perf01-closeout-templates: /kontakt run 1: perf 98 · LCP 1890 ms · CLS 0.000 · TBT 82 ms · FCP 1890 ms · SI 1887 ms · JS 218 KB · benchmarkIndex 4128
    perf01-closeout-templates: /kontakt run 2: perf 98 · LCP 1905 ms · CLS 0.000 · TBT 54 ms · FCP 1905 ms · SI 1899 ms · JS 218 KB · benchmarkIndex 4198
    perf01-closeout-templates: /kontakt run 3: perf 98 · LCP 1952 ms · CLS 0.000 · TBT 53 ms · FCP 1952 ms · SI 1945 ms · JS 218 KB · benchmarkIndex 4135
    perf01-closeout-templates: /za-majstore run 1: perf 97 · LCP 2025 ms · CLS 0.000 · TBT 58 ms · FCP 2025 ms · SI 2038 ms · JS 258 KB · benchmarkIndex 4065
    perf01-closeout-templates: /za-majstore run 2: perf 97 · LCP 2048 ms · CLS 0.000 · TBT 61 ms · FCP 2048 ms · SI 2058 ms · JS 258 KB · benchmarkIndex 4125
    perf01-closeout-templates: /za-majstore run 3: perf 98 · LCP 1967 ms · CLS 0.000 · TBT 62 ms · FCP 1967 ms · SI 1981 ms · JS 258 KB · benchmarkIndex 4116
    perf01-closeout-search: /pretraga?q=disk run 1: perf 95 · LCP 1889 ms · CLS 0.000 · TBT 186 ms · FCP 1889 ms · SI 2064 ms · JS 240 KB · benchmarkIndex 4111
    perf01-closeout-search: /pretraga?q=disk run 2: perf 96 · LCP 1803 ms · CLS 0.000 · TBT 184 ms · FCP 1803 ms · SI 1970 ms · JS 240 KB · benchmarkIndex 3994
    perf01-closeout-search: /pretraga?q=disk run 3: perf 97 · LCP 1791 ms · CLS 0.000 · TBT 126 ms · FCP 1791 ms · SI 1970 ms · JS 240 KB · benchmarkIndex 4179
    perf01-closeout-search: /pretraga?q=disk run 4: perf 97 · LCP 1804 ms · CLS 0.000 · TBT 130 ms · FCP 1804 ms · SI 1962 ms · JS 240 KB · benchmarkIndex 4144
    perf01-closeout-search: /pretraga?q=disk run 5: perf 97 · LCP 1818 ms · CLS 0.000 · TBT 159 ms · FCP 1818 ms · SI 1980 ms · JS 240 KB · benchmarkIndex 4169
```

### Raw runs — simulated throttling (final build)

```
    perf01-closeout-gate-simulate: /kontakt run 1: perf 70 · LCP 3558 ms · CLS 0.000 · TBT 913 ms · FCP 1362 ms · SI 1758 ms · JS 218 KB · benchmarkIndex 4145
    perf01-closeout-gate-simulate: /kontakt run 2: perf 91 · LCP 3391 ms · CLS 0.000 · TBT 12 ms · FCP 1363 ms · SI 1363 ms · JS 218 KB · benchmarkIndex 4073
    perf01-closeout-gate-simulate: /kontakt run 3: perf 92 · LCP 3390 ms · CLS 0.000 · TBT 12 ms · FCP 1362 ms · SI 1362 ms · JS 218 KB · benchmarkIndex 4126
    perf01-closeout-gate-simulate: / run 1: perf 85 · LCP 4291 ms · CLS 0.001 · TBT 15 ms · FCP 1509 ms · SI 1509 ms · JS 298 KB · benchmarkIndex 4110
    perf01-closeout-gate-simulate: / run 2: perf 85 · LCP 4309 ms · CLS 0.001 · TBT 23 ms · FCP 1509 ms · SI 1509 ms · JS 298 KB · benchmarkIndex 4126
    perf01-closeout-gate-simulate: / run 3: perf 85 · LCP 4293 ms · CLS 0.001 · TBT 15 ms · FCP 1510 ms · SI 1510 ms · JS 298 KB · benchmarkIndex 4125
    perf01-closeout-gate-simulate: /delovi/kocioni-diskovi run 1: perf 86 · LCP 4156 ms · CLS 0.000 · TBT 27 ms · FCP 1510 ms · SI 1510 ms · JS 290 KB · benchmarkIndex 4073
    perf01-closeout-gate-simulate: /delovi/kocioni-diskovi run 2: perf 86 · LCP 4140 ms · CLS 0.000 · TBT 16 ms · FCP 1511 ms · SI 1511 ms · JS 290 KB · benchmarkIndex 4149
    perf01-closeout-gate-simulate: /delovi/kocioni-diskovi run 3: perf 86 · LCP 4142 ms · CLS 0.000 · TBT 17 ms · FCP 1511 ms · SI 1511 ms · JS 290 KB · benchmarkIndex 4143
    perf01-closeout-gate-simulate: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 1: perf 87 · LCP 4003 ms · CLS 0.000 · TBT 22 ms · FCP 1360 ms · SI 1360 ms · JS 279 KB · benchmarkIndex 4145
    perf01-closeout-gate-simulate: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 2: perf 87 · LCP 3988 ms · CLS 0.000 · TBT 14 ms · FCP 1360 ms · SI 1360 ms · JS 279 KB · benchmarkIndex 4180
    perf01-closeout-gate-simulate: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 3: perf 87 · LCP 3989 ms · CLS 0.000 · TBT 14 ms · FCP 1361 ms · SI 1361 ms · JS 279 KB · benchmarkIndex 3957
    perf01-closeout-home-simulate-rerun: / run 1: perf 65 · LCP 4329 ms · CLS 0.001 · TBT 831 ms · FCP 1509 ms · SI 2248 ms · JS 298 KB · benchmarkIndex 4088
    perf01-closeout-home-simulate-rerun: / run 2: perf 64 · LCP 4297 ms · CLS 0.000 · TBT 932 ms · FCP 1511 ms · SI 2102 ms · JS 298 KB · benchmarkIndex 4044
    perf01-closeout-home-simulate-rerun: / run 3: perf 85 · LCP 4302 ms · CLS 0.001 · TBT 20 ms · FCP 1509 ms · SI 1509 ms · JS 298 KB · benchmarkIndex 4104
```

### Gates on the final code

The first full Playwright run after the battery failed once on desktop-1440 (`storefront.spec.ts` „text reveal leaves
no copy hidden on home, category and product“): on the category page the intro `Disclosure` summary kept three
`.reveal-word` spans while marked `data-reveal-state="done"` (Playwright trace). Cause in
`components/TextRevealGlobal.tsx`: one IntersectionObserver batch can carry an element's entry *and* its exit above the
root (a fast scroll); the entry split the words and started the restore timer, the exit's `revealNow()` → `finish()`
cleared that timer and marked the element done, so the spans stayed. `finish()` now always calls `restoreWords()` (a
no-op unless the element is split). Regression test: `tests/unit/components/TextRevealGlobal.test.tsx` (it fails
without the fix). The same e2e test passed 10 of 10 repeats before the fix, so the race is intermittent and older than
this close-out; fixed anyway.

Final build (differs from the measured build only in the text-reveal chunk — the other JS chunks are byte-identical by
content hash — and one CSS rule fewer from source text Prettier re-wrapped): `npx tsc --noEmit` exit 0 ·
`npm run lint` 0 errors, 0 warnings · `npm test` 69 files passed + 1 skipped, 1221 tests passed + 4 skipped ·
Playwright on :3100: 105 passed, 27 skipped by design, 0 failed in 9.7 min (`docs/qa/fix/e2e-final.txt`). The
Lighthouse rows „last build“ above come from this build (`perf01-closeout-final-check.txt`):

```
    perf01-closeout-final-check: /upit run 1: perf 96 · LCP 2222 ms · CLS 0.000 · TBT 95 ms · FCP 2222 ms · SI 2243 ms · JS 261 KB · benchmarkIndex 3867
    perf01-closeout-final-check: /upit run 2: perf 95 · LCP 1996 ms · CLS 0.000 · TBT 193 ms · FCP 1996 ms · SI 2017 ms · JS 261 KB · benchmarkIndex 4169
    perf01-closeout-final-check: /upit run 3: perf 90 · LCP 2075 ms · CLS 0.000 · TBT 335 ms · FCP 2075 ms · SI 2124 ms · JS 261 KB · benchmarkIndex 3954
    perf01-closeout-final-check: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 attempt 1: discarded (benchmarkIndex 3340 < 3500 (machine too busy))
    perf01-closeout-final-check: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 1: perf 97 · LCP 2036 ms · CLS 0.000 · TBT 118 ms · FCP 2036 ms · SI 2176 ms · JS 279 KB · benchmarkIndex 4132
    perf01-closeout-final-check: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 2: perf 96 · LCP 2034 ms · CLS 0.000 · TBT 151 ms · FCP 2034 ms · SI 2178 ms · JS 279 KB · benchmarkIndex 4119
    perf01-closeout-final-check: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 3: perf 96 · LCP 2128 ms · CLS 0.000 · TBT 124 ms · FCP 2128 ms · SI 2260 ms · JS 279 KB · benchmarkIndex 4119
```

## PERF-01 final re-measure (2026-10-01)

A fresh re-measure of the close-out's final build (same method: production build on :3100, Lighthouse 13 mobile,
applied throttling `--throttling devtools` = the budget method (D112), fresh profile per run, consent banner open)
did not reproduce the close-out's home and category numbers (141 and 153 ms from 3 runs). Before, 5 runs each,
benchmarkIndex 3,833–4,211:

```
    before: /                        TBT 219 · 288 · 314 · 242 · 226 ms → median 242 ms, performance 91
    before: /delovi/kocioni-diskovi  TBT 237 · 380 · 261 · 227 · 365 ms → median 261 ms, performance 93
    before: product                  TBT 146–169 ms
```

So the close-out's 3-run medians were favourable runs, not a regression: the long tasks were the same in kind.

### Where the time went (before)

Lighthouse JSON (`long-tasks`, `bootup-time`), Lighthouse traces (`.lighthouse/lh-trace.mjs`, summarised by
`lhsum.mjs`) and CDP traces with JS samples under the same throttling (`trace-probe.mjs`, `modcost.mjs`; all
git-ignored). Every task over 50 ms after FCP on home and category, per run:

1. **Framework boot, ≈ 3.1–3.2 s, 126–254 ms (TBT 76–204 ms).** `EvaluateScript` of the framework chunk (React DOM
   19.3 canary + the Next app router, 74 KB gzip) once it arrives. In the sampled traces about 60 % of the task is
   self time of the Turbopack runtime's instantiate frame — V8 compiling module factories lazily on the main thread
   the first time they run (React DOM's factory alone ≈ 22 ms at 4×) — and the rest is evaluating them. No app
   module runs in it; `/kontakt` has the same task (104–132 ms). It was the largest and steadiest contributor.
2. **Render at FCP, ≈ 1.95–2.2 s, 95–317 ms (TBT 0–246 ms).** The render-blocking CSS lands at ≈ 1.65 s; the parser
   yields after 10 ms and the first frame lays out the partial document (180–290 layout objects, 190–260 ms with
   first-use font and text costs). Public Sans latin (27 KB, the largest of the three preloaded faces) shares the
   slow-4G link with the CSS and finishes 250–350 ms after it; its swap relays out the whole document (530–605
   objects, 60–180 ms). When Chromium holds the first frame for the preloaded font, that relayout is part of FCP and
   costs nothing; when the first frame is presented first, the relayout lands after FCP. The rest of the HTML
   (footer, inline RSC payload) is parsed in separate 10–25 ms tasks, so the inline payload is not what makes this
   task long.
3. **End of hydration, ≈ 5.1–5.5 s, 51–98 ms (TBT 1–48 ms).** When the last page chunks arrive: on home GSAP and
   ScrollTrigger are evaluated and registered inside the hydration render (HeroStage); on the category page the
   hydration commit. Small fonts loaded on demand (Archivo Expanded 600, Archivo Condensed, Martian Mono) add one
   or two 27–41 ms relayouts at 3.0–3.4 s.

### Change

**V8 explicit compile hints on the framework chunks (D294).** `scripts/build/compile-hints.mjs`, run by
`npm run build` after `next build`, prepends `//# allFunctionsCalledOnLoad` (Chrome 136+,
[v8.dev/blog/explicit-compile-hints](https://v8.dev/blog/explicit-compile-hints)) to the build manifest's
`rootMainFiles` — the Turbopack runtime, React DOM and the Next router that every App Router page evaluates on load.
V8 then compiles those files eagerly on the script-streaming thread instead of function by function on the main
thread; other browsers read a comment. Page chunks keep lazy compilation. In the sampled trace the 86–93 ms boot
task disappears (no task over 40 ms between 3.0 and 3.5 s); under Lighthouse it is absent in 12 of the 15 final
runs and 53–97 ms in the other three. Unit test: `tests/unit/build/compile-hints.test.ts`.

**Tried and not shipped (D295):** `<link rel="expect" href="#sadrzaj" blocking="render">` in the root layout, so
the first frame waits for `<main>` (the technique React's own Fizz uses behind a flag). With the compile hints in both
builds: home 74 ms (20–158), category 100 ms (50–272), FCP up to 200 ms later in some runs
(`perf01-final-expect-experiment.txt`) against 87 and 48 ms without it (`perf01-final-hints-pass1.txt`) — no
better, and it delays first paint, so the root layout is unchanged. Font loading is unchanged too: making Public Sans
latin win the race against the CSS would mean dropping the latin-ext or display preload (another swap later) or
`font-display: optional` (fallback text on a first slow visit), both design-system changes for a task that now
costs 0–100 ms.

### Applied throttling (budget method) — final build, 5-run medians

| Page | Runs | Perf | A11y | BP | SEO | LCP ms | CLS | TBT ms (runs) |
|---|---|---|---|---|---|---|---|---|
| `/` | 5 | 96 | 100 | 100 | 100 | 2228 | 0.001 | 88 (39–98) |
| `/delovi/kocioni-diskovi` | 5 | 98 | 100 | 100 | 100 | 1959 | 0.000 | 77 (42–101) |
| `/deo/kocioni-disk-prednji-276-24-mm-demo-0004` | 5 | 97 | 100 | 100 | 100 | 2048 | 0.000 | 47 (0–56) |
| `/`, first pass on the same build | 5 | 97 | — | — | — | 2175 | 0.001 | 87 (23–103) |
| `/delovi/kocioni-diskovi`, first pass | 5 | 98 | — | — | — | 1997 | 0.000 | 48 (41–89) |

benchmarkIndex 4,034–4,223, no run discarded. Every page is under 200 ms with performance ≥ 85, accessibility ≥ 95
and SEO ≥ 95; the slowest of the twenty home and category runs on this build is 103 ms. What remains is task 2 above
when the first frame is presented before the font swap, plus 0–13 ms from the end of hydration. The other templates
were last measured in the close-out (above), before the compile hints, which only remove main-thread work. The runner
still exits 1 on the internal J11 lab budgets (first-load JS 279–298 KB against 160–180 KB; product LCP 2048 ms
against 2000 ms) — not gate criteria.

### Simulated throttling (Lantern, reference) — final build, 3 runs

| Page | Perf | A11y | BP | SEO | LCP ms | CLS | TBT ms |
|---|---|---|---|---|---|---|---|
| `/` | 86 | 100 | 100 | 100 | 4214 | 0.001 | 0 |
| `/delovi/kocioni-diskovi` | 87 | 100 | 100 | 100 | 4070 | 0.000 | 0 |
| `/deo/kocioni-disk-prednji-276-24-mm-demo-0004` | 88 | 100 | 100 | 100 | 3917 | 0.000 | 0 |

`/kontakt` ran first as the warm-up URL (see the close-out on Chrome's cold-start stall); its first run was clean
this time.

### Raw runs — applied throttling (final build)

```
    perf01-final-devtools: / run 1: perf 96 · LCP 2306 ms · CLS 0.001 · TBT 39 ms · FCP 2122 ms · SI 2123 ms · JS 298 KB · benchmarkIndex 4140
    perf01-final-devtools: / run 2: perf 97 · LCP 2205 ms · CLS 0.001 · TBT 88 ms · FCP 2039 ms · SI 2046 ms · JS 298 KB · benchmarkIndex 4085
    perf01-final-devtools: / run 3: perf 96 · LCP 2228 ms · CLS 0.001 · TBT 92 ms · FCP 2062 ms · SI 2074 ms · JS 298 KB · benchmarkIndex 4040
    perf01-final-devtools: / run 4: perf 96 · LCP 2179 ms · CLS 0.001 · TBT 98 ms · FCP 2013 ms · SI 2024 ms · JS 298 KB · benchmarkIndex 4108
    perf01-final-devtools: / run 5: perf 96 · LCP 2240 ms · CLS 0.001 · TBT 86 ms · FCP 2073 ms · SI 2083 ms · JS 298 KB · benchmarkIndex 4049
    perf01-final-devtools: /delovi/kocioni-diskovi run 1: perf 98 · LCP 1912 ms · CLS 0.000 · TBT 77 ms · FCP 1912 ms · SI 2011 ms · JS 290 KB · benchmarkIndex 4167
    perf01-final-devtools: /delovi/kocioni-diskovi run 2: perf 97 · LCP 1979 ms · CLS 0.000 · TBT 69 ms · FCP 1979 ms · SI 2072 ms · JS 290 KB · benchmarkIndex 4034
    perf01-final-devtools: /delovi/kocioni-diskovi run 3: perf 97 · LCP 1959 ms · CLS 0.000 · TBT 101 ms · FCP 1959 ms · SI 2059 ms · JS 290 KB · benchmarkIndex 4126
    perf01-final-devtools: /delovi/kocioni-diskovi run 4: perf 98 · LCP 1877 ms · CLS 0.000 · TBT 82 ms · FCP 1877 ms · SI 1973 ms · JS 290 KB · benchmarkIndex 4123
    perf01-final-devtools: /delovi/kocioni-diskovi run 5: perf 98 · LCP 1970 ms · CLS 0.000 · TBT 42 ms · FCP 1970 ms · SI 2070 ms · JS 290 KB · benchmarkIndex 4190
    perf01-final-devtools: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 1: perf 97 · LCP 2061 ms · CLS 0.000 · TBT 0 ms · FCP 2061 ms · SI 2189 ms · JS 279 KB · benchmarkIndex 4157
    perf01-final-devtools: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 2: perf 97 · LCP 2031 ms · CLS 0.000 · TBT 52 ms · FCP 2031 ms · SI 2169 ms · JS 279 KB · benchmarkIndex 4170
    perf01-final-devtools: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 3: perf 97 · LCP 2050 ms · CLS 0.000 · TBT 20 ms · FCP 2050 ms · SI 2190 ms · JS 279 KB · benchmarkIndex 4083
    perf01-final-devtools: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 4: perf 97 · LCP 2048 ms · CLS 0.000 · TBT 47 ms · FCP 2048 ms · SI 2187 ms · JS 279 KB · benchmarkIndex 4156
    perf01-final-devtools: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 5: perf 98 · LCP 1991 ms · CLS 0.000 · TBT 56 ms · FCP 1991 ms · SI 2132 ms · JS 279 KB · benchmarkIndex 4116
    perf01-final-hints-pass1: / run 1: perf 96 · LCP 2265 ms · CLS 0.001 · TBT 23 ms · FCP 2115 ms · SI 2118 ms · JS 298 KB · benchmarkIndex 4147
    perf01-final-hints-pass1: / run 2: perf 97 · LCP 2150 ms · CLS 0.001 · TBT 99 ms · FCP 1984 ms · SI 1994 ms · JS 298 KB · benchmarkIndex 4065
    perf01-final-hints-pass1: / run 3: perf 96 · LCP 2175 ms · CLS 0.001 · TBT 103 ms · FCP 2008 ms · SI 2020 ms · JS 298 KB · benchmarkIndex 4094
    perf01-final-hints-pass1: / run 4: perf 97 · LCP 2186 ms · CLS 0.001 · TBT 70 ms · FCP 2037 ms · SI 2048 ms · JS 298 KB · benchmarkIndex 4128
    perf01-final-hints-pass1: / run 5: perf 97 · LCP 2121 ms · CLS 0.001 · TBT 87 ms · FCP 1955 ms · SI 1970 ms · JS 298 KB · benchmarkIndex 4090
    perf01-final-hints-pass1: /delovi/kocioni-diskovi run 1: perf 97 · LCP 2022 ms · CLS 0.000 · TBT 48 ms · FCP 2022 ms · SI 2112 ms · JS 290 KB · benchmarkIndex 4223
    perf01-final-hints-pass1: /delovi/kocioni-diskovi run 2: perf 98 · LCP 1997 ms · CLS 0.000 · TBT 63 ms · FCP 1997 ms · SI 2096 ms · JS 290 KB · benchmarkIndex 4152
    perf01-final-hints-pass1: /delovi/kocioni-diskovi run 3: perf 97 · LCP 2005 ms · CLS 0.000 · TBT 89 ms · FCP 2005 ms · SI 2098 ms · JS 290 KB · benchmarkIndex 4077
    perf01-final-hints-pass1: /delovi/kocioni-diskovi run 4: perf 98 · LCP 1993 ms · CLS 0.000 · TBT 43 ms · FCP 1993 ms · SI 2087 ms · JS 290 KB · benchmarkIndex 4071
    perf01-final-hints-pass1: /delovi/kocioni-diskovi run 5: perf 98 · LCP 1945 ms · CLS 0.000 · TBT 41 ms · FCP 1945 ms · SI 2042 ms · JS 290 KB · benchmarkIndex 4208
```

### Raw runs — simulated throttling (final build)

```
    perf01-final-simulate: /kontakt run 1: perf 87 · LCP 3932 ms · CLS 0.000 · TBT 0 ms · FCP 1366 ms · SI 1366 ms · JS 218 KB · benchmarkIndex 4066
    perf01-final-simulate: /kontakt run 2: perf 92 · LCP 3318 ms · CLS 0.000 · TBT 0 ms · FCP 1364 ms · SI 1364 ms · JS 218 KB · benchmarkIndex 4213
    perf01-final-simulate: /kontakt run 3: perf 92 · LCP 3324 ms · CLS 0.000 · TBT 0 ms · FCP 1368 ms · SI 1368 ms · JS 218 KB · benchmarkIndex 4030
    perf01-final-simulate: / run 1: perf 85 · LCP 4228 ms · CLS 0.001 · TBT 0 ms · FCP 1510 ms · SI 1510 ms · JS 298 KB · benchmarkIndex 4109
    perf01-final-simulate: / run 2: perf 86 · LCP 4213 ms · CLS 0.001 · TBT 0 ms · FCP 1510 ms · SI 1510 ms · JS 298 KB · benchmarkIndex 4107
    perf01-final-simulate: / run 3: perf 86 · LCP 4214 ms · CLS 0.001 · TBT 0 ms · FCP 1511 ms · SI 1511 ms · JS 298 KB · benchmarkIndex 4143
    perf01-final-simulate: /delovi/kocioni-diskovi run 1: perf 86 · LCP 4078 ms · CLS 0.000 · TBT 0 ms · FCP 1513 ms · SI 1513 ms · JS 290 KB · benchmarkIndex 4070
    perf01-final-simulate: /delovi/kocioni-diskovi run 2: perf 87 · LCP 4066 ms · CLS 0.000 · TBT 0 ms · FCP 1510 ms · SI 1510 ms · JS 290 KB · benchmarkIndex 4151
    perf01-final-simulate: /delovi/kocioni-diskovi run 3: perf 87 · LCP 4070 ms · CLS 0.000 · TBT 0 ms · FCP 1514 ms · SI 1514 ms · JS 290 KB · benchmarkIndex 4167
    perf01-final-simulate: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 1: perf 88 · LCP 3925 ms · CLS 0.000 · TBT 0 ms · FCP 1362 ms · SI 1362 ms · JS 279 KB · benchmarkIndex 4172
    perf01-final-simulate: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 2: perf 88 · LCP 3916 ms · CLS 0.000 · TBT 0 ms · FCP 1361 ms · SI 1361 ms · JS 279 KB · benchmarkIndex 4175
    perf01-final-simulate: /deo/kocioni-disk-prednji-276-24-mm-demo-0004 run 3: perf 88 · LCP 3917 ms · CLS 0.000 · TBT 0 ms · FCP 1361 ms · SI 1361 ms · JS 279 KB · benchmarkIndex 4184
```

### Raw runs — rejected `<link rel="expect">` build (D295)

```
    perf01-final-expect-experiment: / run 1: perf 95 · LCP 2465 ms · CLS 0.001 · TBT 24 ms · FCP 2332 ms · SI 2327 ms · JS 298 KB · benchmarkIndex 3918
    perf01-final-expect-experiment: / run 2: perf 94 · LCP 2355 ms · CLS 0.001 · TBT 158 ms · FCP 2172 ms · SI 2182 ms · JS 298 KB · benchmarkIndex 3604
    perf01-final-expect-experiment: / run 3: perf 96 · LCP 2209 ms · CLS 0.001 · TBT 120 ms · FCP 2042 ms · SI 2068 ms · JS 298 KB · benchmarkIndex 3861
    perf01-final-expect-experiment: / attempt 4: discarded (benchmarkIndex 3106 < 3500 (machine too busy))
    perf01-final-expect-experiment: / attempt 5: discarded (benchmarkIndex 1855 < 3500 (machine too busy))
    perf01-final-expect-experiment: / run 4: perf 97 · LCP 2194 ms · CLS 0.001 · TBT 20 ms · FCP 2094 ms · SI 2093 ms · JS 298 KB · benchmarkIndex 4036
    perf01-final-expect-experiment: / run 5: perf 97 · LCP 2153 ms · CLS 0.001 · TBT 74 ms · FCP 2019 ms · SI 2027 ms · JS 298 KB · benchmarkIndex 3986
    perf01-final-expect-experiment: /delovi/kocioni-diskovi run 1: perf 92 · LCP 2061 ms · CLS 0.000 · TBT 272 ms · FCP 2061 ms · SI 2175 ms · JS 290 KB · benchmarkIndex 3888
    perf01-final-expect-experiment: /delovi/kocioni-diskovi run 2: perf 97 · LCP 1936 ms · CLS 0.000 · TBT 96 ms · FCP 1936 ms · SI 2036 ms · JS 290 KB · benchmarkIndex 4068
    perf01-final-expect-experiment: /delovi/kocioni-diskovi run 3: perf 96 · LCP 1985 ms · CLS 0.000 · TBT 126 ms · FCP 1985 ms · SI 2092 ms · JS 290 KB · benchmarkIndex 4039
    perf01-final-expect-experiment: /delovi/kocioni-diskovi run 4: perf 98 · LCP 1904 ms · CLS 0.000 · TBT 100 ms · FCP 1904 ms · SI 2009 ms · JS 290 KB · benchmarkIndex 4063
    perf01-final-expect-experiment: /delovi/kocioni-diskovi run 5: perf 98 · LCP 1947 ms · CLS 0.000 · TBT 50 ms · FCP 1947 ms · SI 2045 ms · JS 290 KB · benchmarkIndex 4115
```

### Gates on the final code

`NEXT_PUBLIC_TEST_HOOKS=1 npm run build` exit 0 (the compile-hint step reports the six root main files) ·
`npx tsc --noEmit` exit 0 · `npm run lint` 0 errors, 0 warnings · `npm test` 70 files passed + 1 skipped, 1223 tests
passed + 4 skipped · Playwright on :3100: 105 passed, 27 skipped by design, 0 failed in 9.4 min
(`docs/qa/fix/e2e-final.txt`). On home, category and product at 390 px after scrolling end to end: no console errors
or warnings, no copy left at opacity 0, no `pending` reveal state, no `.reveal-word`, and the served runtime chunk
starts with the hint. No UI change, so no new screenshots.
