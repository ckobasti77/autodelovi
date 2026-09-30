# 3D hero — web QA (step 10)

> Part of the SKLOP docs — index: [README](../README.md). Contract: [3D-CONTRACT §F7–F9](../3D-CONTRACT.md). Decisions: D97–D112 in [DECISIONS](../DECISIONS.md).

Date: 2026-09-30 · production build (`next build` + `next start -p 3100`) · Windows 11; Lighthouse 13.5 drives the Chrome at `CHROME_PATH` (headless), Playwright 1.63 drives its Chromium for e2e and captures · evidence in `docs/3d/web-qa/` (WebP) and `.lighthouse/` (JSON, git-ignored).

## 1. Verdicts

| Area | Result | Verdict |
|---|---|---|
| Poster → 3D (1440 and 390) | SSR poster first (no canvas, no model request before intent); 3D after intent, 600 ms crossfade, poster kept underneath | Pass |
| Part selection | via the parts list and via `__sklop3d.selectPart` → panel with Convex products at 1440 (drawer) and 390 (sheet) | Pass |
| Deep link `/?deo=<slug>` | explodes to the part's stage, selects, opens the panel; unknown slug ignored | Pass (fixed a ScrollTrigger refresh race, §6) |
| Console | 0 errors on every hero flow (e2e + capture scripts) | Pass |
| Lighthouse mobile (applied throttling, the budget method — D112) | latest 5-run medians: perf **92**, LCP **2263 ms**, CLS **0.001**, TBT **226 ms** (previous batch: 90 / 2269 ms / 0.001 / 297 ms) | Pass |
| Lighthouse mobile (default simulated) | perf 85, LCP 4312 ms, CLS 0.001, TBT 26 ms | LCP over budget — Lantern artefact on localhost, §2.2 (P2, step 21) |
| Lighthouse desktop preset | perf 99, LCP 885 ms, CLS 0, TBT 0 ms | Pass |
| 3D chunk budget (≤ 350 KB gzip) | 281.8 KB (+ 27.1 KB three-mesh-bvh, fine pointers only) | Pass |
| Scroll smoothness (4× CPU, integrated GPU) | median 16.7 ms, p95 33 ms, ≤ 6 % frames over 33 ms | Pass |
| Accessibility | axe WCAG 2.2 AA 0 violations (home, panel open); focus visible on every hero stop; stage focus after close is visible | Pass |
| Visual review (impeccable + design-taste) | assembled / exploded / selected at 1440 and 390 reviewed; detector 0 findings | No P0/P1 open |

## 2. Lighthouse

`node tests/lighthouse/run.mjs [--runs N] [--throttling devtools|simulate] [--desktop] /` (median of N; JSON in `.lighthouse/`).

### 2.1 Mobile, applied throttling (budget method)

Latest two 5-run batches (after D113, lazy drag plugins; `node tests/lighthouse/run.mjs --runs 5 --throttling devtools /`):

| Batch | Runs (perf · LCP · TBT) | Median perf | Median LCP | Median CLS | Median TBT |
|---|---|---|---|---|---|
| A | 92·2335·218 · 91·2263·270 · 82·2781·372 · 86·2140·447 · 90·2269·297 | 90 | 2269 ms | 0.001 | 297 ms |
| B | 90·2483·235 · 81·2035·644 · 93·2209·195 · 92·2263·226 · 92·2264·225 | **92** | **2263 ms** | **0.001** | **226 ms** |

TBT varies run to run (195–644 ms): the document's parse/style/layout tasks land just before or just after FCP, and under throttling the late first-load chunks hydrate as separate tasks at ~4.8–5.3 s. Before D113 the medians were 264–363 ms.

Earlier batch (before D113), for reference:

| Run | Perf | LCP | CLS | TBT | FCP |
|---|---|---|---|---|---|
| 1 | 89 | 2513 ms | 0.001 | 264 ms | 2513 ms |
| 2 | 88 | 2393 ms | 0.002 | 315 ms | 2393 ms |
| 3 | 91 | 2386 ms | 0.001 | 218 ms | 2386 ms |
| 4 | 91 | 2317 ms | 0.001 | 254 ms | 2317 ms |
| 5 | 86 | 2677 ms | 0.001 | 284 ms | 2677 ms |
| **Median** | **89** | **2393 ms** | **0.001** | **264 ms** | 2393 ms |

Accessibility 100 · Best practices 100 · SEO 100. The page really loads on slow 4G (562 ms RTT, 1.47 Mbps) with a 4× slower CPU. LCP = FCP = the headline (RevealText, server-split): it is gated by the render-blocking CSS, which shares the first round trips with four preloaded fonts (76 KB), and by the first parse/style/layout task (~580 ms at 4×).

