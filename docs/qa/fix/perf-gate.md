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