### 2.2 Mobile, default simulated throttling (Lantern), 5 runs

Median: perf **86** · LCP **4213 ms** · CLS 0.001 · TBT 20 ms · FCP 1360 ms (runs: LCP 4212–4400 ms); latest 3-run check: perf 85 · LCP 4312 ms · TBT 26 ms.

Why the simulated LCP is not the page's LCP (measured with traces during this step):

- On localhost every request finishes in ~60 ms. Headless Chrome paints the first frame on the main thread at ~82 ms, but software raster presents it only at 185–250 ms. The async first-load chunks evaluate at 92–159 ms — *between* paint and presentation.
- Lantern cuts its LCP graph at the observed LCP timestamp. Every chunk that was downloaded and evaluated before that timestamp counts as render-blocking, so it charges the whole first-load JS (≈ 324 KB gzip in 21 chunks) plus fonts, CSS and HTML to the headline (≈ 500 KB). It then replays them over simulated HTTP/1.1 with 150 ms RTT and 1.6 Mbps.
- Evidence: `/prijava`, which has no 3D at all, gets 3.93 s; with JS blocked the home page gets 2.56 s. One run in which the frame happened to present before the chunks evaluated gave **2412 ms / perf 98**.
- Behind a real network (a deployed site, PageSpeed Insights) the chunks arrive after the first paint and are excluded. HUMAN-TODO carries the PSI check after launch.

### 2.3 Desktop preset (Lighthouse desktop config), 3 runs
Median: perf **99** · LCP **885 ms** (the poster, preloaded ≥ 768 px) · CLS 0 · TBT 0 ms · FCP 371 ms. (Earlier runner versions applied mobile throttling to the desktop screen; fixed in this step.)

### 2.4 What this step changed for load performance
| Change | Effect |
|---|---|
| Draggable + InertiaPlugin load with the first bottom sheet instead of in every first load — D113 | first-load JS 321.6 → 303.2 KB gzip; applied-throttling TBT medians 264–363 → 226–297 ms |
| Canvas never in the first load; overlays (panel, parts list, callout, vehicle picker) lazy — D106 | first-load JS 339 → 324 KB gzip on home, less hydration work |
| WebGL2 probe moved from hydration to 3D start — D105 | −13 ms main thread at hydration (≈ −53 ms at 4×) |
| 3D starts in idle time only with a fine pointer — D105 | phones no longer download ~2 MB / run the GPU setup unasked; applied-throttling TTI 24 s → 5.4 s, TBT 2.1 s → 0.26 s |
| Poster high priority only ≥ 768 px (scoped preload) — D98 | phones spend the first round trips on CSS/fonts |
| First caption via CSS RevealText; no ScrollTrigger refresh before `load` — D106 | fewer long tasks in hydration |
| zod-free manifest guard — D102 | 3D chunk 381 → 291 KB gzip (now 282 KB after the BVH split) |

### 2.5 Remaining (systemic, step 21/22 — P2)
The rest of the gap to the simulated LCP is the shared shell, not the hero. First-load JS: React DOM 72 KB, GSAP ~44 KB (Draggable/Inertia now lazy, D113), Next runtime 34 KB, Convex 21 KB. Fonts: four preloads, 76 KB. Candidates:
- mount the header sheets lazily (radix Dialog stays in the first load);
- review which fonts need preloading;
- measure PSI on the deployed site.

## 3. Bytes

| Item | Size |
|---|---|
| First-load JS, home (21 scripts, hooks build) | 303.2 KB gzip (321.6 before D113) |
| Canvas chunks (three + R3F + loaders + scene) | 183.0 + 98.8 = 281.8 KB gzip |
| three-mesh-bvh (fine pointer only) | 27.1 KB gzip |
| Overlay chunks warmed at start | ≈ 16 KB gzip |
| `car.glb` (high) / `car-lite.glb` (mid) | 3.55 MB / 1.6 MB (budget ≤ 8 MB) |
| `env/studio-512.hdr` | 401 KB |
| Mobile poster `car-assembled-m-828.avif` | 14 KB |

## 4. Runtime cost

- **Scroll through the whole explode** (`node scripts/qa/hero-frames.mjs --gpu`, 4× CPU throttle, Intel UHD via ANGLE/D3D11, 60 wheel steps):
  - desktop 1440 (high): 496 frames, median 16.7 ms, p95 33.4 ms, 6.0 % over 33 ms, 11 long tasks (worst 82 ms);
  - mobile 390 (mid): 514 frames, median 16.7 ms, p95 33.3 ms, 2.7 % over 33 ms, no long tasks.
  - One isolated ~0.4–0.5 s frame per run with no main-thread long task, likely a first-use GPU upload (P3).
  - With SwiftShader (software GL, the e2e default) the desktop canvas drops to a median of 100 ms/frame. That is a floor for CPU-rendered WebGL, not a device number.
- **3D init** (intent → ready, 4× CPU, SwiftShader): 585 → ~450–505 ms of blocking, in tasks ≤ 175 ms: BVH only for fine pointers and as a lazy chunk, yields between uploads and compile, `checkShaderErrors` off.
- **Bug fixed during profiling:** the adaptive-DPR step-down started from the tier maximum (2) instead of the ratio in use, so a DPR-1 screen under load was raised to 1.75 and its buffer reallocated at every step. Worst long task while scrolling went 534 → 82 ms.
- Demand frameloop (no frames while idle), `frameloop="never"` off-screen, context loss → posters (e2e), dispose on unmount.

## 5. Poster ↔ canvas parity
`node scripts/qa/hero-parity.mjs`: mean absolute difference at the crossfade 1.84/255 (desktop), 2.13/255 (mobile) after the Blender-semantics shader and drafting edges (D99). They started at 3.60 and 4.68. The swap is invisible at normal viewing.

## 6. Playwright
`npx playwright test` (production build with `NEXT_PUBLIC_TEST_HOOKS=1`, projects desktop-1440 and mobile-390): **44 passed** (re-run after D113; `tests/e2e/hero-3d.spec.ts` alone: 18 passed). The bottom-sheet drag-to-dismiss was re-checked by hand after D113 (panel closes, selection cleared, 0 console errors). `tests/e2e/hero-3d.spec.ts` covers, at both widths:
- poster first → 3D after intent → crossfade, no console errors;
- parts list → panel with products, URL `?deo=`, Esc returns focus;
- hook explode/select + unknown slug;
- deep link `akumulator` explodes to stage 4;
- unknown deep link ignored;
- axe with the panel open + visible focus on every hero stop (and on the stage after closing);
- reduced motion (no track, cut to exploded);
- low tier (`?3d=low`, posters follow the explode, panel works);
- WebGL context loss → posters.

Fixed on the way:
- a deep link lost its explode when ScrollTrigger refreshed (the refresh measures at scroll 0 and restores silently, so transient renders no longer reach the store, D104/F9);
- instant jumps go through `trigger.scroll()`;
- the axe home test ran with links under the sticky header after the end-to-end scroll and now scans from the top.

## 7. Screens and critique (impeccable, design-taste-frontend)

Re-captured and re-reviewed on the final build (2026-09-30): assembled / exploded / selected at 1440 and 390 — verdicts below unchanged; the two-line product names are visible in `mobile-4-selected-turbina.webp`.

Files in `docs/3d/web-qa/`:
- `desktop-*` / `mobile-*`: 0 poster, 1 assembled, 2 explode 30/60 %, 3 exploded, 4 selected (turbina), 5 hover (desktop), 6 vehicle picker, 7 parts list, 8 low tier (mobile), 9 reduced motion (desktop);
- `mobile360-0-poster`, `desktop2560-*`.

`node .claude/skills/impeccable/scripts/detect.mjs` on the hero and vehicle components: 0 findings. 360 px: no horizontal overflow.

- **Assembled (1440):** the statement, search and vehicle field hold the left columns. The X-ray car sits in the drawing frame (corner ticks, title block, honesty line) on a floor with a contact shadow, and the strip reads as a drawing index. Strong first screen; poster and canvas are indistinguishable.
- **Exploded (1440 / 390):** the tiers read clearly: body panels float, the engine bay opens, the intercooler steps forward. „Kliknite / Dodirnite deo“ replaces the stage caption at the hold.
- **Selected (1440 / 390):** the telephoto glide frames the part in the free area. The accent rim reads without flooding the metal, and the rest dims. The callout labels the part; the drawer/sheet lists the products with price, stock, OEM and cart. The copy stays legible under the scrim.
- **Hover (1440):** the category tint plus an informational callout (name, mechanic note, count).

Open items (none P0/P1):
- **P2** — phones: large empty band between the stage caption and the car. The 4:5 manifest camera leaves headroom for the exploded state. A tighter mobile camera needs new posters (3D pipeline) — step 21.
- **P2** — simulated-throttling LCP on localhost (§2.2, §2.5) — step 21/22.
- **P3** — one isolated ~0.5 s GPU hitch per session during the first explode frames on an integrated GPU (§4).
- **P3** — the mobile vehicle picker opens at full height with little content (component from step 07).
- **Fixed in this pass:** product names in the panel wrap to two lines instead of cutting „…, nova“.
