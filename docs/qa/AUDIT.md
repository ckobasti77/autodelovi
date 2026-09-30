# SKLOP — QA audit (step 21)

> Date: 2026-09-30 · Production build (`next build` with `NEXT_PUBLIC_TEST_HOOKS=1`) served by `next start` on :3100 (reviewers) and :3200 (isolated performance runs) · Convex dev deployment with demo data · Windows 11, 16 logical CPUs. Method: specialist reviewers per track in parallel (multi-agent workflow), then **every finding reproduced by independent verifiers** before it was recorded (P0/P1: a reproducer and a skeptic, a third tie-breaker on disagreement; P2/P3: an independent reproducer; performance timing claims re-measured on the quiet machine). Evidence: `docs/qa/audit/`. Scripts: `scripts/qa/audit/`. Findings as data: [audit/findings.json](audit/findings.json).

Step 22 works through this list in priority order: change **Status** from `OPEN` to `FIXED` (with a re-verification note citing a command output or screenshot path) or `WONTFIX` (with a reason consistent with `pipeline/BRIEF.md`).

## 1. Summary

**72 confirmed findings** — P0 0 · P1 6 · P2 33 · P3 33. 86 findings were reported; 5 did not survive verification (Appendix A) and 9 were merged into duplicates.

SKLOP is not ready for handoff yet, but the base is solid. The six tracks that completed confirmed 81 findings (72 unique after merging 9 duplicates): no P0, 6 unique P1, 33 unique P2 and 33 P3. tsc and lint are clean, the e2e suite passed 91 of 91 tests that ran, the authz probe found 0 violations and JSON-LD has 0 errors. Ten of sixteen reviews failed (visual, motion, a11y, cross-browser, flows), so step 21's „every track covered“ is not met. Their raw evidence in docs/qa/audit/ is unverified but points to WCAG 2.2 AA risks (the consent banner covers focused links at 390 px, and closing a dialog drops focus to BODY) and to stuck reveal words in WebKit. Step 22 should re-run a11y-store, a11y-app and xbrowser first. The P1s fall into three themes. Money and abuse controls in Convex: accepting a quote ignores the mechanic's credit limit (backend-01), and rate limits keyed on the User-Agent let one client trip the global order cap (backend-02). Public correctness: a /s+/ regex strips every „s“ from up to 87 product titles (copy-01), and the home FAQ contradicts the statutory 14-day withdrawal right (copy-03). Mobile performance: TBT is 246–1019 ms against 200 ms on every template (perf-lh-01), and CLS is 0.08–0.10 on vehicle generation pages (perf-lh-03). Performance is the step 22 gate most at risk: mobile Lighthouse is 83 on home, 77 on category and 76–80 on product against ≥ 85, and the shell ships 325–355 KB gzip of JS against 160–200 KB budgets. Fix in this order. (1) The one-hour items: copy-01, copy-03, perf-lh-03, copy-04 and backend-05, which unblocks „all suites green“. (2) backend-02 and backend-01 with convex-test regressions, then backend-03, -06 and -07. (3) Repair the Lighthouse gate (perf-lh-10) so the numbers are trustworthy, then the perf program, re-measuring home, category and product after each step: zod and the Tooltip, GSAP, overlay and icon deferrals; one client island per ProductGrid; a CSS-keyframe text reveal with the failsafe fix; per-template font preloads. (4) The SEO and copy P2 batch: pagination, category titles, brand declension, thin hubs, slug redirects, the 404 body, and copy that points to company data that is not filled in yet. (5) The 3D start freeze, the renderer leak and MSAA; P3s last. Step 22 needs at least 24 of the 33 unique P2s: the 19 non-performance P2s plus five small perf fixes (perf-bundle-01, perf-bundle-02, perf-lh-02, perf-3d-02, perf-3d-05) reach that. The owner must fill in the company settings and confirm the dispatch cut-off and the return wording before these copy fixes can be final.

- Evidence paths are relative to `docs/qa/`. Reviewer scripts in `scripts/qa/audit/` re-create most measurements (`kit.mjs` is the shared helper).
- Lab numbers come from localhost on a Windows desktop; PageSpeed Insights on the deployed site remains the owner's check (HUMAN-TODO).

| Track | P0 | P1 | P2 | P3 | Total |
|---|---|---|---|---|---|
| 1. Visual design & consistency | 0 | 0 | 0 | 0 | 0 |
| 2. Interaction & motion | 0 | 0 | 0 | 0 | 0 |
| 3. Accessibility | 0 | 0 | 0 | 0 | 0 |
| 4. Cross-browser | 0 | 0 | 0 | 0 | 0 |
| 5. Performance | 0 | 2 | 14 | 10 | 26 |
| 6. SEO | 0 | 0 | 8 | 9 | 17 |
| 7. Copy | 0 | 2 | 6 | 9 | 17 |
| 8. Flows & edge cases | 0 | 0 | 0 | 0 | 0 |
| 9. Backend & reliability | 0 | 2 | 5 | 5 | 12 |
| **All** | **0** | **6** | **33** | **33** | **72** |

### Setup and baseline

- Build: `NEXT_PUBLIC_TEST_HOOKS=1 npm run build` — exit 0 in 3 min 30 s (log not committed). Served by `next start -p 3100` (all reviewers) and a second `next start -p 3200` of the same build reserved for the performance track, so Lighthouse and frame-time runs never shared a Node event loop with the crawlers.
- Data: Convex dev deployment `tame-impala-374`, `seed:stats` before the audit — 167 products (157 demo), 89 orders, 52 inquiries, 35 mechanic profiles, owner present. Shared audit accounts (approved mechanic „Majstor Plus“ with deferred payment, retail customer) were created through the real UI by `scripts/qa/audit/accounts.mjs`.
- Browsers: Playwright 1.63 with Chromium 1243, Firefox 1543 and WebKit 2359 installed for the audit.
- **Full e2e suite on the production build after the step 20 CSP/header changes: 118 tests — 91 passed, 27 skipped, 0 failed, 0 flaky (11.6 min).** All 27 skips are intentional (admin/import desktop-only, HTTP-level and run-once checks skipped on the mobile-390 project). Evidence: [audit/e2e/full-run.txt](audit/e2e/full-run.txt), [audit/e2e/full-run.json](audit/e2e/full-run.json). The suite covers Chromium only; Firefox/WebKit are the cross-browser track.
- Lighthouse: Lighthouse 13.5 through `tests/lighthouse/run.mjs` against :3200 (fresh profile, so the cookie banner is visible as on a first ad click). Runs whose CPU benchmarkIndex showed machine contention were excluded and are listed in `audit/perf-lh/lighthouse.md`; timing claims were re-measured by an independent verifier.
- Incidents: (1) the :3100 `next start` process exited with code 1 at about 17:50 without an error in its log; it was restarted at 17:56 and guarded by a watchdog for the rest of the audit (no restart was needed). No verdict was produced against the dead server. (2) The first audit run lost all ten browser-heavy reviewers (visual, motion/3D, accessibility, cross-browser, flows) and the completeness critic to API network errors (ECONNRESET / ENOTFOUND) at about 19:40. Those tracks were re-run in a second workflow that reused the evidence already on disk; the completeness-critic phase was dropped to stay within the step's time limit.

## 2. Scorecards

| Track | Score (0–10) | Verdict |
|---|---|---|
| 1. Visual design & consistency | 7 | PROVISIONAL: all three visual reviews failed. The lead's spot checks show a distinct automotive brand with no generic template look. |
| 2. Interaction & motion | 6 | PROVISIONAL: the motion-3d review failed. Confirmed perf findings show that the hero's first interaction and the site-wide reveal are the weak points. |
| 3. Accessibility | 6.5 | PROVISIONAL: both a11y reviews failed. The raw sweeps look clean but point to two unverified WCAG 2.2 AA failures. |
| 4. Cross-browser | 5.5 | PROVISIONAL: the review failed. The shop flow completes in Chromium and Firefox; WebKit shows stuck reveal words on home (unverified). |
| 5. Performance | 4.5 | Mobile misses the BRIEF §9 bar on every storefront template. Desktop, 3D lazy-loading and asset budgets are sound. |
| 6. SEO | 6 | Technically clean, but a P1 title bug and indexable thin or duplicate pages break the BRIEF §9 bar. |
| 7. Copy | 6.5 | The hand-written Serbian is award-grade. Generated and seeded text carries a legal error, an invented promise and grammar-blind templates. |
| 8. Flows & edge cases | 7 | PROVISIONAL: all three flow reviews failed. The raw runs completed every scripted journey; confirmed backend findings show where the rules break. |
| 9. Backend & reliability | 6 | Authorization and data integrity are exemplary. Two reproduced P1s, in credit limits and rate limiting, fail BRIEF §9 Security. |

### 1. Visual design & consistency — 7/10

PROVISIONAL: all three visual reviews failed. The lead's spot checks show a distinct automotive brand with no generic template look.

**Drivers**
- The vis-store, vis-commerce and vis-admin reviews failed. About 1,300 capture files at 8 widths are unreviewed.
- Lead spot check (home 1440, category 390, product 1440): the X-ray („Rendgen“) system is consistent, the display type hierarchy is strong, and OEM numbers are set in mono.
- Unverified render metrics: several part renders are near-black on dark cards (contrast about 1.06–1.1: kočione pločice, spone-stabilizatori, filter kabine, ABS senzori).
- Confirmed visual-adjacent findings: CLS jump on the vehicle generation page (perf-lh-03), OG images uppercase units (copy-18), „Škoda“ falls back to another font on OG images (seo-10).

**Strengths**
- The hero has a clear signature: the X-ray car, the stage strip and the spec panel.
- The product buy box is clean, and the category card works at 390 px.

**Biggest gaps**
- The award-level bar is not verified.
- Dark renders have low contrast.
- Admin density and print layouts are unreviewed.

### 2. Interaction & motion — 6/10

PROVISIONAL: the motion-3d review failed. Confirmed perf findings show that the hero's first interaction and the site-wide reveal are the weak points.

**Drivers**
- The motion-3d review failed. Its focus script crashed on a 90 s navigation timeout on the shared machine.
- Confirmed in the perf track: a 0.3–0.9 s freeze at the first 3D touch or scroll (perf-3d-01), 230–400 ms of rAF work for the text reveal at 4× CPU (perf-lh-06), and on slow phones the failsafe reveals copy, then hides it again and re-animates it (perf-lh-07).
- Raw hero runs: 3D loaded only on intent, deep links (?deo=) and the explode scrub worked, and the mobile sheet (drag, flick, landscape) worked, with 0 console errors.

**Strengths**
- 3D loads only after intent, and the demand frameloop draws 0 frames when idle.
- 60 fps at 1× on desktop. The reduced-motion gate hides nothing.
- The sheet drag is lazy-loaded (D113). Deep links restore the stage and the selected part.

**Biggest gaps**
- The freeze on first interaction and the INP of taps on touch devices (184–288 ms).
- The text-reveal cost and the failsafe race.
- Unverified: after Escape on the desktop parts list, focus lands on BODY. THREE.Clock logs a deprecation warning on every 3D start (perf-3d-09).

### 3. Accessibility — 6.5/10

PROVISIONAL: both a11y reviews failed. The raw sweeps look clean but point to two unverified WCAG 2.2 AA failures.

**Drivers**
- 0 confirmed findings because a11y-store and a11y-app never reached verification. The only confirmed related item is perf-lh-12 (home target-size, Lighthouse a11y 97, P3).
- Lighthouse accessibility is 100 on every other template. The e2e axe check on six templates passes.
- Raw axe sweeps: 72 storefront loads gave 1 color-contrast and 3 scrollable-region-focusable violations; 75 admin, mechanic and customer loads gave 1 link-in-text-block.
- Unverified, from docs/qa/audit/a11y-store: at 390 px the consent banner fully covers focused product links and „U korpu“ buttons (SC 2.4.11). Closing the vehicle picker, header search or parts list sends focus to BODY (SC 2.4.3).

**Strengths**
- Every page has a skip link to main, exactly one H1, no heading skips and 0 unlabeled buttons.
- The sign-in, sign-up and reset forms work without JavaScript.
- The admin command palette, keyboard shortcuts and dialog focus were exercised.

**Biggest gaps**
- No verified coverage of keyboard flows, screen-reader names or the 3D accessible equivalent.
- Possible focus-not-obscured failure behind the consent banner.
- Possible loss of focus return when dialogs close.

### 4. Cross-browser — 5.5/10

PROVISIONAL: the review failed. The shop flow completes in Chromium and Firefox; WebKit shows stuck reveal words on home (unverified).

**Drivers**
- The xbrowser review failed. Several Firefox and WebKit navigations timed out at 90 s on a contended machine.
- Raw shop flow (search → product → cart → 4-step checkout → thank-you) passed every step in Chromium and Firefox at 1440 and 390 px.
- Raw reveal probe: at the last sample WebKit still hides 9 words on home at 1440 px and 4 at 390 px; Chromium and Firefox hide 0.
- The Playwright e2e suite runs Chromium only (desktop-1440 and mobile-390).

**Strengths**
- Flows in Firefox match Chromium.
- The quantity input has the same size and styling in every engine.
- Variable fonts were captured in all three engines.

**Biggest gaps**
- WebKit (iOS Safari) is unverified. It is the largest real-world risk for mobile traffic.
- The e2e suite has no WebKit or Firefox project.

### 5. Performance — 4.5/10

Mobile misses the BRIEF §9 bar on every storefront template. Desktop, 3D lazy-loading and asset budgets are sound.

**Drivers**
- 30 confirmed findings (P1 2, P2 15, P3 13; 26 unique after 4 merges). P1s: perf-lh-01 (TBT) and perf-lh-03 (CLS).
- Mobile, applied throttling: TBT 246–1019 ms against a 200 ms budget on every template. Performance 83 on home, 77 on category, 76–80 on product, against the step 22 gate of 85 (BRIEF: 90 for catalog and product).
- Shell first-load JS is 325–355 KB gzip (430–451 KB on /upit and /porudzbina) against the 160–200 KB §J11 budgets. About 80 KB of the shell can be deferred, and 67–85 KB more of zod on the forms.
- LCP 2.2–2.74 s (at or over the 2.5 s line on home, product and /ponuda). CLS 0.082 on /vozila/…/golf-7. The first 3D interaction freezes the page for 0.3–0.9 s.

**Strengths**
- Desktop preset: performance 98–99, LCP 0.87–1.0 s, TBT 0 on every template.
- 3D loads only on user intent: no three.js, GLB or HDR in any first load. Canvas chunk 282 KB gzip (budget 350). GLBs 3.55 MB and 2.57 MB (budget 8 MB). 0 draw calls when idle or off-screen.
- One 18.5 KB gzip render-blocking stylesheet, immutable caching on /_next/static, art-directed AVIF hero poster. LCP is the server-painted frame (LCP = FCP).

**Biggest gaps**
- Hydration of the shell plus three client islands per ProductCard (×24) drives TBT (perf-lh-01, perf-lh-11). The per-word GSAP blur tweens of the text reveal add 230–400 ms of rAF work at 4× CPU, and the failsafe races hydration (perf-lh-06, perf-lh-07).
- Code that loads on every page but runs only on intent: Tooltip/floating-ui, the GSAP scroll plugins, overlays and toasts, six-weight Phosphor icons, and the root not-found and error chunks.
- 3D: runtime PMREM compile at first touch, the renderer and the detached home DOM leak on every SPA visit (+1107 nodes), and 4× MSAA at DPR 2 needs an estimated 114–194 MB against a 60 MB budget.
- The Lighthouse gate (tests/lighthouse/run.mjs) enforces looser budgets than the BRIEF and drops runs (perf-lh-10), so step 22 numbers are not trustworthy until it is fixed.

Reviewer scores: perf-bundle 6/10 · perf-lh 4/10 · perf-3d 6/10.

### 6. SEO — 6/10

Technically clean, but a P1 title bug and indexable thin or duplicate pages break the BRIEF §9 bar.

**Drivers**
- 19 confirmed findings (P1 1, P2 8, P3 10). seo-01 is the same regex bug as copy-01: every lowercase „s“ is missing from 87 of 157 product titles.
- Lighthouse SEO is 100 on indexable pages. JSON-LD: 955 pages, 0 parse errors. Sitemaps: 349 of 349 URLs indexable and self-canonical.
- The BRIEF's „no indexable thin pages“ fails: 38 hubs are under 150 words (29 under 60). ?strana=2…500 serves indexable, self-canonical copies of page 1.
- 18 of 48 category titles are truncated with „…“, 3 title pairs are duplicates, /kontakt has 0 inlinks, and a renamed product slug returns 404.

**Strengths**
- Server HTML matches the rendered DOM on 12 templates, so nothing SEO-critical depends on JavaScript.
- The thin-content guard is exact (50 of 497 landings indexable). noindex pages keep follow and a correct canonical.
- Product JSON-LD matches the visible page on 157 of 157, BreadcrumbList on 349 of 349. og:url equals the canonical on 962 of 962 pages. 404 statuses, the trailing-slash 308 and robots.txt are all correct.

**Biggest gaps**
- The product title builder has the regex bug and drops the manufacturer, which creates the duplicate titles (seo-02).
- Out-of-range pagination and seeded category SEO fields (seo-03, seo-04).
- Thin system and single-generation model hubs (seo-06). Renamed slugs get no redirect even though the admin promises one (seo-08).
- Unknown product, category and vehicle URLs return a 404 with an empty body and the home page title (seo-09).

Reviewer scores: seo 6.5/10.

### 7. Copy — 6.5/10

The hand-written Serbian is award-grade. Generated and seeded text carries a legal error, an invented promise and grammar-blind templates.

**Drivers**
- 20 confirmed findings (P1 2, P2 8, P3 10; 17 unique after merges).
- 0 ijekavian, Cyrillic, ASCII-for-diacritic, exclamation, emoji or lorem hits across 457 page loads and 25 e-mail templates.
- copy-03: the home FAQ narrows the statutory 14-day withdrawal right. copy-04: it states a 14:00 same-day dispatch cut-off that no one confirmed.
- Grammar slips repeat across many pages: „24 meseci“ on 156 pages, undeclined „za Škoda/Cupra“ on 65 pages, a double „i“ in manufacturer lists on 27 landings.

**Strengths**
- Typography follows DS §4.4: „…“ quotes, en-dash ranges, × in dimensions, a no-break space before RSD.
- The voice is a credible mechanic's. Validation messages say what is wrong and how to fix it, with an error summary.
- E-mails are fully Serbian with plain-text versions. Empty states give a next step.

**Biggest gaps**
- No grammar-aware helpers (noun case, plural, list join) in lib/seo or the landing copy.
- Seeded content is not settings-aware: it points to phone, Viber, e-mail and seller data that are not shown while company settings are empty (copy-02, copy-04).
- The 403 page is Next's English default (copy-07). The e-pošta/e-mail and artikli/proizvodi terminology is not enforced.

Reviewer scores: copy 7/10.

### 8. Flows & edge cases — 7/10

PROVISIONAL: all three flow reviews failed. The raw runs completed every scripted journey; confirmed backend findings show where the rules break.

**Drivers**
- The flows-shop, flows-admin and flows-import-mech reviews failed, so no flow findings were verified.
- Raw runs: 13 checkout journeys (guest G1–G6, customer C1–C3, mechanic M1–M4) reached the thank-you page and the predračun. Admin order SK-2026-000112 went nova → potvrđena → poslata → završena. Lager, edge-case and round-trip imports committed and rolled back. 7 malformed files were rejected with Serbian guidance.
- e2e: 118 tests, 91 passed, 27 skipped on purpose, 0 failed.
- Confirmed flow defects from other tracks: accepting a quote bypasses the credit limit (backend-01), stock drifts on order edits (backend-06), a renamed slug returns 404 (seo-08), a rejected PIB blocks the real company (backend-11).

**Strengths**
- End-to-end commerce works for every role.
- The import wizard is safe: dry run, row check and rollback.
- Mechanic prices appear on category, product, search and cart.

**Biggest gaps**
- No independent flow review.
- Business-rule edge cases in quote-to-order and order editing.
- A dead outbox event is invisible to staff (backend-09).

### 9. Backend & reliability — 6/10

Authorization and data integrity are exemplary. Two reproduced P1s, in credit limits and rate limiting, fail BRIEF §9 Security.

**Drivers**
- 12 confirmed findings (P1 2, P2 5, P3 5).
- Authz probe: 81 protected queries × 3 roles, 0 violations. All 298 functions have args and returns validators, and there are 0 .collect() calls.
- Rate limits: with one User-Agent, 20 requests pass and 1 is limited; rotating the User-Agent, 21 pass and 0 are limited. Credit repro: a 250.000 RSD deferred-payment order was accepted on a 200.000 RSD limit.
- Full vitest run with --maxWorkers=2: 1090 passed, 2 failed on timeouts under load. The Reliability bar is not met reliably.

**Strengths**
- The authorization builders are used everywhere. There is no cost, margin or other-role price in public payloads, SSR HTML or feeds.
- The ledger reconciles: 99 orders with gap-free numbering, and 143 stock movements that match product stock.
- Crons are DST-safe, idempotent and bounded. Retention covers SECURITY §L5.

**Biggest gaps**
- Both quote-to-order paths skip the mechanic's credit limit, payment terms and tier snapshot (backend-01).
- The per-visitor rate-limit key includes the User-Agent, so it is bypassable, and anyone can drain the global sign-up bucket (backend-02, backend-07).
- Consent proof is supplied by the client and stored verbatim. Attribution strings are unbounded. Stock drifts when order lines are edited (backend-03, -04, -06).
- Dead outbox events are invisible to staff, and every signed-in page load rotates the session tokens (backend-08, -09).

Reviewer scores: backend 6.5/10.

## 3. Top 10 quick wins

| # | Finding | Severity | Effort | Why |
|---|---|---|---|---|
| 1 | [COPY-01](#copy-01) Product <title>/og:title lose every lowercase „s“ and descriptions are cut mid-word (broken regex in productTitle/productMeta) | P1 | S | P1. Fixing two regexes in lib/seo/templates.ts restores up to 87 product titles, their og:title and twitter:title, and 32 cut descriptions on the main SEO template (also closes seo-01). Add the unit test with a name that contains „s“. |
| 2 | [COPY-02](#copy-02) Home FAQ restricts the statutory 14-day withdrawal right and contradicts the site's own legal page | P1 | S | P1 legal exposure. The home FAQ narrows the statutory 14-day withdrawal right and contradicts /reklamacije-i-povrat. The fix is one seed string plus the live FAQ row. |
| 3 | [PERF-02](#perf-02) CLS 0.08–0.10 on the vehicle generation page: when Martian Mono loads, the engine chips narrow and the whole 'Delovi po kategorijama' section jumps 96 px | P1 | S | P1. One layout change on the generation page (engine code on its own line or a fixed-width code span) removes the 96 px jump (CLS 0.08–0.10) on every vehicle generation page. |
| 4 | [BE-05](#be-05) Quality gate: full `npx vitest run --maxWorkers=2` fails with two Convex test timeouts under load | P2 | S | Step 22 requires every suite to pass. A testTimeout on the convex Vitest project removes the 2 failures that appear only under load. |
| 5 | [BE-02](#be-02) Per-visitor rate limits include the caller-controlled User-Agent, so they are bypassable and the global order cap can be drained | P1 | M | P1 security. Rotating the User-Agent bypasses every per-visitor limit, and one client can exhaust the global order cap and block real customers. Key the limits on a salted IP hash (/64 for IPv6) and add a convex-test. |
| 6 | [BE-01](#be-01) Quote acceptance ignores the mechanic's credit limit, payment terms and tier snapshot on deferred-payment orders | P1 | M | P1, money. A mechanic can accept a quote beyond the credit limit (250.000 RSD accepted on a 200.000 RSD limit). Move the terms into one helper that orders.submit and both quote-to-order paths call. |
| 7 | [PERF-08](#perf-08) `import { z } from "zod"` ships all of zod 4 (40+ locales, JSON Schema): +101 KB gzip / 394 KB raw on checkout, VIN inquiry and mechanic registration | P2 | S | Changing three import lines removes about 67–85 KB gzip of zod from checkout, VIN inquiry and mechanic registration (the conversion pages). With zod/mini or a jitless config it also clears the CSP eval warning on /upit (merged perf-lh-08). |
| 8 | [PERF-03](#perf-03) Mobile LCP is at or over 2.5 s on home and product and 2.74 s on the ads landing, because the only render-blocking stylesheet shares slow-4G bandwidth with four font preloads and card-image preloads | P2 | S | Correcting the preload flags in lib/fonts.ts frees slow-4G bandwidth for the render-blocking CSS. Mobile LCP is at 2.5 s on home and product and 2.74 s on /ponuda (merged perf-bundle-08). |
| 9 | [PERF-09](#perf-09) Root Providers mounts radix Tooltip.Provider, so Tooltip + Popper/floating-ui (13.2 KB gzip) load on every storefront page that never shows a tooltip | P2 | S | Moving Tooltip.Provider to the admin shell and styleguide removes 13.2 KB gzip of floating-ui from every storefront page. That lowers TBT toward the step 22 gate of performance ≥ 85. |
| 10 | [COPY-04](#copy-04) Invented dispatch promise „porudžbine potvrđene do 14 časova šaljemo istog dana“ is hard-coded in seeded content | P2 | S | An invented 14:00 same-day dispatch promise on /dostava-i-placanje and in the home FAQ commits the owner to an unconfirmed service level and breaks the project's no-invented-facts rule. Replace it with a settings placeholder. |

## 4. Known open items (verified)

| Known item | Result |
|---|---|
| Mobile hero framing at 360–430 px (empty band above the car) | see motion/3D findings |
| Shared shell first-load JS ~303 KB gzip | [PERF-09](#perf-09) P2 — Root Providers mounts radix Tooltip.Provider, so Tooltip + Popper/floating-ui (13.2 KB gzip) load on every storefront page that never shows a tooltip<br>[PERF-11](#perf-11) P2 — Overlay code is eager in the shell: Sheet/Dialog stack, Toaster, consent banner (also after consent) and header sheets ≈ 24–30 KB gzip that only runs on intent<br>[PERF-12](#perf-12) P2 — Phosphor icons used in client components ship all six weights (23 icons, 56.5 KB raw on home) although D30 uses only the regular weight<br>[PERF-13](#perf-13) P2 — Root app/not-found.tsx renders the full SiteShell: +32 KB gzip of shop-header JS on the ads landing and a second serialized header/footer/404 in every page's RSC payload<br>[PERF-20](#perf-20) P3 — 14 modules are shipped twice in every page's first load through the root error-boundary chunk (25.7–27.2 KB raw)<br>[PERF-04](#perf-04) P2 — Shell first-load JS is 330–355 KB gzip (24–25 scripts) on every storefront template, about 2× the SEO-ADS §J11 JS budgets |
| Default simulated mobile LCP ~4.2 s on home (D112 applied throttling) | not confirmed (perf-lh-09, Appendix A) |
| Phone TBT over budget on home, category and product | [PERF-01](#perf-01) P1 — Mobile TBT is over the 200 ms budget on every storefront template, and the performance score misses the bar on home, catalog and product (applied throttling, the D112 budget method) |
| Font preloads | merged into PERF-03<br>[PERF-03](#perf-03) P2 — Mobile LCP is at or over 2.5 s on home and product and 2.74 s on the ads landing, because the only render-blocking stylesheet shares slow-4G bandwidth with four font preloads and card-image preloads |
| Globally registered GSAP plugins | [PERF-10](#perf-10) P2 — ScrollTrigger + ScrollToPlugin + CustomEase registered for every page: ≈ 22 KB gzip used only by the home hero<br>merged into PERF-10 |
| Search not narrowed by the selected vehicle | see flows findings |
| Mobile filter row not sticky | see flows findings |
| Mobile sticky contact bar not built | see flows findings |
| Mechanics quick order at 1440: last row behind the summary bar | see visual findings |
| Full e2e suite re-run after the step 20 CSP changes | 118 tests: 91 passed, 27 skipped (intentional), 0 failed — no finding |

## 5. Findings

### P1 — major (6)

#### PERF-01

**Mobile TBT is over the 200 ms budget on every storefront template, and the performance score misses the bar on home, catalog and product (applied throttling, the D112 budget method)**

- **Severity:** P1 · **Area:** 5. Performance — Performance / main-thread (hydration) · **Status:** OPEN
- **Route:** / · /delovi · /delovi/kocioni-diskovi · /deo/kocioni-disk-prednji-276-24-mm-demo-0004 · /pretraga?q=disk · /vozila/volkswagen/golf/golf-7 · /delovi/kocioni-diskovi/volkswagen/golf · /ponuda/kocione-plocice-golf · /kontakt · /upit · /za-majstore
- **Context:** Lighthouse 13.5 mobile, --throttling devtools (slow 4G + 4× CPU), headless Chrome, fresh profile with the cookie banner visible, isolated server :3200. Shared machine: runs with benchmarkIndex < 3000 were excluded.
- **Standard:** BRIEF §9 (TBT ≤ 200 ms; perf ≥ 85 home / ≥ 90 catalog & product); SEO-ADS §J11
- **Known item:** phone TBT ~355–397 ms on home/category/product (perf-lh)
- **Reproduction:**
  1. Start from the production build served on :3200.
  2. In Git Bash, run: MSYS_NO_PATHCONV=1 node tests/lighthouse/run.mjs --base http://localhost:3200 --runs 3 --throttling devtools /delovi/kocioni-diskovi
  3. Repeat for / (5 runs), for /deo/kocioni-disk-prednji-276-24-mm-demo-0004 and for the other templates.
  4. Read TBT, performance, long-tasks and bootup-time in the JSON under .lighthouse/.
- **Corrected reproduction (verifier):**
  1. MSYS_NO_PATHCONV=1 node scripts/qa/audit/verify-perf-lh-runner.mjs --base http://localhost:3200 --runs 3 --throttling devtools --paths "/,/upit,/delovi/kocioni-diskovi/volkswagen/golf,/delovi/kocioni-diskovi,/deo/kocioni-disk-prednji-276-24-mm-demo-0004"
  2. Check benchmarkIndex is at least 3500 and read the TBT medians: home about 340 ms, /upit about 260 ms, landing about 220 ms (misses); category about 170 ms and product about 145 ms (within BRIEF, category over the J11 150 ms bar).
  3. Performance scores are 89 or higher on home and 93–95 on catalog and product; the score bars are met.
- **Expected:** TBT ≤ 200 ms on every template. Performance ≥ 85 on home and ≥ 90 on catalog and product (BRIEF §9). SEO-ADS §J11 is stricter: TBT ≤ 150 ms on category, landing and product.
- **Actual:** Medians, with min–max where n > 1 (benchmarkIndex 3083–4103):
- home: TBT 425 ms (334–623, n=5), perf 83 (78–87).
- category: TBT 837 ms (674–863, n=3), perf 77.
- product: TBT 551–699 ms (n=2), perf 76–80.
- landing /delovi/kocioni-diskovi/volkswagen/golf: TBT 1019 ms, perf 73. Simulated TBT on the same page was 274 ms (n=4).
- /pretraga: 625 ms, perf 82.
- Golf 7 vehicle page: 650 ms, perf 78.
- /upit: 371 ms, perf 88.
- /za-majstore: 280 ms, perf 90.
- /delovi: 246 ms, perf 91.
- Contended single runs: /ponuda 629 ms (perf 75, bench 1733) and /kontakt 454 ms (perf 83, bench 2731).
The same build measured uncontended in step 19 (bench ≈ 4070, .lighthouse/_delovi_kocioni-diskovi-mobile-devtools-1..3.json) already gave category TBT 264–438 ms, so the miss holds without contention.
Where the time goes, per representative run:
- React DOM (0qy3sss5e6eww.js, 72 KB gzip) hydration: long tasks of 140–304 ms at about 3.2 s and 85–235 ms at 4.8–6.4 s.
- A second document style/layout task after FCP: 116–282 ms.
- App chunk 25dplrt_qw3he.js: 51–300 ms.
- GSAP ticker frames (see perf-lh-06).
- **Evidence:** [audit/perf-lh/lighthouse.md](audit/perf-lh/lighthouse.md) (tables and the 'Top long tasks' section) · [audit/perf-lh/lighthouse-summary.json](audit/perf-lh/lighthouse-summary.json) (groups[].perRun, representative.longTasks/bootup) · [audit/perf-lh/lh-console.log,](audit/perf-lh/lh-console.log,) docs/qa/audit/perf-lh/lh-fill.log · [audit/perf-lh/trace-attribution.json](audit/perf-lh/trace-attribution.json) (4× CPU trace: category 17 long tasks, Σ(>50 ms) 1916 ms)
- **Suggested fix:** Cut hydration work on the storefront shell and the listings:
1. Replace the three client islands per ProductCard (ProductStock, ProductPrice, AddToCartButton, times 24 cards) with one delegated client island per ProductGrid (components/catalog/ProductGrid.tsx). Keep the SSR markup and patch live values after idle.
2. Mount HeaderSearch's Dialog + SearchBox/Combobox and MobileNav's Sheet only on intent, via next/dynamic (components/shell/HeaderSearch.tsx, MobileNav.tsx).
3. Defer the hydration of ConsentBanner; its form already works without JS.
4. Start TextRevealGlobal in requestIdleCallback after hydration.
5. Re-measure with --throttling devtools on an idle machine, then with PSI after deployment.
- **Verification:** perf → partially_confirmed (P1): 30 Lighthou e 13.5 run  on :3200, mo tly idle machine (bench 3496–4171). Mobile, devtool  throttling, 3–4 run  per template. Median TBT: home 343 m  (171/353/343), /upit 262 (297/262/217), brand-model landing 218 (218/167/256). Tho e three mi  the 200 m  bar. The re t are within it: category 170 (170/169/487/170), prod… [doc /qa/audit/verify/perf-lh/perf-lh-01-perf.txt, doc /qa/audit/verify/perf-lh/lh- ummary.txt] — perfskeptic → partially_confirmed (P1): No new Lighthou e run ; I re-analy ed the exi ting report . I recomputed TBT per long ta k with Lighthou e'  rule (clip to the FCP–TTI window,  ubtract 50 m ) on three  et : the finder'  40 devtool  run , the earlier verifier'  21 quiet devtool  run  (bench 3496–4171), and the  tep-19 category run .

What i  real:
- Ho… [doc /qa/audit/verify/perf-lh/perf-lh-01-perf keptic.txt, cript /qa/audit/verify-perf-lh-01- keptic.mj]
- _Reviewer key: perf-lh-01_

#### PERF-02

**CLS 0.08–0.10 on the vehicle generation page: when Martian Mono loads, the engine chips narrow and the whole 'Delovi po kategorijama' section jumps 96 px**

- **Severity:** P1 · **Area:** 5. Performance — Performance / CLS · **Status:** OPEN
- **Route:** /vozila/volkswagen/golf/golf-7 (and every /vozila/[marka]/[model]/[generacija] with engine chips)
- **Context:** Mobile 412 × 823 on slow 4G + 4× CPU (Lighthouse applied and simulated); desktop preset 1350 wide
- **Standard:** BRIEF §9 (CLS ≤ 0.05); DESIGN-SYSTEM §4.2 (font loading must not shift layout)
- **Reproduction:**
  1. Run: MSYS_NO_PATHCONV=1 node tests/lighthouse/run.mjs --base http://localhost:3200 --runs 1 --throttling devtools /vozila/volkswagen/golf/golf-7
  2. Read layout-shifts / cls-culprits-insight: the shifted node is section.mt-12 (cats-title), with cause 'Web font loaded ee9d8ff0751135e3…woff2'.
  3. Reproduce with: AUDIT_BASE=http://localhost:3200 THROTTLE=1 node scripts/qa/audit/perf-lh-cls-mono.mjs. It compares non-preloaded fonts blocked vs loaded and records layout-shift sources.
- **Corrected reproduction (verifier):**
  1. Budget reproduction (as in the finding): MSYS_NO_PATHCONV=1 node tests/lighthouse/run.mjs --base http://localhost:3200 --runs 3 --throttling devtools /vozila/volkswagen/golf/golf-7. Expect CLS 0.082; the culprit is section.mt-12, cause the Martian Mono woff2.
  2. Layout-only reproduction without timing: node scripts/qa/audit/verify-perf-lh-03-perfskeptic.mjs --only golf-7. It swaps --nf-mono to 'Martian Mono Fallback' and back at each width and records the layout-shift. Expect 0.0814 at 412/414, 0.079 at 430 and ~0 at 375/390.
  3. Scope: FAST=1 node scripts/qa/audit/verify-perf-lh-03-perfskeptic.mjs lists all 46 /vozila/[marka]/[model]/[generacija] pages. Expect 43/46 over 0.05 at 412 px and up to 0.25 at 430 px.
  4. Root cause and proof of the fix: node scripts/qa/audit/verify-perf-lh-03-perfskeptic-fallback.mjs. The next/font fallback's caps advance is 1.064 em vs Martian Mono's 0.700 em; a local('Courier New') fallback at size-adjust 116.65 % gives CLS 0.
- **Expected:** CLS ≤ 0.05 (BRIEF §9); no reflow when a font swaps in (D127 fixed the same class of bug on product).
- **Actual:** Lighthouse CLS: 0.082 (mobile, applied throttling), 0.100 (mobile, simulated), 0.074 (desktop).
Playwright under slow 4G: a single layout shift of 0.0832 at 3660 ms.
- With the fallback metrics, the nav 'Motor' is 401 px tall and the section starts at 811 px.
- With Martian Mono it is 305 px and 715 px.
- The engine chips with type-code-s codes ('CUAA, DFHA') are wider in the fallback, so the flex-wrap row takes two extra lines until the web font (preload: false, display: swap) arrives at about 2.3–3.3 s, after FCP.
- **Evidence:** [audit/perf-lh/cls-golf7-412-mono-blocked.webp](audit/perf-lh/cls-golf7-412-mono-blocked.webp) (first-paint metrics: 8 chip rows) · [audit/perf-lh/cls-golf7-412-mono-loaded.webp](audit/perf-lh/cls-golf7-412-mono-loaded.webp) (after swap: 6 rows, section 96 px higher) · [audit/perf-lh/cls-golf7-slow4g.json](audit/perf-lh/cls-golf7-slow4g.json) · [audit/perf-lh/lighthouse-summary.json](audit/perf-lh/lighthouse-summary.json) (golf-7 groups, representative.layoutShifts)
- **Suggested fix:** In app/(shop)/vozila/[marka]/[model]/[generacija]/page.tsx, make the chip width independent of the mono font. Options:
- put the code on its own line under the engine name (same approach as D127);
- give the code span a fixed `inline-block w-[11ch]` with overflow clip;
- use `display: "optional"` for Martian Mono in lib/fonts.ts.
Also audit other flex-wrap rows that contain type-code, such as the VIN kod line.
- **Verification:** perf → confirmed (P1): Lighthou e CLS on /vozila/volk wagen/golf/golf-7 i  0.082 in 3 of 3 mobile devtool  run  and 0.074 in 2 of 2 de ktop run . Culprit:  ection.mt-12 on mobile and the h1 on de ktop, with cau e 'Web font loaded ee9d8ff0751135e3…woff2' (Martian Mono). Playwright at 412 px, 4× CPU,  low 4G: a  ingle  hift of 0.0832 at 3380 m… [doc /qa/audit/verify/perf-lh/perf-lh-03-perf.txt, doc /qa/audit/verify/perf-lh/perf-lh-03-cl -golf7-412-mono-blocked.webp] — perfskeptic → confirmed (P1): Thi  i  confirmed and the damage i  wider than the finding  ay . I ran no Lighthou e and no timing run . I only emulated the font  wap on :3100 at  croll 0, u ing next/font'  own fallback face.

**Cau e.** ee9d8ff0751135e3 i  the Martian Mono latin file (build CSS, preload:fal e). The fallback next/font generate  i  Ar… [doc /qa/audit/verify/perf-lh/perf-lh-03-perf keptic.txt, doc /qa/audit/verify/perf-lh/perf-lh-03-perf keptic-fallback.j on (Martian 0.700 em v  fallback cap  1.064 / digit  0.873; next fallback CLS 0.0814, calibrated …]
- _Reviewer key: perf-lh-03_

#### COPY-01

**Product <title>/og:title lose every lowercase „s“ and descriptions are cut mid-word (broken regex in productTitle/productMeta)**

- **Severity:** P1 · **Area:** 7. Copy — SEO copy / product template · **Status:** OPEN
- **Route:** /deo/[slug] — 73 of 157 product pages (e.g. /deo/kocioni-disk-prednji-276-24-mm-demo-0004, /deo/kociona-celjust-*, /deo/abs-senzor-*, /deo/set-zupcastog-kaisa-*)
- **Context:** All viewports/browsers, anonymous and mechanic; server-rendered <title>, og:title, twitter:title, meta description
- **Standard:** BRIEF §2 (correct Serbian copy), BRIEF §5 SEO (unique, correct titles/descriptions), BRIEF §9 SEO bar
- **Reproduction:**
  1. Open /deo/kocioni-disk-prednji-276-24-mm-demo-0004
  2. Look at the browser tab / view-source <title> and og:title
  3. Compare with the H1 „Kočioni disk prednji 276 × 24 mm“
  4. Check the meta description of /deo/kocione-plocice-zadnje-elektronska-rucna-* or /deo/rame-prednje-desno-sa-kuglom-*
- **Corrected reproduction (verifier):**
  1. curl -s http://localhost:3100/deo/kocioni-disk-prednji-276-24-mm-demo-0004 | grep -oE '<title>[^<]*</title>|og:title" content="[^"]*"|name="description" content="[^"]*"'
  2. Compare with the H1 „Kočioni disk prednji 276 × 24 mm“: the title reads „Kočioni di k prednji 276 × 24 mm 5Q0 615 505 R | SKLOP“ (expected „Kočioni disk prednji 276 × 24 mm 5Q0 615 505 R | SKLOP“; the maker is dropped by design D193 because the full title is over 60 characters)
  3. The description ends „…VW Passat B8 i … Cena…“ (dangling „i“); other products end mid-word („VW Go…“, „i jo…“)
  4. Run node scripts/qa/audit/verify-copy-01-skeptic.mjs to crawl the product sitemap: 87 of 157 titles (every product name containing a lowercase s) are mangled, and 32 descriptions are cut at a raw character position
- **Expected:** „Kočioni disk prednji 276 × 24 mm Febi Bilstein 5Q0 615 505 R | SKLOP“; descriptions shortened at a word boundary („za VW Golf VII, VW Passat B8 i još 10.“).
- **Actual:** „Kočioni di k prednji 276 × 24 mm 5Q0 615 505 R | SKLOP“, „Kočiona čelju t prednja leva…“, „ABS enzor prednji…“, „Pumpa vi okog priti ka CP4…“, „Ra hladna tečno t G13…“ (73/157 titles, same in og:title shown on Facebook/Viber shares). 32 descriptions end with cut words or dangling conjunctions: „za VW Golf VII, VW Go… Cena…“, „za VW Golf VII, VW Passat B8 i … Cena…“.
- **Evidence:** [audit/copy/ev-01-product-titles.txt](audit/copy/ev-01-product-titles.txt) · [audit/copy/crawl-sitemap.json](audit/copy/crawl-sitemap.json) · [audit/copy/dump-anon1440.txt](audit/copy/dump-anon1440.txt)
- **Suggested fix:** lib/seo/templates.ts:54 `p.name.replace(/s+/g, " ")` → `/\s+/g`; line 88 `.replace(/[s,;]+S*$/, "")` → `/[\s,;]+\S*$/` (and drop a trailing „i“/„,“ before the ellipsis). Add a unit test with a name containing „s“ (e.g. „Kočioni disk“) and a long fitment list.
- **Verification:** skeptic → confirmed (P1): Reproduced from  cratch on :3100. Root cau e i  in lib/ eo/template .t . Line 54 read  `p.name.replace(/ +/g, " ")`, which replace  the literal letter   (od -c  how  no back la h; git blame: 497770c,  tep 19). Line 88 read  `.replace(/[ ,;]+S*$/, "")`,  o the word-boundary trim never remove  anything. I crawled all 157… [doc /qa/audit/verify/copy/copy-01- keptic.txt (per-URL H1 v  <title>, de cription tail , brow er check), doc /qa/audit/verify/copy/copy-01- keptic.j on (all 157 row  +  ummary)] — reproduce → confirmed (P1): The bug i  real, and the title half affect  more page  than reported. Source: lib/ eo/template .t :54 `p.name.replace(/ +/g, " ")` and :88 `.replace(/[ ,;]+S*$/, "")`. Both regexe  lo t their back la he  (checked with cat -A: no e cape byte ). Line 54  wap  every lowerca e ' ' in the product name for a  pace.

What I d… [doc /qa/audit/verify/copy/copy-01-reproduce.j on (157-page crawl: 87 broken title ; og:title == twitter:title == title for all), doc /qa/audit/verify/copy/copy-01-reproduce-de c.j on (32  hortened de cription  cla ified again t full fitmentSummary: 10 mid-word, 4 incomplete label, 7 dangl…]
- **Also reported as:** seo-01 (Product <title>, og:title and twitter:title drop every lowercase „s“ from the product name @ /deo/[slug]: 87 of 157 products (every name containing a lowercase „s“). Examples: /deo/kocioni-disk-prednji-276-24-mm-demo-0004, /deo/kocione-plocice-prednje-sa-senzorom-demo-0009, /deo/set-zupcastog-kaisa-sa-vodenom-pumpom-1-9-tdi-demo-0057)
- _Reviewer key: copy-01_

#### COPY-02

**Home FAQ restricts the statutory 14-day withdrawal right and contradicts the site's own legal page**

- **Severity:** P1 · **Area:** 7. Copy — Legal copy / home FAQ · **Status:** OPEN
- **Route:** / (Česta pitanja → „Mogu li da vratim deo?“) vs /reklamacije-i-povrat
- **Context:** All viewports, anonymous; home is the main ad landing
- **Standard:** BRIEF §6 (14-day withdrawal), Zakon o zaštiti potrošača („Sl. glasnik RS“ 35/2026), DESIGN-SYSTEM §11.1 (precise, no invented terms)
- **Reproduction:**
  1. Open / and scroll to „Česta pitanja“
  2. Open „Mogu li da vratim deo?“
  3. Read: „…možete odustati od kupovine u roku od 14 dana od prijema, ako deo nije ugrađivan i vraćate ga u originalnom pakovanju.“
  4. Open /reklamacije-i-povrat → „Odustanak od ugovora (14 dana)“: the right is „bez navođenja razloga“; an installed part only makes the buyer liable for loss of value
- **Corrected reproduction (verifier):**
  1. Open http://localhost:3100/ (any width, anonymous), scroll to „Česta pitanja“ and open „Mogu li da vratim deo?“. The answer makes the right conditional on „ako deo nije ugrađivan i vraćate ga u originalnom pakovanju“, and „Reklamacije i povrat“ is not a link.
  2. View the page source of /: the FAQPage JSON-LD acceptedAnswer.text contains the same restrictive sentence.
  3. Open /reklamacije-i-povrat → „Odustanak od ugovora (14 dana)“: the right applies „bez navođenja razloga“, and an installed, used part only makes the buyer liable for loss of value. This contradicts the FAQ's „nije ugrađivan“ condition.
  4. Note: step 2 on the same legal page also says „neoštećenu i u originalnom pakovanju“, so the packaging condition appears on both pages. The fix is to rewrite the FAQ (seed + Admin → Sadržaj) to „bez navođenja razloga; trošak vraćanja snosite vi; za ugrađen/korišćen deo odgovarate za umanjenje vrednosti“ with a real link to /reklamacije-i-povrat, and to add both the FAQ and the legal page step 2 packaging wording to the lawyer checklist in HUMAN-TODO §3.
- **Expected:** FAQ states the right as the legal page does: 14 days, no reason needed; the buyer pays return shipping and answers for loss of value if the part was installed/used; link to the page.
- **Actual:** FAQ makes the right conditional on „deo nije ugrađivan“ and „originalno pakovanje“ — conditions the law (and the site's own Reklamacije page and the „Isporučena“ e-mail) do not set. Two contradicting statements on the same site.
- **Evidence:** [audit/copy/ev-home-faq-povrat-1440.webp](audit/copy/ev-home-faq-povrat-1440.webp) · [audit/copy/text-home-1440.txt](audit/copy/text-home-1440.txt) · [audit/copy/dump-anon1440.txt](audit/copy/dump-anon1440.txt)
- **Suggested fix:** convex/seedData/content.ts:264 (and the live FAQ in Admin → Sadržaj): „Da. Kao potrošač možete da odustanete u roku od 14 dana od prijema, bez navođenja razloga. Trošak vraćanja snosite vi; ako je deo ugrađivan ili oštećen, odgovarate za umanjenje vrednosti. Detalji: Reklamacije i povrat.“ Add this FAQ to the lawyer checklist in HUMAN-TODO §3 explicitly. (HUMAN-TODO lists the FAQ for owner review, but not this contradiction.)
- **Verification:** reproduce → confirmed (P1): Reproduced in Chromium at 1440x900 and 390x844 a  an anonymou  vi itor. The home FAQ „Mogu li da vratim deo?“  ay  word for word: „Kao potrošač možete odu tati od kupovine u roku od 14 dana od prijema, ako deo nije ugrađivan i vraćate ga u originalnom pakovanju. Detalji  u na  tranici Reklamacije i povrat.“ On /reklama… [doc /qa/audit/verify/copy/copy-03-reproduce-home-faq-1440.webp, doc /qa/audit/verify/copy/copy-03-reproduce-home-faq-viewport-390.webp] — skeptic → partially_confirmed (P2): I checked the live build on :3100 in Chromium at 390 and 1440 a  an anonymou  vi itor, reading the text from Convex rather than the  eed file. The home FAQ an wer to „Mogu li da vratim deo?“ i  exactly: „Kao potrošač možete odu tati od kupovine u roku od 14 dana od prijema, ako deo nije ugrađivan i vraćate ga u origina… [doc /qa/audit/verify/copy/copy-03- keptic-home-faq-390.webp (FAQ opened, an wer text vi ible, no link on „Reklamacije i povrat“), doc /qa/audit/verify/copy/copy-03- keptic-home-faq-1440.webp]
- _Reviewer key: copy-03_

#### BE-01

**Quote acceptance ignores the mechanic's credit limit, payment terms and tier snapshot on deferred-payment orders**

- **Severity:** P1 · **Area:** 9. Backend & reliability — Orders / mechanics (B2B) business rules · **Status:** OPEN
- **Route:** /upit/[token] (customer accepts the quote: inquiries:acceptQuote) and /admin/upiti/[broj] „Pretvori u porudžbinu“ (inquiriesAdmin:convertToOrder)
- **Context:** Dev deployment tame-impala-374. Shared approved mechanic (Majstor Plus, credit on, limit 200.000 RSD, 15-day terms) plus the owner. Called through ConvexHttpClient with the same public mutations the UI uses.
- **Standard:** BRIEF §5 Mechanics (deferred payment only on staff-granted credit, per-mechanic limit, D132), BRIEF §6 business rules, HUMAN-TODO [P1] limit/terms item
- **Reproduction:**
  1. Run `node scripts/qa/audit/backend-quote-credit-repro.mjs`. It does the steps below and cancels the test order afterwards.
  2. Sign in as the approved mechanic. mechanicPortal:overview shows credit limitPara 20000000 and availablePara 20000000 (200.000 RSD).
  3. As the mechanic, submit a part inquiry (created UP-2026-000059).
  4. As the owner, save and send a one-line quote at 250.000 RSD (inquiriesAdmin:saveQuoteDraft, then sendQuote).
  5. As the mechanic, accept through the token link (inquiries:acceptQuote) with payment „deferred“ (Odloženo plaćanje) and pickup.
  6. Observe that SK-2026-000100 is created as deferred, 250.000 RSD. mechanicPortal:overview now shows usedPara 25000000 against limitPara 20000000 and availablePara 0. The admin order detail has tierName null.
- **Corrected reproduction (verifier):**
  1. Staff path through the UI, no scripting needed: as the approved credit-enabled mechanic (limit 200.000 RSD), submit a part inquiry from /upit or the portal.
  2. As the owner, open /admin/upiti/<broj>, compose and send a quote of 250.000 RSD (more than the remaining limit).
  3. On the same page click „Pretvori u porudžbinu“, fill in the e-mail, keep „Lično preuzimanje“ and choose Plaćanje = „Odloženo plaćanje“. The dialog shows no limit.
  4. Click „Kreiraj porudžbinu“. The order is created (deferred, 250.000 RSD, unpaid), the mechanic's credit shows 250.000 used of 200.000, and the order page shows no tier.
  5. Public path: the /upit/<token> accept form never offers deferred payment. The bypass needs a direct inquiries:acceptQuote call with payment {method:'deferred'} from the mechanic's own session (for example devtools or ConvexHttpClient), which the server accepts over the limit.
  6. Clean up: cancel the test orders in /admin/porudzbine/<broj> („Promeni status“ → Otkazana) to release the credit.
- **Expected:** Accepting a quote enforces the same mechanic terms as orders.submit (convex/orders.ts:123-146, D132): deferred payment is refused when the items plus delivery exceed the available credit, dueAt comes from the profile's paymentTermsDays, and tierSnapshot is recorded.
- **Actual:** The order is accepted and the credit limit is exceeded by 50.000 RSD. createOrder falls back to a 15-day due date whatever the profile's terms are (convex/lib/orders.ts:247), and no tier snapshot is stored. The staff conversion path (convex/inquiriesAdmin.ts:654-713) has the same gap: validateCheckout only checks creditEnabled, not the remaining limit.
- **Evidence:** [audit/backend/quote-credit-repro.json](audit/backend/quote-credit-repro.json) · scripts/qa/audit/backend-quote-credit-repro.mjs · convex/inquiries.ts:359-410 (acceptQuote → createOrder without credit/terms/tier) · convex/inquiriesAdmin.ts:690-706 (convertToOrder, same)
- **Suggested fix:** Move the mechanic-terms block of orders.submit into a helper in convex/lib/orders.ts, for example `mechanicOrderTerms(ctx, profile, lines, deliveryConfig, paymentMethod)`. It returns {tierSnapshot, paymentTermsDays} and throws INVALID when deferred payment exceeds the available credit. Call it from orders.submit, inquiries.acceptQuote and inquiriesAdmin.convertToOrder. Staff can get an explicit, audited override flag if needed. Add convex-test cases for both quote paths (over the limit → refused; terms 30 → dueAt +30 d; tier snapshot present).
- **Verification:** reproduce → confirmed (P1): Reproduced from  cratch with my own  cript , on both conver ion path . Starting credit for the  hared Maj tor Plu  mechanic: limit 200.000 RSD, u ed 0, term  15 day .

(A) Public path. The mechanic, on it  own  e ion, call  inquirie :acceptQuote with payment deferred on a 250.000 RSD quote (UP-2026-000061). It i  accep… [doc /qa/audit/verify/backend/backend-01-reproduce.j on, doc /qa/audit/verify/backend/backend-01-reproduce-admin-convert-dialog-1440.webp] — skeptic → confirmed (P2): Reproduced independently in two way . (1) I olated convex-te t run (no  hared data): mechanic A with credit on, limit  et to 5.000 RSD and paymentTerm Day   et to 30. Normal checkout (order . ubmit, deferred, over the limit) i  refu ed with INVALID. The  ame over-limit amount via inquirie .acceptQuote (deferred) i  ACC… [doc /qa/audit/verify/backend/backend-01- keptic-convex-te t.txt (BACKEND01_RESULT: control INVALID; acceptQuote ACCEPTED dueInDay  15 tierSnap hot null u edPara…, cript /qa/audit/verify-backend-01.te t.t  +  cript /qa/audit/verify-backend-01.vite t.config.mt  (run: npx vite t run --config  cript /qa/audit/verify-backend-0…]
- _Reviewer key: backend-01_

#### BE-02

**Per-visitor rate limits include the caller-controlled User-Agent, so they are bypassable and the global order cap can be drained**

- **Severity:** P1 · **Area:** 9. Backend & reliability — Security / abuse protection (public writes) · **Status:** OPEN
- **Route:** Every public write: /korpa checkout (orders:submit, carts cartCreate), /upit (inquiries:submit, inquiries:generateUploadUrl), back-in-stock subscribe, consent:record, search:log, /za-majstore (mechanics:register), quick order
- **Context:** Dev deployment, anonymous ConvexHttpClient from one machine and IP with a custom fetch that sets the User-Agent header. Harmless mutation used (issuing an upload URL writes no business record).
- **Standard:** BRIEF §9 Security („rate limits on public writes“), SECURITY §L2, D4 (intent: real client IP limits)
- **Reproduction:**
  1. Run `node scripts/qa/audit/backend-ratelimit-ua.mjs`.
  2. 21 calls to inquiries:generateUploadUrl with one fixed User-Agent: 20 succeed and the 21st returns RATE_LIMITED (limit uploadUrl, 20/h per client).
  3. 21 more calls from the same IP, each with a different User-Agent: all 21 succeed, 0 limited.
- **Corrected reproduction (verifier):**
  1. Run `node scripts/qa/audit/verify-backend-02-skeptic.mjs` (anonymous ConvexHttpClient, custom User-Agent header, mutation inquiries:generateUploadUrl, no records written).
  2. Phase A: 21 calls with one fixed UA. The first 20 return ok and the 21st returns RATE_LIMITED.
  3. Phase B: 10 calls from the same machine and IP, each with a new UA. All 10 return ok.
  4. Phase C (control): 2 more calls with the fixed UA from phase A. Both return RATE_LIMITED, which proves the IP did not change and the bypass comes from the UA alone.
  5. Code path for impact: inquiries:submit is limited only by inquirySubmit on the same client key, and each accepted inquiry queues an inquiry_received e-mail to the submitted contact.email. So rotating the UA allows unlimited inquiries and confirmation e-mails to arbitrary addresses. The global order cap can only be drained with about 300 successful orders per hour, because failed submits roll back their global token.
- **Expected:** Per-visitor limits hold for a given IP whatever headers the caller sends. No single public limit can be drained by one client to lock out every other customer.
- **Actual:** The key is SHA-256(salt|ip|UA) (convex/lib/functions.ts:26-36, D4), and changing the UA gives a fresh bucket. The audit kit itself relies on this. Honeypot and the 3 s startedAt are client-supplied, so a script can submit unlimited inquiries and uploads (8 MB each) and create guest carts. It can also place orders until orderSubmitGlobal (fixed window, 300/h, convex/lib/rateLimits.ts:13) trips, after which every genuine customer gets „Previše pokušaja“ until the hour resets.
- **Evidence:** [audit/backend/ratelimit-ua.json](audit/backend/ratelimit-ua.json) · scripts/qa/audit/backend-ratelimit-ua.mjs · convex/lib/functions.ts:26-36 · convex/lib/rateLimits.ts:11-26
- **Suggested fix:** In getClientInfo (convex/lib/functions.ts), key per-client limits on the IP alone: salted hash, with the /64 prefix for IPv6. Keep the UA out of the key, or use ip+UA only as a second, finer bucket. Size the per-IP buckets for carrier NAT. Turn orderSubmitGlobal into a high alarm threshold that notifies the owner instead of a hard stop that blocks customers, or require sign-in/extra checks only above it. Add a convex-test proving two UAs from one IP share a bucket.
- **Verification:** skeptic → confirmed (P1): Reproduced independently with my own  cript, which u e  a new UA prefix and a new ConvexHttpClient per call, again t the harmle  inquirie :generateUploadUrl (uploadUrl, 20/h per client key). (A) 21 call  with one fixed UA: 20 ok, the 21 t RATE_LIMITED. (B) 10 call , each with a new UA: 10 ok, 0 limited. (C) Control: th… [doc /qa/audit/verify/backend/backend-02- keptic.j on (A: 20 ok + RATE_LIMITED; B: 10/10 ok; C control: 2/2 RATE_LIMITED; D: 3/3 RATE_LIMITED), cript /qa/audit/verify-backend-02- keptic.mj] — reproduce → confirmed (P1): I wrote my own  cript and ran it from one machine and one public IP again t the dev deployment. It only call  inquirie :generateUploadUrl, which ha  the uploadUrl limit (token bucket 20/h per ctx.client.key) and write  no bu ine  row.

Re ult :
(A) HTTP, one fixed UA: 20 ok, then RATE_LIMITED on call 21 (retryAfterM  ~… [doc /qa/audit/verify/backend/backend-02-reproduce.j on (A: 20 ok + RATE_LIMITED; B: 21/21 ok with rotating UA; C:  poofed IP header   till RATE_LIMITED; D: WS 2…, cript /qa/audit/verify-backend-02-ratelimit-ua.mj]
- _Reviewer key: backend-02_

### P2 — minor (33)

#### PERF-03

**Mobile LCP is at or over 2.5 s on home and product and 2.74 s on the ads landing, because the only render-blocking stylesheet shares slow-4G bandwidth with four font preloads and card-image preloads**

- **Severity:** P2 (reported P1, adjusted by verification) · **Area:** 5. Performance — Performance / LCP critical path · **Status:** OPEN
- **Route:** / · /deo/kocioni-disk-prednji-276-24-mm-demo-0004 · /ponuda/kocione-plocice-golf (also /delovi/kocioni-diskovi and the landings vs the SEO-ADS §J11 2.0 s bar)
- **Context:** Lighthouse mobile, applied throttling; 412 × 823; first visit
- **Standard:** BRIEF §9 (LCP ≤ 2.5 s, target 2.0); SEO-ADS §J11 (≤ 2.0 s category/landing/product; fonts preloaded ≤ 150 KB is met, but the preloads are on the critical path)
- **Known item:** font preloads (perf-lh)
- **Reproduction:**
  1. Run: MSYS_NO_PATHCONV=1 node tests/lighthouse/run.mjs --base http://localhost:3200 --runs 5 --throttling devtools /
  2. Open the JSON and read the network-requests audit (priority, networkRequestTime, networkEndTime) and lcp-breakdown-insight.
  3. Compare the stylesheet's end time with the four preloaded woff2 files.
- **Corrected reproduction (verifier):**
  1. Run Lighthouse mobile devtools 3 times on /delovi/kocioni-diskovi and /deo/kocioni-disk-prednji-276-24-mm-demo-0004: LCP = FCP of about 2.1–2.25 s (under 2.5 s, over 2.0 s).
  2. AUDIT_BASE=http://localhost:3200 node scripts/qa/audit/verify-perf-lh-02-fonts.mjs 3. With the preloads aborted, the CSS finishes about 0.4 s earlier and LCP drops to 1.62–1.78 s.
- **Expected:** LCP ≤ 2.5 s (target 2.0) on home, product and the ads landing (BRIEF §9). LCP ≤ 2.0 s on category, landing and product (SEO-ADS §J11).
- **Actual:** LCP medians:
- home 2519 ms (2455–2571, n=5);
- product 2497–2533 ms (n=2);
- /ponuda 2741 ms (one contended run);
- category 2196 ms (2162–2513).
LCP equals FCP on every run; render delay is 2.1–2.5 s and TTFB is about 20 ms.
Critical path on category and product: the HTML is 28–33 KB gzip and finishes at about 740 ms. The CSS 1ims1_lcdan5r.css (19.7 KB gzip) is requested at about 610 ms, alongside:
- Archivo Condensed 600, 16.9 KB;
- Archivo Expanded 700, 17.0 KB;
- Public Sans latin, 27.3 KB;
- Public Sans latin-ext, 19.0 KB;
- 1–2 `preload` card images of 5–9 KB (ProductGrid preloadFirst).
The CSS finishes at 1726–1754 ms, the same time as the fonts (1663–1800 ms). Alone on the link (≈180 KB/s) it would finish roughly 0.4 s earlier. The first parse/style/layout/paint task of the document follows, 343–682 ms at 4× (product 682 ms, with Paint 244 ms in the trace).
- **Evidence:** [audit/perf-lh/lighthouse.md](audit/perf-lh/lighthouse.md) ('LCP element and phases', 'Bytes') · [audit/perf-lh/lighthouse-summary.json](audit/perf-lh/lighthouse-summary.json) (representative.fonts, lcpPhasesMedian) · [audit/perf-lh/trace-attribution.json](audit/perf-lh/trace-attribution.json) (product first task 834 ms: Paint 244, Layout 223+198)
- **Suggested fix:** 1. Preload only the fonts each template paints above the fold. Archivo Condensed 600 (prices) is not in the first mobile viewport of home, /upit, /kontakt or /ponuda. Consider preloading only Public Sans latin-ext, or merging the subsets (lib/fonts.ts).
2. Make the ProductGrid/ProductCard image preload media-scoped (≥ 768 px, as D98 does for the poster), and drop it on /ponuda, where the cards are below the fold on phones (components/catalog/ProductGrid.tsx preloadFirst).
3. Cut the first style/layout cost: DOM size and the per-word blur spans (see perf-lh-06).
4. Re-check LCP ≤ 2.0 s for category, landing and product.
- **Verification:** perf → partially_confirmed (P2): Median LCP (devtool , 3 run  each) i  under 2.5   everywhere: home 2134 (2128–2326), product 2235 (2205–2295), /ponuda 2105, category 2116, landing 2109, Golf 7 2090. The claim of 2.5   or more on home, product and /ponuda did not reproduce. Every template mi e  the BRIEF 2.0   target and the J11 2.0   bar for category… [doc /qa/audit/verify/perf-lh/perf-lh-02-perf.txt, doc /qa/audit/verify/perf-lh/perf-lh-02-font -ab.j on] — perfskeptic → partially_confirmed (P2): Thi  wa  analy i  only; I ran no Lighthou e. I  plit each exi ting mobile devtool  run (finder'  kept run ,  tep-19 run , verifier j onl) into network time (CSS end) and main-thread time (CSS end to LCP).

1. The ≥ 2.5   number  come from CPU contention, not from the font .
- Home, finder'  run  (bench 3083–3749): LCP … [doc /qa/audit/verify/perf-lh/perf-lh-02-perf keptic.txt, doc /qa/audit/verify/perf-lh/perf-lh-02-perf keptic.j on]
- **Also reported as:** perf-bundle-08 (Font preloads do not match the first viewport: condensed 600 preloaded everywhere, Archivo Expanded 600 (H1 of category and ads landing) not preloaded @ /delovi/kocioni-diskovi, /ponuda/kocione-plocice-golf, / (and every page for the condensed preload))
- _Reviewer key: perf-lh-02_

#### PERF-04

**Shell first-load JS is 330–355 KB gzip (24–25 scripts) on every storefront template, about 2× the SEO-ADS §J11 JS budgets**

- **Severity:** P2 · **Area:** 5. Performance — Performance / bundle · **Status:** OPEN
- **Route:** All storefront templates (e.g. /delovi/kocioni-diskovi 352.7 KB, /deo/… 355 KB, / 347 KB, /kontakt 330 KB, /upit 451 KB)
- **Context:** Lighthouse network-requests / resource-summary, mobile applied throttling, first visit
- **Standard:** SEO-ADS §J11 (JS first load budgets); BRIEF §9 (TBT)
- **Known item:** shell first-load JS ~303 KB gzip (perf-lh / perf-bundle)
- **Reproduction:**
  1. Run any template with tests/lighthouse/run.mjs --throttling devtools.
  2. Sum the Script transferSize values in network-requests (or read resource-summary).
  3. Map each chunk by content: React DOM 0qy3sss5e6eww, Next router 0qimmyhv2_bjj, GSAP 1tr6a7zmh41cy, Convex 2jrozipxybei4, zustand 0sgvhbpe5nb6s, radix 0rklqt_vfe3_n.
- **Expected:** First-load JS ≤ 180 KB gzip on home, ≤ 160 KB on category/landing/product and ≤ 200 KB on checkout/inquiry (SEO-ADS §J11).
- **Actual:** Script transfer, category (25 scripts): 352.7 KB gzip, 99 % requested before `load`.
- React DOM: 72.3 KB (33 % unused).
- Next runtime: 34.7 KB.
- GSAP + plugins: 49.2 KB (56 % unused).
- zustand chunk: 23.1 KB.
- Convex client: 22.9 KB.
- radix: 13 KB.
- About 17 more chunks of 1–16 KB.
Home is 347 KB and /upit is 451 KB. The known figure of 303 KB counted first-load chunks only; the browser actually fetches about 330–355 KB before `load`.
- **Evidence:** [audit/perf-lh/lighthouse.md](audit/perf-lh/lighthouse.md) ('Bytes' table) · [audit/perf-lh/lighthouse-summary.json](audit/perf-lh/lighthouse-summary.json) (representative.scripts, representative.unusedJs)
- **Suggested fix:** 1. Lazy-load the header Dialog/SearchBox and the MobileNav Sheet (radix Dialog, Combobox, Convex useConvex) on intent.
2. Load ScrollTrigger/ScrollToPlugin only on home (perf-lh-05).
3. Keep ConvexClientProvider, but start the socket after idle for anonymous visitors.
4. Audit the 23 KB zustand chunk (0sgvhbpe5nb6s) and the chunks idle-warmed before `load` (VehiclePickerLazy, overlays).
5. Add a JS-bytes gate to tests/lighthouse/run.mjs.
- **Verification:** perf → confirmed (P2): Script tran fer (gzip) i  25  cript  on every template: home 351 KB, category 352.6, landing 352.6, product 355.3, Golf 7 346.4, /ponuda 366, /upit 450.5. 24 of 25 fini h before `load`. React DOM 0qy3 5e6eww i  71.6 KB (23.9–25.7 KB unu ed); the GSAP chunk i  48.5 KB. Thi  i  about twice the SEO-ADS §J11 fir t-load bud… [doc /qa/audit/verify/perf-lh/perf-lh-04-perf.txt, doc /qa/audit/verify/perf-lh/lh- ummary.txt]
- _Reviewer key: perf-lh-04_

#### PERF-05

**The site-wide text reveal costs about 230–400 ms of rAF work plus 300 ms of start-up per load at 4× CPU: per-word GSAP tweens animate filter blur with will-change on every word**

- **Severity:** P2 · **Area:** 5. Performance — Performance / motion runtime (text reveal) · **Status:** OPEN
- **Route:** All storefront templates; measured on /delovi/kocioni-diskovi, /deo/kocioni-disk-prednji-276-24-mm-demo-0004, /kontakt
- **Context:** Playwright Chromium, 412 × 823, 4× CPU via CDP, devtools.timeline trace from navigation to load + 5 s; consent pre-answered
- **Standard:** BRIEF §9 (TBT ≤ 200 ms); gsap-performance (prefer transform/opacity, avoid mass filter tweens, will-change only while animating); .claude/rules/architecture.md Text Reveal (the no-second-animation rule still holds)
- **Reproduction:**
  1. Run: AUDIT_BASE=http://localhost:3200 PATHS=/delovi/kocioni-diskovi,/deo/kocioni-disk-prednji-276-24-mm-demo-0004,/kontakt node scripts/qa/audit/perf-lh-trace.mjs 1
  2. Read docs/qa/audit/perf-lh/trace-attribution.json: rafCount/rafMs, perScript['1tr6a7zmh41cy.js'] and the longTasks with FireAnimationFrame.
  3. Compare with components/TextRevealGlobal.tsx lines 124–147: gsap.set on every word span with opacity, filter blur(8px), y, willChange 'transform, opacity, filter', then a staggered tween.
- **Corrected reproduction (verifier):**
  1. MSYS_NO_PATHCONV=1 AUDIT_BASE=http://localhost:3200 PATHS=/delovi/kocioni-diskovi node scripts/qa/audit/verify-perf-lh-trace.mjs 2
  2. Repeat with RM=reduce and compare styleTotal, layoutTotal, rafMs and the 25dplrt_qw3he.js long task.
- **Expected:** Copy entrance animations stay on the compositor (transform/opacity), stay out of the TBT window and add no long tasks (gsap-performance: avoid many simultaneous tweens of paint-heavy properties).
- **Actual:** Category: 333 rAF callbacks totalling 397 ms and GSAP function calls of 293 ms in the first 5 s. Long tasks of 74–249 ms are dominated by FireAnimationFrame plus UpdateLayoutTree (30–66 ms) and Commit (33 ms). The app chunk that holds TextRevealGlobal (25dplrt_qw3he.js) also runs a 298 ms task at hydration, with 68 ms of style and 74 ms of layout inside: the :has()-based hiddenSelector query and its observers.
Product: 456 rAF, 227 ms. /kontakt: 454 rAF, 234 ms.
Lighthouse bootup-time attributes 1.2–2.45 s to the GSAP chunk at 4×. The attempted A/B (reveal CSS/JS stripped) was too noisy on the shared machine to quantify the saving; see not_covered.
- **Evidence:** [audit/perf-lh/trace-attribution.json](audit/perf-lh/trace-attribution.json) · [audit/perf-lh/lighthouse-summary.json](audit/perf-lh/lighthouse-summary.json) (representative.bootup: 1tr6a7zmh41cy.js total 1174–2450 ms) · [audit/perf-lh/stylecost.json](audit/perf-lh/stylecost.json) (inconclusive A/B, kept for transparency)
- **Suggested fix:** 1. Drive the word animation with a CSS keyframe that is already inlined for RevealText (the tr-lcp pattern with --i/--n). TextRevealGlobal would then only split the words, set --i and toggle a class, with no per-frame GSAP work.
2. Drop filter: blur on coarse pointers or at small widths, or animate opacity and transform only.
3. Start the IntersectionObserver in requestIdleCallback after hydration.
4. Precompute eligibility on the server (e.g. a data attribute from RevealText-like helpers) so the runtime query does not evaluate the nested :has() selector across the document.
- **Verification:** perf → partially_confirmed (P2): A/B trace at 4× CPU, 412 px, 2 round  each, normal v  prefer -reduced-motion (the reveal mark  element  done without tween ). Category: long-ta k time over 50 m  659/1582 m  v  297/247;  tyle 246/326 v  41/34 m ; layout 338/509 v  168/150 m ; rAF 238/222 v  127/182 m . The TextRevealGlobal chunk 25dplrt_qw3he.j  ta k o… [doc /qa/audit/verify/perf-lh/perf-lh-06-perf.txt, doc /qa/audit/verify/perf-lh/perf-lh-06-trace-motion.j on]
- _Reviewer key: perf-lh-06_

#### PERF-06

**On slow phones the text-reveal failsafe fires before hydration: copy stays hidden about 3 s after first paint, then already-visible lines are hidden again and re-animated**

- **Severity:** P2 · **Area:** 5. Performance — Performance / text reveal robustness · **Status:** OPEN
- **Route:** /delovi/kocioni-diskovi · /deo/kocioni-disk-prednji-276-24-mm-demo-0004 · /delovi/kocioni-diskovi/volkswagen/golf (home also hits the failsafe)
- **Context:** Playwright Chromium 412 × 823, 4× CPU + Lighthouse slow-4G (562.5 ms RTT, 1.47 Mbps) via CDP, consent pre-answered
- **Standard:** DESIGN-SYSTEM §8.6 / .claude/rules/architecture.md (Text Reveal behaviour, failsafe); ARCHITECTURE risk R5 ('text reveal hides content'); BRIEF §9 visual quality
- **Reproduction:**
  1. Run: AUDIT_BASE=http://localhost:3200 node scripts/qa/audit/perf-lh-failsafe.mjs 2
  2. Read docs/qa/audit/perf-lh/failsafe.json: fcp, failsafeAt (html.tr-failsafe added), firstStateAt (TextRevealGlobal's first data-reveal-state) and splitAfterFailsafe (elements set to 'running' after the failsafe).
  3. Read components/TextRevealGlobal.tsx lines 73–76: it clears the timer but never checks html.tr-failsafe.
- **Corrected reproduction (verifier):**
  1. Run node scripts/qa/audit/verify-perf-lh-07-perfskeptic.mjs against :3100. It opens /delovi/kocioni-diskovi in Chromium at 412×823 with consent set, and an init script wraps window.setTimeout so the boot script's 3500 ms failsafe fires at 0 ms. This reproduces 'hydration finished after the failsafe' on any machine.
  2. First load: 6 first-viewport elements ("Više o kategoriji", the brand lines, the h3 product names, the OEM lines) have data-reveal-state=pending with computed opacity 1, then become running with word spans at opacity 0. The copy is visible, then goes blank, then re-animates.
  3. Scroll to the end: all 22 remaining lines are visible as they enter the bottom 15% of the viewport, then blank out and re-animate as they cross the IntersectionObserver line.
  4. Click the first product card (client-side navigation; window marker survives): the new copy is at opacity 1 while pending (not CSS-hidden) and is then split to opacity 0.
  5. Control run with the real 3500 ms timer: 0 elements painted visible and then hidden in any of the three phases.
  6. Real-world trigger: hydration has to finish more than 3.5 s after the stylesheet loads (the boot script runs after it). Under the D112 lab profile (4× CPU, slow 4G) this is borderline (lost by 0 to ~400 ms in prior runs). It happens reliably on slower-than-lab devices.
- **Expected:** Copy is readable soon after first paint on a mid-range phone. If the failsafe has revealed copy, the observer must not hide it again (.claude/rules/architecture.md: the failsafe reveals everything if the observer never starts).
- **Actual:** - FCP: 2.05–3.3 s.
- tr-failsafe: 5.30–5.77 s (3.5 s after the head boot script).
- TextRevealGlobal starts only at 5.86–7.84 s.
So every non-RevealText line in the first viewport is opacity 0 for about 3 s after first paint. After the failsafe has shown it, 6 elements on category and 2 on product and landing are split and animated from opacity 0 again: a visible flash and extra main-thread work after load. LCP is not affected; the LCP elements are RevealText or data-reveal="off".
- **Evidence:** [audit/perf-lh/failsafe.json](audit/perf-lh/failsafe.json) · scripts/qa/audit/perf-lh-failsafe.mjs
- **Suggested fix:** 1. In TextRevealGlobal, if html has tr-failsafe, mark every candidate done and do not re-hide (in reveal(), check the class before gsap.set).
2. Either arm the failsafe relative to the `load`/hydration time, or hide at boot only candidates below the first viewport, so above-the-fold copy never waits for hydration.
3. Make hydration cheaper (perf-lh-01), which also shortens the hidden window.
- **Verification:** perf → confirmed (P1): At 412 px, 4× CPU and  low 4G, 2 round  on each of 4 path : FCP 1996–2148 m , tr-fail afe at 5237–5317 m , TextRevealGlobal'  fir t  tate at 5568–5666 m . After the fail afe, 6 element  are  plit again on category and 2 on product and landing (home 0). Snap hot at 3.99  , 1.9   after FCP: 8 copy element  in the fir t v… [doc /qa/audit/verify/perf-lh/perf-lh-07-perf.txt, doc /qa/audit/verify/perf-lh/perf-lh-07-category-412-before-fail afe.webp] — perfskeptic → partially_confirmed (P2): The re-hide i  a real logic bug, and it   cope i  wider than reported. TextRevealGlobal.t x:75 only call  clearTimeout, and neither track() nor reveal() check  html.tr-fail afe. Once the fail afe ha  fired, the CSS gate  tay  off for the re t of the  e ion, yet every candidate i   till tracked and  plit from opacity 0.… [doc /qa/audit/verify/perf-lh/perf-lh-07-perf keptic.j on, doc /qa/audit/verify/perf-lh/perf-lh-07-perf keptic.txt]
- _Reviewer key: perf-lh-07_

#### PERF-07

**The Lighthouse gate tests/lighthouse/run.mjs does not enforce the BRIEF budgets, and four bugs lose data**

- **Severity:** P2 · **Area:** 5. Performance — Tooling / performance gate · **Status:** OPEN
- **Route:** tests/lighthouse/run.mjs (all templates)
- **Context:** Runner used as documented in WEB-QA §2 and TESTING §M
- **Standard:** BRIEF §9; docs/TESTING.md §M; Definition of Done (reliable quality gates)
- **Reproduction:**
  1. Read tests/lighthouse/run.mjs line 34: `const BUDGET = { lcp: 2500, cls: 0.05, tbt: 300, performance: 0.85 }`.
  2. Run: MSYS_NO_PATHCONV=1 node tests/lighthouse/run.mjs --base http://localhost:3200 --runs 3 --desktop / /delovi/kocioni-diskovi. `/` is silently skipped; see lh-console.log line 105 onward, where only category and product ran.
  3. Run any batch with --runs 5 --throttling devtools / on a loaded machine. When one run returns NO_NAVSTART, the script crashes at `run.cls.toFixed` and every remaining URL is lost.
  4. Observe `LCP element:` printed empty on every run.
- **Expected:** The gate encodes BRIEF §9 and step 22: TBT ≤ 200 ms, perf ≥ 90 for catalog/product, a11y ≥ 95, SEO ≥ 95 on indexable pages, SEO-ADS JS bytes. It survives a failed run and reports the LCP element.
- **Actual:** 1. TBT budget is 300 ms (BRIEF 200); performance is a flat 85 (BRIEF: 90 for catalog/product); there are no a11y, SEO, best-practices or JS-byte gates. /delovi at 91/246 ms printed 'budgets met'.
2. Three runs in this audit hit NO_NAVSTART; each crash aborted the rest of its batch.
3. The LCP element is always empty, because Lighthouse 13 removed `largest-contentful-paint-element`; the data is now in lcp-breakdown-insight.
4. A path that directly follows the boolean --desktop is parsed as the flag's value and dropped: `/` and `/delovi` were never run on desktop.
- **Evidence:** [audit/perf-lh/lh-console.log](audit/perf-lh/lh-console.log) (lines 2–10, 19–27, 96–104 crashes; 17, 34, 46 empty LCP element; 53 'budgets met' at TBT 246; 105–106 '/' skipped) · [audit/perf-lh/lh-fill.log](audit/perf-lh/lh-fill.log) (NO_NAVSTART retries) · scripts/qa/audit/perf-lh-fill.mjs (workaround: one run per call + retry)
- **Suggested fix:** In tests/lighthouse/run.mjs:
- Set per-template budgets from BRIEF §9 / SEO-ADS §J11 (tbt 200; perf 0.90 for /delovi*, /deo/*, /ponuda/*; a11y and SEO ≥ 0.95 unless the page is noindex; a JS-bytes gate).
- Skip and retry runs with lhr.runtimeError instead of dereferencing missing metrics.
- Read the LCP node from audits['lcp-breakdown-insight'].details.items (type 'node').
- Treat only known value flags (--base, --runs, --throttling) as consuming the next argument.
- Record environment.benchmarkIndex and reject runs below a threshold.
- **Verification:** perf → confirmed (P2): Static check , all reproduced:
- te t /lighthou e/run.mj :35  et  tbt 300 and a flat performance 0.85, with no a11y, SEO or JS-byte  gate , although TESTING.md  ay  the runner check  §J11.
- The path filter on line 29 drop  a path that follow  --de ktop:  imulating the arg  '--de ktop / /delovi/kocioni-di kovi' give  o… [doc /qa/audit/verify/perf-lh/perf-lh-10-perf.txt]
- _Reviewer key: perf-lh-10_

#### PERF-08

**`import { z } from "zod"` ships all of zod 4 (40+ locales, JSON Schema): +101 KB gzip / 394 KB raw on checkout, VIN inquiry and mechanic registration**

- **Severity:** P2 (reported P1, adjusted by verification) · **Area:** 5. Performance — JS bundle / forms · **Status:** OPEN
- **Route:** /porudzbina, /upit, /za-majstore/registracija
- **Context:** Production build on :3100, any viewport/browser, anonymous, first load before interaction
- **Standard:** BRIEF §9 Performance (mobile TBT ≤ 200 ms, 'world-class' bar); BRIEF §5 core flows (order, VIN inquiry); ARCHITECTURE §0.3.14 (measure chunk sizes)
- **Reproduction:**
  1. curl -s -H 'Accept-Encoding: gzip' http://localhost:3100/porudzbina | gunzip | grep -o '/_next/static/chunks/[^"]*\.js' — the list contains 1uyyf-z7kpx1w.js (same on /upit)
  2. node -e "const b=require('fs').readFileSync('.next/static/chunks/1uyyf-z7kpx1w.js');console.log(b.length, require('zlib').gzipSync(b).length)" → 403 KB raw, 101 KB gzip
  3. grep -o 'Nieprawid' .next/static/chunks/1uyyf-z7kpx1w.js | wc -l → 13 (Polish locale); Chinese, Russian, Turkish locale strings and toJSONSchema/fromJSONSchema are also present
  4. grep -l 1uyyf-z7kpx1w .next/server/app/**/page_client-reference-manifest.js → (shop)/porudzbina, (shop)/upit, (shop)/za-majstore/registracija
  5. Compare with esbuild (docs/qa/audit/perf-bundle/esbuild-comparisons.txt): the same schema with `import { z } from "zod"` = 91.0 KB gz, `import * as z from "zod"` = 24.4 KB gz, `zod/mini` = 5.6 KB gz
- **Corrected reproduction (verifier):**
  1. curl -s -H 'Accept-Encoding: gzip' http://localhost:3100/porudzbina | gunzip | grep -o '/_next/static/chunks/[^"]*\.js' | sort -u: the list includes 1uyyf-z7kpx1w.js. It is also on /upit and /za-majstore/registracija, and not on /korpa, /, /deo/..., /prijava or /za-majstore.
  2. node -e "const b=require('fs').readFileSync('.next/static/chunks/1uyyf-z7kpx1w.js');console.log(b.length, require('zlib').gzipSync(b).length)" prints 430078 bytes raw (420 KiB) and about 103.4 to 103.6 K gzip (101 KiB).
  3. grep -o Nieprawid .next/static/chunks/1uyyf-z7kpx1w.js | wc -l prints 13. Chinese 无效, Russian Неверн, toJSONSchema and fromJSONSchema are also present.
  4. node scripts/qa/audit/verify-perf-bundle-01-browser.mjs: at 390 px the three form routes load about 108 KiB more JS on the wire than /korpa.
  5. node scripts/qa/audit/verify-perf-bundle-01-nav.mjs: add a product to the cart, open /korpa, throttle to slow 4G and tap the checkout link. The chunk is fetched only after the tap and delays the navigation by about 0.57 s (median of 3, cold vs chunk-cached).
  6. Fix: in lib/validation/checkout.ts, inquiry.ts and mechanicRegistration.ts, stop pulling the zod classic namespace into client code. Option 1 is `import * as z from "zod"` (esbuild: 106 to 40 KiB gz including RHF). Option 2 is zod/mini, or named imports from zod/mini. Turbopack's behaviour is unproven, so after the rebuild confirm with `grep -c Nieprawid` = 0 on the new chunk. Optionally warm the checkout chunk from /korpa (for example a dynamic import in idle time), and add a per-route first-load size check (ARCHITECTURE §0.3 item 14).
- **Expected:** Form validation adds at most ~25 KB gzip to the checkout and inquiry pages (only the zod features the schemas use + react-hook-form).
- **Actual:** One hoisted module (zod classic with every locale and JSON Schema conversion + react-hook-form + zodResolver) of 393.6 KB raw / 101.1 KB gzip is in the first load. /porudzbina ships 429.9 KB gz and /upit 428.7 KB gz of module JS vs 321.3 KB gz on /korpa with the same shell: +34 %. JS heap after load is +0.7 to +1.0 MB vs /korpa (scriptcost.txt, 3 runs).
- **Evidence:** [audit/perf-bundle/esbuild-comparisons.txt](audit/perf-bundle/esbuild-comparisons.txt) · [audit/perf-bundle/signatures.txt](audit/perf-bundle/signatures.txt) · [audit/perf-bundle/entries.txt](audit/perf-bundle/entries.txt) · [audit/perf-bundle/templates.txt](audit/perf-bundle/templates.txt) · [audit/perf-bundle/scriptcost.txt](audit/perf-bundle/scriptcost.txt) · [audit/perf-bundle/bundle.md](audit/perf-bundle/bundle.md)
- **Suggested fix:** In lib/validation/checkout.ts, lib/validation/inquiry.ts and lib/validation/mechanicRegistration.ts replace `import { z } from "zod"` with `import * as z from "zod"` (esbuild: 91 → 24 KB gz), or port the three client schemas to `zod/mini` (5.6 KB gz) and keep classic zod for server/tests. Verify after the rebuild that Turbopack drops the locales (`grep -c Nieprawid` on the new chunk = 0; scripts/qa/audit/perf-bundle-signatures.mjs). Optionally load zodResolver and the schema on first focus of the form. Add a first-load size check per route to the chunk-size script (ARCHITECTURE §0.3 item 14).
- **Verification:** reproduce → confirmed (P2): The defect i  real and matche  the report. I am lowering  everity to P2. One Turbopack module (#81307) hold  zod 4.6.5 cla ic with every locale (Nieprawid x13, 无效 x13, Неверн x13, al o Ungültig, Geçer iz and Érvénytelen), plu  toJSONSchema x5, fromJSONSchema x2, react-hook-form and zodRe olver. The file i  .next/ tatic… [doc /qa/audit/verify/perf-bundle/perf-bundle-01-reproduce-e build.txt ( cript /qa/audit/verify-perf-bundle-01-e build.mj ): real  chema  a -i  451.0 KiB raw / 9…, doc /qa/audit/verify/perf-bundle/perf-bundle-01-reproduce-brow er.txt and .j on ( cript /qa/audit/verify-perf-bundle-01-brow er.mj ): wire JS at 390 px, 3 run :…] — skeptic → confirmed (P2): The main claim hold . /porudzbina, /upit and /za-maj tore/regi tracija each reference chunk 1uyyf-z7kpx1w.j . It i  the only chunk in .next/ tatic that contain  zod locale , and it appear  only in tho e three client-reference manife t . It hold  all of zod cla ic (Nieprawid x13, 无效 x13, Неверн x13, toJSONSchema x5, fro… [doc /qa/audit/verify/perf-bundle/perf-bundle-01- keptic.txt, doc /qa/audit/verify/perf-bundle/perf-bundle-01- keptic-e build.txt]
- **Also reported as:** perf-lh-08 (The inquiry and mechanic-registration forms ship full zod 4 with every locale: a 102 KB gzip chunk, 85 % unused, whose eval probe is blocked by the CSP @ /upit · /za-majstore/registracija (lib/validation/checkout.ts suggests checkout too))
- _Reviewer key: perf-bundle-01_

#### PERF-09

**Root Providers mounts radix Tooltip.Provider, so Tooltip + Popper/floating-ui (13.2 KB gzip) load on every storefront page that never shows a tooltip**

- **Severity:** P2 · **Area:** 5. Performance — JS bundle / shell · **Status:** OPEN
- **Route:** All storefront templates: /, /delovi, /delovi/kocioni-diskovi, /deo/*, /pretraga, /vozila/*, /ponuda/*, /za-majstore, /upit, /korpa, /porudzbina, /prijava
- **Context:** Production build :3100, all viewports, first load
- **Standard:** BRIEF §9 Performance (mobile TBT/LCP budgets); D106 (less first-load JS and hydration work)
- **Known item:** Shell first-load JS ~303 KB gzip (co-owned with perf-lh) — distinct root cause
- **Reproduction:**
  1. Open components/providers/Providers.tsx: line 7 `import { Tooltip as TooltipPrimitive } from "radix-ui"`, line 16 wraps the whole app in `<TooltipPrimitive.Provider>`
  2. node scripts/qa/audit/perf-bundle-modules.mjs 14y-81z8a-w-u 25dplrt_qw3he → module #53660 [Anchor,Arrow,Content,Root,createPopperScope] 25.7 KB raw / 10.1 KB gz and #85786 [Tooltip,TooltipContent,…] 8.4 KB raw / 3.1 KB gz
  3. The entry manifest lists 14y-81z8a-w-u.js under [project]/app/layout for every route (entries.txt)
  4. grep -rln 'components/ui/Tooltip' components app → only components/admin/charts.tsx, components/admin/shell/AdminSidebar.tsx and the styleguide use tooltips
- **Expected:** The storefront first load contains no Popper/floating-ui code; tooltip code loads only in the admin panel and the styleguide.
- **Actual:** 34.1 KB raw / 13.2 KB gzip of Tooltip + Popper (floating-ui) sits in the root layout chunks of all 12 perf templates (4 % of the shell).
- **Evidence:** [audit/perf-bundle/home-modules.txt](audit/perf-bundle/home-modules.txt) · [audit/perf-bundle/shell-groups.txt](audit/perf-bundle/shell-groups.txt) · [audit/perf-bundle/entries.txt](audit/perf-bundle/entries.txt) · [audit/perf-bundle/bundle.md](audit/perf-bundle/bundle.md)
- **Suggested fix:** Remove TooltipPrimitive.Provider from components/providers/Providers.tsx. Wrap the admin shell (components/admin/shell/*) and the styleguide gallery in the Provider instead, or let components/ui/Tooltip.tsx render its own `TooltipPrimitive.Provider` around each Root (Radix supports nested providers).
- **Verification:** reproduce → confirmed (P2): Reproduced independently on build 9b4K278NWK6BGwhVv5UCP (:3100). I par ed the  erved chunk  my elf in tead of u ing the reviewer'   cript. Import chain: 25dplrt_qw3he.j  #66120 Provider  → e.i(85786), the Tooltip module (8.4 KB raw) → e.i(53660), which i  Popper plu  inlined floating-ui (chunk 14y-81z8a-w-u.j , 26.3 KB… [doc /qa/audit/verify/perf-bundle/perf-bundle-02-reproduce.txt, doc /qa/audit/verify/perf-bundle/perf-bundle-02-reproduce- tatic.txt]
- _Reviewer key: perf-bundle-02_

#### PERF-10

**ScrollTrigger + ScrollToPlugin + CustomEase registered for every page: ≈ 22 KB gzip used only by the home hero**

- **Severity:** P2 · **Area:** 5. Performance — JS bundle / GSAP · **Status:** OPEN
- **Route:** All templates except / (and / itself before the hero needs them)
- **Context:** Production build :3100, all viewports, first load
- **Standard:** BRIEF §9 Performance; ARCHITECTURE §G5; gsap-performance skill (load only what animates)
- **Known item:** Globally registered GSAP plugins (owners perf-lh and perf-bundle)
- **Reproduction:**
  1. Open lib/gsap/client.ts: imports and registers ScrollTrigger, ScrollToPlugin and CustomEase at module scope (lines 11–13, 22, 33)
  2. grep -rl 'ScrollTrigger\|scrollTo:' components → only components/three/HeroStage.tsx (home) and components/motion/ScrollTriggerRefresher.tsx
  3. Chunk 1tr6a7zmh41cy.js (121.4 KB raw / 48.4 KB gz, gsap + 3 plugins + motion constants) is in the first load of all 12 templates (templates.txt)
  4. esbuild: gsap core 27.1 KB gz; with the three plugins and useGSAP 49.3 KB gz → plugins = 22.2 KB gz (ScrollTrigger 17.3, CustomEase 3.1, ScrollToPlugin 1.4)
- **Expected:** Pages without scroll-linked animation load GSAP core only (the text reveal needs core); ScrollTrigger/ScrollToPlugin load with the home hero.
- **Actual:** Every page downloads, parses and registers ≈ 22 KB gzip of plugins; CustomEase is used only to create four cubic-bezier eases.
- **Evidence:** [audit/perf-bundle/esbuild-comparisons.txt](audit/perf-bundle/esbuild-comparisons.txt) · [audit/perf-bundle/signatures.txt](audit/perf-bundle/signatures.txt) · [audit/perf-bundle/templates.txt](audit/perf-bundle/templates.txt)
- **Suggested fix:** Split lib/gsap/client.ts: keep gsap + useGSAP + the sk.* eases registered with `gsap.registerEase(name, cubicBezier(x1,y1,x2,y2))` (a 20-line bezier solver from constants/motion EASE_CURVES) instead of CustomEase; move ScrollTrigger + ScrollToPlugin registration into lib/gsap/scroll.ts imported only by HeroStage; make ScrollTriggerRefresher / requestScrollTriggerRefresh no-ops until lib/gsap/scroll.ts has loaded. Update ARCHITECTURE §G5 and the architecture rule.
- **Verification:** reproduce → confirmed (P2): lib/g ap/client.t  regi ter  ScrollTrigger, ScrollToPlugin and Cu tomEa e at module  cope (line  11–13, 22, 33). The  erved merged module #65747 (1tr6a7zmh41cy.j , 121.4 KB raw / 47.7 KB gzip) i  in the fir t load of all 12 template  and i  reque ted on every route, width and engine I te ted. I mea ured with e build 0.… [doc /qa/audit/verify/perf-bundle/perf-bundle-03-reproduce.txt, doc /qa/audit/verify/perf-bundle/perf-bundle-03-reproduce-e build.txt]
- **Also reported as:** perf-lh-05 (GSAP ScrollTrigger and ScrollToPlugin are registered globally, although only the home hero uses them; the GSAP chunk is 56–69 % unused on other routes @ Every route except / (e.g. /delovi/kocioni-diskovi, /deo/…, /upit, /kontakt))
- _Reviewer key: perf-bundle-03_

#### PERF-11

**Overlay code is eager in the shell: Sheet/Dialog stack, Toaster, consent banner (also after consent) and header sheets ≈ 24–30 KB gzip that only runs on intent**

- **Severity:** P2 · **Area:** 5. Performance — JS bundle / shell · **Status:** OPEN
- **Route:** All storefront templates (landing via its own layout)
- **Context:** Production build :3100, 390 and 1440, consent cookie already set (Odbij sve), first load before interaction
- **Standard:** BRIEF §9 Performance (TBT ≤ 200 ms mobile); D106, D120 (lazy overlays)
- **Known item:** Shell first-load JS ~303 KB gzip (co-owned with perf-lh) — distinct root cause
- **Reproduction:**
  1. node scripts/qa/audit/perf-bundle-modules.mjs on the home first-load chunks (home-modules.txt)
  2. Sheet/Dialog stack in 1t0q0ok8maumv.js + 2vm060vmiv-df.js: RemoveScroll 10.6 KB raw, FocusScope, DismissableLayer, Presence, Dialog, Sheet, hideOthers, focus guards = 33.2 KB raw / 13.4 KB gz
  3. radix Toast (Toaster mounted in components/providers/Providers.tsx line 18): 15.3 KB raw / 5.5 KB gz
  4. ConsentBanner + radix Switch + consent store: 11.2 KB raw / 5.3 KB gz although the sk_consent cookie exists and the banner is not rendered (ConsentRoot imports ConsentBanner statically)
  5. MobileNav / HeaderSearch dialog / SearchBox / Combobox: 12.5 KB raw / 6.1 KB gz (only the trigger buttons are needed at first paint)
- **Corrected reproduction (verifier):**
  1. Fetch the HTML of /, /delovi/kocioni-diskovi, /deo/kocioni-disk-prednji-276-24-mm-demo-0004, /pretraga?q=disk, /ponuda/kocione-plocice-golf and /korpa from :3100 and list the module scripts (nomodule excluded).
  2. node scripts/qa/audit/verify-perf-bundle-sets.mjs → set A (claimed) is 28.4 KB gzip in-chunk. Set B (SearchBox/Combobox kept) is 25.1 KB. Dialog stack alone 10.9, Toast alone 7.3, ConsentBanner + Switch 3.2.
  3. curl / and /pretraga?q=disk | grep role="combobox" → the hero and results SearchBox render at first paint, so they cannot be deferred on those routes.
  4. grep 'e.i(40743)' .next/static/chunks/1cggx7i-lhdg7.js and 'import { Sheet }' components/catalog/CatalogControls.tsx → the category page imports Sheet statically. The fix must also lazy-load the filter sheet.
  5. Fix scope: lazy-load the MobileNav sheet, the HeaderSearch dialog body (off / and /pretraga), the CatalogControls filter sheet, the Toaster viewport (split the toast() API out of components/ui/Toast.tsx) and ConsentBanner when a consent record exists.
- **Expected:** Like the cart drawer (D120) and the vehicle picker (D106): overlays, toasts and the consent UI load on intent (hover/focus/tap of their trigger, first toast() call, banner actually needed).
- **Actual:** ≈ 24 KB gzip of overlay/toast/consent code (+ ≈ 6 KB header sheet code) is downloaded, parsed and hydrated on every page before any interaction.
- **Evidence:** [audit/perf-bundle/shell-groups.txt](audit/perf-bundle/shell-groups.txt) · [audit/perf-bundle/home-modules.txt](audit/perf-bundle/home-modules.txt) · [audit/perf-bundle/runtime.txt](audit/perf-bundle/runtime.txt)
- **Suggested fix:** Apply the D120 pattern: (1) components/shell/MobileNav.tsx and HeaderSearch.tsx render only the trigger and `import()` the Sheet/Dialog body on pointerenter/focus/click; (2) components/ui/Toast.tsx: `toast()` queues and lazy-imports the Toaster viewport on first call (remove it from Providers); (3) components/consent/ConsentRoot.tsx renders a tiny client stub when a consent record exists and lazy-loads ConsentBanner only when `openConsentSettings()` fires; keep the SSR banner path for first visits (D185). Re-measure with scripts/qa/audit/perf-bundle-html.mjs.
- **Verification:** reproduce → partially_confirmed (P2): Confirmed: the fir t load of every  torefront template carrie  the radix Dialog  tack (Dialog, Focu Scope, Focu Guard , RemoveScroll 10.6 KB raw, hideOther , ui/Sheet, ui/Dialog, u eOverlayMotion), Di mi ableLayer/Pre ence/Collection, the radix Toa t plu  Toa ter (#80809, 15.3 KB raw / 5.5 KB gzip), and Con entBanner p… [doc /qa/audit/verify/perf-bundle/perf-bundle-04-reproduce.txt, doc /qa/audit/verify/perf-bundle/perf-bundle-04-reproduce- et .txt]
- _Reviewer key: perf-bundle-04_

#### PERF-12

**Phosphor icons used in client components ship all six weights (23 icons, 56.5 KB raw on home) although D30 uses only the regular weight**

- **Severity:** P2 · **Area:** 5. Performance — JS bundle / icons · **Status:** OPEN
- **Route:** All storefront templates (header, ShopChrome, MobileNav, ErrorState, Toast, hero)
- **Context:** Production build :3100, first load
- **Standard:** D30 (regular weight only); BRIEF §9 Performance
- **Known item:** Shell first-load JS ~303 KB gzip (co-owned with perf-lh) — distinct root cause
- **Reproduction:**
  1. node scripts/qa/audit/perf-bundle-modules.mjs <home first-load chunks> (home-modules.txt): 23 icon modules — PhoneIcon 4.4 KB, WhatsappLogoIcon 4.3, ListNumbersIcon 3.9, WrenchIcon 3.7, CarIcon 3.3, WarningIcon 3.3, …
  2. Inspect one: grep -o '.\{300\}' .next/static/chunks/0sgvhbpe5nb6s.js | grep -m1 PhoneIcon → `new Map([["bold",…],…])` with bold, duotone, fill, light, regular, thin paths
  3. Same icon modules are duplicated across chunks (ArrowCounterClockwiseIcon x2, PhoneIcon/WhatsappLogoIcon x2 on the landing)
- **Expected:** Client islands carry only the regular-weight path of each icon (≈ 0.5–0.8 KB raw each), as intended by D30.
- **Actual:** 56.5 KB raw (≈ 15–20 KB gzip standalone) of icon code in home's first load; roughly 5/6 of it is unused weights.
- **Evidence:** [audit/perf-bundle/home-modules.txt](audit/perf-bundle/home-modules.txt) · [audit/perf-bundle/landing-modules.txt](audit/perf-bundle/landing-modules.txt) · [audit/perf-bundle/dupes.txt](audit/perf-bundle/dupes.txt)
- **Suggested fix:** Generate a local single-weight icon set (script under scripts/brand/ emitting components/icons/<Name>.tsx with only the regular path, same props API) and use it in client components; or pass `/dist/ssr` icons rendered by server components as ReactNode props into client islands (ShopChrome, MobileNav, CartButtonLive, ErrorState, Toast). Keep optimizePackageImports.
- **Verification:** reproduce → confirmed (P2): The  erved PhoneIcon in 0 gvhbpe5nb6 .j  carrie  a weight Map with bold, duotone, fill, light, regular and thin. Pho phor'   r and c r build   hare di t/def /<Icon>.e .j  with all  ix weight ,  o importing from /di t/ r doe  not help in ide client component ; 98 client component  import Pho phor. I mea ured by rewritin… [doc /qa/audit/verify/perf-bundle/perf-bundle-05-reproduce.txt, doc /qa/audit/verify/perf-bundle/perf-bundle-02-reproduce- tatic.txt]
- _Reviewer key: perf-bundle-05_

#### PERF-13

**Root app/not-found.tsx renders the full SiteShell: +32 KB gzip of shop-header JS on the ads landing and a second serialized header/footer/404 in every page's RSC payload**

- **Severity:** P2 · **Area:** 5. Performance — JS bundle / RSC payload · **Status:** OPEN
- **Route:** /ponuda/kocione-plocice-golf (all /ponuda/*); RSC duplication on every route
- **Context:** Production build :3100, 390 (mobile ad traffic) and all widths, first load
- **Standard:** BRIEF §9 Performance (catalog/landing ≥ 90, mobile); BRIEF §5 SEO/Ads (landings for mobile ad traffic)
- **Known item:** Shell first-load JS ~303 KB gzip (co-owned with perf-lh) — distinct root cause
- **Reproduction:**
  1. curl the landing HTML (docs/qa/audit/perf-bundle/html/landing.html): scripts include 404ko09-15lhs.js (17.8 KB gz), 00t-a16koa1p2.js (14.2 KB gz), 1axg9-vmwkb-w.js (0.2)
  2. In .next/server/app/(landing)/ponuda/[slug]/page_client-reference-manifest.js those three chunks appear only under "[project]/app/not-found" (entries.txt), not under the (landing) layout or page
  3. Module split (landing-modules.txt): MobileNav, SearchBox, Combobox, Sheet, ListNumbersIcon, WrenchIcon, UserCircleIcon, VehicleChip… — the landing layout renders none of the MobileNav/search UI
  4. node scripts/qa/audit/perf-bundle-dupes.mjs → landing has 44 modules shipped twice (77.7 KB raw) vs 14 on other pages
  5. node scripts/qa/audit/perf-bundle-rsc-count.mjs → "site-header"/"site-footer" appear 2x in the RSC payload but 1x in the HTML on shop pages (2x vs 0x on the landing); "Stranica nije pronađena" 2x in RSC, 0x in HTML
- **Corrected reproduction (verifier):**
  1. curl -s http://localhost:3100/ponuda/kocione-plocice-golf | grep -oE 'static/chunks/(1axg9-vmwkb-w|1t0q0ok8maumv|404ko09-15lhs|00t-a16koa1p2)\.js' | sort -u → all four present
  2. Evaluate .next/server/app/(landing)/ponuda/[slug]/page_client-reference-manifest.js and print entryJSFiles → the four chunks are listed only under [project]/app/not-found
  3. node scripts/qa/audit/verify-perf-bundle-chunks.mjs (390 px Chromium) → landing fetches 4/4 not-found-only chunks = 40.0 KB gz; home/category/product fetch 0
  4. node scripts/qa/audit/verify-perf-bundle-rsc.mjs → the root not-found SiteShell + NotFoundContent is serialized 2x in the landing RSC (root + (landing) LayoutRouter notFound) and 1x on shop pages
  5. Fix as suggested (lightweight root app/not-found.tsx without SiteShell/VehiclePickerLazy, a rich 404 through a (shop) catch-all that calls notFound(), and a minimal app/(landing)/not-found.tsx), then re-run both scripts
- **Expected:** The ads landing loads only its minimal chrome; the 404 fallback adds no client JS to pages that never render it and is not serialized as a full second shell.
- **Actual:** The landing — where paid mobile traffic arrives — has the heaviest first load of all catalog-type templates (340.2 KB gz module JS vs 329.1 on home), 32.2 KB gz of it only for the root 404 fallback. Every page's RSC payload carries an extra header + footer + NotFoundContent (≈ 12–16 KB decoded).
- **Evidence:** [audit/perf-bundle/entries.txt](audit/perf-bundle/entries.txt) · [audit/perf-bundle/landing-modules.txt](audit/perf-bundle/landing-modules.txt) · [audit/perf-bundle/dupes.txt](audit/perf-bundle/dupes.txt) · [audit/perf-bundle/rsc-count.txt](audit/perf-bundle/rsc-count.txt) · [audit/perf-bundle/rsc.txt](audit/perf-bundle/rsc.txt) · [audit/perf-bundle/templates.txt](audit/perf-bundle/templates.txt)
- **Suggested fix:** Make app/not-found.tsx a lightweight server component without SiteShell/VehiclePickerLazy (plain header link + NotFoundContent links, no client islands), and route unknown URLs to the rich shop 404 with a catch-all `app/(shop)/[...nepostojece]/page.tsx` that calls notFound() (uses the existing app/(shop)/not-found.tsx inside the shop layout). Add a minimal app/(landing)/not-found.tsx. Re-run scripts/qa/audit/perf-bundle-entries.mjs and -rsc-count.mjs.
- **Verification:** reproduce → confirmed (P2): Reproduced on the :3100 build, and the finding under tate  the JS co t. In .next/ erver/app/(landing)/ponuda/[ lug]/page_client-reference-manife t.j , four chunk  appear only under [project]/app/not-found: 1axg9-vmwkb-w.j , 1t0q0ok8maumv.j  (Radix Dialog, 8.0 KB gz; it  module #64053 i  in no other landing chunk), 404k… [doc /qa/audit/verify/perf-bundle/perf-bundle-06-reproduce.txt (node  cript /qa/audit/verify-perf-bundle-chunk .mj : landing 'chunk  only in app/not-found: 1axg9…, doc /qa/audit/verify/perf-bundle/perf-bundle-06-r c-count.txt (node  cript /qa/audit/verify-perf-bundle-r c.mj : landing " ite-header" r c 2 / html 0;  hop page…]
- _Reviewer key: perf-bundle-06_

#### PERF-14

**3D start freezes the main thread for 0.3–0.9 s at the visitor's first touch, scroll or hover (the PMREM shader compiles synchronously, the first frame still links programs, the 3D chunk evaluates)**

- **Severity:** P2 (reported P1, adjusted by verification) · **Area:** 5. Performance — 3D hero runtime: start · **Status:** OPEN
- **Route:** /
- **Context:** Chromium 1.63 headless, ANGLE D3D11 (RTX 4060 Laptop). Desktop 1440×900 at DPR 1, CPU 1× and 4×. Mobile 390×844 at DPR 3 with touch, CPU 4× and 6×. Anonymous visitor, consent answered, first visit (fresh browser, so the GPU program cache is cold). Server: localhost:3200.
- **Standard:** BRIEF §4 (the 3D must never block the page); 3D-CONTRACT F7.3 (compileAsync, idle slices); DESIGN-SYSTEM §1 principle 5 (3D never blocks); docs/3d/WEB-QA.md §4 (init in tasks ≤ 175 ms); INP ≤ 200 ms
- **Reproduction:**
  1. Launch a fresh Chromium with --use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist and open http://localhost:3200/. Wait for load.
  2. Optional: set the CPU throttle with CDP Emulation.setCPUThrottlingRate {rate: 4}.
  3. Give intent: on desktop move the pointer over the hero stage; on mobile tap the stage or scroll more than 40 px.
  4. Record a CPU profile and the long tasks until window.__sklop3d.getState().status === 'ready'. Scripted: `node scripts/qa/audit/perf-3d-profile.mjs --vp desktop --cpu 1 --gpu`, run 3 times (each run launches a new browser); `node scripts/qa/audit/perf-3d-frames.mjs --vp mobile --cpu 4 --gpu --runs 3`; and `... --cold` to make the first scroll the intent.
- **Corrected reproduction (verifier):**
  1. Use Windows with Chrome or Edge on ANGLE D3D11 (Playwright: chromium.launch({args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']})). Use a NEW browser launch for every measured run: a new context in the same browser reuses the in-memory GPU program cache, and the problem disappears.
  2. Open http://localhost:3200/ at 1440x900, DPR 1, CPU 1x, with consent answered. Wait for load.
  3. Move the pointer over the hero stage (intent). Record a CPU profile until window.__sklop3d.getState().status === 'ready'.
  4. Expected: no task over 50-100 ms. Actual (cold): one task of about 340-460 ms. Its self time is getProgramParameter under PMREMGenerator.fromEquirectangular → _applyGGXFilter. A second task of about 200-250 ms follows (138-191 ms getProgramParameter in the first render after compileAsync). Start TBT is about 525 ms.
  5. Control: repeat in the same browser (warm cache). Start TBT is 0-8 ms at 1x, and PMREM takes about 15 ms.
  6. Do not count the canvas chunk evaluation (turbopack H, about 20 ms at 1x, 255-489 ms at 4x/6x) toward this finding. It is the budgeted lazy chunk. Phone numbers need a real phone GPU backend, not a desktop D3D11 run with CPU throttling.
- **Expected:** The 3D never blocks the page. The init runs in short tasks (WEB-QA §4 records tasks ≤ 175 ms), and compileAsync plus idle slices keep scrolling and taps responsive while the model comes up (BRIEF §4, contract F7.3).
- **Actual:** PMREMGenerator.fromEquirectangular → _applyGGXFilter → getUniforms → getProgramParameter blocks while the PMREM blur shader compiles: 336, 344 and 457 ms at 1× CPU on three fresh browsers (busy stretches 378–519 ms), and 725–884 ms at 4×. The 3D chunk (282 KB gzip) takes 255–345 ms to evaluate at 4×. The first real frame after compileAsync still blocks 160–190 ms in getProgramParameter plus 52–92 ms of texSubImage2D, although KHR_parallel_shader_compile is available. Worst start long task: desktop 4× 556/291/434 ms (start TBT 604–1113 ms); mobile 4× 765/294/313 ms (TBT 527–1603 ms); mobile 6× 897/435/616 ms (TBT 1267–2293 ms). When the first scroll on a phone is the intent (4×), a single frame in the middle of the scroll takes 683, 333 and 300 ms (3/3 runs). A warm program cache cuts the PMREM cost to about 77 ms, but first-time visitors (ad traffic) always pay the full cost.
- **Evidence:** [audit/perf-3d/profile-start-desktop-cpu1-cold.txt](audit/perf-3d/profile-start-desktop-cpu1-cold.txt) · [audit/perf-3d/profile-start-desktop.txt](audit/perf-3d/profile-start-desktop.txt) · [audit/perf-3d/profile-start-mobile.txt](audit/perf-3d/profile-start-mobile.txt) · [audit/perf-3d/frames-desktop-cpu4-gpu.json](audit/perf-3d/frames-desktop-cpu4-gpu.json) · [audit/perf-3d/frames-mobile-cpu4-gpu.json](audit/perf-3d/frames-mobile-cpu4-gpu.json) · [audit/perf-3d/frames-mobile-cpu6-gpu.json](audit/perf-3d/frames-mobile-cpu6-gpu.json) · [audit/perf-3d/frames-mobile-cpu4-gpu-cold.txt](audit/perf-3d/frames-mobile-cpu4-gpu-cold.txt) · [audit/perf-3d/3d.md](audit/perf-3d/3d.md)
- **Suggested fix:** components/three/canvas/loadCar.ts loadEnvironment(): stop prefiltering at runtime. Bake the PMREM output (cubeUV layout) in the 3D pipeline, export it as a half-float/RGBE PNG or KTX2, load it with mapping = CubeUVReflectionMapping and drop PMREMGenerator and HDRLoader. If that is not possible, compile the PMREM blur material through KHR_parallel_shader_compile first (compileAsync on a throwaway mesh) before calling fromEquirectangular. In HeroCanvas.tsx, include every material the first frame uses (edge and depth materials, overlay layer) in the compileAsync pass, and initTexture every texture before compileAsync. On fine-pointer devices, import and evaluate the canvas chunk in idle time before intent. Then correct the numbers in docs/3d/WEB-QA.md §4.
- **Verification:** perf → confirmed (P2): CPU profile on a fre h brow er at 1×: PMREM fromEquirectangular → getProgramParameter i  a bu y  tretch of 390 m  (350 m   elf), and the fir t frame after compileA ync 242 m  (148 m  getProgramParameter). A warm program cache in the  ame brow er cut  thi  to 15 m  and 76 m . At 4×, cold: PMREM 558 m , fir t frame and c… [doc /qa/audit/verify/perf-lh/perf-3d-01-perf.txt, doc /qa/audit/verify/perf-lh/3d/profile- tart-de ktop-cpu1.txt] — perfskeptic → partially_confirmed (P2): Analy i  only: I ran no brow er. I re-read the finder'  and the perf verifier'  JSON and profile  with an offline  cript, then checked the code. CONFIRMED: on a fir t vi it (cold GPU program cache), Window  ANGLE D3D11 compile  the PMREM GGX  hader  ynchronou ly. loadCar.t :96-105 call  pmrem.fromEquirectangular(), whi… [doc /qa/audit/verify/perf-3d/perf-3d-01-perf keptic.txt, cript /qa/audit/perf-3d-01-perf keptic.mj]
- _Reviewer key: perf-3d-01_

#### PERF-15

**Every home visit leaks the old WebGL renderer, its canvas and the whole detached home DOM (+1107 DOM nodes per visit)**

- **Severity:** P2 · **Area:** 5. Performance — 3D hero runtime: memory / disposal · **Status:** OPEN
- **Route:** / ↔ /delovi (client-side navigation)
- **Context:** Desktop 1440×900, Chromium with ANGLE D3D11, CPU 1×, anonymous visitor. Heap measured after 3 forced GCs (HeapProfiler.collectGarbage). A control run without WebGL call wrapping (--bare) gives the same result.
- **Standard:** 3D-CONTRACT F8 (dispose on unmount); BRIEF §9 Reliability
- **Reproduction:**
  1. Open http://localhost:3200/ and hover the hero until the 3D is ready.
  2. Scroll through the whole explode, open a part (e.g. turbina) and close it with Esc.
  3. Click the header link „Delovi“ (/delovi, client-side), then use browser Back.
  4. Repeat 4 times. After each step, run DevTools → Memory → Collect garbage and read Performance monitor → DOM Nodes, or take a heap snapshot and filter by „Detached“.
  5. Scripted: `node scripts/qa/audit/perf-3d-leak.mjs --gpu --cycles 4 --bare`; retaining paths: `node scripts/qa/audit/perf-3d-retainers.mjs --gpu`.
- **Expected:** After leaving the home page and a GC, nothing from an earlier home visit is reachable: no renderer, no canvas, no detached DOM (contract F8: dispose on unmount). DOM nodes and heap stay flat across cycles.
- **Actual:** GPU resources are released: the context is lost, live contexts drop to 0 off the home page, and backing storage stays flat at 11.7 MB. But WebGL contexts reachable after GC grow 1→2→3→4→5 over 5 visits (WeakRef test). DOM nodes on /delovi grow 1365 → 2472 → 3579 (+1107 per home visit; bare run 1365 → 3055 → 4162 → 5269). Listeners grow by about 173 per visit and the JS heap by 0.7–1 MB per visit. Heap snapshot retaining paths: the latest renderer is held by React Three Fiber's module-level loop state (… .i .gl (WebGLRenderer) .domElement → canvas). Older renderers are held through a module-level three.js texture Source (RG half-float LUT, cache key "1001,1001,0,1006,1006,1,,1030,1016,false,false,false,1,"), used as a WeakMap key → .texture WebGLTexture → WebGL2RenderingContext → <canvas data-engine="three.js r186"> → the detached home tree.
- **Evidence:** [audit/perf-3d/leak-desktop-gpu-bare.json](audit/perf-3d/leak-desktop-gpu-bare.json) · [audit/perf-3d/leak-desktop-gpu.json](audit/perf-3d/leak-desktop-gpu.json) · [audit/perf-3d/retainers.txt](audit/perf-3d/retainers.txt) · [audit/perf-3d/retainers.json](audit/perf-3d/retainers.json)
- **Suggested fix:** components/three/canvas/HeroCanvas.tsx: capture gl in onCreated and call gl.dispose() on unmount, in addition to R3F's forceContextLoss. This releases WebGLTextures and the properties maps, so the module-level three texture's WeakMap entry stops pointing at the old WebGLTexture. Also dispose the PMREM render target explicitly, and clear scene.environment and heroStore.controller. Make sure R3F's module-level loop state does not keep the last root: upgrade R3F, or unmount through a path that clears it. Add a Playwright regression: 3 home ↔ /delovi cycles, forced GC, a WeakRef on the hero canvas must be empty and Performance.getMetrics Nodes must stay flat.
- **Verification:** perf → confirmed (P2): verify-perf-3d-leak.mj  --gpu --cycle  3 (GL in trumentation on). DOM node  on /delovi after a forced GC grow 1365 → 2472 → 3579 (+1107 per home vi it, the  ame a  the finder'  figure ). Reachable WebGL context  grow 1 → 2 → 3 → 4 while live context  go back to 0 off the home page. Li tener  grow by about 174 and the h… [doc /qa/audit/verify/perf-lh/perf-3d-02-perf.txt, doc /qa/audit/verify/perf-lh/3d/leak-de ktop-gpu.j on]
- _Reviewer key: perf-3d-02_

#### PERF-16

**High tier renders 4× MSAA at up to DPR 2: estimated GPU memory is 62 MB at DPR 1 and 114–194 MB on HiDPI screens, against a 60 MB budget**

- **Severity:** P2 · **Area:** 5. Performance — 3D hero runtime: GPU memory · **Status:** OPEN
- **Route:** /
- **Context:** Desktop 1440×900, high tier, DPR 1 and DPR 2 (HiDPI laptop), ANGLE D3D11, CPU 4×. GPU memory is estimated by instrumenting bufferData, texStorage2D, texImage2D and renderbufferStorage, plus the drawing buffer (RGBA8 + depth per sample × 4 samples + resolve).
- **Standard:** 3D-CONTRACT F5 (GPU memory ≤ 60 MB)
- **Reproduction:**
  1. Run `node scripts/qa/audit/perf-3d-frames.mjs --vp desktop --cpu 4 --gpu --runs 3 --dpr 2 --tag desktop-dpr2-cpu4-gpu` and read gl.perContext in the JSON.
  2. Or in DevTools: document.querySelector('[data-testid=hero-track] canvas') → width/height, and getContext('webgl2').getContextAttributes().antialias.
- **Expected:** 3D-CONTRACT F5: GPU memory ≤ 60 MB on desktop.
- **Actual:** Resources are 20.7 MB (buffers 5.9 MB in 643 buffers, textures 14.8 MB in 13 textures) and would pass alone. The MSAA drawing buffer adds 41.3 MB at 1440×836 DPR 1, for 62.1 MB total. On a DPR 2 screen, after the adaptive step to 1.5 (2160×1254), it adds 93 MB for 113.7 MB total. Before that step, at 2880×1672, it is about 173 MB, or about 194 MB total. The cause is `antialias: tier === "high"` combined with `dpr={[1, 2]}`. Same numbers in 3/3 runs.
- **Evidence:** [audit/perf-3d/frames-desktop-dpr2-cpu4-gpu.json](audit/perf-3d/frames-desktop-dpr2-cpu4-gpu.json) · [audit/perf-3d/frames-desktop-cpu4-gpu.json](audit/perf-3d/frames-desktop-cpu4-gpu.json) · [audit/perf-3d/3d.md](audit/perf-3d/3d.md)
- **Suggested fix:** components/three/canvas/HeroCanvas.tsx: use MSAA only when the effective DPR is below 1.5 (antialias: tier === 'high' && window.devicePixelRatio < 1.5), or cap the high tier at DPR 1.5 when MSAA is on. At DPR 2 without MSAA the drawing buffer is about 38 MB, so the total is about 59 MB, and integrated GPUs (the typical high-tier laptop) get the fill-rate back. Also state in the contract whether the drawing buffer counts toward the budget.
- **Verification:** perf → confirmed (P2): GPU e timate at DPR 1 (1440×836) i  62.1 MB in 3 of 3 frame  run  plu  the leak run. At DPR 2, after the adaptive  tep to 1.5 (canva  2160×1254), it i  113.7 MB. At 2880×1672 before that  tep, the drawing buffer alone work  out to about 173 MB (4× MSAA color + depth + re olve). Cau e confirmed in code: HeroCanva .t x  … [doc /qa/audit/verify/perf-lh/perf-3d-05-perf.txt, doc /qa/audit/verify/perf-lh/3d/frame -verify-de ktop-cpu4-gpu.j on]
- _Reviewer key: perf-3d-05_

#### SEO-01

**Product titles drop the manufacturer before the brand suffix, so same-OEM parts from different makers get identical titles**

- **Severity:** P2 · **Area:** 6. SEO — SEO metadata: product template · **Status:** OPEN
- **Route:** /deo/[slug]. Demo pairs: /deo/kocione-plocice-prednje-sa-senzorom-demo-0009 (ATE) vs -demo-e002 (Bosch); /deo/kocioni-disk-prednji-312-25-mm-ventilirani-demo-0002 (Brembo) vs -demo-e001 (ATE); /deo/set-zupcastog-kaisa-sa-vodenom-pumpom-1-9-tdi-demo-0057 (INA) vs -demo-e007 (Gates)
- **Context:** Any viewport, anonymous, server HTML
- **Standard:** SEO-ADS §J1 / D193; BRIEF §5 (unique titles)
- **Reproduction:**
  1. curl each URL of a pair and compare the <title> values.
  2. Compare their H1, manufacturer line and price: these are different products from different makers.
- **Corrected reproduction (verifier):**
  1. curl -s http://localhost:3100/deo/kocione-plocice-prednje-sa-senzorom-demo-0009 and -demo-e002, then compare <title>: identical („… 1K0 698 406 F | SKLOP“); the JSON-LD brand is ATE vs Bosch.
  2. Repeat for -demo-0002/-demo-e001 and -demo-0057/-demo-e007: identical titles without the suffix.
  3. Evaluate the candidates by hand: under D193's order the pads become unique (maker kept, suffix dropped), but the disc and belt pairs still end at [name code] because [name maker code] exceeds 60 characters. The fix must clamp the name and keep the maker (update D193 to match), plus add a uniqueness test over the products sitemap.
- **Expected:** D193: „drop the brand suffix first, then the maker, then shorten the name“. That yields e.g. „Kočione pločice prednje, sa senzorom ATE 1K0 698 406 F“ vs „… Bosch 1K0 698 406 F“, so the titles stay unique.
- **Actual:** Both products in each pair get the same <title> (3 duplicate pairs among 349 indexable URLs, e.g. twice „Kočioni di k prednji 312 × 25 mm, ventilirani 1K0 615 591 E“). productTitle() tries `name + code + suffix` before `name + maker + code`, so it drops the only differentiator (the maker) and keeps „ | SKLOP“. The suffix also appears on some product titles and not on others. A real VAG catalogue usually carries several makers per OEM number, so this will multiply.
- **Evidence:** [audit/seo/crawl.csv](audit/seo/crawl.csv) (duplicate titles on the pairs above) · [audit/seo/product-jsonld.json](audit/seo/product-jsonld.json) (brand/mpn differ per pair) · [audit/seo/raw/meta-templates.txt](audit/seo/raw/meta-templates.txt)
- **Suggested fix:** In lib/seo/templates.ts productTitle(), reorder the candidates to [name maker code suffix] → [name maker code] → [clamped name + maker + code] → [name code], matching D193. Add a uniqueness test over the products sitemap: no two active products may share a title.
- **Verification:** reproduce → partially_confirmed (P2): I crawled all 349  itemap URL  on :3100 with my own  cript. There are exactly 3 duplicate title , and all 3 are the product pair  named in the finding (0009/e002 ATE v  Bo ch, 0002/e001 Brembo v  ATE, 0057/e007 INA v  Gate ). In each pair the JSON-LD brand, mpn and price differ. It i  correct that productTitle() in lib… [doc /qa/audit/verify/ eo/ eo-02-04-reproduce-crawl- ummary.txt (duplicate title : 3, li ting the 3 pair ), doc /qa/audit/verify/ eo/ eo-02-04-reproduce-crawl.j onl]
- _Reviewer key: seo-02_

#### SEO-02

**Out-of-range pagination (?strana=2…500) serves indexable, self-canonical copies of page 1**

- **Severity:** P2 · **Area:** 6. SEO — Indexability: pagination · **Status:** OPEN
- **Route:** Every category listing /delovi/[kategorija]?strana=N, e.g. /delovi/kocioni-diskovi?strana=2, ?strana=99, ?strana=500; /delovi/filteri?strana=2
- **Context:** Any viewport, anonymous, server HTML. The demo categories have at most 16 products, so every page ≥ 2 is out of range.
- **Standard:** ROUTES §B1/§B4 (pagination canonical rules); BRIEF §9 SEO (no indexable thin or duplicate pages)
- **Reproduction:**
  1. curl -s "http://localhost:3100/delovi/kocioni-diskovi?strana=99" and read the status, robots meta, canonical and title.
  2. Compare the product cards and ItemList with /delovi/kocioni-diskovi.
  3. Try ?strana=500 (lib/catalog/filters.ts MAX_PAGE).
- **Expected:** A page beyond pageCount returns 404 (or a 308 to the last real page). Per ROUTES §B1 only existing ?strana=n pages are self-canonical and indexable.
- **Actual:** 200, „index, follow“, canonical „…/delovi/kocioni-diskovi?strana=99“, and the same 9 products as page 1: the listing clamps to the last page but the metadata does not. The title also loses its „— strana n“ (see seo-04), so page N is indistinguishable from page 1. That makes 499 indexable duplicate URLs per category, reachable by any stray or external link.
- **Evidence:** [audit/seo/evidence-commands.txt](audit/seo/evidence-commands.txt) (section seo-03) · [audit/seo/page-facts.jsonl](audit/seo/page-facts.jsonl) (/delovi/kocioni-diskovi?strana=99, /delovi/filteri?strana=2) · [audit/seo/raw/status-battery.txt](audit/seo/raw/status-battery.txt)
- **Suggested fix:** In app/(shop)/delovi/[kategorija]/page.tsx (generateMetadata and the page), load pageCount and call notFound() (or permanentRedirect to the last page) when filters.page > pageCount. Pass the clamped page to listingIndexing() in lib/catalog/filters.ts so the canonical never points at a non-existent page.
- **Verification:** reproduce → confirmed (P2): Reproduced exactly. /delovi/kocioni-di kovi? trana=2, 99 and 500 return 200 with „index, follow“, a  elf-referencing canonical (…? trana=N) and the  ame 9 product link  a  page 1 (identical link- et ha h). For ? trana=501 and 100000 the page i  clamped to MAX_PAGE, with canonical ? trana=500. /delovi/filteri? trana=2 (… [doc /qa/audit/verify/ eo/ eo-03-reproduce.txt ( tatu , title, robot , canonical and product- et ha h for 10 URL ), GET /delovi/kocioni-di kovi? trana=99 -> 200, index, follow, canonical http://localho t:3000/delovi/kocioni-di kovi? trana=99, 9 product , ha h c0d80966763c ( a…]
- _Reviewer key: seo-03_

#### SEO-03

**Category titles come from seeded SEO fields: truncated mid-list, the „— strana n“ is lost, and boilerplate descriptions replace the J1 template**

- **Severity:** P2 · **Area:** 6. SEO — SEO metadata: categories, system hubs, landings · **Status:** OPEN
- **Route:** 18 of 48 indexable categories, e.g. /delovi/vesanje-i-upravljanje („Vešanje i upravljanje za VW, Audi, Škoda, SEAT i… | SKLOP“), /delovi/turbina, /delovi/poluosovine, /delovi/senzori („Senzori (lambda, parking, temperatura) za VW, Audi, Škoda…“, suffix dropped). Paginated: /delovi/kocioni-diskovi?strana=2. Landings with long category names lose the vehicle: /delovi/senzori/skoda, /delovi/senzori/skoda/{octavia,kodiaq,karoq,superb,fabia,rapid} all read „Senzori (lambda, parking, temperatura) za Škoda… | SKLOP“ (these are noindex today because of the guard). Descriptions: all 58 category and system URLs.
- **Context:** Any viewport, anonymous, server HTML
- **Standard:** SEO-ADS §J1; BRIEF §5 (unique titles and descriptions)
- **Reproduction:**
  1. curl /delovi/vesanje-i-upravljanje and read <title>.
  2. curl "/delovi/kocioni-diskovi?strana=2": the title ends in „Cupra… | SKLOP“ with no page number.
  3. curl /delovi/senzori/skoda/octavia and /delovi/senzori/skoda/kodiaq and compare titles.
  4. Compare the meta descriptions of /delovi/kocnice and /delovi/transmisija, and of /delovi/anlaser and /delovi/farovi.
- **Expected:** SEO-ADS §J1: Category „{Kategorija} za VW, Audi, Škoda, SEAT“ (+ „ — strana n“) within 60 characters including the suffix. Description from real data: count, price from, in-stock count, manufacturers. System hub: its categories plus counts. Landing titles keep the vehicle.
- **Actual:** convex/seed.ts:173-174/201/227 and convex/seedData/categories.ts write seoTitle „… za VW, Audi, Škoda, SEAT i Cupra“ and a generic seoDescription. The page prefers these (`category.seoTitle ?? text.title`), appends „ — strana n“, and pageTitle() then clamps from the end. Result: 18 truncated titles ending „…“, the page number lost, and the model name lost on long landings (7 identical titles). All 58 category and system descriptions share one sentence („… pretraga po OEM broju i vozilu, cene sa PDV-om i stanje.“) with no counts or prices.
- **Evidence:** [audit/seo/raw/meta-templates.txt](audit/seo/raw/meta-templates.txt) · [audit/seo/crawl.csv](audit/seo/crawl.csv) · [audit/seo/evidence-commands.txt](audit/seo/evidence-commands.txt) (seo-03 section shows the lost „strana“)
- **Suggested fix:** Shorten the seeded seoTitle to the J1 form, or stop seeding seoTitle/seoDescription so categoryMeta()/systemMeta() build them from counts (convex/seedData/categories.ts, convex/seed.ts). In lib/seo/metadata.ts pageTitle() and landingMeta(), clamp only the category name and always keep the vehicle and „— strana n“. Add a test that every title in the sitemaps is ≤ 60 characters, unique, and has no „…“.
- **Verification:** reproduce → confirmed (P2): Confirmed with a full  itemap crawl. 18 of the 58 URL  in kategorije.xml have title  ending in „…“. That i  17 categorie  plu  1  y tem hub (/delovi/ve anje-i-upravljanje), not „18 of 48 categorie “. /delovi/ enzori al o drop  the „ | SKLOP“  uffix. Cau e: the  eeded  eoTitle („{label} za VW, Audi, Škoda, SEAT i Cupra“… [doc /qa/audit/verify/ eo/ eo-02-04-reproduce-crawl- ummary.txt (title  with ellip i : 18, li ted), doc /qa/audit/verify/ eo/ eo-04-reproduce.txt (title , robot  and de cription  for 18 URL  incl. ? trana=2 and 7 Škoda  en or landing )]
- **Also reported as:** copy-11 (Paginated category titles lose „— strana N“ and end with an ellipsis (page 2 = page 1 title) @ /delovi/[kategorija]?strana=2 (e.g. /delovi/kocioni-diskovi?strana=2); every category with ≥ 2 pages)
- _Reviewer key: seo-04_

#### SEO-04

**38 indexable hub pages are thin (29 under 60 words): system hubs have no intro, and single-generation model hubs duplicate their generation page**

- **Severity:** P2 · **Area:** 6. SEO — Content / thin pages · **Status:** OPEN
- **Route:** System hubs: /delovi/tockovi (6 words), /delovi/servis (11), /delovi/izduvni-sistem (13), /delovi/transmisija (16), /delovi/kocnice (17), /delovi/elektrika-i-svetla, /delovi/hladjenje-i-klima, /delovi/karoserija, /delovi/vesanje-i-upravljanje, /delovi/motor-i-usis. Vehicle hubs: /vozila, /vozila/cupra (13), /vozila/seat, /vozila/audi, /vozila/skoda, /vozila/volkswagen. 21 model hubs (27–83 words), including 7 with one generation: /vozila/skoda/rapid, /vozila/cupra/formentor, /vozila/cupra/leon, /vozila/skoda/karoq, /vozila/seat/ateca, /vozila/cupra/ateca, /vozila/skoda/kodiaq
- **Context:** 390 and 1440, Chromium, anonymous. Word counts from <main> server HTML without breadcrumbs.
- **Standard:** BRIEF §9 SEO („no indexable thin pages“); BRIEF §5 catalog „SEO intro“; ROUTES §B1
- **Reproduction:**
  1. Open /delovi/kocnice: H1 plus four category tiles, no intro, no products, no ItemList.
  2. Open /vozila/skoda/rapid: one tile linking to /vozila/skoda/rapid/rapid, no counts.
  3. Run node scripts/qa/audit/seo-thin.mjs for the full list.
- **Expected:** ROUTES §B1 and BRIEF §5: system hub and category pages carry an SEO intro. BRIEF §9: no indexable thin pages. Hubs should add value (counts per generation, top categories and landings, intro), or be noindexed or merged.
- **Actual:** 38 of 349 indexable URLs are under 150 words and 29 are under 60, all listed in the sitemaps. The seeded category intro (buildIntro) is not shown on system hubs. Single-generation model hubs are near-empty doorways to one page. Model hubs show no product counts.
- **Evidence:** [audit/seo/thin-pages.json](audit/seo/thin-pages.json) · [audit/seo/system-hub-kocnice-390.webp](audit/seo/system-hub-kocnice-390.webp) · [audit/seo/system-hub-kocnice-1440.webp](audit/seo/system-hub-kocnice-1440.webp) · [audit/seo/model-hub-skoda-rapid-390.webp](audit/seo/model-hub-skoda-rapid-390.webp) · [audit/seo/model-hub-skoda-rapid-1440.webp](audit/seo/model-hub-skoda-rapid-1440.webp)
- **Suggested fix:** components/catalog/SystemHub.tsx: render the system intro plus counts, top products (with ItemList) and top landings. app/(shop)/vozila/[marka]/[model]/page.tsx: show product counts per generation plus top categories and landings; for single-generation models, 308 to the generation page or mark noindex and canonicalise to it (and drop it from vozila.xml). Brand hubs: add counts and top landings.
- **Verification:** reproduce → confirmed (P2): I crawled all 5  itemap  my elf: 349 URL , and every one i  200, index,follow and  elf-canonical. I counted word  in <main> from the  erver HTML, breadcrumb excluded. The reviewer'  total  match exactly: 38 page  under 150 word  and 29 under 60. Breakdown: 10  y tem hub  (6–72 word ; /delovi/tockovi 6, /delovi/kocnice … [doc /qa/audit/verify/ eo/ eo-06-reproduce.j on (under150Count 38, under60Count 29, byKind,  ingleGenerationModelHub ), doc /qa/audit/verify/ eo/ eo-06-reproduce- y tem-hub-kocnice-390.webp]
- _Reviewer key: seo-06_

#### SEO-05

**/kontakt is an orphan: it is in the sitemap but no page links to it (the footer „KONTAKT“ column has no link to it)**

- **Severity:** P2 · **Area:** 6. SEO — Internal linking / local SEO · **Status:** OPEN
- **Route:** /kontakt; header, footer and mobile nav on every storefront page
- **Context:** 390 and 1440, Chromium, anonymous; raw HTML crawl of 962 pages
- **Standard:** SEO-ADS §J5; seo-technical crawl depth / orphan pages; BRIEF §5 static pages
- **Reproduction:**
  1. Open any page and look at the header, the footer „KONTAKT“ column (hours plus „Pošaljite upit“) and the mobile menu „Kontakt“ block.
  2. Search the crawl for inbound links to /kontakt: the only one is its own breadcrumb.
  3. Confirm /kontakt is listed in /sitemaps/staticne.xml.
- **Expected:** SEO-ADS §J5: the footer links to static and legal pages. The contact / NAP page is a key local-SEO and trust page and should be one click from every page.
- **Actual:** 0 internal links from other pages across 962 crawled URLs (inlinkCount 1 = self). It is unreachable from home by links and found only through the sitemap. In code, only UnsubscribeForm links to ROUTES.contact; Footer.tsx and MobileNav.tsx do not.
- **Evidence:** [audit/seo/footer-1440.webp](audit/seo/footer-1440.webp) · [audit/seo/footer-390.webp](audit/seo/footer-390.webp) · [audit/seo/crawl.json](audit/seo/crawl.json) (inlinkCount["/kontakt"] = 1)
- **Suggested fix:** components/shell/Footer.tsx: add { href: ROUTES.contact, label: "Kontakt" } to the Kupovina column (or make the „KONTAKT“ heading a link). Add the same link in the MobileNav.tsx „Kontakt“ block.
- **Verification:** reproduce → confirmed (P2): I par ed the  erver HTML of 359 page : all 349  itemap URL , plu  home, cart, checkout, auth page ,  earch, the ad  landing, the root 404 and an out-of- tock product. Page  linking to /kontakt: 0. That i   tricter than the reviewer'  'inlinkCount 1 =  elf': the /kontakt breadcrumb'  la t item i  a  pan,  o even the pag… [doc /qa/audit/verify/ eo/ eo-07-reproduce.j on (page Crawled 359, page LinkingToKontakt [], compari on 357–358 for other  tatic page ), doc /qa/audit/verify/ eo/ eo-07-reproduce-footer-1440.webp]
- _Reviewer key: seo-07_

#### SEO-06

**Renaming a product slug creates no working redirect: the old URL returns 404, although the admin promises a redirect**

- **Severity:** P2 · **Area:** 6. SEO — URL changes / redirects · **Status:** OPEN
- **Route:** /deo/[old-slug] after a slug change in /admin/proizvodi/[id]
- **Context:** Owner/staff edits a product; any visitor or crawler then requests the old URL. Not reproduced at runtime, to avoid editing catalogue data; evidence is code plus a read-only data check.
- **Standard:** ROUTES §B1; seo-technical URL structure (permanent redirects for moved URLs)
- **Reproduction:**
  1. Admin → Proizvodi → open any product → field „Adresa na sajtu (slug)“ (help text: „Promena pravi preusmerenje sa stare adrese.“) → change it → Sačuvaj.
  2. Request /deo/<old-slug>.
- **Expected:** ROUTES §B1: „renamed slug → 308“ to /deo/<new-slug>, keeping rankings, backlinks and ad and catalog links.
- **Actual:** convex/lib/productWriter.ts:863 inserts a `redirects` row, but nothing reads the table: no query on index by_fromPath outside convex/catalog.test.ts, nothing in proxy.ts or next.config.ts. app/(shop)/deo/[slug]/page.tsx only checks getRetiredProduct() (inactive products) and otherwise calls notFound(), so the old URL is a 404. `convex data redirects` shows „There are no documents in this table.“
- **Evidence:** [audit/seo/evidence-commands.txt](audit/seo/evidence-commands.txt) (section seo-08)
- **Suggested fix:** Add a public query redirects.byFromPath and, in app/(shop)/deo/[slug]/page.tsx before notFound(), call permanentRedirect(toPath) (308) and increment hits. Alternatively resolve it in proxy.ts. Cover it with an e2e test that renames a test product's slug.
- **Verification:** reproduce → confirmed (P2): I reproduced thi  at runtime, not ju t in code. Signed in a  owner, I created an inactive te t product through /admin/proizvodi/novi (SKU E2E-VSEO08-muo8o7 c,  ame convention a  the e2e admin  pec). The  lug field  how  the help text 'Promena pravi preu merenje  a  tare adre e.' I changed the  lug to <old>-novi and  av… [doc /qa/audit/verify/ eo/ eo-08-reproduce.j on (oldUrl 404 location null; newUrl 200; helpText), doc /qa/audit/verify/ eo/ eo-08-reproduce-redirect -table.txt (row with hit  0)]
- _Reviewer key: seo-08_

#### SEO-07

**404s for unknown product, category and vehicle send an empty body (content only after JS) and the home page title**

- **Severity:** P2 (reported P3, adjusted by verification) · **Area:** 6. SEO — Server rendering of error pages · **Status:** OPEN
- **Route:** /deo/ne-postoji-demo-9999, /delovi/nepostojeca-kategorija, /delovi/kocioni-diskovi/nepostojeca-marka, /delovi/kocioni-diskovi/volkswagen/nepostojeci-model, /vozila/nepostojeca, /vozila/volkswagen/nepostojeci, /vozila/volkswagen/golf/golf-99, /deo/KOCIONI-DISK-PREDNJI-276-24-MM-DEMO-0004
- **Context:** 390, Chromium with JavaScript on and off; curl
- **Standard:** seo-technical JS rendering (critical content in the initial HTML); ROUTES §B1 404 rules; D119
- **Reproduction:**
  1. curl -s http://localhost:3100/deo/ne-postoji-demo-9999: status 404, but <body> holds only a hidden div and scripts.
  2. Open it with JavaScript disabled: the page is blank.
  3. With JavaScript on, the page shows „Stranica nije pronađena“, but the tab title is „SKLOP — Rasklopi auto. Nađi deo.“.
  4. Compare /ovo-ne-postoji, which is server-rendered with the title „Stranica nije pronađena · SKLOP“.
- **Corrected reproduction (verifier):**
  1. curl -s http://localhost:3100/deo/ne-postoji-demo-9999: status 404, <meta name=robots content=noindex>, <title> is the home title; with scripts and styles stripped, the body is only <div hidden><!--$--><!--/$--></div>. There is no header, main or footer.
  2. Repeat for /delovi/nepostojeca-kategorija, /delovi/kocnice/volkswagen, /delovi/kocioni-diskovi/nepostojeca-marka, /vozila/nepostojeca, /vozila/volkswagen/golf/golf-99, /ponuda/ne-postoji, /porudzbina/<invalid token>, /porudzbina/hvala/<invalid token>, /upit/<invalid token>: same empty body.
  3. Open any of them at 390 with JavaScript disabled (Chromium, Firefox or WebKit): blank page.
  4. With JavaScript on: 'Stranica nije pronađena' renders. Catalog 404s and /ponuda/ne-postoji have the tab title 'SKLOP — Rasklopi auto. Nađi deo.'; token 404s show 'Status porudžbine | SKLOP' or 'Upit i ponuda | SKLOP'.
  5. Compare /ovo-ne-postoji or /o-nama/xyz: full shell in the server HTML, title 'Stranica nije pronađena · SKLOP'.
- **Expected:** The not-found UI (header, H1, search, links) in the initial HTML, like the root 404, with a „Stranica nije pronađena“ title.
- **Actual:** Status and noindex are correct, but the shop-segment not-found content exists only in the RSC payload. If JavaScript fails or is off, a visitor from an old link sees a blank page, and the title is the home title.
- **Evidence:** [audit/seo/404-nojs-deo-ne-postoji-demo-9999-390.webp](audit/seo/404-nojs-deo-ne-postoji-demo-9999-390.webp) · [audit/seo/404-js-deo-ne-postoji-demo-9999-390.webp](audit/seo/404-js-deo-ne-postoji-demo-9999-390.webp) · [audit/seo/404-nojs-ovo-ne-postoji-390.webp](audit/seo/404-nojs-ovo-ne-postoji-390.webp) · [audit/seo/404-check.json](audit/seo/404-check.json)
- **Suggested fix:** Find out why app/(shop)/not-found.tsx is not in the streamed HTML when notFound() is called from app/(shop)/deo/[slug]/page.tsx, delovi/[kategorija]/page.tsx and vozila/…/page.tsx. For example, call notFound() in generateMetadata as well (it currently returns {}), so the error is known before the shell streams. Return title „Stranica nije pronađena“ for missing entities. Verify with curl.
- **Verification:** reproduce → confirmed (P2): Reproduced, and the  cope i  wider than reported. The  erver HTML of every  hop- egment notFound() body i  exactly '<body><div hidden=""><!--$--><!--/$--></div></body>' plu   cript . The whole  hell i  mi ing ( kip link, header, main, footer), not ju t the not-found content; the 'Stranica nije pronađena' text exi t  on… [doc /qa/audit/verify/ eo/ eo-09-reproduce-deo.html (body = hidden div only), doc /qa/audit/verify/ eo/ eo-09-reproduce-root.html (root 404 fully rendered)]
- _Reviewer key: seo-09_

#### SEO-08

**Programmatic copy defects in product meta descriptions and landing intros („Original VAG, Original VAG“, dangling „i …“, „… i X i još 1“)**

- **Severity:** P2 (reported P3, adjusted by verification) · **Area:** 6. SEO — Copy templates (SERP snippets, landing intros) · **Status:** OPEN
- **Route:** 21 product descriptions with „(Original VAG, Original VAG)“, e.g. /deo/kocioni-disk-prednji-340-30-mm-gti-demo-0005. 43 with a truncated vehicle list („za VW Golf IV, VW Golf … Cena“, „VW Passat B8 i … Cena“ on /deo/kocioni-disk-prednji-276-24-mm-demo-0004, „i još… Cena“). 27 of 50 indexable landings, e.g. /delovi/kocioni-diskovi/volkswagen/golf
- **Context:** Server HTML meta description and landing intro
- **Standard:** BRIEF §2 copy quality; SEO-ADS §J1/§J4 (unique, non-mad-libs copy)
- **Reproduction:**
  1. Read the meta description of /deo/kocioni-disk-prednji-276-24-mm-demo-0004 and /deo/kocioni-disk-prednji-340-30-mm-gti-demo-0005.
  2. Read the intro of /delovi/kocioni-diskovi/volkswagen/golf.
- **Corrected reproduction (verifier):**
  1. curl -s http://localhost:3100/deo/kocioni-disk-prednji-340-30-mm-gti-demo-0005 | grep -o '<meta name="description"[^>]*>' -> „(Original VAG, Original VAG) za VW Golf VII, VW Golf V… Cena…“; the page's fitment list shows only Golf VII and Golf VIII, not Golf V.
  2. curl -s http://localhost:3100/deo/kocioni-disk-prednji-276-24-mm-demo-0004 | grep -o '<meta name="description"[^>]*>' -> „za VW Golf VII, VW Passat B8 i … Cena“.
  3. Open /delovi/kocioni-diskovi/volkswagen/golf at 390 px and read the intro: „… i Original VAG (1) i još 1.“, generations ordered VII, V, VI, IV, and Golf VIII missing although the „po generaciji“ block lists it.
  4. node scripts/qa/audit/verify-seo-13-copy.mjs gives 21 duplicate-quality and 32 truncated product descriptions of 157, and 27 of 50 landings with the double „i“.
  5. Fix: restore the escapes in lib/seo/templates.ts:54 and :88 (/\s+/g, /[\s,;]+\S*$/) and cut the fitment list at whole entries with „i još N“. In lib/seo/landingCopy.ts, name the last item when more === 1, otherwise join with commas and end with „i još N“; add „i još N“ to the generation list and sort it by yearFrom. Skip the quality label when it equals the manufacturer.
- **Expected:** Correct Serbian lists: „ATE (2), Brembo (1), Febi Bilstein (1), Original VAG (1) i TRW (1).“; vehicle lists cut at a whole item with „i još N“; quality omitted when it equals the manufacturer; generations in chronological order.
- **Actual:** „Proizvođači: ATE (2), Brembo (1), Febi Bilstein (1) i Original VAG (1) i još 1.“ (double „i“, and „još 1“ where the name fits); „za VW Golf VII, VW Passat B8 i … Cena“; „(Original VAG, Original VAG)“; „Pokrivene generacije: Golf VII …, Golf V …, Golf VI … i Golf IV“.
- **Evidence:** [audit/seo/crawl.csv](audit/seo/crawl.csv) (description column) · [audit/seo/crawl.json](audit/seo/crawl.json)
- **Suggested fix:** lib/seo/landingCopy.ts:68: when more > 0, join the shown items with commas and end with „i još N“ (list the item when more === 1). Sort generations by year. lib/seo/templates.ts productMeta: skip the quality label when it equals the manufacturer, and shorten the vehicle list to whole entries plus „i još N“.
- **Verification:** reproduce → confirmed (P2): All three pattern  reproduce, with one count correction (32 truncated product de cription , not 43).

1. Product meta de cription :
- -0004: „…(Febi Bil tein, Aftermarket) za VW Golf VII, VW Pa at B8 i … Cena 4.690 RSD…“ — a dangling „i …“.
- -0005: „…GTI (Original VAG, Original VAG) za VW Golf VII, VW Golf V… Cena 18.… [doc /qa/audit/verify/ eo/ eo-13-reproduce-copy.j on, doc /qa/audit/verify/ eo/ eo-13-reproduce-landing-intro-390.webp]
- **Also reported as:** copy-10 (Landing intros join manufacturers with two „i“: „Bosch (1) i Febi Bilstein (1) i još 2.“ @ 27 landings, e.g. /delovi/kocioni-diskovi/volkswagen, /delovi/kocioni-diskovi/volkswagen/golf, /delovi/kocioni-diskovi/skoda, /delovi/kocioni-diskovi/audi/a3); copy-14 („Original VAG · Original VAG“ — manufacturer and quality repeat on cards, 3D panel and meta descriptions @ /delovi/kocioni-diskovi, /pretraga?q=disk, /ponuda/kocione-plocice-golf, /vozila/volkswagen/golf/golf-7, home 3D part panel, /deo/* descriptions („(Original VAG, Original VAG)“))
- _Reviewer key: seo-13_

#### COPY-03

**Copy promises phone, Viber, e-mail, seller address and a withdrawal form that are not shown anywhere when company settings are empty**

- **Severity:** P2 · **Area:** 7. Copy — Content / empty-safe company data · **Status:** OPEN
- **Route:** /kontakt, / (contact strip), /reklamacije-i-povrat, /politika-privatnosti, /porudzbina/[token], e-mail „Porudžbina je isporučena“
- **Context:** 1440 and 390, anonymous; current settings (company phone/Viber/e-mail/address empty — owner item, but the copy handles the absence badly)
- **Standard:** BRIEF §5 (company data from settings; legal templates without visible gaps), DESIGN-SYSTEM §11.1 (never invent facts; errors/next step must work), HUMAN-TODO §3 (channels without data are not shown)
- **Reproduction:**
  1. Open /kontakt: the only content is hours + „Pošaljite upit“ and the sentence „Najbrže je da nas pozovete ili pišete na Viber.“ — no number anywhere
  2. Scroll home to „Pitanje za majstora?“: „Pozovite, pišite na Viber ili pošaljite upit…“ — no phone/Viber shown
  3. Open /reklamacije-i-povrat: „izjavu o odustanku e-poštom (adresa sa stranice Kontakt) ili pismom na adresu prodavca“ — Kontakt has no e-mail, no address exists on the site
  4. Open /politika-privatnosti: „Rukovalac — Prodavac naveden na stranici Kontakt“ and „Zahtev pošaljite na e-poštu sa stranice Kontakt“ — Kontakt names no seller
  5. Open /porudzbina/GVl2SHwvba1nbEDG8VWTGcg0IPXAbHGNXGpzjHnowJw: „Pitanje o porudžbini? Navedite njen broj.“ with no channel to state it to
  6. Admin → E-pošta → Šabloni → Isporučena: „Uslovi i obrazac su na stranici Reklamacije i povrat“ — the page has no obrazac
- **Expected:** Sentences that name a channel or document render only when that setting/document exists; otherwise a fallback that works („Pošaljite upit — odgovaramo u toku radnog dana“). Fallback texts never point to a page that shows nothing.
- **Actual:** Placeholders drop the data line but keep the sentences that rely on it; the {{firma.naziv|Prodavac naveden na stranici Kontakt}} fallback is circular because /kontakt hides the same data.
- **Evidence:** [audit/copy/ev-kontakt-1440.webp](audit/copy/ev-kontakt-1440.webp) · [audit/copy/ev-home-contact-strip-1440.webp](audit/copy/ev-home-contact-strip-1440.webp) · [audit/copy/ev-02-contact-promises.txt](audit/copy/ev-02-contact-promises.txt) · [audit/copy/emails-text.txt](audit/copy/emails-text.txt)
- **Suggested fix:** convex/seedData/content.ts:60 (kontakt), :97, :165 and the privacy „Vaša prava“ paragraph: move channel-specific sentences into conditional placeholders (e.g. {{kontakt.najbrze}} rendered from settings, empty → omitted) and change fallbacks to „putem upita na sajtu“; components/home/HomeSections.tsx:279 and app/(shop)/porudzbina/[token]/page.tsx:32 build the sentence from the channels present (ContactActions); lib/email/templates/order.ts:269 say „Obrazac za odustanak…“ only when the form exists (HUMAN-TODO §3). Consider a go-live check that blocks publishing legal pages while firma.* is empty.
- **Verification:** reproduce → confirmed (P2): I checked every route at 1440 and 390 a  an anonymou  vi itor in Chromium, u ing the current  etting  (company phone, Viber, e-mail and addre  all empty). None of /kontakt, /, /reklamacije-i-povrat or /politika-privatno ti ha  a tel:, mailto:, viber: or wa.me link, and none  how  a phone number or e-mail addre . The on… [doc /qa/audit/verify/copy/copy-02-reproduce.txt, doc /qa/audit/verify/copy/copy-02-reproduce- ource.txt]
- _Reviewer key: copy-02_

#### COPY-04

**Invented dispatch promise „porudžbine potvrđene do 14 časova šaljemo istog dana“ is hard-coded in seeded content**

- **Severity:** P2 · **Area:** 7. Copy — Content / invented company facts · **Status:** OPEN
- **Route:** /dostava-i-placanje, / (FAQ „Koliko košta dostava i kada stiže?“)
- **Context:** All viewports, anonymous
- **Standard:** CLAUDE.md Copy („no invented company facts — read settings“), DESIGN-SYSTEM §11.1, HUMAN-TODO §8
- **Reproduction:**
  1. Open /dostava-i-placanje → „Načini dostave“
  2. Read „Porudžbine potvrđene radnim danom do 14 časova šaljemo istog dana…“
  3. Open / → Česta pitanja → „Koliko košta dostava i kada stiže?“ — same 14 h promise
  4. Compare HUMAN-TODO §8: the „Šaljemo danas ako poručite do …“ cut-off is shown only if the owner sets it in settings
- **Expected:** The cut-off hour comes from settings ({{dostava.rokSlanja}}) and the sentence disappears while it is empty.
- **Actual:** A same-day shipping cut-off at 14:00 is stated as fact in two places, although the owner has not confirmed it and the settings-driven mechanism exists.
- **Evidence:** [audit/copy/ev-dostava-14h-1440.webp](audit/copy/ev-dostava-14h-1440.webp) · [audit/copy/ev-home-faq-dostava-14h-1440.webp](audit/copy/ev-home-faq-dostava-14h-1440.webp) · [audit/copy/ev-03-14h.txt](audit/copy/ev-03-14h.txt)
- **Suggested fix:** convex/seedData/content.ts:74 and :258 — replace „do 14 časova“ with a settings placeholder that removes the whole sentence when empty; re-seed/update the live contentPages and FAQ rows.
- **Verification:** reproduce → confirmed (P2): Reproduced at 1440 and 390:
- /do tava-i-placanje ha  one paragraph: „Porudžbine potvrđene radnim danom do 14 ča ova šaljemo i tog dana…“.
- The home FAQ „Koliko košta do tava i kada  tiže?“ (expanded)  ay  „…šaljemo i tog radnog dana za porudžbine potvrđene do 14 ča ova“.
- Both are literal text in convex/ eedData/con… [doc /qa/audit/verify/copy/copy-04-reproduce.txt, doc /qa/audit/verify/copy/copy-04-reproduce- ource.txt]
- _Reviewer key: copy-04_

#### COPY-05

**Brand names are not declined after „za“: „Delovi za Škoda“, „Kočioni diskovi za Cupra“ in titles, H1, OG images and link lists**

- **Severity:** P2 · **Area:** 7. Copy — Grammar / programmatic SEO copy · **Status:** OPEN
- **Route:** /vozila/skoda, /vozila/cupra, /vozila/skoda/*, /vozila/cupra/*, /delovi/*/skoda, /delovi/*/cupra/*, related-link lists on /delovi/[kategorija], /deo/[slug], /vozila/* — 65 pages
- **Context:** All viewports; <title>, H1, intro, FAQ, aria-labels, OG image of landings
- **Standard:** BRIEF §2 (correct Serbian), BRIEF §5 SEO (unique, quality titles/H1), DESIGN-SYSTEM §11.1
- **Reproduction:**
  1. Open /vozila/skoda — H1 „DELOVI ZA ŠKODA“, title „Delovi za Škoda — svi modeli“
  2. Open /delovi/kocioni-diskovi/skoda — H1 „KOČIONI DISKOVI ZA ŠKODA“ (also on its OG image)
  3. Open /delovi/kocioni-diskovi — link list „Kočioni diskovi za Škoda“
  4. Open /vozila/cupra — „DELOVI ZA CUPRA“
- **Expected:** Accusative after „za“: „Delovi za Škodu“, „za Cupru“ (or neutral „za vozila Škoda/Cupra“); with a model either „za Škodu Octaviju“ or „za vozila Škoda Octavia“.
- **Actual:** Nominative feminine brand after the preposition on 65 indexable pages, OG images and aria-labels — reads as machine-generated to a Serbian buyer.
- **Evidence:** [audit/copy/ev-vozila-skoda-h1-1440.webp](audit/copy/ev-vozila-skoda-h1-1440.webp) · [audit/copy/ev-landing-skoda-h1-1440.webp](audit/copy/ev-landing-skoda-h1-1440.webp) · [audit/copy/og-landing-skoda.webp](audit/copy/og-landing-skoda.webp) · [audit/copy/ev-05-brand-declension.txt](audit/copy/ev-05-brand-declension.txt)
- **Suggested fix:** Add an accusative form to brands (vehicleBrands.nameAcc: Škodu, Cupru; Volkswagen/Audi/SEAT unchanged) and use it in app/(shop)/vozila/[marka]/page.tsx:23-48, lib/seo/templates.ts:180-183, lib/seo/landingCopy.ts and lib/seo/landingLinks.ts, lib/og/frame.tsx callers; or switch the templates to „za vozila {Marka}“.
- **Verification:** reproduce → confirmed (P2): Reproduced, and the  cope i  wider than reported.

Checked directly at 1440 and 390:
- /vozila/ koda: title „Delovi za Škoda —  vi modeli | SKLOP“, H1 „DELOVI ZA ŠKODA“.
- /delovi/kocioni-di kovi/ koda: H1 „KOČIONI DISKOVI ZA ŠKODA“; the OG image render  the  ame phra e.
- /vozila/cupra: H1 „DELOVI ZA CUPRA“.
- The lan… [doc /qa/audit/verify/copy/copy-05-reproduce.txt, doc /qa/audit/verify/copy/copy-05-reproduce-count.txt]
- _Reviewer key: copy-05_

#### COPY-06

**English framework leftovers: default Next 403 page „This page could not be accessed.“ and plain-text „Not found“**

- **Severity:** P2 · **Area:** 7. Copy — Error pages · **Status:** OPEN
- **Route:** /admin, /admin/* (signed-in customer or mechanic; staff on owner-only /admin/korisnici), /slike/deo/<missing>, /sitemaps/<missing>.xml
- **Context:** 1440 and 390, Chromium, signed in as the audit customer
- **Standard:** BRIEF §2 (Serbian only), track standard (no English leftovers on error pages), DECISIONS D19
- **Reproduction:**
  1. Sign in as the retail customer (.playwright/audit-accounts.json)
  2. Open /admin or /admin/porudzbine
  3. See white unbranded page „403 | This page could not be accessed.“ (title „403: This page could not be accessed.“)
  4. curl http://localhost:3100/slike/deo/nepostoji-1-abc.jpg → text/plain „Not found“
- **Corrected reproduction (verifier):**
  1. Sign in at /prijava with the customer or mechanic account from .playwright/audit-accounts.json
  2. Open /admin, /admin/porudzbine, /admin/korisnici or /admin/porudzbine/SK-2026-000092/predracun (all behave the same; Chromium and Firefox; 1440 and 390)
  3. Observe HTTP 403, a white unbranded page „403 | This page could not be accessed.“, title „403: This page could not be accessed.“ and no navigation
  4. curl -i http://localhost:3100/sitemaps/nepostoji.xml (or /slike/deo/nepostoji-1-abc.jpg) returns 404 text/plain „Not found“ (low impact, machine-facing)
- **Expected:** A Serbian, branded 403 in the shop shell: „Nemate pristup ovoj strani. Prijavljeni ste kao …“ with links „Početna“ / „Odjavi se“; route handlers answer 404 with a Serbian body or empty body.
- **Actual:** No app/forbidden.tsx exists although D19 relies on forbidden(); Next's English default is shown. app/slike/deo/[file]/route.ts:12-20 and app/sitemaps/[file]/route.ts:20-22 return „Not found“.
- **Evidence:** [audit/copy/forbidden-_admin-390.webp](audit/copy/forbidden-_admin-390.webp) · [audit/copy/forbidden-_admin-1440.webp](audit/copy/forbidden-_admin-1440.webp) · [audit/copy/forbidden.json](audit/copy/forbidden.json)
- **Suggested fix:** Add app/forbidden.tsx (and app/admin/forbidden.tsx for the admin shell) with Serbian copy + metadata title „Nemate pristup“; also add unauthorized.tsx; change route-handler bodies to „Nije pronađeno“ or empty.
- **Verification:** reproduce → confirmed (P2): I  igned in a  the audit cu tomer and the approved mechanic u ing a fre h context each time, then opened /admin, /admin/porudzbine, /admin/kori nici and /admin/porudzbine/SK-2026-000092/predracun. Te ted Chromium at 1440 and 390 (cu tomer), Chromium 1440 (mechanic) and Firefox 1440 (cu tomer). All 16 load  return HTTP … [doc /qa/audit/verify/copy/copy-07-reproduce-chromium-cu tomer-1440_admin.webp, doc /qa/audit/verify/copy/copy-07-reproduce-chromium-cu tomer-390_admin.webp]
- _Reviewer key: copy-07_

#### COPY-07

**„Garancija 24 meseci“ — wrong plural on every product page**

- **Severity:** P2 · **Area:** 7. Copy — Grammar / product template · **Status:** OPEN
- **Route:** /deo/[slug] — 156 of 157 product pages (e.g. /deo/kocioni-disk-prednji-276-24-mm-demo-0004)
- **Context:** All viewports, Specifikacije block
- **Standard:** BRIEF §2 (correct Serbian), track standard (copy errors)
- **Reproduction:**
  1. Open /deo/kocioni-disk-prednji-276-24-mm-demo-0004
  2. Scroll to „Specifikacije“
  3. Read „Garancija 24 meseci“
- **Expected:** „24 meseca“ (2–4 → meseca; 5–20 → meseci; 21, 31 → mesec), via the existing countSr helper.
- **Actual:** „24 meseci“ — hard-coded plural.
- **Evidence:** [audit/copy/ev-warranty-24-meseci-1440.webp](audit/copy/ev-warranty-24-meseci-1440.webp) · [audit/copy/ev-08-warranty.txt](audit/copy/ev-08-warranty.txt)
- **Suggested fix:** app/(shop)/deo/[slug]/page.tsx:407 → `countSr(data.warrantyMonths, ["mesec", "meseca", "meseci"])`.
- **Verification:** reproduce → confirmed (P2): I crawled every product URL in / itemap /proizvodi-1.xml (157) and pulled the SSR value of the Garancija <dd>. All 157  how „24 me eci“; the out-of- tock /deo/kocione-plocice-prednje-demo-0012 doe  too. So the  cope i  every product page, not „156 of 157“. The DOM at 1440 and 390 read  „Garancija | 24 me eci“, which i … [doc /qa/audit/verify/copy/copy-08-reproduce-1440.webp, doc /qa/audit/verify/copy/copy-08-reproduce-390.webp]
- _Reviewer key: copy-08_

#### COPY-08

**„Svih 44 kategorija“ on the home category grid — wrong number agreement**

- **Severity:** P2 · **Area:** 7. Copy — Grammar / home · **Status:** OPEN
- **Route:** / (section „Najtraženije kategorije“)
- **Context:** All viewports, anonymous
- **Standard:** BRIEF §2 (correct Serbian), track standard (copy errors)
- **Reproduction:**
  1. Open / and scroll to „Najtraženije kategorije“
  2. Read the link „Svih 44 kategorija · 157 artikala“
- **Expected:** „Sve 44 kategorije · 157 artikala“ (paucal after 2–4; plural agreement via countSr).
- **Actual:** „Svih 44 kategorija“ — hard-coded genitive plural.
- **Evidence:** [audit/copy/ev-home-svih-44-kategorija-1440.webp](audit/copy/ev-home-svih-44-kategorija-1440.webp) · [audit/copy/text-home-1440.txt](audit/copy/text-home-1440.txt)
- **Suggested fix:** components/home/HomeSections.tsx:101 — use countSr with forms ["Sva {n} kategorija"/"Sve {n} kategorije"/"Svih {n} kategorija"] or neutral „Sve kategorije (44) · 157 artikala“.
- **Verification:** reproduce → confirmed (P2): I opened / anonymou ly at 1440 and 390 and  crolled to #cat -title. The  ection link (href /delovi) read  „Svih 44 kategorija · 157 artikala“ at both width , and the SSR payload ha  the  ame text. The  ource i  component /home/HomeSection .t x:101: „Svih {tree.categorie .length} kategorija“ i  hard-coded. On the  ame l… [doc /qa/audit/verify/copy/copy-09-reproduce-1440.webp, doc /qa/audit/verify/copy/copy-09-reproduce-390.webp]
- _Reviewer key: copy-09_

#### BE-03

**Consent proof is client-supplied: terms/privacy versions and acceptedAt are stored verbatim**

- **Severity:** P2 · **Area:** 9. Backend & reliability — Privacy / records (legal evidence) · **Status:** OPEN
- **Route:** /korpa checkout (orders:submit via validateCheckout), /upit (inquiries:submit), /upit/[token] quote accept (inquiries:acceptQuote), /za-majstore (mechanics:register)
- **Context:** Dev deployment, anonymous inquiry. Read back with the owner-only privacy export.
- **Standard:** SECURITY §L5 (consent records as proof), BRIEF §5 Records („evidencija svega“), ZZPL (controller must demonstrate consent)
- **Reproduction:**
  1. Run `node scripts/qa/audit/backend-consent-forgery.mjs`.
  2. It submits an anonymous inquiry with consent {termsVersion:"QA-FORGED", privacyVersion:"QA-FORGED", acceptedAt: 2000-01-01}. UP-2026-000060 is created.
  3. The owner exports the subject with privacy:customerData (by the unique test e-mail). The stored consent is exactly the forged object.
  4. The script then closes the inquiry („QA audit test“).
- **Corrected reproduction (verifier):**
  1. Run `node scripts/qa/audit/verify-backend-03-04.mjs` (needs SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in the environment).
  2. Inquiry: consent {termsVersion:"", privacyVersion:"", acceptedAt: 2099-01-01} is accepted, and privacy:customerData shows exactly that object.
  3. Order (guest cart, pickup + pickup_cash): consent {termsVersion:"VERIFY-FORGED", acceptedAt:0} is accepted and stored verbatim.
  4. The script then closes the inquiry and cancels the order.
- **Expected:** The server records the versions in force (settings.legalVersions) and its own timestamp, and rejects a stale or unknown version. Only the visitor's choices (marketing/analytics/ads) come from the client.
- **Actual:** storedConsent = {termsVersion:"QA-FORGED", privacyVersion:"QA-FORGED", acceptedAt: 946684800000}. validateCheckout only checks the strings are non-empty (convex/lib/orders.ts:164-175). inquiries.submit (convex/inquiries.ts:206), acceptQuote (:384) and mechanics.register (convex/mechanics.ts:102) store args.consent as-is.
- **Evidence:** [audit/backend/consent-forgery.json](audit/backend/consent-forgery.json) · scripts/qa/audit/backend-consent-forgery.mjs
- **Suggested fix:** Build the consent object on the server in all four entry points: {termsVersion: settings.legalVersions.terms, privacyVersion: settings.legalVersions.privacy, acceptedAt: Date.now(), marketingEmail/analytics/ads from args}. Return CONFLICT („Uslovi su izmenjeni — osvežite stranicu.“) when the client's versions differ from the current ones. Add a convex-test.
- **Verification:** reproduce → confirmed (P2): I wrote my own  cript ( cript /qa/audit/verify-backend-03-04.mj ) and ran it again t the dev deployment. The legal ver ion  in force are 2026-09-29 for term  and privacy.
(A) Anonymou  inquirie : ubmit with term Ver ion "", privacyVer ion "" and acceptedAt 2099-01-01 wa  accepted a  UP-2026-000063. The owner privacy ex… [doc /qa/audit/verify/backend/backend-03-reproduce.j on, cript /qa/audit/verify-backend-03-04.mj]
- _Reviewer key: backend-03_

#### BE-04

**Attribution and company-address strings are stored unbounded and returned in full by admin lists**

- **Severity:** P2 · **Area:** 9. Backend & reliability — Data integrity / abuse (payload caps) · **Status:** OPEN
- **Route:** orders:submit (/korpa), inquiries:submit (/upit), mechanics:register (/za-majstore); read back in /admin/upiti and /admin/porudzbine
- **Context:** Dev deployment, anonymous inquiry (same run as backend-03), owner reads.
- **Standard:** SECURITY §L2 payload caps, BRIEF §9 Security, Convex guidelines (bounded documents)
- **Reproduction:**
  1. Run `node scripts/qa/audit/backend-consent-forgery.mjs`. It sends attribution.last.campaign of 200 000 characters.
  2. The owner's privacy export is 201 KB and shows storedCampaignLength 200000.
  3. inquiriesAdmin:list (which the Admin → Upiti table loads with initialNumItems 50) returns campaign length 200000 for that row.
- **Corrected reproduction (verifier):**
  1. Run `node scripts/qa/audit/verify-backend-03-04.mjs`.
  2. Inquiry: campaign 200,000 characters and gclid 3,010 characters are stored in full. The inquiriesAdmin:list row is 200,466 bytes, and the default "Svi" tab page is 424,882 bytes even after the inquiry is closed.
  3. Order: company.address.street is 20,000 characters and postalCode "ABC" is accepted. Run `node scripts/qa/audit/verify-backend-04-shot.mjs SK-2026-000102` to see the "Sedište" cell 19,110 px tall in the admin order detail at 1440 px.
- **Expected:** Attribution fields are trimmed and clamped on the server (e.g. ≤ 200 chars; click ids ≤ 512 from a safe charset). Company address fields are trimmed and sliced like the delivery address, and the postal code is validated. SECURITY §L2 promises payload caps.
- **Actual:** touchV/attributionV are plain v.string() (convex/lib/validators.ts:6-30), stored verbatim at convex/orders.ts:156, convex/inquiries.ts:205 and convex/mechanics.ts:101. company.address is stored unchecked (convex/lib/orders.ts:113). At about 1 MB per document, a few scripted inquiries (unlimited, see backend-02) put 50 list rows at tens of MB, beyond Convex per-function read/return limits, so Admin → Upiti would stop loading. (Not exercised at that size to avoid breaking the shared admin.)
- **Evidence:** [audit/backend/consent-forgery.json](audit/backend/consent-forgery.json) · scripts/qa/audit/backend-consent-forgery.mjs · components/admin/inquiries/InquiriesList.tsx:65-76 (initialNumItems 50)
- **Suggested fix:** Add a `sanitizeAttribution()` helper in convex/lib that slices every touch field and drops non [A-Za-z0-9._-] characters from click ids, and apply it at the three entry points. Trim, slice and validate company.address in validateCheckout. Return campaign sliced (≤ 60) in list rows.
- **Verification:** reproduce → confirmed (P2): Same  cript a  backend-03.
Inquiry path:
- attribution.la t.campaign of 200,000 character  wa   tored in full, and  o wa  a gclid of 3,010 character  made of <>"'=;| (no char et filter).
- inquirie Admin:li t return  the full campaign: one row i  200,466 byte .
- The fir t page of the default Admin > Upiti tab ("Svi", … [doc /qa/audit/verify/backend/backend-04-reproduce.j on, doc /qa/audit/verify/backend/backend-04-reproduce- hot.j on]
- _Reviewer key: backend-04_

#### BE-05

**Quality gate: full `npx vitest run --maxWorkers=2` fails with two Convex test timeouts under load**

- **Severity:** P2 · **Area:** 9. Backend & reliability — Quality gates (tests) · **Status:** OPEN
- **Route:** n/a (vitest convex project)
- **Context:** Shared audit machine (other reviewers and Lighthouse running). Vitest 5, 61 files, 1096 tests.
- **Standard:** BRIEF §9 Reliability („unit + Convex + e2e tests green“), CLAUDE.md Definition of Done
- **Reproduction:**
  1. Run `npx vitest run --maxWorkers=2` on the shared machine.
  2. Result: 1090 passed, 2 failed, 4 skipped. convex/orders.test.ts:80 „approved mechanic orders at his price with a tier snapshot“ took 6387 ms and convex/notify.test.ts:328 „test mode rewrites recipients…“ took 7223 ms, both failing with „Test timed out in 5000ms“.
  3. Re-run only those two files twice with `npx vitest run --maxWorkers=2 convex/orders.test.ts convex/notify.test.ts`: 41/41 pass each time (6.5 s and 7.0 s total).
- **Corrected reproduction (verifier):**
  1. Run `npx vitest run --maxWorkers=2` on the loaded shared machine. Result: 2 failed. notify.test.ts:328 times out at 5000 ms (took 28,214 ms), and notify.test.ts:485 fails its assertion (reminded 0 instead of 1). orders.test.ts:80 passed in 1,172 ms.
  2. Run `npx vitest run --maxWorkers=2 convex/orders.test.ts convex/notify.test.ts` twice. Both times 40/41: the crons test at notify.test.ts:485 fails even with no load.
  3. Run `npx vitest run --config scripts/qa/audit/verify-backend-06.vitest.config.mts --silent=false verify-backend-05-clock`. A world built at 16:00 gives reminded 1; built at 16:45 or on 07.10. it gives reminded 0. This shows the crons test depends on the real clock from 30.09.2026 16:30 CEST onward.
- **Expected:** The unit + Convex suite is green whatever the machine load (DoD and BRIEF §9).
- **Actual:** Red gate caused by the default 5 s testTimeout. convex-test world setup takes more than 5 s under load.
- **Evidence:** [audit/backend/gate-vitest.txt](audit/backend/gate-vitest.txt) · [audit/backend/gate-vitest-rerun.txt](audit/backend/gate-vitest-rerun.txt)
- **Suggested fix:** In vitest.config.ts set `testTimeout: 20_000` (and hookTimeout) for the `convex` project, or share one seeded world per file (beforeAll) so setupWorld is not rebuilt per test.
- **Verification:** reproduce → partially_confirmed (P2): I ran `npx vite t run --maxWorker =2` once at 16:36 on the  hared machine: 1090 pa ed, 2 failed, 4  kipped, 249.6  .
- The load timeout reproduce  for notify.te t.t :328 ("Te t timed out in 5000m "; the te t took 28,214 m ).
- order .te t.t :80 did NOT time out in my run (1,172 m ).
- The  econd failure wa  different a… [doc /qa/audit/verify/backend/backend-05-reproduce-run1.txt, doc /qa/audit/verify/backend/backend-05-reproduce-i olated.txt]
- _Reviewer key: backend-05_

#### BE-06

**Order line edits never adjust stock that was already committed, so stock drifts in the „pri kreiranju“ decrement mode**

- **Severity:** P2 · **Area:** 9. Backend & reliability — Data integrity (stock) · **Status:** OPEN
- **Route:** /admin/porudzbine/[broj] „Izmeni stavke“ (ordersAdmin:editItems) with Admin → Podešavanja → umanjenje zalihe = created
- **Context:** Code review. Not exercised live because switching the global stock mode would affect other reviewers' orders.
- **Standard:** BRIEF §5 Admin (stock movements log, every change with reason), BRIEF §6 (stock decrement configurable, returns on cancel)
- **Reproduction:**
  1. Set commerce.stockDecrementOn = "created" (offered in SettingsAdmin.tsx:707).
  2. A customer orders 3 × product A (stock 10 → 7; orderItem committedQty 3; stockCommitted true).
  3. Staff edit the still-new order and remove line A. The orderItem is deleted, stock stays 7 and no movement is written.
  4. Cancel the order with restockOnCancel: restock only iterates the remaining items, so the 3 units are never returned. Adding a line B × 2 never decrements B. Changing A 3 → 1 leaves 2 units stuck.
  5. Also: after switching the mode from confirmed → created, orders already in „nova“ are never committed, because commitsStockOn returns false for potvrdjena in created mode (lib/domain/orderStateMachine.ts:91-96).
- **Corrected reproduction (verifier):**
  1. Run `npx vitest run --config scripts/qa/audit/verify-backend-06.vitest.config.mts --silent=false verify-backend-06.test` (in-memory convex-test, no shared data touched).
  2. Check the VERIFY06 lines. remove-then-cancel: afterRemove 7, afterCancel 7 (expected 10). lower-then-complete: 7 (expected 9). add-then-complete: battery 20 (expected 18). mode-switch: stockCommitted false, stock 10 (expected 7). control-confirmed: 9 (correct).
- **Expected:** Edits apply stock deltas with the existing movement reason „order_edited“ whenever order.stockCommitted is true, and cancel returns exactly what was taken.
- **Actual:** editItems (convex/ordersAdmin.ts:581-747) contains no applyStockDelta/commitStock/restock call. The „order_edited“ reason is declared (convex/lib/validators.ts:226, lib/i18n/sr/admin.ts:106) but never written anywhere.
- **Evidence:** [audit/backend/code-greps.txt](audit/backend/code-greps.txt) (section backend-06) · [audit/backend/integrity.json](audit/backend/integrity.json) (current dev data reconciles, 143 movements / 114 products, because the dev deployment uses the default „confirmed“ mode)
- **Suggested fix:** In editItems, when order.stockCommitted: removal → applyStockDelta(+committedQty, reason order_edited); qty change → delta of the committed part; addition → commit −qty and set committedQty. In commitsStockOn, commit on potvrdjena in both modes when the order is not yet committed. Add convex-tests for created mode + edit + cancel.
- **Verification:** reproduce → confirmed (P2): I reproduced thi  in memory with convex-te t again t the real  chema and function  ( cript /qa/audit/verify-backend-06.te t.t ). The  hared deployment'   tock mode wa  never touched. Stock mode "created", re tockOnCancel on.
(1) Order di c × 3 + battery × 1:  tock 10 → 7. Staff remove the di c line:  tock  tay  7 (expe… [cript /qa/audit/verify-backend-06.te t.t, cript /qa/audit/verify-backend-06.vite t.config.mt]
- _Reviewer key: backend-06_

#### BE-07

**The global sign-up limit can be drained by anyone and closes registration for all customers and mechanics**

- **Severity:** P2 · **Area:** 9. Backend & reliability — Security / availability (auth) · **Status:** OPEN
- **Route:** /registracija and /za-majstore (Convex Auth `auth:signIn` flow signUp → afterUserCreatedOrUpdated)
- **Context:** Code review plus the deployed function spec. Not executed: draining the bucket would lock out other reviewers.
- **Standard:** BRIEF §5 Mechanics (registration flow), BRIEF §9 Security; D207 documented, but the trade-off breaks the BRIEF as shown
- **Reproduction:**
  1. `auth:signIn` is a public action on the deployment (deployed-function-spec-summary.txt), callable directly on https://<deployment>.convex.cloud without going through the Next /api/auth proxy.
  2. A script calls it 30 times with flow "signUp", random e-mails and a valid password. Each new account consumes the single "global" key of signUpGlobal (token bucket capacity 30, 60/h; convex/auth.ts:90, convex/lib/rateLimits.ts:25).
  3. Every genuine visitor registering on /registracija, including mechanics who must create an account before the /za-majstore registration, then gets RATE_LIMITED. About one sign-up a minute from the script keeps registration closed indefinitely.
- **Corrected reproduction (verifier):**
  1. Run node scripts/qa/audit/verify-backend-07-signup.mjs. It calls auth:signIn directly on the Convex URL with flow signUp and a weak password, gets WEAK_PASSWORD (the sign-up flow is reachable without the proxy), and reads the single signUpGlobal/'global' bucket (capacity 30, 60/h).
  2. Code path: every new user runs afterUserCreatedOrUpdated, which calls enforceRateLimit(signUpGlobal, 'global') (convex/auth.ts:90). A script making 30 sign-ups, then 1 per minute, keeps the bucket at 0, whether it calls Convex directly or goes through /api/auth (the proxy has no per-client limit).
  3. Run node scripts/qa/audit/verify-backend-07-ui.mjs. It fulfils the sign-up POST /api/auth with the exact 400 body the proxy produces for RATE_LIMITED. /registracija then shows 'Nalog nije napravljen. Ako već imate nalog sa ovom adresom, prijavite se ili promenite lozinku.' instead of a 'try again later' message. /za-majstore/registracija shows 'Nalog sa ovom e-mail adresom verovatno već postoji'.
  4. Suggested fix: enable e-mail verification (R01/D212). Key the sign-up limit on the request IP from ctx.meta.getRequestMetadata() for direct calls, and on a proxy-signed client key for /api/auth, and keep the global number as an owner alert. Map proxy error strings containing RATE_LIMITED to the Serbian 'Previše pokušaja…' message in AuthForms and MechanicRegistrationForm (parse the code out of error.message, since the Next client drops .data).
- **Expected:** Abuse by one client cannot block registration for everyone. D207 accepts a global limit because the IP is hidden behind the Next proxy, but the action is also directly reachable, and the result breaks the BRIEF §5 mechanics onboarding flow.
- **Actual:** The only sign-up control is one shared global bucket.
- **Evidence:** [audit/backend/code-greps.txt](audit/backend/code-greps.txt) (section backend-07) · [audit/backend/deployed-function-spec-summary.txt](audit/backend/deployed-function-spec-summary.txt)
- **Suggested fix:** Enable e-mail verification (R01/D212) so junk sign-ups do not become active accounts. Key sign-up limits on the caller IP where Convex request metadata is available, or on a signed client-IP header forwarded by the /api/auth proxy with direct calls refused. Keep the global number as an owner alert rather than a hard stop.
- **Verification:** reproduce → confirmed (P2): I did not drain the  hared bucket. I reproduced each part without  pending a  ign-up token. (1) I called the public auth: ignIn action directly on <deployment>.eu-we t-1.convex.cloud through ConvexHttpClient,  kipping the Next proxy, with flow  ignUp and a 5-character pa word. The backend ran the  ign-up flow and an we… [doc /qa/audit/verify/backend/backend-07-reproduce.j on (direct convex.cloud auth: ignIn  ignUp -> WEAK_PASSWORD;  ignUpGlobal/global bucket capacity 30, rate 60…, doc /qa/audit/verify/backend/backend-07-proxy-error.txt (proxy return  HTTP 400 {"error":"[Reque t ID…] Server Error Uncaught ConvexError: {…}"},  o the ConvexE…]
- _Reviewer key: backend-07_

### P3 — polish (33)

#### PERF-17

**The home HTML carries a 137–167 KB inline RSC payload (about 55–65 % of the document), and the first document task is 343–682 ms at 4× before first paint**

- **Severity:** P3 · **Area:** 5. Performance — Performance / document weight · **Status:** OPEN
- **Route:** /vozila/volkswagen/golf/golf-7 (325 KB raw HTML, 809 DOM elements) · /delovi (262 KB) · /delovi/kocioni-diskovi/volkswagen/golf (248 KB) · /delovi/kocioni-diskovi (237 KB) · /deo/… (220 KB)
- **Context:** Lighthouse script-treemap-data (inline __next_f scripts), network-requests Document resourceSize, dom-size-insight; mobile applied throttling
- **Standard:** BRIEF §9 (TBT/LCP); SEO-ADS §J11
- **Reproduction:**
  1. Run tests/lighthouse/run.mjs --throttling devtools on the routes.
  2. Read script-treemap-data: the document node's '(inline) self.__next_f.p…' children.
  3. Read network-requests Document resourceSize and long-tasks for the document URL.
- **Expected:** Server HTML carries the markup plus a small flight payload. The first parse/style/layout stays well under one frame budget at 4×.
- **Actual:** - Inline RSC payload: 89–167 KB raw per page, on HTML of 137–325 KB raw (23–33 KB gzip).
- DOM: 346–809 elements.
- First document task at about 1.75 s: 343–682 ms. A second one after FCP: 116–282 ms (counts toward TBT).
- Each ProductCard passes the whole card object to AddToCartButton, and the product ids again to LiveOverlayProvider, so card data is serialised more than once.
- **Evidence:** [audit/perf-lh/lighthouse.md](audit/perf-lh/lighthouse.md) ('Bytes' table: HTML KB, inline RSC KB, DOM elements) · [audit/perf-lh/lighthouse-summary.json](audit/perf-lh/lighthouse-summary.json) (representative.rscInlineKB, docRawKB, longTasks)
- **Suggested fix:** 1. Pass minimal props to client islands (id, price and stock only; AddToCartButton should receive what it needs to add, not the full ProductCardData) in components/catalog/ProductCard.tsx.
2. Collapse the per-card islands (perf-lh-01).
3. On the vehicle page, cap or paginate the category tiles and render the engine list compactly.
4. Re-measure the document tasks.
- **Verification:** perf → confirmed (P3): Document raw  ize and inline __next_f payload:
- home 246.5 KB / 36.3 KB gzip, 136.5 KB RSC (55 %);
- Golf 7: 325.2 KB, 167 KB RSC;
- landing: 248.2 KB, 138.5 KB;
- category: 237.4 KB, 127.2 KB;
- product: 220.5 KB, 134.7 KB (61 %).
The fir t document ta k at about 1.73–1.81   take  207–400 m  at 4×, a little below the… [doc /qa/audit/verify/perf-lh/perf-lh-11-perf.txt, doc /qa/audit/verify/perf-lh/lh- ummary.txt]
- _Reviewer key: perf-lh-11_

#### PERF-18

**Home Lighthouse accessibility is 97 in 5 of 5 mobile runs (target-size on the systems-index links, SF-16 still open)**

- **Severity:** P3 · **Area:** 5. Performance — Accessibility score (Lighthouse) · **Status:** OPEN
- **Route:** /
- **Context:** Lighthouse mobile, applied throttling, 5 runs, first visit
- **Standard:** WCAG 2.2 SC 2.5.8 Target Size (Minimum) — Lighthouse heuristic; step 22 a11y ≥ 95 (met)
- **Reproduction:**
  1. Run: MSYS_NO_PATHCONV=1 node tests/lighthouse/run.mjs --base http://localhost:3200 --runs 5 --throttling devtools /
  2. Read categories.accessibility and the failed audit ids.
- **Corrected reproduction (verifier):**
  1. AUDIT_BASE=http://localhost:3200 node scripts/qa/audit/verify-perf-lh-08-12.mjs
  2. Before scrolling, the categories section (cv-auto) is 1035 px tall but its last card ends at 5763 px, past the systems index starting at 5148 px. After scrolling it into view, the section is 1718 px and nothing overlaps.
  3. Lighthouse's target-size relatedNodes list section.cv-auto > ul.mt-10 > li > a.group (akumulator, farovi, hladnjak-ventilator) as the obscuring elements.
- **Expected:** Accessibility 100 (≥ 95 is met); SF-16 was scheduled to be investigated in step 21.
- **Actual:** Accessibility is 97 in every run; the failing audit is `target-size`. Every other template scores 100.
- **Evidence:** [audit/perf-lh/lighthouse-summary.json](audit/perf-lh/lighthouse-summary.json) (group '/ | mobile | devtools' failedA11y: ['target-size']) · [audit/perf-lh/lighthouse.md](audit/perf-lh/lighthouse.md)
- **Suggested fix:** Check which systems-index links Lighthouse reports as partially obscured at 412 px, typically links adjacent under a sticky or fixed layer such as the consent banner or header. Give them ≥ 24 px of spacing, or make the cv-auto systems index exempt as D121 did. Then close SF-16 in docs/qa/STOREFRONT.md.
- **Verification:** perf → partially_confirmed (P3): Home acce ibility i  97 (target- ize) in 3 of 3 devtool  run , but 100 in 3 of 3  imulate run . The finder'  cau e (a fixed or  ticky layer) i  wrong. The ob curing node  are the card  of the preceding cv-auto categorie   ection (HomeSection .t x:95). While that  ection i   kipped, it  box i  1035 px (intrin ic 900 px)… [doc /qa/audit/verify/perf-lh/perf-lh-12-perf.txt, doc /qa/audit/verify/perf-lh/perf-lh-08-12.j on]
- _Reviewer key: perf-lh-12_

#### PERF-19

**public/ assets (hero posters, car.glb 3.5 MB, car-lite.glb 2.6 MB, HDR, manifest, shadows, icons) are served with Cache-Control: public, max-age=0**

- **Severity:** P3 (reported P2, adjusted by verification) · **Area:** 5. Performance — Caching · **Status:** OPEN
- **Route:** / (posters, 3D assets); /images/**, /models/**, /icon.svg, /favicon.ico, /manifest.webmanifest
- **Context:** next start :3100 (production headers from next.config.ts), repeat visits
- **Standard:** BRIEF §9 Performance (LCP on repeat visits); Lighthouse uses-long-cache-ttl
- **Reproduction:**
  1. curl -s -o /dev/null -D - http://localhost:3100/models/car.glb → Cache-Control: public, max-age=0
  2. Same for /models/car-lite.glb, /models/env/studio-512.hdr, /models/car.manifest.json, /models/car-shadow.webp, /images/hero/car-assembled-1440.avif (desktop LCP poster)
  3. Compare /_next/static/** → public, max-age=31536000, immutable
- **Expected:** Static media get a long browser cache (fingerprinted names + immutable, or at least days with stale-while-revalidate) so repeat visitors neither re-download nor revalidate the LCP poster and the multi-MB GLB before the 3D starts.
- **Actual:** Every repeat visit revalidates each asset (one conditional request per poster/GLB/HDR/manifest/shadow); the desktop LCP poster waits on a revalidation round trip. Lighthouse 'uses-long-cache-ttl' flags these files.
- **Evidence:** [audit/perf-bundle/headers-static.txt](audit/perf-bundle/headers-static.txt) · [audit/perf-bundle/bundle.md](audit/perf-bundle/bundle.md)
- **Suggested fix:** In next.config.ts headers() add `{ source: "/models/:path*" }` and `{ source: "/images/:path*" }` with `Cache-Control: public, max-age=31536000, immutable`, after making the files content-addressed (the 3D pipeline already writes sha256 into car.manifest.json — emit car.<sha8>.glb / poster names with a hash and reference them from the manifest and HeroStage). If hashing is not done now, use `public, max-age=604800, stale-while-revalidate=2592000`. The same applies on Vercel, where public/ files default to max-age=0.
- **Verification:** reproduce → confirmed (P3): The header  are a  reported. /model /car.glb (3.64 MB), /model /car-lite.glb (2.63 MB), /model /env/ tudio-512.hdr, /model /car- hadow*.webp, /image /hero/*.avif and public/icon /*.png are  erved with 'Cache-Control: public, max-age=0'. /_next/ tatic/** i   erved with 'public, max-age=31536000, immutable'. next.config.… [doc /qa/audit/verify/perf-bundle/perf-bundle-07-reproduce.txt (curl -D: car.glb/car-lite.glb/ tudio-512.hdr/car.manife t.j on/car- hadow.webp/car-a embled-1440.…, doc /qa/audit/verify/perf-bundle/perf-bundle-07-reproduce-brow er.txt (node  cript /qa/audit/verify-perf-bundle-cache.mj : 'vi it 2 /image /hero/car-a embled-14…]
- _Reviewer key: perf-bundle-07_

#### PERF-20

**14 modules are shipped twice in every page's first load through the root error-boundary chunk (25.7–27.2 KB raw)**

- **Severity:** P3 · **Area:** 5. Performance — JS bundle / chunking · **Status:** OPEN
- **Route:** All 12 perf templates
- **Context:** Production build :3100, first load
- **Standard:** BRIEF §9 Performance (bundle hygiene)
- **Known item:** Shell first-load JS ~303 KB gzip (co-owned with perf-lh) — distinct root cause
- **Reproduction:**
  1. node scripts/qa/audit/perf-bundle-dupes.mjs (dupes.txt)
  2. Home: constants/routes (#44004, 3.9 KB), next/link internals (#22016 3.3, #18967 2.3), Button (#76525 2.6), ArrowCounterClockwiseIcon (2.1), config/site (#79175 x3), formatPhone (x3–4), ErrorState… appear both in 120epkn8j_rkq.js/3k__gv_edg8eb.js/2f8qbt33jjpy3.js and in 1adhcvv0smcza.js
  3. entries.txt: 1adhcvv0smcza.js (8.6 KB gz) is the [project]/app/error entry; app/error.tsx imports the full ErrorState (Button, RouteLink, config/site, routes, Phosphor icons)
- **Expected:** Each module is downloaded once per page.
- **Actual:** 25.7 KB raw (27.2 KB on product/category/search/generation/upit/porudzbina) of duplicate module code per page, ≈ 8–12 KB gzip.
- **Evidence:** [audit/perf-bundle/dupes.txt](audit/perf-bundle/dupes.txt) · [audit/perf-bundle/entries.txt](audit/perf-bundle/entries.txt)
- **Suggested fix:** Make app/error.tsx (routes outside the shop group) a minimal client component with plain markup and no UI-kit/config imports, and keep ErrorState only in app/(shop)/error.tsx; re-run perf-bundle-dupes.mjs. Re-test after the next Turbopack upgrade (cross-entry dedupe).
- **Verification:** reproduce → confirmed (P3): Independent check: I  plit every chunk fetched at 390 into it  Turbopack module factorie  in a vm, without running them. Home, category, product and /korpa each download the  ame 14 module  twice (/korpa and home have one more unrelated pair), and all 14 involve 1adhcvv0 mcza.j , the app/error entry (8.6 KB gz), which … [doc /qa/audit/verify/perf-bundle/perf-bundle-09-reproduce.txt (node  cript /qa/audit/verify-perf-bundle-dupe .mj : 'home / @390: 25 chunk  fetched, 315 module ,…, doc /qa/audit/verify/perf-bundle/perf-bundle-06-reproduce.txt ('chunk  only in [project]/app/error: 1adhcvv0 mcza.j (8.6); fetched 1' on landing, home, category…]
- _Reviewer key: perf-bundle-09_

#### PERF-21

**Product-card sizes claims 50vw on phones while the list image renders 104 px: DPR 3 phones fetch w=640 instead of w=384**

- **Severity:** P3 · **Area:** 5. Performance — Images · **Status:** OPEN
- **Route:** /delovi/kocioni-diskovi, /pretraga?q=disk, /ponuda/kocione-plocice-golf, /deo/* (related), /vozila/* listings
- **Context:** Chromium 390×844 at DPR 3 (and DPR 1: w=256 for a 104 px image)
- **Standard:** BRIEF §9 Performance; Lighthouse 'Properly size images'
- **Reproduction:**
  1. node scripts/qa/audit/perf-bundle-dpr.mjs (dpr3-sizes.txt)
  2. Every product-card image renders 104 css px (needs 312 px) but currentSrc is …&w=640&q=75
  3. components/catalog/ProductCard.tsx line 84: variant "responsive" uses the grid sizes '(min-width: 1920px) 360px, (min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw', yet below sm the responsive card uses the list thumbnail (line 65)
- **Corrected reproduction (verifier):**
  1. node scripts/qa/audit/verify-perf-bundle-12.mjs (Chromium, widths 360/390/412 at DPR 1/2/2.625/3, plus 540@2 and 1440@1)
  2. On /delovi/kocioni-diskovi, /pretraga?q=disk, /ponuda/kocione-plocice-golf, /deo/kocioni-disk-prednji-276-24-mm-demo-0004 (related) and /vozila/volkswagen/golf/golf-7, below 480 px every product-card img renders 104 css px but currentSrc is w=640 (DPR ≥ 2) or w=256 (DPR 1)
  3. Fix: in ProductCard.tsx:84, for the responsive variant use sizes '(min-width: 1920px) 360px, (min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 480px) 50vw, 104px' (sm = 480 px in this project, not 640)
- **Expected:** On phones the list thumbnail requests the w=384 candidate.
- **Actual:** ≈ 2.7× the needed pixels per card on DPR 3 phones; with real per-product photos every card pays it (demo data shares one category illustration, so only one fetch is visible today).
- **Evidence:** [audit/perf-bundle/dpr3-sizes.txt](audit/perf-bundle/dpr3-sizes.txt) · [audit/perf-bundle/category-390-dpr3-cards.webp](audit/perf-bundle/category-390-dpr3-cards.webp)
- **Suggested fix:** In components/catalog/ProductCard.tsx give the responsive variant `(min-width: 1920px) 360px, (min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 104px` (list thumbnail below sm).
- **Verification:** reproduce → confirmed (P3): Reproduced, and the  cope i  wider than reported, but the  ugge ted fix u e  the wrong breakpoint. Every ProductGrid route u e  variant="re pon ive": category,  earch, ad  landing, product related and /vozila/volk wagen/golf/golf-7. On all five, below 480 px the card u e  the 104 px li t thumbnail, but it   ize   tring… [doc /qa/audit/verify/perf-bundle/perf-bundle-12-reproduce.txt, doc /qa/audit/verify/perf-bundle/perf-bundle-12-reproduce.j on]
- _Reviewer key: perf-bundle-12_

#### PERF-22

**Desktop explode scroll at 4× CPU misses the documented WEB-QA smoothness bar: 290 draws per frame, and the X-ray two-pass recomputes program keys every frame**

- **Severity:** P3 (reported P2, adjusted by verification) · **Area:** 5. Performance — 3D hero runtime: scroll frame cost · **Status:** OPEN
- **Route:** /
- **Context:** Desktop 1440×900, DPR 1, high tier, ANGLE D3D11 (RTX 4060), CPU 4×, 60 wheel steps through the whole hero track. Mobile 390 @ 3×, mid tier, CPU 4× and 6×.
- **Standard:** 3D-CONTRACT F5 (runtime 60 fps desktop while scrubbing; draw-call and lite triangle budgets); docs/3d/WEB-QA.md §1 scroll smoothness bar
- **Reproduction:**
  1. Run `node scripts/qa/hero-frames.mjs --base http://localhost:3200 --cpu 4 --gpu` 3 times. This is the WEB-QA script, uninstrumented.
  2. Run `node scripts/qa/audit/perf-3d-frames.mjs --vp desktop --cpu 4 --gpu --runs 3` to get draws and triangles per frame, and `--vp mobile --cpu 6` for the low-end phone profile.
  3. Run `node scripts/qa/audit/perf-3d-profile.mjs --vp desktop --cpu 4 --gpu --phase scroll` for the CPU attribution.
- **Corrected reproduction (verifier):**
  1. node scripts/qa/hero-frames.mjs --base http://localhost:3200 --cpu 4 --gpu, 2 or more times on a quiet machine: p95 is about 33.3 ms and 1.5–4.3 % of frames are over 33 ms (the bar is met).
  2. Record draws and triangles per frame with verify-perf-3d-frames.mjs: 290 and 416 k on desktop, 172 and 257 k on mobile.
- **Expected:** docs/3d/WEB-QA.md §1: at 4× CPU, median 16.7 ms, p95 ≤ 33 ms and ≤ 6 % of frames over 33 ms (recorded as Pass). 3D-CONTRACT F5: 60 fps on desktop while scrubbing; draw calls ≤ 220 (desktop) and ≤ 150 (lite); lite ≤ 250 k triangles.
- **Actual:** Uninstrumented desktop runs: p95 50.0 / 33.4 / 50.0 ms, frames over 33 ms 7.9 / 4.6 / 8.1 %, worst 83–100 ms, 10–21 long tasks. Instrumented runs: 8.8 / 8.4 / 16.4 %, p95 50–67 ms. So 5 of 6 runs miss the bar. At 1× the desktop is perfect (p95 16.7 ms, 0 %). Per frame: 290 draw calls and 416 k triangles on desktop (the GLB itself is 213 draws and 344 k), because the edges add hidden + depth + visible passes per shell mesh. Mobile: 172 draws and 257 k triangles per frame (lite budget 150 and 250 k). Mobile 4× passes (1.3–4.6 %), but mobile 6× has 21.8 / 32.6 / 25.1 % of frames over 33 ms (p95 67–100 ms). CPU profile at 4×: the main thread is busy 5.37 s out of 9.91 s, and three's render takes 73 % of that. getParameters (390 ms) + getProgramCacheKey (116 ms) of self time come from X-ray materials that use transparent + DoubleSide: three's automatic two-pass sets material.needsUpdate = true twice per object per frame.
- **Evidence:** [audit/perf-3d/hero-frames-original-gpu.txt](audit/perf-3d/hero-frames-original-gpu.txt) · [audit/perf-3d/frames-desktop-cpu4-gpu.json](audit/perf-3d/frames-desktop-cpu4-gpu.json) · [audit/perf-3d/frames-mobile-cpu6-gpu.json](audit/perf-3d/frames-mobile-cpu6-gpu.json) · [audit/perf-3d/profile-scroll-desktop.txt](audit/perf-3d/profile-scroll-desktop.txt) · [audit/perf-3d/frames-desktop-cpu1-gpu.json](audit/perf-3d/frames-desktop-cpu1-gpu.json)
- **Suggested fix:** components/three/canvas/materials.ts createXrayMaterial: replace side: DoubleSide and three's automatic two-pass with two explicit materials: BackSide at 0.5× alpha rendered first through renderOrder, then FrontSide. Alternatively use forceSinglePass plus a back-face clone. Either way needsUpdate is never set per frame. components/three/canvas/enhance.ts: stop adding 3 draws per shell mesh. Precompute the edge lines in the pipeline as one line primitive per part node, and drop the separate depth pre-pass by letting the front-face shell pass write depth for the visible-edge test. Re-measure with hero-frames.mjs and correct docs/3d/WEB-QA.md §1.
- **Verification:** perf → partially_confirmed (P3): The  moothne -bar mi  did not reproduce. De ktop 4× on the RTX 4060: in trumented run  p95 33.3/33.3/33.4 m  with 0.7/1.5/6.8 % of frame  over 33 m ; unin trumented hero-frame .mj  p95 33.4/33.3 m  with 4.3/1.5 %. So 4 of 5 run  meet the ≤ 6 % bar, again t the finder'  5 of 6 mi e . Mobile 4×: 2.3–6.6 % in trumented, 0… [doc /qa/audit/verify/perf-lh/perf-3d-03-perf.txt, doc /qa/audit/verify/perf-lh/3d/hero-frame -cpu4-gpu.txt]
- _Reviewer key: perf-3d-03_

#### PERF-23

**Software WebGL (SwiftShader, llvmpipe, blocklisted GPUs, VMs/RDP) gets the full high tier: p95 about 1 s per frame, worst about 2 s**

- **Severity:** P3 (reported P2, adjusted by verification) · **Area:** 5. Performance — 3D hero runtime: tier detection · **Status:** OPEN
- **Route:** /
- **Context:** Desktop 1440×900 in Chromium with software GL (--use-angle=swiftshader --enable-unsafe-swiftshader), CPU 1× and 4×. This stands in for a VM or RDP session, a blocklisted GPU, or Linux without GPU drivers.
- **Standard:** 3D-CONTRACT F7.2 (tiers); BRIEF §4 (never block the page)
- **Reproduction:**
  1. Run `node scripts/qa/audit/perf-3d-frames.mjs --vp desktop --cpu 1 --runs 2 --tag desktop-cpu1-swiftshader` and `node scripts/qa/audit/perf-3d-frames.mjs --vp desktop --cpu 4 --runs 3`.
  2. In the page, read window.__sklop3d.getState().tier: it is 'high'.
- **Expected:** 3D-CONTRACT F7.2: a device that cannot render the 3D gets the low tier (posters and the GSAP crossfade), and the 3D never blocks the page.
- **Actual:** The tier is high in every run. At 1× CPU: median 16.7 ms, p95 1034–1050 ms, 38–40 % of frames over 33 ms, worst 1.87–1.98 s. At 4×: p95 1033–1133 ms, 46–53 % over 33 ms, worst 1.3–1.9 s. lib/three/tier.ts probes with failIfMajorPerformanceCaveat: false and never checks the renderer. The adaptive DPR is already at 1, so it cannot help.
- **Evidence:** [audit/perf-3d/frames-desktop-cpu1-swiftshader.json](audit/perf-3d/frames-desktop-cpu1-swiftshader.json) · [audit/perf-3d/frames-desktop-cpu4-swiftshader.json](audit/perf-3d/frames-desktop-cpu4-swiftshader.json) · [audit/perf-3d/frames-desktop-cpu4-swiftshader-b.json](audit/perf-3d/frames-desktop-cpu4-swiftshader-b.json)
- **Suggested fix:** lib/three/tier.ts hasWebGL2(): probe with failIfMajorPerformanceCaveat: true, and/or read WEBGL_debug_renderer_info and classify /SwiftShader|llvmpipe|softpipe|Basic Render|Software/i as low. Add a runtime watchdog in HeroCanvas.tsx: if the median frame is over 50 ms across the first 60 continuous frames at DPR 1, set status 'failed' so the existing posters take over. Keep the e2e suite on SwiftShader through the ?3d=high test override.
- **Verification:** perf → partially_confirmed (P3): With --u e-angle= wift hader --enable-un afe- wift hader at 1×, the tier i  'high': p95 1117 m , p99 1400 m , wor t 1900 m , 39.7 % of frame  over 33 m . lib/three/tier.t :57 probe  with failIfMajorPerformanceCaveat: fal e and never check  the renderer. Expo ure i  narrower than claimed: the repro need  --enable-un afe… [doc /qa/audit/verify/perf-lh/perf-3d-06-perf.txt, doc /qa/audit/verify/perf-lh/3d/frame -verify-de ktop-cpu1- wift hader.j on]
- _Reviewer key: perf-3d-06_

#### PERF-24

**Idle-slice jobs (EdgesGeometry, BVH build) run 60–155 ms each at 4× and ignore the 6 ms slice budget**

- **Severity:** P3 · **Area:** 5. Performance — 3D hero runtime: idle enhancements · **Status:** OPEN
- **Route:** /
- **Context:** Desktop 1440×900, high tier, ANGLE D3D11, CPU 4×, first visit.
- **Standard:** 3D-CONTRACT F7.3 (idle slices); DESIGN-SYSTEM §7.2
- **Reproduction:**
  1. Run `node scripts/qa/audit/perf-3d-profile.mjs --vp desktop --cpu 4 --gpu --runs 2`.
  2. Look at the busy stretches after the first draw: self time in `sN` (the minified EdgesGeometry constructor, .next/static/chunks/0i-5efvfrwjiv.js:1:183806) and in three-mesh-bvh `init`.
- **Expected:** runInIdleSlices runs each enhancement in slices of about 6 ms (components/three/canvas/idle.ts budgetMs = 6), with no long task (DESIGN-SYSTEM §7.2: edges built in an idle slice).
- **Actual:** A single EdgesGeometry job takes 63–155 ms of self time at 4×. BVH init takes 22–28 ms per mesh. The busy stretches are 121–340 ms. requestIdleCallback's timeout of 2000 ms forces these jobs to run while the visitor is scrolling. All 3 desktop frames runs show 92–196 ms long tasks between the first draw and ready.
- **Evidence:** [audit/perf-3d/profile-start-desktop.txt](audit/perf-3d/profile-start-desktop.txt) · [audit/perf-3d/frames-desktop-cpu4-gpu.json](audit/perf-3d/frames-desktop-cpu4-gpu.json)
- **Suggested fix:** Precompute the shell edge lines in the 3D pipeline (an extra line primitive per part in the GLB, zero runtime cost), or split EdgesGeometry over triangle ranges across slices. Build or serialize the BVH off the main thread (three-mesh-bvh GenerateMeshBVHWorker, or serialized BVH in the build).
- **Verification:** perf → confirmed (P3): Cold profile at 4× on de ktop: a 327 m  bu y  tretch with 149 m   elf in  N (the minified Edge Geometry con tructor, 0i-5efvfrwjiv.j :1:183806) and 112 m  inclu ive in three-me h-bvh init. A later  tretch of 145 m  ha  49 m  in  N. At 1×,  N take  13–17 m  per job. idle.t   et  budgetM  = 6 and reque tIdleCallback time… [doc /qa/audit/verify/perf-lh/perf-3d-07-perf.txt, doc /qa/audit/verify/perf-lh/3d/profile- tart-de ktop-cpu4.txt]
- _Reviewer key: perf-3d-07_

#### PERF-25

**The 3D environment map studio-512.hdr is sent uncompressed (411 KB; gzip gives 308 KB), and all /models assets are served with max-age=0**

- **Severity:** P3 · **Area:** 5. Performance — 3D assets: bytes on the wire · **Status:** OPEN
- **Route:** /models/env/studio-512.hdr (loaded after 3D intent on /)
- **Context:** next start on localhost:3200, request with Accept-Encoding: gzip, br
- **Standard:** docs/3d/WEB-QA.md §3 (bytes); BRIEF §9 performance (3D after intent must stay light on mobile data)
- **Reproduction:**
  1. Run `curl -s -D - -o /dev/null -H "Accept-Encoding: gzip, br" http://localhost:3200/models/env/studio-512.hdr`.
  2. Compare with `gzip -c public/models/env/studio-512.hdr | wc -c`.
- **Expected:** Every 3D asset is compressed on the wire (the GLBs are served gzip) and cached long-term, since the manifest already carries sha256 hashes.
- **Actual:** The response has no Content-Encoding, Content-Length 410772 and Content-Type application/octet-stream; gzip would make it 307757 B (−25 %). car.glb and car-lite.glb are gzip, but every /models file has Cache-Control: public, max-age=0.
- **Evidence:** [audit/perf-3d/3d.md](audit/perf-3d/3d.md)
- **Suggested fix:** Best: ship the prefiltered environment from perf-3d-01 as a small KTX2/PNG and drop the .hdr. Otherwise serve .hdr with a compressible content type (e.g. image/vnd.radiance) through next.config headers or the host. Give /models hashed filenames with immutable caching.
- **Verification:** perf → confirmed (P3): curl with Accept-Encoding: gzip, br on /model /env/ tudio-512.hdr return  no Content-Encoding, Content-Length 410772, application/octet- tream and Cache-Control: public, max-age=0. gzip -c give  307,757 B (−25 %). car.glb, car-lite.glb and car.manife t.j on are  ent gzip, al o with max-age=0. [doc /qa/audit/verify/perf-lh/perf-3d-08-perf.txt]
- **Also reported as:** perf-bundle-11 (studio-512.hdr (401 KB) is sent without compression @ / (3D start))
- _Reviewer key: perf-3d-08_

#### PERF-26

**Every 3D start logs the console warning „THREE.Clock: This module has been deprecated“**

- **Severity:** P3 · **Area:** 5. Performance — 3D hero runtime: console hygiene · **Status:** OPEN
- **Route:** /
- **Context:** Any viewport, Chromium, after intent (the 3D starts)
- **Standard:** BRIEF §9 Reliability (console hygiene)
- **Reproduction:**
  1. Open http://localhost:3200/ with the console open.
  2. Hover the hero (desktop) or tap the stage (mobile) to start the 3D.
  3. The console shows: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.
- **Expected:** A clean console. BRIEF §9 Reliability asks for no console errors, and warnings on every page view hide real ones.
- **Actual:** The warning appears once per 3D start, 6 of 6 starts in the leak run. React Three Fiber 9 creates THREE.Clock, which three r186 deprecates.
- **Evidence:** [audit/perf-3d/leak-desktop-gpu.json](audit/perf-3d/leak-desktop-gpu.json) · [audit/perf-3d/leak-desktop-gpu-bare.txt](audit/perf-3d/leak-desktop-gpu-bare.txt)
- **Suggested fix:** Upgrade @react-three/fiber to a release that uses THREE.Timer, or pin three below the deprecation until one exists. Record the choice in DECISIONS.
- **Verification:** perf → confirmed (P3): The leak run captured 'THREE.Clock: Thi  module ha  been deprecated. Plea e u e THREE.Timer in tead.' once per 3D  tart, 4 of 4  tart . The  ource i  three 0.186.1  rc/core/Clock.j :61 (deprecated  ince r183), in tantiated by @react-three/fiber 9.8.1 (new THREE.Clock in event -9ce18a08.e m.j ). [doc /qa/audit/verify/perf-lh/perf-3d-09-perf.txt, doc /qa/audit/verify/perf-lh/3d/leak-de ktop-gpu.txt]
- _Reviewer key: perf-3d-09_

#### SEO-09

**OG images: „Škoda“ falls back to another font in the mono subtitle line, and og:image:alt is a generic template text**

- **Severity:** P3 · **Area:** 6. SEO — Social / OG images · **Status:** OPEN
- **Route:** OG images of system hubs and categories, e.g. /delovi/kocnice/opengraph-image-cd3rrt (subtitle „VW · Audi · Škoda · SEAT · Cupra“) and any mono line with Š/Č/Ć/Ž/Đ. og:image:alt on all 157 products, 58 categories and all landings.
- **Context:** Fetched PNG 1200×630
- **Standard:** BRIEF §8 typography with latin-ext; DESIGN-SYSTEM §2.3 OG frame; SEO-ADS §J1
- **Reproduction:**
  1. Fetch the og:image of /delovi/kocnice and zoom into the brand line.
  2. Read og:image:alt on /deo/kocioni-disk-prednji-276-24-mm-demo-0004 and /delovi/kocioni-diskovi.
- **Expected:** The whole line in Martian Mono (latin-ext, BRIEF §8). The alt describes the actual image: „{Naziv} — OEM {broj}, {proizvođač}“.
- **Actual:** „Škoda“ renders in Archivo Expanded bold while the rest of the line is Martian Mono. Satori does not merge the two same-name fonts (latin and latin-ext files in lib/og/frame.tsx). The alt is „Auto deo — naziv, OEM broj i proizvođač“ / „Kategorija auto delova — broj artikala i stanje“ on every page.
- **Evidence:** [audit/seo/og/crop-kocnice-skoda-glyph.webp](audit/seo/og/crop-kocnice-skoda-glyph.webp) · [audit/seo/og/delovi_kocnice.webp](audit/seo/og/delovi_kocnice.webp) · [audit/seo/og/og-check.json](audit/seo/og/og-check.json)
- **Suggested fix:** lib/og/frame.tsx: load a single Martian Mono file that covers latin + latin-ext, or register the ext file under its own family name and list both in fontFamily. Generate the alt per page (generateImageMetadata, or openGraph.images alt in buildMetadata).
- **Verification:** reproduce → confirmed (P3): I fetched /delovi/kocnice/opengraph-image-cd3rrt (200, image/png, 1200×630) and cropped the mono line at 3×. „VW · Audi · · SEAT · Cupra“ i  Martian Mono, but the whole word „Škoda“ render  in the wide bold Archivo Expanded 700. /delovi/kocioni-di kovi  how  the  ame thing becau e the label i  hard-coded in app/( hop)/… [doc /qa/audit/verify/ eo/ eo-10-reproduce-kocnice-og.webp, doc /qa/audit/verify/ eo/ eo-10-reproduce-crop-brandline.webp]
- _Reviewer key: seo-10_

#### SEO-10

**Product Offer JSON-LD lacks the handling/transit times required by J2 and the recommended return fields**

- **Severity:** P3 · **Area:** 6. SEO — Structured data: Product/Offer · **Status:** OPEN
- **Route:** All 157 /deo/[slug] pages
- **Context:** Server HTML JSON-LD
- **Standard:** SEO-ADS §J2; Google merchant listing structured data (recommended properties)
- **Reproduction:**
  1. Parse the Product JSON-LD on /deo/kocioni-disk-prednji-276-24-mm-demo-0004.
  2. Inspect offers.shippingDetails, offers.hasMerchantReturnPolicy and offers.seller.
- **Expected:** SEO-ADS §J2: shippingDetails with handling and transit days; return policy with returnMethod and returnFees (Google merchant-listing recommended); the seller resolvable on the page.
- **Actual:** shippingDetails has no deliveryTime (0 of 157). MerchantReturnPolicy has no returnFees or returnMethod (0 of 157). seller is {"@id":"…/#organizacija"}, but that node is defined only on / and /kontakt, so the seller is unresolved on product pages. Price, availability, name and breadcrumbs match the visible content on 157 of 157.
- **Evidence:** [audit/seo/product-jsonld.json](audit/seo/product-jsonld.json)
- **Suggested fix:** lib/seo/jsonld.ts product builder: add deliveryTime (ShippingDeliveryTime with handlingTime and transitTime from settings, e.g. 0–1 and 1–2 days), returnMethod (ReturnByMail / ReturnInStore) and returnFees, and inline the seller as {"@type":"Organization","name":…}.
- **Verification:** reproduce → confirmed (P3): I par ed the  erver-HTML JSON-LD with  cript /qa/audit/verify- eo-11-j onld.mj  on /deo/kocioni-di k-prednji-276-24-mm-demo-0004, /deo/kocione-plocice-prednje-demo-0012, / and /kontakt.

On both product , offer . hippingDetail  contain  only  hippingRate (450.00 RSD) and  hippingDe tination (RS). There i  no deliveryTi… [doc /qa/audit/verify/ eo/ eo-11-reproduce-j onld.j on, cript /qa/audit/verify- eo-11-j onld.mj]
- _Reviewer key: seo-11_

#### SEO-11

**Google Merchant feed: backorder items have no g:availability_date**

- **Severity:** P3 · **Area:** 6. SEO — Feeds · **Status:** OPEN
- **Route:** /feeds/google-merchant.xml?demo=1 (28 of 157 items with availability backorder)
- **Context:** Feed preview with demo items. The live feed is empty (non-demo only, D190) and dormant for Google (D21).
- **Standard:** SEO-ADS §J9; Google Merchant Center product data specification
- **Reproduction:**
  1. curl "http://localhost:3100/feeds/google-merchant.xml?demo=1"
  2. Find items with <g:availability>backorder</g:availability> and look for g:availability_date.
- **Expected:** Merchant Center requires availability_date for backorder/preorder items (ISO 8601, from the lead time).
- **Actual:** None of the 28 backorder items has availability_date, so they would be disapproved once Serbia is supported. Otherwise the feed is well-formed: 157 items, required fields present, no duplicate IDs, shipping correct. The Meta CSV is valid: 12 columns and consistent rows.
- **Evidence:** [audit/seo/feeds/google-merchant.xml_demo_1](audit/seo/feeds/google-merchant.xml_demo_1) · [audit/seo/feeds/meta-catalog.csv_demo_1](audit/seo/feeds/meta-catalog.csv_demo_1)
- **Suggested fix:** lib/seo/feeds.ts: for backorder emit g:availability_date = today + leadTimeDays (T00:00+02:00).
- **Verification:** reproduce → confirmed (P3): curl "http://localho t:3100/feed /google-merchant.xml?demo=1" returned 200 (application/xml, 139,884 byte ) with 157 item : 114 in_ tock, 15 out_of_ tock and 28 backorder. availability_date appear  0 time , including on DEMO-0001, DEMO-0008, DEMO-0026, DEMO-0027 and DEMO-0033. The live feed without ?demo=1 ha  0 item .… [doc /qa/audit/verify/ eo/ eo-12-reproduce-google-merchant.xml, doc /qa/audit/verify/ eo/ eo-12-reproduce- ummary.j on]
- _Reviewer key: seo-12_

#### SEO-12

**The consent banner is the first text in every page's HTML (first heading „Kolačići“), so it can become the search snippet**

- **Severity:** P3 · **Area:** 6. SEO — Snippet control · **Status:** OPEN
- **Route:** All 962 crawled storefront URLs (first visit and crawlers never have sk_consent)
- **Context:** Server HTML without the consent cookie
- **Standard:** seo-technical indexability / snippet control (Google data-nosnippet)
- **Reproduction:**
  1. curl -s http://localhost:3100/ and locate „>Kolačići</h2>“ (offset ~11.6 k) vs <header> (~14 k) and <h1> (~25 k).
  2. Check the crawl: firstHeading is „Kolačići“ on 962 of 962 pages.
- **Expected:** Banner text excluded from snippets. The early DOM position is intentional for keyboard order (comment in app/(shop)/layout.tsx), so the fix should not move it.
- **Actual:** The cookie copy precedes the header, H1 and content on every page, which is a known source of cookie-text snippets in Google.
- **Evidence:** [audit/seo/crawl.json](audit/seo/crawl.json) (pages[].firstHeading)
- **Suggested fix:** Add data-nosnippet to the banner root in components/consent (ConsentRoot / banner container). Keep the DOM order.
- **Verification:** reproduce → confirmed (P3): I fetched 8 route  with curl and a Googlebot UA and no  k_con ent cookie: /, product, category, model landing, generation page, /ponuda (the landing route group), /kontakt and /pretraga. On every one the con ent H2 „Kolačići“ i  the fir t heading in <body>. On home it  it  at byte off et 11591, ahead of <header> (14007… [doc /qa/audit/verify/ eo/ eo-15-reproduce.txt, doc /qa/audit/verify/ eo/ eo-15-reproduce-390.webp]
- _Reviewer key: seo-15_

#### SEO-13

**GET /api/zdravlje (health endpoint in ROUTES §B3) returns 404**

- **Severity:** P3 · **Area:** 6. SEO — Route map · **Status:** OPEN
- **Route:** /api/zdravlje
- **Context:** curl
- **Standard:** ROUTES §B3
- **Reproduction:**
  1. curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/api/zdravlje
  2. ls app/api: only atribucija and revalidate exist.
- **Expected:** 200 with build id and Convex reachability, as documented in ROUTES §B3 and ARCHITECTURE for monitoring.
- **Actual:** 404 (the not-found page). The route was never built.
- **Evidence:** [audit/seo/evidence-commands.txt](audit/seo/evidence-commands.txt) (section seo-17) · [audit/seo/raw/status-battery-2.txt](audit/seo/raw/status-battery-2.txt)
- **Suggested fix:** Add app/api/zdravlje/route.ts (build id + a cheap Convex query, no-store), or remove it from ROUTES §B3 and ARCHITECTURE.
- **Verification:** reproduce → confirmed (P3): GET /api/zdravlje return  404 (the not-found page, <title>Stranica nije pronađena · SKLOP</title>). HEAD al o return  404, and /api/zdravlje/ redirect  (308) to the  ame 404. For compari on, /api/revalidate return  405, which  how  the /api handler  them elve  work. app/api ha  only atribucija and revalidate, and find … [doc /qa/audit/verify/ eo/ eo-17-reproduce.txt, doc /ROUTES.md:51]
- _Reviewer key: seo-17_

#### SEO-14

**Admin HTML responses have no X-Robots-Tag (ROUTES §B2 requires it)**

- **Severity:** P3 · **Area:** 6. SEO — Robots directives · **Status:** OPEN
- **Route:** /admin, /admin/porudzbine, /admin/proizvodi, /admin/podesavanja?tab=seo, /admin/porudzbine/SK-2026-000092/predracun, /admin/pozivnica/[token]
- **Context:** Signed in as owner (page.request), plus anonymous for /admin/pozivnica
- **Standard:** ROUTES §B2
- **Reproduction:**
  1. node scripts/qa/audit/seo-admin-headers.mjs (signs in as the owner and requests the admin URLs).
  2. Compare with /styleguide, which does send X-Robots-Tag: noindex, nofollow.
- **Corrected reproduction (verifier):**
  1. node scripts/qa/audit/verify-seo-18.mjs (signs in as the owner via loginAdmin, then page.request.get with maxRedirects 0 on the admin URLs; anonymous context for /admin/pozivnica/abc)
  2. Read the owner and anonymous tables: xRobots is null on every admin text/html response; robotsMeta is 'noindex, nofollow'
  3. Compare /styleguide (xRobots 'noindex, nofollow') and /admin/izvoz/kupci.csv (xRobots 'noindex, nofollow')
- **Expected:** ROUTES §B2: „everything noidx + X-Robots-Tag + robots disallow“.
- **Actual:** Only meta robots „noindex, nofollow“ plus the robots.txt disallow. No header on any admin response, including the public invitation page. Low risk, but it does not match the documented contract.
- **Evidence:** [audit/seo/admin-headers.json](audit/seo/admin-headers.json) · [audit/seo/raw/status-battery-2.txt](audit/seo/raw/status-battery-2.txt)
- **Suggested fix:** next.config.ts headers(): add { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }, as for /styleguide. Or update ROUTES §B2.
- **Verification:** reproduce → confirmed (P3): Signed in a  the owner with a fre h context and reque ted 11 admin HTML URL  without following redirect : /admin, /admin/porudzbine, /admin/porudzbine/SK-2026-000092 (+ /predracun, /otpremnica), /admin/upiti, /admin/proizvodi, /admin/uvoz, /admin/izvori, /admin/pode avanja?tab= eo and /admin/privatno t. All returned 20… [doc /qa/audit/verify/ eo/ eo-18-reproduce.j on, cript /qa/audit/verify- eo-18.mj]
- _Reviewer key: seo-18_

#### SEO-15

**/upit, an indexable landing page, has no breadcrumbs (neither visible nor BreadcrumbList)**

- **Severity:** P3 · **Area:** 6. SEO — Breadcrumbs / structured data · **Status:** OPEN
- **Route:** /upit
- **Context:** Server HTML, any viewport
- **Standard:** SEO-ADS §J2/§J5
- **Reproduction:**
  1. curl /upit and look for nav[aria-label="Putanja"] and BreadcrumbList JSON-LD.
  2. Compare any other indexable page (347 of 349 have both, and they match).
- **Expected:** SEO-ADS §J5 „breadcrumbs everywhere“ and §J2 BreadcrumbList on every page with breadcrumbs. /upit is indexable (ROUTES §B1, landing for „delovi po broju šasije“).
- **Actual:** No breadcrumb and no JSON-LD at all on /upit (home is the only other exception, as expected).
- **Evidence:** [audit/seo/breadcrumbs.json](audit/seo/breadcrumbs.json)
- **Suggested fix:** app/(shop)/upit/page.tsx: render the shared Breadcrumbs (Početna / Upit po broju šasije) and its BreadcrumbList.
- **Verification:** reproduce → confirmed (P3): curl of /upit: 200, meta robot  'index, follow',  elf-canonical, no nav[aria-label="Putanja"], no BreadcrumbLi t and no application/ld+j on at all. I al o checked the rendered DOM after hydration at 390 and 1440: breadcrumbNav i  null and j onLdType  i  empty at both width . Sibling indexable page  have both a breadcru… [doc /qa/audit/verify/ eo/ eo-19-21-reproduce.j on, doc /qa/audit/verify/ eo/ eo-19-reproduce-upit-1440.webp]
- _Reviewer key: seo-19_

#### SEO-16

**Sitemaps omit lastmod for static and vehicle URLs and in the index entry for the product sitemap**

- **Severity:** P3 · **Area:** 6. SEO — Sitemaps · **Status:** OPEN
- **Route:** /sitemap.xml, /sitemaps/staticne.xml (12 URLs), /sitemaps/vozila.xml (72 URLs)
- **Context:** curl
- **Standard:** SEO-ADS §J3
- **Reproduction:**
  1. curl /sitemap.xml: <lastmod> present only for kategorije.xml and landing.xml.
  2. curl /sitemaps/staticne.xml and /sitemaps/vozila.xml: no <lastmod>.
- **Corrected reproduction (verifier):**
  1. curl http://localhost:3100/sitemap.xml: the proizvodi-1.xml entry has no <lastmod>, although every <url> in /sitemaps/proizvodi-1.xml has one (max 2026-09-30T04:05:56.431Z)
  2. curl http://localhost:3100/sitemaps/staticne.xml: no <lastmod> on the 7 content-page URLs (/o-nama, /kontakt, /dostava-i-placanje, /reklamacije-i-povrat, /uslovi-koriscenja, /politika-privatnosti, /kolacici)
  3. curl any of those 7 pages: the page shows 'Poslednja izmena: 30.09.2026.' (contentPages.updatedAt)
  4. Expected fix: pass contentPages.updatedAt for those 7 URLs in sitemapData/staticne, and give the index entry for proizvodi-N the max contentUpdatedAt of its chunk. vozila.xml and the 5 non-content static URLs correctly have no lastmod (no real change date).
- **Expected:** SEO-ADS §J3: lastmod where a real change date exists (content pages have „Poslednja izmena“, vehicles have updatedAt); the index lastmod = max child lastmod (products have contentUpdatedAt).
- **Actual:** 84 URLs without lastmod, and the index gives none for proizvodi-1.xml even though all 157 entries carry one. Otherwise all 5 files are well-formed, contain 349 URLs, every URL returns 200 and is indexable and self-canonical, no noindex URL is listed, and no indexable clean URL is missing.
- **Evidence:** [audit/seo/raw/staticne.xml](audit/seo/raw/staticne.xml) · [audit/seo/raw/vozila.xml](audit/seo/raw/vozila.xml) · [audit/seo/raw/proizvodi-1.xml](audit/seo/raw/proizvodi-1.xml) · [audit/seo/sitemap-urls.json](audit/seo/sitemap-urls.json)
- **Suggested fix:** lib/seo/sitemap.ts + convex/seo.ts sitemapData: pass contentPages.updatedAt and vehicle updatedAt as lastModified, and compute the index lastmod for the product files as the max contentUpdatedAt.
- **Verification:** reproduce → partially_confirmed (P3): The count  reproduce exactly. The / itemap.xml index ha  la tmod only for kategorije.xml and landing.xml.  taticne.xml ha  12 URL  and 0 la tmod; vozila.xml ha  72 URL  and 0 la tmod. proizvodi-1.xml ha  157/157 la tmod, but it  index entry ha  none (the max child la tmod would be 2026-09-30T04:05:56.431Z). The claimed… [doc /qa/audit/verify/ eo/ eo-20-reproduce.txt, doc /qa/audit/verify/ eo/ eo-20-reproduce-index.txt]
- _Reviewer key: seo-20_

#### SEO-17

**Upper- or mixed-case storefront URLs return 404 instead of a 308 to the lowercase canonical**

- **Severity:** P3 · **Area:** 6. SEO — URL normalisation · **Status:** OPEN
- **Route:** /deo/KOCIONI-DISK-PREDNJI-276-24-MM-DEMO-0004, /DEO/kocioni-disk-prednji-276-24-mm-demo-0004, /Delovi/Kocioni-Diskovi
- **Context:** curl
- **Standard:** ROUTES §B4; seo-technical URL structure
- **Reproduction:**
  1. curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/Delovi/Kocioni-Diskovi
  2. Same for the other two variants.
- **Corrected reproduction (verifier):**
  1. curl -s -o /dev/null -w '%{http_code}' http://localhost:3100/Delovi/Kocioni-Diskovi returns 404 (same for /deo/KOCIONI-…-DEMO-0004, /DEO/…, /Kontakt, /vozila/Volkswagen); the body has <meta name="robots" content="noindex">
  2. curl the lowercase URLs: 200, and with a trailing slash: 308 to the clean URL
  3. Check that no sitemap URL or internal link uses uppercase: 0 of 349 sitemap URLs, 0 in docs/qa/audit/seo/crawl.json
  4. Read as a P3 robustness improvement (optional lowercase 308 in proxy.ts, excluding token routes), not a violation of ROUTES §B4
- **Expected:** ROUTES §B4: lowercase slugs. Case variants from print, Viber or ads should 308 to the lowercase URL. Trailing slashes already 308 correctly.
- **Actual:** 404 for all three variants.
- **Evidence:** [audit/seo/raw/status-battery.txt](audit/seo/raw/status-battery.txt)
- **Suggested fix:** proxy.ts: when the path of a slug route (/deo, /delovi, /vozila, /ponuda, static pages) contains uppercase, 308 to the lowercase path. Exclude token routes (/porudzbina/…, /upit/[token], /admin/pozivnica, /obavestenja/odjava), whose tokens are case-sensitive.
- **Verification:** reproduce → partially_confirmed (P3): The behaviour i  real. 18 ca e variant  return 404 with meta robot  'noindex': /deo/KOCIONI-DISK-PREDNJI-276-24-MM-DEMO-0004, /DEO/…, /Deo/…, /deo/Kocioni-Di k-…, /Delovi/Kocioni-Di kovi, /delovi/Kocioni-Di kovi, /Delovi/kocioni-di kovi, /DELOVI, /Delovi, /delovi/kocioni-di kovi/Volk wagen, /delovi/kocioni-di kovi/volk… [doc /qa/audit/verify/ eo/ eo-21-reproduce.txt, doc /qa/audit/verify/ eo/ eo-19-21-reproduce.j on]
- _Reviewer key: seo-21_

#### COPY-09

**Terminology not enforced: field „E-pošta“ but errors „e-mail adresa“, confirmations „e-mail“, „e-adresa“, „e-mailom“; „Proizvodi“ vs „Artikli“**

- **Severity:** P3 (reported P2, adjusted by verification) · **Area:** 7. Copy — Terminology / forms, validation, e-mails, search · **Status:** OPEN
- **Route:** /porudzbina, /upit, /deo/[slug] (Javi mi kad stigne), /prijava, /registracija, /zaboravljena-lozinka, /za-majstore/registracija, /za-majstore/hvala, /obavestenja/odjava/[token], /pretraga, e-mails
- **Context:** 1440 and 390, anonymous; validation and success states
- **Standard:** DESIGN-SYSTEM §11.1 (consistent mechanic vocabulary), track standard (consistent terminology e-pošta vs e-mail)
- **Reproduction:**
  1. Open /deo/kocione-plocice-prednje-demo-0012, type „pogresno@“ in „Javi mi kad stigne“ → label „E-pošta“, error „E-mail adresa nije ispravna.“
  2. Open /porudzbina with an item, click „Dalje“ empty → „E-pošta“ / „Upišite e-mail adresu.“
  3. On /prijava enter wrong credentials → „Pogrešan e-mail ili lozinka.“
  4. /za-majstore/registracija: „Odgovor stiže e-poštom“ and two lines lower „Stiže vam e-mail o odobrenju“
  5. /pretraga?q=disk heading „PROIZVODI“ while catalog lists say „Artikli“
- **Expected:** One term per concept, e.g. „e-pošta“ for the medium and field, „adresa e-pošte“ in errors; one noun for catalog items („artikli“).
- **Actual:** Mixed within the same form and page. Occurrences: lib/i18n/sr/shop.ts:107, lib/validation/checkout.ts:36, lib/validation/inquiry.ts:41, components/auth/SignInForm.tsx:32, components/mechanic/MechanicRegistrationForm.tsx:150, components/mechanic/MechanicStatusScreen.tsx:32, app/(shop)/za-majstore/hvala/page.tsx:28, app/(shop)/za-majstore/registracija/page.tsx:23, components/notifications/UnsubscribeForm.tsx:58 („e-adresi“), lib/email/templates/customer.ts:148,273, convex/auth.ts:68, convex/backInStock.ts:31, convex/inquiries.ts:141-148 („e-mailom“), convex/lib/orders.ts:97, convex/mechanics.ts:77, convex/staff.ts:138,321; components/shell/SearchBox.tsx:78 + /pretraga heading „Proizvodi“ vs „Artikli“ on listings.
- **Evidence:** [audit/copy/state-back-in-stock-error-1440.webp](audit/copy/state-back-in-stock-error-1440.webp) · [audit/copy/state-signup-errors-1440.webp](audit/copy/state-signup-errors-1440.webp) · [audit/copy/states-1440-addToCart_checkout_searchSuggest.json](audit/copy/states-1440-addToCart_checkout_searchSuggest.json) · [audit/copy/source-scan.txt](audit/copy/source-scan.txt)
- **Suggested fix:** Add a glossary to lib/i18n/sr (e.g. EMAIL_TERM) and route every string above through it; change DESIGN-SYSTEM §11.4 examples accordingly („Adresa e-pošte nije ispravna. Primer: ime@primer.rs.“). Rename search group/heading to „Artikli“.
- **Verification:** reproduce → confirmed (P3): Reproduced at 1440 and 390:
- /deo/kocione-plocice-prednje-demo-0012, back-in- tock form with „pogre no@“: label „E-pošta“, error „E-mail adre a nije i pravna. Primer: ime@primer.r .“
- /porudzbina with one item, empty „Dalje“: label „E-pošta“, error „Upišite e-mail adre u.“
- /prijava with wrong credential  (1440, one… [doc /qa/audit/verify/copy/copy-06-reproduce.txt, doc /qa/audit/verify/copy/copy-06-reproduce-back-in- tock-1440.webp]
- _Reviewer key: copy-06_

#### COPY-10

**Auto-generated meta descriptions of content pages leak Markdown and table syntax**

- **Severity:** P3 · **Area:** 7. Copy — SEO descriptions · **Status:** OPEN
- **Route:** /kolacici, /dostava-i-placanje (also mid-sentence cuts on /o-nama, /kontakt, /reklamacije-i-povrat, /politika-privatnosti, /uslovi-koriscenja)
- **Context:** Meta description + og:description
- **Standard:** BRIEF §5 SEO (unique descriptions), DESIGN-SYSTEM §4.4 (dashes)
- **Reproduction:**
  1. View source of /kolacici → description „…u vašem pregledaču. Neophodni (uvek uključeni) | Naziv | Svrha | Trajanje |…“
  2. View source of /dostava-i-placanje → „…pre slanja. Načini dostave - Lično…“
- **Expected:** Hand-written 140–155-character descriptions per content page (contentPages.seoDescription) or a plain-text excerpt of the first paragraph only.
- **Actual:** clampText over the stripped body concatenates headings, list hyphens and table pipes.
- **Evidence:** [audit/copy/ev-20-content-descriptions.txt](audit/copy/ev-20-content-descriptions.txt)
- **Suggested fix:** components/content/ContentPageView.tsx:24 — use a seoDescription field (editable in Pravni tekstovi) and fall back to the first paragraph only, never tables/headings.
- **Verification:** reproduce → confirmed (P3): I curled all  even content page . /kolacici: de cription and og:de cription are „…u vašem pregledaču. Neophodni (uvek uključeni) | Naziv | Svrha | Trajanje |…“ (a heading plu  table pipe ). /do tava-i-placanje: „…pre  lanja. Načini do tave - Lično…“ (a heading run into a li t hyphen, with no punctuation). Cau e: markdo… [doc /qa/audit/verify/copy/copy-12-reproduce.txt, <meta name="de cription" content="Kolačići i  lični zapi i (localStorage)  u mali podaci koje  ajt čuva u vašem pregledaču. Neophodni (uvek uključeni) | Naziv |…]
- **Also reported as:** seo-14 (Content-page meta descriptions are cut from Markdown and leak table pipes and headings @ /kolacici, /dostava-i-placanje (also /uslovi-koriscenja, /reklamacije-i-povrat))
- _Reviewer key: copy-12_

#### COPY-11

**Number/format slips in hard-coded strings: „0 RSD“ without no-break space, „kom“ without period, „CENA SA PDV“, „06.10.2026..“, „robe.: http…“**

- **Severity:** P3 · **Area:** 7. Copy — Formats / typography · **Status:** OPEN
- **Route:** /korpa, /porudzbina (Dostava step), /porudzbina/[token]/predracun, admin print predračun, e-mails „Ponuda je spremna“, „Deo je ponovo na stanju“, staff e-mails
- **Context:** 1440; e-mail plain text from Admin → E-pošta → Šabloni
- **Standard:** DESIGN-SYSTEM §4.4 (formats, no-break spaces), BRIEF §2 formats
- **Reproduction:**
  1. Add an item and open /korpa → „Preuzimanje 0 RSD“ (normal space); /porudzbina Dostava step → „0 RSD“
  2. Open /porudzbina/GVl2SHwvba1nbEDG8VWTGcg0IPXAbHGNXGpzjHnowJw/predracun → column „Cena sa PDV“
  3. Admin → E-pošta → Šabloni → Ponuda spremna: preheader „…važi do 06.10.2026..“
  4. Šabloni → Deo je ponovo na stanju (Običan tekst): „Odjavite sva obaveštenja o dolasku robe.: http://…“; preheader „Kočione pločice prednje je ponovo na stanju“
  5. Šabloni → Osoblje: malo na stanju: „ostalo 1 kom“; nova porudžbina preheader „4 kom ·“; text lines „+381 64 123 4567: tel:+381641234567“
- **Expected:** formatRSD/nbsp everywhere („0 RSD“ via formatter), „kom.“ with period and no-break space, „Cena sa PDV-om“, one period after a date, no „.:“, agreement-safe preheaders („Artikal „…“ je ponovo na stanju“), tel links printed once.
- **Actual:** See steps; each string bypasses lib/format.
- **Evidence:** [audit/copy/ev-predracun-cena-sa-pdv-1440.webp](audit/copy/ev-predracun-cena-sa-pdv-1440.webp) · [audit/copy/emails-text.txt](audit/copy/emails-text.txt) · [audit/copy/states-1440.json](audit/copy/states-1440.json)
- **Suggested fix:** components/cart/CartView.tsx:222 and components/checkout/CheckoutForm.tsx:544 → formatRSD(0); app/(shop)/porudzbina/[token]/predracun/page.tsx:109, components/admin/print/OrderPrint.tsx:126, components/admin/inquiries/QuoteComposer.tsx:237 → „Cena sa PDV-om“; lib/email/templates/customer.ts:77 drop the extra „.“ after date(), :131 and :135 reword; lib/email/templates/staff.ts:75,180 → formatQuantity(); lib/email/html.ts:118/460 print tel: links as the number only and do not add „:“ after a label ending in „.“.
- **Verification:** reproduce → confirmed (P3): I reproduced every  ub-item my elf (anonymou  1440 context for cart and checkout, then admin → /admin/mejlovi/ abloni?prikaz=tek t). (1) /korpa Do tava read  „Preuzimanje[SP]0[SP]RSD · kurir 450[NBSP]RSD“: a normal  pace in the hard-coded  tring, NBSP only where formatRSD i  u ed. The checkout Do tava  tep option „Ličn… [doc /qa/audit/verify/copy/copy-13-reproduce.j on, doc /qa/audit/verify/copy/copy-13-reproduce-cart-1440.webp]
- _Reviewer key: copy-13_

#### COPY-12

**Hero counts disagree: „42 kategorije“ in the stage caption vs „44“ in the title block and category link**

- **Severity:** P3 · **Area:** 7. Copy — Home hero / 3D · **Status:** OPEN
- **Route:** /
- **Context:** 390 (caption visible under the hero copy) and 1440 (title block „KATEGORIJE 44“)
- **Standard:** DESIGN-SYSTEM §11.1 (numbers do the talking — must be consistent)
- **Reproduction:**
  1. Open / at 390: caption „SKLOPLJEN AUTOMOBIL · 00 · 42 KATEGORIJE · 91 DEO“
  2. Open / at 1440: title block „KATEGORIJE 44“; further down „Svih 44 kategorija“
- **Corrected reproduction (verifier):**
  1. Open / at 390x844 (also 768x1024), anonymous, and do not scroll: the caption under the hero copy reads "00 · 42 KATEGORIJE · 91 DEO".
  2. Scroll to "Najtraženije kategorije": the link reads "Svih 44 kategorija · 157 artikala". The trust facts near the end show "44 kategorija delova".
  3. At 1440 and wider the stage-0 caption is hidden (lg:hidden), so only the title block "KATEGORIJE 44" shows. The conflict is visible on one page only below 1024 px.
- **Expected:** One number, or a label that explains the difference („42 kategorije na 3D prikazu“).
- **Actual:** 42 (categories with 3D nodes, D7) and 44 (all categories) shown as the same thing.
- **Evidence:** [audit/copy/ev-home-hero-390.webp](audit/copy/ev-home-hero-390.webp) · [audit/copy/ev-home-hero-42-vs-44-1440.webp](audit/copy/ev-home-hero-42-vs-44-1440.webp)
- **Suggested fix:** components/three/StageCaption.tsx:75 — label the manifest count („42 dela na prikazu“) or use the catalog count everywhere.
- **Verification:** reproduce → confirmed (P3): Chromium, anonymou , prod build :3100. At 390 and 768 the  tage-0 caption under the hero copy read  "SKLOPLJEN AUTOMOBIL / 00 · 42 KATEGORIJE · 91 DEO". Further down the  ame page it  ay  "Svih 44 kategorija · 157 artikala" (y≈4300 at 390) and the tru t fact  ay  "44 kategorija delova" (y≈10270). At 1440 the  tage-0 ca… [doc /qa/audit/verify/copy/copy-15-reproduce-hero-390.webp, doc /qa/audit/verify/copy/copy-15-reproduce- vih-390.webp]
- _Reviewer key: copy-15_

#### COPY-13

**Form labels and hints: doubled parentheses, terse placeholders, empty field reported as invalid format**

- **Severity:** P3 · **Area:** 7. Copy — Form microcopy · **Status:** OPEN
- **Route:** /upit, /porudzbina (Pregled), /registracija, /zaboravljena-lozinka, /za-majstore/registracija
- **Context:** 1440, anonymous, empty submit
- **Standard:** DESIGN-SYSTEM §11.4 (errors: what happened + how to fix)
- **Reproduction:**
  1. Open /upit: label „Broj šasije (VIN) (nije obavezno)“; Model/Generacija selects read „Prvo marku“, „Prvo model“
  2. Checkout step Pregled: same „Broj šasije (VIN) (nije obavezno)“
  3. Open /registracija and submit empty: e-mail error „E-mail adresa nije ispravna. Primer…“ (field is empty, not invalid); same on /zaboravljena-lozinka and /za-majstore/registracija
- **Expected:** „Broj šasije (VIN), nije obavezno“ or „Broj šasije — VIN (nije obavezno)“; „Prvo izaberite marku“; empty field → „Upišite adresu e-pošte.“ (DS §11.4 required vs format).
- **Actual:** See steps.
- **Evidence:** [audit/copy/ev-upit-vin-label-1440.webp](audit/copy/ev-upit-vin-label-1440.webp) · [audit/copy/states-1440.json](audit/copy/states-1440.json) · [audit/copy/state-inquiry-errors-1440.webp](audit/copy/state-inquiry-errors-1440.webp)
- **Suggested fix:** components/inquiry/InquiryForm.tsx and CheckoutForm VIN label; select placeholders; sign-up/reset/mechanic schemas (components/auth/AuthForms.tsx, lib/validation/mechanicRegistration.ts): min(1, ERRORS.required(...)) before the format refine.
- **Verification:** reproduce → confirmed (P3): Chromium 1440, anonymou . (1) /upit: the VIN label read  "Broj ša ije (VIN) (nije obavezno)", becau e Field.t x:98 append  " (nije obavezno)" to a label that already ha  parenthe e . The  uffix i  font-normal ink-3,  o it look  le  doubled than it  ound , but  creen reader  read both parenthetical group . Checkout  tep… [doc /qa/audit/verify/copy/copy-16-reproduce-upit-vin-1440.webp, doc /qa/audit/verify/copy/copy-16-reproduce-checkout-review-vin-1440.webp]
- _Reviewer key: copy-16_

#### COPY-14

**Ambiguous microcopy for mechanics and account screens („menja se pri svakoj porudžbini“, „otpremite CSV“, „Pošaljite adresu naloga“, „Nalog je opcion“)**

- **Severity:** P3 · **Area:** 7. Copy — Clarity · **Status:** OPEN
- **Route:** /za-majstore, /za-majstore/registracija, /majstor/brza-porudzbina, /zaboravljena-lozinka, /nalog/profil, /uslovi-koriscenja
- **Context:** 1440, anonymous / customer / mechanic
- **Standard:** DESIGN-SYSTEM §11.1 (say what happens and what to do next), impeccable clarify (specific verb + object)
- **Reproduction:**
  1. /za-majstore/registracija, field group Servis: „Na ovu adresu šaljemo delove; menja se pri svakoj porudžbini.“ (reads as if it changes automatically/must be changed)
  2. /za-majstore: „Nalepite listu … ili otpremite CSV“; /majstor/brza-porudzbina button „Otpremi CSV“ — „otpremiti“ is shipping vocabulary here (otpremnica)
  3. /zaboravljena-lozinka: „Pošaljite adresu naloga; stiže vam kod…“
  4. /nalog/profil: „Adresa naloga se ne menja ovde.“ — does not say where
  5. /uslovi-koriscenja: „Nalog je opcion.“
- **Corrected reproduction (verifier):**
  1. Open /za-majstore/registracija (anonymous, 1440). The Servis section aside reads "Na ovu adresu šaljemo delove; menja se pri svakoj porudžbini." (MechanicRegistrationForm.tsx:381).
  2. Open /zaboravljena-lozinka. The intro reads "Pošaljite adresu naloga; stiže vam kod od 8 cifara, važi 15 minuta." (AuthForms.tsx:179).
  3. Sign in as the audit customer and open /nalog/profil. The e-mail help reads "Adresa naloga se ne menja ovde." (AccountViews.tsx:371), and no other screen offers an e-mail change.
  4. Open /uslovi-koriscenja, section "Nalog na sajtu": "Nalog je opcion." (convex/seedData/content.ts:147).
  5. Drop the "otpremite/Otpremi CSV" item: it is standard Serbian UI wording for upload, and the icon and hint make it clear.
- **Expected:** „Adresu možete da promenite u svakoj porudžbini.“; „učitajte CSV“ / „Učitaj CSV“; „Upišite e-poštu naloga — poslaćemo kod od 8 cifara (važi 15 minuta).“; „Adresu e-pošte menjamo na zahtev — pišite nam kroz upit.“; „Nalog nije obavezan.“
- **Actual:** See steps.
- **Evidence:** [audit/copy/ev-za-majstore-otpremite-csv-1440.webp](audit/copy/ev-za-majstore-otpremite-csv-1440.webp) · [audit/copy/dump-anon1440.txt](audit/copy/dump-anon1440.txt) · [audit/copy/dump-customer.txt](audit/copy/dump-customer.txt) · [audit/copy/dump-mechanic.txt](audit/copy/dump-mechanic.txt)
- **Suggested fix:** components/mechanic/MechanicRegistrationForm.tsx:381, app/(shop)/za-majstore/page.tsx:37-38, lib/i18n/sr/mechanic.ts:58 (csv), components/auth/AuthForms.tsx:179, components/account/AccountViews.tsx:371, convex/seedData/content.ts:147.
- **Verification:** reproduce → partially_confirmed (P3): All five  tring  render a  quoted (Chromium 1440; anonymou , the audit cu tomer, and the audit mechanic). Four of the ambiguity claim  hold. (a) /za-maj tore/regi tracija, Servi  a ide: "Na ovu adre u šaljemo delove; menja  e pri  vakoj porudžbini." read  a  "it change  with every order"; the meaning i  "you can change… [doc /qa/audit/verify/copy/copy-17-reproduce-za-maj tore-regi tracija-1440.webp, doc /qa/audit/verify/copy/copy-17-reproduce-zaboravljena-lozinka-1440.webp]
- _Reviewer key: copy-17_

#### COPY-15

**OG images uppercase units and orphan them („276 × 24 MM“)**

- **Severity:** P3 · **Area:** 7. Copy — OG images · **Status:** OPEN
- **Route:** /deo/[slug]/opengraph-image (all products with dimensions in the name)
- **Context:** 1200 × 630 OG image
- **Standard:** DESIGN-SYSTEM §4.4 (no-break space number–unit; uppercase only for display tokens), DESIGN-SYSTEM §2.3 OG frame
- **Reproduction:**
  1. Open /deo/kocioni-disk-prednji-276-24-mm-demo-0004/opengraph-image-138o9k (og:image of the product)
  2. Title reads „KOČIONI DISK PREDNJI 276 × 24 / MM“
- **Expected:** Unit symbols keep their case (mm, kW, L) and stay with the number (no-break space).
- **Actual:** textTransform uppercase in lib/og/frame.tsx:232 turns „mm“ into „MM“; the unit wraps alone onto the last line.
- **Evidence:** [audit/copy/og-product.webp](audit/copy/og-product.webp)
- **Suggested fix:** lib/og/frame.tsx: do not uppercase product names (use sentence case like the site H1), or protect unit tokens and join number+unit with U+00A0 before rendering.
- **Verification:** reproduce → confirmed (P3): I fetched og:image from each product page (URL mapped from :3000 to :3100). For DEMO-0004 the 1200x630 PNG title read  "KOČIONI DISK / PREDNJI 276 × 24 / MM": the unit i  upperca ed and alone on the la t line. Clo e variant  make the  cope wider than reported: 0006 "…256 × 22 / MM"; 0047 "77 KW" (kW with the wrong ca e… [doc /qa/audit/verify/copy/copy-18-reproduce-og-product-0004.webp, doc /qa/audit/verify/copy/copy-18-reproduce-og-variant .webp]
- _Reviewer key: copy-18_

#### COPY-16

**Admin and staff copy slips: „Interna napomena vidi samo osoblje“, „režim log“ vs „Samo zapis“, plain-text preview shown in capitals, „zaposleni u SKLOP“**

- **Severity:** P3 · **Area:** 7. Copy — Admin / staff e-mails · **Status:** OPEN
- **Route:** /admin/porudzbine/[broj], /admin/mejlovi/sabloni?prikaz=tekst, staff e-mails
- **Context:** 1440, owner
- **Standard:** DESIGN-SYSTEM §4.4 (caps only for labels/tokens), DESIGN-SYSTEM §11.1 (consistent terms), BRIEF §2
- **Reproduction:**
  1. Open /admin/porudzbine/SK-2026-000092 → Napomena help: „Interna napomena vidi samo osoblje…“ (case error); Istorija: „E-pošta zabeležena (nije poslata, režim log)“ while Podešavanja call the mode „Samo zapis“
  2. Open /admin/mejlovi/sabloni?sablon=back_in_stock&prikaz=tekst → the plain-text message is displayed in CAPITALS incl. URLs, although the page says „tačno kako ga kupac … vidi“
  3. Any staff e-mail footer: „Ovu poruku dobijate kao zaposleni u SKLOP.“; digest button „Otvorite kontrolnu tablu“ while the admin calls it „Pregled“
- **Expected:** „Internu napomenu vidi samo osoblje…“; „(nije poslata — režim Samo zapis)“; plain-text preview in original case; „kao zaposleni u prodavnici SKLOP“; „Otvorite Pregled“.
- **Actual:** See steps.
- **Evidence:** [audit/copy/email-back_in_stock-tekst.webp](audit/copy/email-back_in_stock-tekst.webp) · [audit/copy/dump-admin.txt](audit/copy/dump-admin.txt) · [audit/copy/emails-text.txt](audit/copy/emails-text.txt)
- **Suggested fix:** components/admin/orders/OrderDetail.tsx:756; convex/notify.ts:67,87 and convex/lib/emailConfig.ts:66; components/admin/system/EmailTemplatesAdmin.tsx:167 replace type-code-s (text-transform: uppercase) with a non-caps mono style; lib/email/templates/shared.ts:26; lib/email/templates/staff.ts:237.
- **Verification:** reproduce → confirmed (P3): I reproduced thi  my elf at 1440 a  owner in Chromium ( cript /qa/audit/verify-copy-19.mj ). All four  lip   how up. (1) On /admin/porudzbine/SK-2026-000092 the note field help  ay  „Interna napomena vidi  amo o oblje, o im ako je označeno drugačije.“ It  hould be „Internu napomenu…“ (accu ative). (2) The order hi tory… [doc /qa/audit/verify/copy/copy-19-reproduce-1440-note-help.webp, doc /qa/audit/verify/copy/copy-19-reproduce-1440-hi tory.webp]
- _Reviewer key: copy-19_

#### COPY-17

**Minor inconsistencies on shared templates: 404 title separator and 404 category labels, delivery table list in Title Case**

- **Severity:** P3 · **Area:** 7. Copy — Consistency · **Status:** OPEN
- **Route:** /ovo-ne-postoji (any 404), /dostava-i-placanje
- **Context:** 1440
- **Standard:** DESIGN-SYSTEM §11.1 (sentence case, consistent terms)
- **Reproduction:**
  1. Open /ovo-ne-postoji: <title> „Stranica nije pronađena · SKLOP“ (every other title uses „ | SKLOP“); category chips „Zupčasti kaiš i vodena pumpa“, „Turbina“ differ from catalog names „Set zupčastog kaiša i vodena pumpa“, „Turbina (turbopunjač)“
  2. Open /dostava-i-placanje table column Plaćanje: „Gotovinom pri preuzimanju, Karticom pri preuzimanju, Virmanom uz predračun, Odloženo plaćanje“ — every item capitalised mid-list, and „Odloženo plaćanje“ listed without „(odobreni majstori)“
- **Corrected reproduction (verifier):**
  1. Open http://localhost:3100/ovo-ne-postoji (global 404, any URL outside the shop routes). <title> is „Stranica nije pronađena · SKLOP“; every storefront page uses „ | SKLOP“ (/kontakt → „Kontakt | SKLOP“).
  2. Open http://localhost:3100/deo/ovaj-deo-ne-postoji-demo-9999 and http://localhost:3100/delovi/nepostojeca-kategorija. Both are HTTP 404 with <title> „SKLOP — Rasklopi auto. Nađi deo.“ (the home default), not a 404 title, because generateMetadata returns {} and app/(shop)/not-found.tsx has no metadata. Fix: give both not-found files metadata built with pageTitle(„Stranica nije pronađena“) and return it from both generateMetadata fallbacks.
  3. On either 404, the list „Često tražene kategorije“ shows „Zupčasti kaiš i vodena pumpa“ and „Turbina“, while the linked category H1s are „Set zupčastog kaiša i vodena pumpa“ and „Turbina (turbopunjač)“. Fix: read labels from lib/catalog/taxonomy.ts in components/shell/NotFoundContent.tsx.
  4. Open http://localhost:3100/dostava-i-placanje at 1440 or 390. The Plaćanje column joins the settings labels with „, “ and keeps each capital („…preuzimanju, Karticom pri preuzimanju, Virmanom…“). Fix: lower-case items after the first in app/(shop)/dostava-i-placanje/page.tsx:45 (or render them as a list), and optionally add „(odobreni majstori)“ to the deferred item; the body text below already states the restriction.
- **Expected:** One title suffix; 404 chips take labels from the taxonomy; list items lower-case after the first („gotovinom ili karticom pri preuzimanju, virmanom uz predračun, odloženo plaćanje (samo odobreni majstori)“).
- **Actual:** See steps.
- **Evidence:** [audit/copy/ev-dostava-table-1440.webp](audit/copy/ev-dostava-table-1440.webp) · [audit/copy/dump-anon1440.txt](audit/copy/dump-anon1440.txt)
- **Suggested fix:** app/not-found.tsx:9 (use pageTitle suffix), components/shell/NotFoundContent.tsx:9-14 (read labels from lib/catalog/taxonomy.ts), app/(shop)/dostava-i-placanje/page.tsx:45 (lower-case join + deferred note).
- **Verification:** reproduce → partially_confirmed (P3): I checked thi  in Chromium at 1440 and 390 a  an anonymou  vi itor ( cript /qa/audit/verify-copy-20.mj ), with raw title  confirmed by curl. The title- eparator claim i  real but the  cope „any 404“ i  wrong. Only the global 404 (/ovo-ne-po toji, app/not-found.t x through the root template „%  · SKLOP“) return  „Strani… [doc /qa/audit/verify/copy/copy-20-reproduce.txt, doc /qa/audit/verify/copy/copy-20-reproduce-1440.j on]
- _Reviewer key: copy-20_

#### BE-08

**Every signed-in page load forces a Convex Auth refresh (new JWT and rotated refresh token) although the JWT is valid for 1 h**

- **Severity:** P3 (reported P2, adjusted by verification) · **Area:** 9. Backend & reliability — Auth / backend load · **Status:** OPEN
- **Route:** Any page while signed in (tested /nalog, /delovi, /nalog/porudzbine, /korpa, /)
- **Context:** Chromium 1440×900, shared customer account, production build on :3100. Cookie values fingerprinted only (SHA-256 prefix).
- **Standard:** BRIEF §9 Reliability/Performance (no needless backend work per request), SECURITY §D1 (1 h JWT, refresh only near expiry)
- **Reproduction:**
  1. Run `node scripts/qa/audit/backend-session-refresh.mjs`: sign in, then 6 full page loads about 3 s apart.
  2. __convexAuthJWT changed on 5 of 6 loads and __convexAuthRefreshToken on 5 of 6 (session-refresh.json).
  3. Run `node scripts/qa/audit/backend-session-refresh-source.mjs`: each navigation issues a client fetch POST /api/auth that sets the new cookies (session-refresh-source.json).
  4. The Convex log stream 16:19:32–16:23:08 shows 44 `auth:store type: refreshSession` against 4 sign-ins (convex-logs-stream.txt).
- **Corrected reproduction (verifier):**
  1. Run node scripts/qa/audit/verify-backend-08-refresh.mjs. It signs in the customer from .playwright/audit-accounts.json on http://localhost:3100 at 1440×900 in Chromium.
  2. Phase A, full page loads of /delovi, /korpa, / and /nalog (3 s apart): each load sends one POST /api/auth with action auth:signIn and args {refreshToken}, and its response sets a new __convexAuthJWT (4 of 4).
  3. Phase B, clicking in-page links to /delovi, /nalog, /vozila and / (soft navigations): no POST /api/auth (0 of 4).
  4. Cause: the Convex client refetches the token right after the server confirms the SSR token (convex/src/browser/sync/authentication_manager.ts:213-220). Fix: new ConvexReactClient(url, { initialAuthTokenReuse: true }) in components/providers/ConvexClientProvider.tsx (experimental in convex 1.46, so pin it and cover it with an e2e test: at most one POST /api/auth across sign-in plus two reloads). Otherwise accept the behaviour and record it in DECISIONS.
- **Expected:** The server-provided JWT is reused. Refresh only happens in the last minute before the 1 h expiry (Convex Auth's own rule in the middleware).
- **Actual:** One extra /api/auth round trip plus an auth:signIn action and refresh-token write for every page view of every signed-in user (mechanics are the heaviest users). The refresh-token chain grows per page view, and parallel tabs are more likely to hit reuse races.
- **Evidence:** [audit/backend/session-refresh.json](audit/backend/session-refresh.json) · [audit/backend/session-refresh-source.json](audit/backend/session-refresh-source.json) · [audit/backend/convex-logs-stream.txt](audit/backend/convex-logs-stream.txt)
- **Suggested fix:** Find out why the client calls fetchAccessToken({forceRefreshToken:true}) on load. Turn on `verbose` for ConvexAuthNextjsProvider/ConvexReactClient in a debug build (components/providers/ConvexClientProvider.tsx:18-28). Check that the token from ConvexAuthNextjsServerProvider (app/layout.tsx:54) reaches the client, and that the backend accepts the initial JWT (an AuthError, e.g. issuer mismatch, forces a refresh). Add an e2e assertion: at most one /api/auth POST across two navigations.
- **Verification:** reproduce → partially_confirmed (P3): Reproduced with my own  cript: Chromium 1440,  hared cu tomer account, :3100. Full document load  (page.goto /delovi, /korpa, /, /nalog): 4 of 4 each  ent exactly one POST /api/auth {action:'auth: ignIn', arg :{refre hToken}}, and that re pon e  et a new __convexAuthJWT. Clo e variant, client- ide Link navigation (/del… [doc /qa/audit/verify/backend/backend-08-reproduce.j on ( ummary: apiAuthPo t DuringFullLoad  4 of 4, apiAuthPo t DuringClientNav  0 of 4; each full load: POST /…, doc /qa/audit/verify/backend/backend-08-reproduce-lib.txt (convex authentication_manager.t :38-51 and 213-222, client.t  initialAuthTokenReu e doc , @convex-dev…]
- _Reviewer key: backend-08_

#### BE-09

**Failed or dead outbox events are invisible to staff (no admin view, no alert)**

- **Severity:** P3 · **Area:** 9. Backend & reliability — Notifications / observability · **Status:** OPEN
- **Route:** /admin (dashboard), /admin/mejlovi (outbox)
- **Context:** Code review.
- **Standard:** BRIEF §5 Notifications (outbox → dispatcher → channels, staff instant notification), BRIEF §9 Reliability
- **Reproduction:**
  1. If processEvent throws (template or data bug), events.dispatch catches it and marks the event failed/dead after MAX_ATTEMPTS (convex/events.ts:551-579).
  2. No notificationDeliveries/emailLog rows are created in that case, so the e-mail outbox shows nothing.
  3. No staff query reads domainEvents by status: only events.sweep and automations use by_status_and_nextAttemptAt (code-greps.txt).
- **Expected:** Staff see stuck or dead events (count, last error, retry) and the owner gets an in-app alert. Otherwise a lost „nova porudžbina“ notification or customer e-mail goes unnoticed.
- **Actual:** Silent until someone reads Convex logs. Prod error capture is not set up yet (SECURITY-AUDIT §1, HUMAN-TODO §7).
- **Evidence:** [audit/backend/code-greps.txt](audit/backend/code-greps.txt) (section backend-09)
- **Suggested fix:** Add a staffQuery `events.health` (failed/dead counts via by_status_and_nextAttemptAt, take 100, latest lastError), a dashboard card, an owner notification when an event goes dead, and a staffMutation to retry (reset attempts, audited).
- **Verification:** reproduce → confirmed (P3): Confirmed in code and in the admin UI (owner, 1440). event .di patch (convex/event .t :552-579) catche  proce Event error  and mark  the event failed, or dead after MAX_ATTEMPTS. event . weep only pick  up pending and failed event ,  o dead one  are never retried. No other function read  domainEvent  by  tatu : the rea… [doc /qa/audit/verify/backend/backend-09-reproduce.txt (all domainEvent  reader , di patch catch block, no  taff reader of failed/dead, doc /NOTIFICATIONS.md:10 …, doc /qa/audit/verify/backend/backend-09-reproduce-da hboard.webp (owner /admin at 1440: no event-health indicator)]
- _Reviewer key: backend-09_

#### BE-10

**Dashboard KPIs and the 08:00 digest count stock states by reading up to 1 000 full product documents (silently capped)**

- **Severity:** P3 · **Area:** 9. Backend & reliability — Performance / scalability · **Status:** OPEN
- **Route:** /admin (dashboard:kpis, reactive), daily digest (lib/emailData)
- **Context:** Code review. Dev has 168 products, so there is no visible effect today.
- **Standard:** Convex guidelines (never count with collect/take length), BRIEF §5 Admin dashboard (low stock)
- **Reproduction:**
  1. dashboard:kpis reads products by_stockState_and_active for low_stock and out_of_stock with .take(1_000) each and returns .length (convex/dashboard.ts:101-112). The digest does the same (convex/lib/emailData.ts:385-391).
  2. After a real import (thousands of SKUs, many out of stock) the KPI stops at 1000 and every reactive update re-reads up to 2 000 product documents.
- **Expected:** Counts come from denormalized counters or @convex-dev/aggregate, kept in productWriter next to the existing category counters (adjustCounts), as the Convex guidelines require.
- **Actual:** Counting by scanning documents, silently capped.
- **Evidence:** [audit/backend/code-greps.txt](audit/backend/code-greps.txt) (section backend-10)
- **Suggested fix:** Maintain lowStock/outOfStock counters in lib/productWriter when stockState changes (same transaction), or mount @convex-dev/aggregate keyed by stockState. Read the counters in dashboard:kpis and the digest.
- **Verification:** reproduce → confirmed (P3): Confirmed in code. da hboard:kpi  (convex/da hboard.t :101-112) read  product  through by_ tockState_and_active for low_ tock and out_of_ tock with .take(1_000) each and return  .length. Da hboard.t x:147-156 render  the number a  'Bez zaliha N / još M  a malo zaliha' with no '1000+' marker,  o the cap i   ilent. The d… [doc /qa/audit/verify/backend/backend-10-reproduce.txt (da hboard.t :100-113, emailData.t :380-392, Da hboard.t x KPI render, productWriter adju tCount , Convex …, doc /qa/audit/verify/backend/backend-09-reproduce-da hboard.webp (the 'Bez zaliha 15 / još 28  a malo zaliha' KPI fed by kpi .outOfStock / kpi .lowStock)]
- _Reviewer key: backend-10_

#### BE-11

**A rejected or fraudulent mechanic registration blocks the real company's PIB forever**

- **Severity:** P3 · **Area:** 9. Backend & reliability — Mechanics registration · **Status:** OPEN
- **Route:** /za-majstore (mechanics:register)
- **Context:** Code review.
- **Standard:** BRIEF §5 Mechanics (registration → pending → approve/reject)
- **Reproduction:**
  1. Someone registers a mechanic profile with a real workshop's public PIB/MB (both are in the APR registry).
  2. Staff reject it (status rejected).
  3. The real workshop tries to register: `pibTaken` matches any profile regardless of status (convex/mechanics.ts:64-71), so it gets DUPLICATE „Ovaj PIB je već registrovan…“.
- **Corrected reproduction (verifier):**
  1. node node_modules/convex/bin/main.js run testing:createPendingMechanic '{"tag":"x1","pib":"<valid PIB>","mb":"<valid MB>"}' → profileId
  2. Sign in as the owner, open /admin/majstori/<profileId>, enter a reason and click 'Odbij registraciju'. Status becomes Odbijen; the only action offered is 'Vrati na čekanje'.
  3. In a fresh signed-out context, open /za-majstore/registracija. Fill in a new e-mail/password, another firm name, the same PIB, a different valid MB and the other required fields, then submit.
  4. Actual: the account is created and the user is signed in, then the registration fails with 'Ovaj PIB je već registrovan — prijavite se ili nas pozovite.' Staff have no tool to release or reassign the PIB, and no event is emitted.
  5. Suggested fix: in mechanics.register, skip profiles with status 'rejected' in the pibTaken check, or add an owner-only staff action 'Oslobodi PIB' / 'Izmeni podatke firme' (pib, mb, companyName) with audit(). On a DUPLICATE attempt, record a staff notification outside the failing transaction (e.g. return a structured result instead of throwing, or schedule the notification from the client error path).
- **Expected:** Rejected profiles do not reserve the PIB, or staff can release it. Staff are told about the duplicate attempt.
- **Actual:** Permanent block. The only workaround is a phone call and a manual data fix.
- **Evidence:** [audit/backend/code-greps.txt](audit/backend/code-greps.txt) (section backend-11)
- **Suggested fix:** Ignore profiles with status rejected in the uniqueness check (or re-open the rejected profile for the new account after staff review), and emit a staff notification on DUPLICATE PIB attempts.
- **Verification:** reproduce → confirmed (P3): Reproduced live on the dev deployment ( cript  cript /qa/audit/verify-backend-11-12.mj ). I created a pending te t mechanic with PIB 286870265 u ing te ting:createPendingMechanic, then rejected it a  the owner in /admin/maj tori/<id> with the rea on 'PIB pripada drugoj firmi (APR).' The probe returned  tatu  'rejected'… [doc /qa/audit/verify/backend/backend-11-reproduce-admin-rejected.webp (rejected profile, PIB 286870265; the only action i  'Vrati na čekanje'), doc /qa/audit/verify/backend/backend-11-reproduce-duplicate-pib.webp (/za-maj tore/regi tracija,  ame PIB, different MB: 'Ovaj PIB je već regi trovan — prijavit…]
- _Reviewer key: backend-11_

#### BE-12

**The password rule „not equal to the e-mail“ from SECURITY §D1 is not enforced**

- **Severity:** P3 · **Area:** 9. Backend & reliability — Auth · **Status:** OPEN
- **Route:** /registracija and the reset flow (Convex Auth Password provider)
- **Context:** Code review.
- **Standard:** docs/SECURITY.md §D1
- **Reproduction:**
  1. validatePassword (convex/auth.ts:19-32) checks only ≥ 10 characters and at least one letter and one digit.
  2. Sign up as e.g. marko2024@primer.rs with the password „marko2024@primer.rs“: it passes both rules and is accepted. No client-side zod rule compares them either.
- **Corrected reproduction (verifier):**
  1. Open /registracija (signed out), enter a name, e-mail X = 'marko2024-<n>@primer.rs' and password = X, accept the terms, click 'Napravi nalog'. Actual: the account is created and the user lands on /nalog. Expected: the WEAK_PASSWORD error 'Lozinka ne sme biti ista kao e-mail adresa.'
  2. Same result on /za-majstore/registracija (signed out, the account e-mail + lozinka fields). By code, the same gap exists on the reset-verification step of the password reset.
  3. Fix: in convex/auth.ts Password profile(params), when params.flow is 'signUp' (params.password) or 'reset-verification' (params.newPassword), throw ConvexError WEAK_PASSWORD if normalizeEmail(password) === the normalized e-mail. Add the same rule to passwordError (components/auth/AuthForms.tsx), which needs the e-mail value, and to passwordProblem (lib/validation/mechanicRegistration.ts). Add a convex-test case.
- **Expected:** Per SECURITY §D1 the password is rejected when it equals the e-mail.
- **Actual:** Accepted.
- **Evidence:** [audit/backend/code-greps.txt](audit/backend/code-greps.txt) (section backend-12)
- **Suggested fix:** Validate in the Password provider's `profile(params)` (where both e-mail and password are available). Throw WEAK_PASSWORD „Lozinka ne sme biti ista kao e-mail adresa.“ when normalizeEmail(password) === email. Mirror the rule in the sign-up zod schema.
- **Verification:** reproduce → confirmed (P3): Reproduced live on two  ign-up route . (1) /regi tracija at 1440: e-mail 'marko2024-8687026@primer.r ' with the identical  tring a  the pa word. It wa  accepted and landed on /nalog ('Prijavljeni  te kao marko2024-8687026@primer.r '). (2) Variant: the  igned-out account creation on /za-maj tore/regi tracija accepted e-… [doc /qa/audit/verify/backend/backend-12-reproduce- ignup-form.webp (/regi tracija filled with marko2024-8687026@primer.r  a  both e-mail and pa word), doc /qa/audit/verify/backend/backend-12-reproduce- ignup-accepted.webp (/nalog, 'Prijavljeni  te kao marko2024-8687026@primer.r ')]
- _Reviewer key: backend-12_

## Appendix A — reported but not confirmed

Kept for transparency; step 22 does not need to act on these.

| Reviewer key | Reported | Title | Outcome |
|---|---|---|---|
| perf-lh-09 | P2 | Simulated (Lantern) mobile LCP is 3.9–4.6 s on every template; the evidence shows it is a localhost/headless artefact, not the real LCP | rejected: perf: refuted — The number  reproduce, but thi  i  the documented localho t artefact (D112, WEB-QA §2.2), not a product defect; the finding it elf conclude  the  ame. Simulated LCP: home 4383 m  (4377–4521), product 4236 (4226–4272), with  imulated FCP 1.06–1.36  . Ob erved FCP = LCP = 141–271 m , ob erved load 150–196 m  (before the fir t frame), and 24 of 25  cript  (347–352 KB) fini h before the ob erved LCP,  o L… |
| perf-bundle-10 | P3 | Normal maps are lossless WebP: tex_cast_n is 356 KB in the phone GLB (≈ 22 % of its gzip transfer) | rejected: reproduce: refuted — The number  hold, but the choice i  intentional and documented. I par ed both GLB  by hand, without gltf-tran form. Every embedded image i  RIFF/VP8L. tex_ca t_n i  512² and 364,514 B in both GLB , and it i  the normal map of mat_ca t_iron and mat_ca t_alu. In car-lite.glb the image  total 440,678 B; the file i  2,628,980 B raw and 1,687,209 B gzip,  o tex_ca t_n i  about 21.6 % of the gzip tran … |
| perf-3d-04 | P2 | Tapping a part on a phone takes 184–288 ms to respond at 4× CPU (plain raycast with no BVH inside pointerup) | rejected: perf: not_reproducible — verify-perf-3d-interact.mj  --vp mobile --cpu 4 --gpu --run  3, on a quiet machine. Event Timing duration: hauba 120/152/120 m , akumulator 152/136/136 m , u i na grana 88/112/80 m . That i  0 of 9 part tap  over 200 m , again t the finder'  224–288 m . pointerup proce ing (the rayca t without a BVH) i  43–112 m : a real co t, but within the good INP thre hold. The finder'  number  were likel… |
| seo-05 | P2 | Vehicle pages link to ~2,000 vehicle-filtered category URLs that are indexable but canonical to the generic category instead of the model landing | rejected: reproduce: refuted — The raw fact  hold only in part, and the defect claim  do not hold. I found all 56 generation page  through the brand and model page  (46 in vozila.xml, 10 noindex). Their category tile  link to 1,109 unique generation-filtered category URL , not 1,964. Only 82 of tho e, not 185, have an indexable model-landing twin. The parameter URL  return 200 with „index, follow“ and a canonical to the bare c… |
| seo-16 | P3 | Platform-twin vehicle pages and landings are near-duplicates (up to 93 % identical) | rejected: reproduce: refuted — The number  reproduce with my own  cript. /vozila/ eat/ateca/ateca v  /vozila/cupra/ateca/cupra-ateca: 5- hingle Jaccard 0.93, 3- hingle 0.94, 8/8  hared product link ; the only different word  are the brand and the  tart year. /delovi/kocione-plocice/ eat/ateca v  cupra/ateca: 0.69 with 6/6  hared product . All four page  are index,follow with  elf-canonical  and no cro -link . Other MQB pair : … |

## Appendix B — coverage per reviewer

### perf-lh — Performance — Lighthouse lab per template

Skills invoked: gsap-performance. Reviewer score: 4/10 — Desktop is excellent: perf 98–99, LCP 0.87–1.0 s, TBT 0 on every template. Accessibility and SEO are 100 on indexable pages. On mobile, the BRIEF §9 bar is missed in lab conditions: TBT is 246–1019 ms on every template against a 200 ms budget, performance is 73–83 on catalog and product against 90, LCP sits at the 2.5 s line on home and product, and CLS is 0.08–0.10 on the vehicle generation page. The causes are identifiable: shell hydration, per-card client islands, the per-word GSAP text reveal, globally loaded GSAP plugins, font preloads on the critical path, zod on forms, and the mono font swap. The simulated 4.2 s LCP is shown to be a Lantern/localhost artefact.

- **/ (home)** — Mobile applied throttling: 5 valid runs plus excluded contended and errored runs. Mobile simulated: 3 runs. LCP element and phases, fonts, scripts, long tasks, bootup. Failsafe race test (2 rounds). Desktop preset not run: the runner dropped '/' after --desktop, and the fill pass for it was still queued when time ran out.
- **/delovi/kocioni-diskovi (category)** — Mobile applied: 3 valid runs. Mobile simulated: 3. Desktop: 3. Trace attribution (4× CPU). Failsafe test (2 rounds). CSP check. Style-cost A/B (inconclusive).
- **/deo/kocioni-disk-prednji-276-24-mm-demo-0004 (product)** — Mobile applied: 2 valid runs (plus contended and errored ones excluded). Mobile simulated: 3. Desktop: 3. Trace attribution. Failsafe test.
- **/delovi, /pretraga?q=disk, /vozila/volkswagen/golf/golf-7, /delovi/kocioni-diskovi/volkswagen/golf, /za-majstore, /upit** — Mobile applied ×1 and mobile simulated ×1–4. Desktop ×1, except /delovi, which the runner bug dropped. Golf 7 CLS reproduced in Playwright under slow 4G with layout-shift sources and screenshots. /upit and /za-majstore/registracija CSP violations recorded.
- **/ponuda/kocione-plocice-golf, /kontakt** — Desktop ×1. Mobile applied ×1 each, but both runs were contended (bench 1733 and 2731), so they are reported only as indicative. Simulated runs were lost to the runner crash, and the fill pass was still queued.
- **Attribution audits** — network-requests (critical path and font/CSS timing), resource-summary, script-treemap-data (inline RSC), unused-javascript, bootup-time, long-tasks, mainthread-work-breakdown, lcp-breakdown-insight, layout-shifts / cls-culprits-insight, server-response-time. Chunk contents were identified by Grep of .next/static/chunks.
- **gsap-performance checklist** — Checked lib/gsap/client.ts (global plugin registration), components/TextRevealGlobal.tsx (per-word filter and will-change tweens, observer start), ScrollTriggerRefresher and refresh.ts (refresh is coalesced; the load refresh measured cheap), ConsentBanner and Sheet usage.

Not covered:
- The machine was heavily shared during the run: Lighthouse benchmarkIndex was 790–4103 (baseline ≈ 4000). Applied-throttling runs below 3000 were excluded, but the absolute TBT values of the kept runs are likely inflated. The conclusions rely on medians plus the step 19 uncontended runs of the same build.
- The fill pass (scripts/qa/audit/perf-lh-fillall.mjs) was still running when time ran out. Missing: the planned 2 extra applied-throttling runs for each secondary template, simulated runs for /upit, /ponuda and /kontakt, desktop runs for / and /delovi, and a third valid applied run for product. /ponuda and /kontakt mobile applied numbers come from contended single runs.
- The style-cost A/B experiment (scripts/qa/audit/perf-lh-stylecost.mjs) is inconclusive: the HTML rewrite did not strip the reveal stylesheet (attribute order), and the noise was too high. It is kept in docs/qa/audit/perf-lh/stylecost.json for transparency only.
- No PageSpeed Insights or field data (CrUX/INP): there is no deployment. INP was not measured.
- Third-party tags (GA4, Ads, Meta) are not configured, so the post-consent JS weight is unmeasured.
- Signed-in views were not measured: the mechanic portal, where the live overlay subscribes at hydration (D133), and admin.
- The 3D-loaded state of home was not measured (perf-3d track).
- Chunk sizes were taken from Lighthouse transfer sizes. They were not re-measured with gzip from .next: a Bash-based measurement was blocked by the environment's permission classifier.
- Of the eight reference widths, only Lighthouse's 412 mobile and 1350 desktop presets and 390/1440 captures were used.

### perf-bundle — Performance — static bundle and asset analysis

Skills invoked: gsap-performance. Reviewer score: 6/10 — The 3D architecture is disciplined: nothing from three.js is in any first load, the canvas chunk is 282 KB gzip against a 350 KB budget, both GLBs are well under budget with meshopt, and Draggable/Inertia really are lazy. Static assets under /_next are immutable and the CSS is one lean 18.5 KB file. The shared shell still costs 309–334 KB gzip of module JS on every catalog page, and about 80 KB of it can be deferred through a handful of independent root causes: a global Tooltip provider pulling in floating-ui, globally registered GSAP scroll plugins, eager overlays, toasts and consent code, six-weight icons, duplicated modules, and a root 404 that drags shop-header JS into the ads landing. The checkout and VIN-inquiry pages add another 101 KB gzip because of a single zod import pattern. On top of that, public/ media is not cached and the font preloads miss the landing and category H1 face.

- **12 perf templates (/, /delovi, /delovi/kocioni-diskovi, product, /pretraga?q=disk, /vozila/volkswagen/golf/golf-7, /ponuda/kocione-plocice-golf, /za-majstore, /upit, /korpa, /porudzbina, /prijava)** — HTML fetched sequentially from :3100 with gzip/br; every script/stylesheet/font/image preload and Link header listed; raw/gzip-6/brotli-11 sizes from .next/static; HTML wire vs raw and inline RSC bytes (templates.json, templates-table.md)
- **.next/static/chunks (151 JS chunks)** — Library signature scan (react-dom, router, convex, convex auth, gsap core/plugins, Draggable/Inertia, radix primitives, zod, RHF, zustand, three/R3F/meshopt/BVH, TanStack, SheetJS, Phosphor, analytics); Turbopack module split of home and landing first-load chunks and 3D chunks; duplicate modules per template and build-wide; chunk → Next entry attribution from client reference manifests
- **Home runtime (Chromium 390 touch and 1440 fine pointer)** — All requests during load + 10–12 s idle, JS coverage (55 % unused), CSS coverage at load and after scroll-through (87 % used), fonts loaded vs painted, images natural vs rendered, render-blocking resources
- **Category, product, ads landing at 390** — Requests after load (prefetches, lazy chunks), images, fonts; first-viewport font faces also for /korpa and /prijava; DPR 3 thumbnail candidate selection on category/search/landing
- **3D assets** — car.glb / car-lite.glb sizes (raw/gzip/br), extensions, meshes, primitives, triangles, materials, texture encodings; HDR, manifest, shadows; 3D chunk size vs 350 KB budget; confirmation that nothing 3D is in the first load and BVH is fine-pointer lazy
- **Caching and compression** — curl headers for /_next/static JS/CSS/fonts, /_next/image, HTML, /images, /models, icons, manifest, robots, sitemap
- **Forms pages script cost** — /upit, /porudzbina vs /korpa, /prijava at 4x CPU, 3 runs (noisy on the shared machine — only heap deltas cited)
- **GSAP (gsap-performance checklist, static)** — Tweened properties, will-change usage, stagger, refresh coalescing, plugin registration and bundle cost
- **RSC payload** — Decoded inline flight rows for korpa/home/generation/product; duplicate rows; shell landmarks counted in RSC vs HTML

Not covered:
- Lighthouse scores, lab LCP/TBT/CLS and filmstrips (owned by perf-lh on :3200); no timing claims made beyond noisy indicative script durations
- Admin panel, account and mechanic portal bundles (outside the perf template list)
- Firefox and WebKit (static bundle analysis is engine-independent; runtime inventory only in Chromium)
- Real-device CPU/GPU cost of the 3D start and of the blur-based text reveal (runtime/motion tracks)
- Verifying proposed fixes in a rebuilt bundle (no rebuild allowed) — notably whether Turbopack tree-shakes `import * as z from "zod"` as well as esbuild does
- Brotli/HTTP2 behaviour and cache headers on the future Vercel deployment (local next start only)
- Convex websocket timing and INP

### perf-3d — Performance — 3D runtime on a throttled profile

Skills invoked: threejs-interaction, gsap-performance. Reviewer score: 6/10 — The steady state is well engineered: nothing 3D loads before intent, the demand frameloop draws 0 frames idle or off-screen, GPU resources are released on unmount, a fast desktop holds a perfect 60 fps, and a 4× phone scrolls the explode smoothly. The award bar breaks at the moment that matters most. The first touch, scroll or hover freezes the main thread for 0.3–0.9 s (a synchronous PMREM shader compile, 336–457 ms even unthrottled), and tapping a part on a phone takes 184–288 ms to respond. Each home visit leaks a renderer, a canvas and the detached home DOM. The 4× desktop smoothness that WEB-QA records as passed misses its bar in 5 of 6 runs. Software-GL browsers get the full high tier at about 1 s per frame.

- **/ desktop 1440×900 high tier (ANGLE D3D11, RTX 4060)** — Scroll through the whole explode (60 wheel steps): 1× ×3, 4× ×3 instrumented, 4× ×3 with the original hero-frames.mjs, DPR 2 at 4× ×3. Start timeline intent → first draw → ready, long tasks, CPU profiles (4× ×2, cold 1× on 3 fresh browsers). Scroll CPU profile at 4×. Draw calls, triangles and GPU-memory estimate per frame. Hover sweep, and click with Event Timing and LoAF, ×3. Idle frames (0 draws) and off-screen frames (0 draws).
- **/ desktop SwiftShader (software GL floor)** — 4× ×3 and 1× ×2 through the whole explode; tier classification checked.
- **/ mobile 390×844 DPR 3 touch, mid tier** — What loads before intent (nothing 3D) and after intent (car-lite.glb, HDR, shadows, chunks). Frames at 4× ×3 (tap intent) and 6× ×3. Cold first scroll as the intent at 4× ×3. Start CPU profile at 4×. Tap-to-select INP ×3 runs × 5 tap points. Adaptive DPR ×3 with device-pixel crops of poster vs canvas.
- **/ ↔ /delovi client-side navigation (memory)** — 5 cycles instrumented + 4 cycles bare control, with forced GC. JS heap, DOM nodes, listeners, workers, WebGL contexts created / reachable (WeakRef) / live, GPU estimate. Heap snapshot with retaining paths of old canvases. Runtime.getHeapUsage backing storage.
- **3D assets and headers** — car.glb, car-lite.glb and studio-512.hdr: content-encoding, cache-control, sizes. KHR_parallel_shader_compile and timer-query availability on ANGLE D3D11.
- **Code review (checklists from threejs-interaction and gsap-performance)** — HeroCanvas.tsx (frameloop, adaptive DPR, dispose, context loss), loadCar.ts (PMREM, workers, dispose), enhance.ts and idle.ts (BVH, edges, idle slices), controller.ts (explode timeline, pick, anchor), usePointerPicking.ts (rAF-coalesced hover, tap raycast), HeroStage.tsx (intent/idle start, ScrollTrigger scrub proxy, IntersectionObserver, crossfade), StageStrip (transform-only writes), tier.ts, assets.ts (module-level GLB cache).

Not covered:
- Real devices: no iOS Safari (Metal), no Android GPU drivers, no real mid-range phone. Mobile numbers are Chromium emulation on a Windows desktop GPU, so the PMREM compile time on phones depends on the driver.
- Integrated-GPU desktop (Intel UHD as in WEB-QA step 10). ANGLE picked the discrete RTX 4060 here, so GPU-bound costs (MSAA at DPR 2, fill rate) are optimistic.
- GPU time per pass (DESIGN-SYSTEM §7.2: X-ray pass ≤ 1.5 ms on the mid tier). EXT_disjoint_timer_query_webgl2 is available but was not used.
- Network-throttled intent → ready. Everything ran against localhost; on real 4G the 2.6 MB lite GLB, 0.4 MB HDR and 0.3 MB JS add several seconds.
- Firefox and WebKit 3D runtime.
- Memory leak cycles on the mobile tier; sessions longer than 5 cycles; context-loss restore path; deep-link /?deo= start cost; reduced-motion and low-tier runtime cost.
- Hover-sweep hitches of 115–207 ms per frame in one of three desktop runs. Not reproduced, so not reported.
- The adaptive DPR ended at 1.0–1.5 on a 3× phone depending on the run. Not reproducible 3× at the same value; recorded in 3d.md only.

### seo — SEO — crawl of the local production build

Skills invoked: seo-audit, seo-technical. Reviewer score: 6.5/10 — Solid technical SEO: server HTML matches the rendered DOM, and robots, sitemaps and canonical rules follow ROUTES almost everywhere. JSON-LD is valid and matches the visible content, and the landing guard works exactly as specified. The track falls short of the BRIEF §9 bar because of one highly visible bug and several structural issues. A regex typo removes every „s“ from 55 % of product titles (P1). There are also indexable duplicates from out-of-range pagination, truncated or boilerplate category metadata, ~2,000 vehicle-filtered URLs that bypass the landings, 38 thin indexable hubs, an orphaned contact page, and product slug renames that 404 despite the admin's promise.

- **Full crawl of the local build (http://localhost:3100)** — 962 URLs: every URL of /sitemap.xml plus internal-link BFS from home, navigation and footer; max 2 concurrent requests; query URLs capped at 150. Checked per URL: status, redirect chain, X-Robots-Tag, robots meta, canonical (count and self), title and description (length, uniqueness), H1 count, heading hierarchy, lang, viewport, OG/Twitter tags, JSON-LD parse, image alt, HTML weight, inlinks, click depth. All 962 returned 200; 0 redirects in internal links; 0 broken internal links; no rel=nofollow; no external links. Evidence: docs/qa/audit/seo/crawl.json and crawl.csv.
- **robots.txt and sitemaps (/sitemap.xml + staticne, kategorije, vozila, landing, proizvodi-1)** — XML well-formedness, namespaces, URL counts (12/58/72/50/157 = 349), lastmod coverage, X-Robots-Tag on the XML, every sitemap URL 200/indexable/self-canonical, noindex URLs absent (0), indexable URLs missing (0). Robots directives compared with ROUTES §B4 and D200.
- **Structured data** — JSON-LD parsed on 955 pages with 0 parse errors. Product/Offer on all 157 products vs visible H1, price, stock badge and breadcrumb (all match). BreadcrumbList vs visible nav on all 349 indexable pages (all match; /upit has none). 1,960 ItemList entries resolve and are linked. FAQPage on 499 pages vs visible questions. WebSite+SearchAction and the Organization fallback (no address in settings: owner item) on / and /kontakt.
- **Canonical, facets, pagination, 404, redirects** — About 45-URL battery: 1-dimension filters (marka, marka+model → landing canonical, kvalitet, proizvodjac, cena, dostupnost), 2 dimensions, sort, unknown values, ?strana=1/2/99/500/abc, landing ?generacija / ?strana / utm, vehicle ?motor, trailing slash (308), uppercase variants, unknown product/category/brand/model/generation (404 + noindex), /lab/koncept 308, retired product (200 noindex), token pages (/porudzbina/*, /upit/*: noindex + no-referrer), auth pages, /styleguide, admin (signed in as owner).
- **Server HTML vs rendered DOM** — 12 templates (home, category, system hub, landing brand/model, product in and out of stock, vehicle generation/model, za-majstore, upit, kontakt) in Chromium at 1440 with JS off vs on: title, canonical, robots, H1, JSON-LD count, link set and word count identical on all 12. No-JS screenshots at 390 and 1440 (home, product, category, landing). 404 pages with and without JS at 390.
- **OG images and social tags** — og:image fetched for 13 pages across all templates: all 200 image/png 1200×630, 81–128 KB. og:url equals canonical on all 962; twitter:card summary_large_image on all 962. Visual review of the product, landing and system-hub images; glyph crop.
- **Content quality / thin and duplicate** — Word count of <main> (breadcrumbs excluded) for all 349 indexable URLs. 5-word shingle similarity across indexable landing and vehicle pages, with full-text re-checks on 4 pairs. Landing guard thresholds verified (brand ≥ 8, model ≥ 6; 50 indexable of 497). Title and description templates reviewed for all templates.
- **Feeds** — /feeds/google-merchant.xml (empty by default, D190) and ?demo=1 (157 items): XML validity, required g: fields, duplicate IDs, availability, shipping vs the free-shipping threshold, google_product_category, image size (768×768 WebP). /feeds/meta-catalog.csv and ?demo=1: RFC 4180 column consistency, availability values.
- **Internal linking** — Inlink counts, orphans (/kontakt), click depth from home (sitemap URLs at depth ≤ 3 except /kontakt), links from indexable pages to noindex landings (580), vehicle-filtered parameter URLs (1,964) and ?motor URLs (373), product → landing links (30 of 157 have landing twins).

Not covered:
- Lighthouse SEO category scores (owned by the performance track; not run).
- Google's own validators (Rich Results Test, Search Console URL inspection, Merchant Center diagnostics): the audit is local-only. JSON-LD was validated structurally against the SEO-ADS §J2 contract and Google's documented required/recommended properties.
- Runtime demonstration of the slug-rename redirect (seo-08): it would require editing a catalogue product. The evidence is code plus the empty redirects table.
- Curated search pages (settings.seo.curatedSearches is empty) and ads landings marked indexable: both would require changing admin settings.
- Only 150 of the ~2,340 parameter URLs (vehicle-filtered categories, ?motor, landing ?generacija) were fetched; the rest were counted from links.
- Image sitemap / image:image and /slike/deo/* descriptive photo URLs: no product has a photo yet (owner item), so they cannot be exercised.
- Firefox and WebKit: the SEO checks are engine-independent; the render comparison used Chromium only.
- The post-demo-removal state (sitemaps and feeds after „Obriši demo podatke“): destructive, not run.
- IndexNow / Bing Webmaster (not in the BRIEF), backlinks and live SERP data (no external services allowed).

### copy — Copy — Serbian language, tone and formats

Skills invoked: impeccable. Reviewer score: 7/10 — The Serbian copy is well above average: ekavian throughout, correct diacritics in every rendered string, „…“ quotes, en-dash ranges, × for dimensions, no-break spaces in formatted prices and phones, calm mechanic voice with no exclamation marks, emojis, lorem or visible TODO, and the storefront validation copy mostly follows DESIGN-SYSTEM §11. The defects are in generated and fallback text rather than hand-written copy. A regex bug removes every „s“ from 73 product titles. Brand names are not declined on 65 SEO pages. The site states a 14:00 dispatch cut-off that was invented. The home FAQ contradicts the legal withdrawal rules. Several sentences point customers to phone, Viber, e-mail or seller data that the site does not show while company settings are empty. The 403 page is Next's English default. Terminology (e-pošta/e-mail, artikli/proizvodi) is not enforced.

- **All sitemap URLs (349: static, 58 categories/systems, 72 vehicle hubs, 50 landings, 157 products)** — No-JS SSR crawl at 1440 (docs/qa/audit/copy/crawl-sitemap.json): visible text, aria-label/placeholder/title/alt, <title>, meta description, og:title/description, H1; automated rule scan (copy-analyze.mjs) for English UI words, ijekavian stems, ASCII spellings of diacritic words, Cyrillic, straight quotes, three dots, hyphen ranges, x-dimensions, exclamation marks, emoji, TODO/lorem, RSD format, dates/times, Title Case
- **Key storefront templates with JS (45 URLs incl. home, catalog, landings, product in/out of stock, vehicles, search hit/zero/empty, cart, checkout, inquiry, za-majstore, auth, legal/static, ads landing, order status/thanks/predračun, quote page, 404s, unsubscribe, pagination/filter variants)** — Chromium 1440 with scroll-through (crawl-anon1440.json, dump-anon1440.txt), home section-by-section textContent (text-home-1440.txt); 7 templates re-crawled at 390 for mobile-only strings (crawl-anon390.json)
- **Interactive states** — Cookie banner + settings dialog (1440/390), mobile menu (390), vehicle picker dialog, 3D parts list + category panel (1440/390), back-in-stock error, cart with item, checkout all 4 steps incl. empty/invalid/company/courier/postal/terms errors, inquiry empty + invalid VIN, sign-in wrong password, sign-up empty/invalid, password reset, mechanic registration empty/invalid PIB (states-*.json + screenshots)
- **Customer account and mechanic portal** — Signed in: /nalog (+porudzbine, upiti, vozila, profil), /majstor (+brza-porudzbina, porudzbine, omiljeno, vozila, cenovnik, upiti, profil), product/category/cart with mechanic prices (crawl-customer.json, crawl-mechanic.json)
- **Admin panel (owner)** — 38 screens read-only: dashboard, orders list/detail/predračun/otpremnica, inquiries list/details, products list/new/detail, categories, vehicles, manufacturers, stock, customers, mechanics, tiers, import wizard/history/detail, export, searches, sources, e-mail outbox + template gallery, notifications, users, audit, privacy, all 10 settings tabs (crawl-admin.json, dump-admin.txt)
- **Transactional e-mails** — All 25 templates (customer + staff) in plain-text view from the admin gallery with current settings (emails-text.txt) + source review of lib/email/templates/*.ts and lib/email/context.ts
- **OG images** — Default, product, category and landing OG images rendered and inspected (og-*.webp)
- **Source** — TypeScript-AST scan of 557 files (app, components, lib, convex, constants, config) for JSX text, copy attributes and literals (source-scan.txt); manual review of lib/i18n/sr/*, lib/validation/*, Convex user-facing error messages (fail/invalid/notFound), seeded content pages and FAQ (convex/seedData/content.ts)
- **Access-denied and route-handler texts** — Guest on /admin, /majstor, /nalog; signed-in customer on /admin, /admin/porudzbine, /majstor at 1440 and 390; curl of /slike/deo, /sitemaps, /feeds 404 bodies

Not covered:
- Firefox/WebKit (copy is engine-independent; not re-run)
- Toast texts after add-to-cart/copy OEM were not captured on screen (source strings reviewed only: PANEL_COPY.addedToast, DS §11.5)
- Quote accept/decline, order submit success and mechanic quick-order results with real codes were not executed end-to-end to avoid creating/altering records (their confirmation pages were read on existing tokens; quick-order strings reviewed in source)
- Admin dialogs, toasts and destructive-action confirmations (status change, cancel, rollback, demo removal, anonymization) were not opened
- Import wizard steps after file upload, import error-report XLSX, product/orders/customers CSV/XLSX headers and the mechanic price-list XLSX contents
- E-mail HTML rendering in real clients and the print (Ctrl+P) versions of predračun/otpremnica — screen text only
- Network/offline error, rate-limit and server-error messages were reviewed in source (lib/i18n/sr/shop.ts, convex errors) but not triggered live
- 3D hover tooltips/callout copy per part beyond the category panel and the part notes list

### backend — Backend — quality gates, authorization, data integrity, logged errors

Skills invoked: convex-reviewer. Reviewer score: 6.5/10 — Authorization is solid: every one of the 230 public functions uses the builders, and live probes found 0 violations across 81 protected queries × 3 roles. There are no price or PII leaks in public payloads, SSR HTML or feeds, and dev data reconciles perfectly (orders, numbering, stock ledger). But two business and security controls fail in reproducible ways: quote acceptance bypasses the mechanic credit limit and terms, and every per-visitor rate limit is defeated by changing the User-Agent. Consent proof is client-forgeable, payloads are unbounded, and the Vitest gate is load-sensitive. That misses BRIEF §9 Security/Reliability as written.

- **Quality gates** — npx tsc --noEmit (exit 0, 4 m 52 s on the shared machine); npm run lint (0 errors; 2 warnings, both in another reviewer's scripts/qa/audit/seo-crawl.mjs, not app code); node 3d/scripts/validate.mjs (PASS, 16 warnings: triangle target, packaging intersections, small click targets); npx vitest run --maxWorkers=2 (1090 passed / 2 timed out / 4 skipped, then the two files re-run 2× green → backend-05).
- **Convex function surface (static)** — TypeScript-AST scan of 52 files and 298 exported functions (227 SKLOP builders, 71 internal). Zero raw query/mutation/action exports; every function has args and returns validators; no .collect(); no scheduling to api.*; v.any() only in the importChanges schema. The deployed `convex function-spec` matches the source exactly (230 public = 227 + 3 Convex Auth; 75 internal incl. auth:store). Wall-clock reads only in R07-accepted queries. Post-index .filter() only in R06-accepted staff lists.
- **Authorization (live, dev deployment)** — Owner, customer and mechanic signed in through the Convex Auth password flow (tokens kept in memory). All 81 staff/owner/user queries were called as anonymous, customer and mechanic with args proven valid by an owner call: 0 violations, 81/81 conclusive. myOrder for a foreign order (customer and mechanic) → null. Wrong or short tokens on orders:getByToken, inquiries:getByToken → null; staff:inviteInfo → status invalid. pricing:forProducts: anonymous and customer yourPricePara null, mechanic 11.467 RSD. All 40 public queries scanned anonymously for cost/margin/token/PII keys: only settings:getPublic company address (public data).
- **SSR / route handlers (anonymous curl, :3100)** — /deo/kocioni-disk-prednji-276-24-mm-demo-0004, /delovi/kocioni-diskovi, /delovi/kocioni-diskovi/volkswagen/golf, /pretraga?q=5Q0615505R, /ponuda/kocione-plocice-golf, / grepped for the mechanic price (1146700 / 11.467), costNet, marginBp, personalRules, token hashes: none. Feeds (/feeds/google-merchant.xml, /feeds/meta-catalog.csv, /sitemap.xml) have no cost fields. Admin/mechanic route handlers (/admin/izvoz/*, /admin/uvoz/sablon, /admin/porudzbine/SK-2026-000092/predracun, /majstor/cenovnik/preuzmi) redirect anonymous callers to /prijava; /api/revalidate GET 405. catalog-cache is anonymous-only.
- **Business-rule reproductions (live)** — Quote → deferred order credit bypass (UP-2026-000059 → SK-2026-000100, cancelled afterwards). Consent/attribution forgery (UP-2026-000060, closed afterwards). User-Agent rate-limit bypass with generateUploadUrl (no records). Session refresh per page load (Playwright Chromium 1440).
- **Data integrity (dev data via owner staff queries)** — 99/99 orders: Σ lines = itemsPara, line = unit×qty, unit ≤ retail, discount = retail − items, items + delivery = total, VAT formula, itemCount, list = detail totals, delivery price vs the current free-over rule. All consistent. SK-2026 numbering 1–99 with no gaps or duplicates (100 after my test); UP-2026 1–58 with no gaps. 143 stock movements across 114 products: arithmetic, chain continuity and last qtyAfter = product stock all reconcile; no product with stock but without movements. 168 products: none without a category, none with negative stock, cost > retail, or a fitment to an unknown generation (56 generations). seed:stats counts recorded.
- **Crons and scheduled functions (code review)** — crons.ts: 1-min outbox sweep, 15-min reminders (Belgrade opening hours, DST-safe lib/domain/time), hourly digest guarded to digestHour with a cronRuns day key (08:00 Europe/Belgrade exactly once), quote expiry and 24 h reminders, hourly low-stock batch, back-in-stock safety sweep, 01:30 UTC auto-complete, hourly landing stats, 01:40 UTC nightly retention (orphan uploads, e-mail HTML/log, search logs, events, notifications, subscriptions, consent, audit, guest carts, CAPI context, click ids) with bounded batches and self-continuation (≤ 10 rounds). All targets are internal.*. Upload rows exist for product/category/import/inquiry files, so the orphan cleaner does not delete live assets.
- **Logs** — npx convex logs --history captured 3 times (with timeouts) plus a 5-min stream. Only errors were my own probe rejections (FORBIDDEN/UNAUTHENTICATED/argument validation); no application function errors. `convex insights` (72 h): no issues. .qa-server.log: 2 × `auth:signIn` InvalidSecret (wrong-password attempts, Convex Auth logs them as uncaught) and 2 × „destination stream closed early“ (client aborts). .qa-server-perf.log clean.

Not covered:
- Raw table dumps (`npx convex data <table>`) were refused by the permission classifier (credential materialization), so orphaned productCodes, authRefreshTokens growth and counters documents were not read directly. Integrity was checked only through owner staff queries and seed:stats.
- Convex log history before 15:59 was pushed out of the CLI's short buffer by my own authorization probe (I should have captured logs first). Logs cover 15:59–16:01, 16:16–16:18 and 16:19–16:23 only.
- Staff/owner mutations were not called live as anonymous/customer, to avoid accidental writes if an authorization bug existed. Their protection rests on the static builder proof plus the 81 live query checks.
- The stockDecrementOn = "created" mode (backend-06) was not exercised live: the global setting would affect other reviewers' orders.
- The sign-up bucket drain (backend-07) and the ~1 MB attribution admin-list failure (backend-04) were not executed at full scale, to avoid locking out or breaking the shared environment.
- Root cause of the per-load session refresh (backend-08) was not isolated (client verbose logging needs a rebuild).
- Production deployment: none exists (not assessed).

## Appendix C — measurements reported by reviewers

### perf-lh

Budgets: BRIEF §9 (mobile LCP ≤ 2500 ms, CLS ≤ 0.05, TBT ≤ 200 ms; perf ≥ 85 on home, ≥ 90 on catalog and product). Medians, with the range where n > 1.

**Mobile, applied throttling (devtools; runs with benchmarkIndex ≥ 3000 only)**

| Template | n | Perf | LCP ms | TBT ms | CLS | JS KB gzip |
|---|---|---|---|---|---|---|
| / | 5 | 83 (78–87) | 2519 (2455–2571) | 425 (334–623) | 0.001 | 347 |
| /delovi | 1 | 91 | 2274 | 246 | 0 | 334 |
| /delovi/kocioni-diskovi | 3 | 77 (76–77) | 2196 (2162–2513) | 837 (674–863) | 0 | 353 |
| /deo/…-0004 | 2 | 76–80 | 2497–2533 | 551–699 | 0 | 355 |
| /pretraga?q=disk | 1 | 82 | 1991 | 625 | 0 | 346 |
| /vozila/…/golf-7 | 1 | 78 | 2249 | 650 | **0.082** | 346 |
| /delovi/kocioni-diskovi/volkswagen/golf | 1 | 73 | 2356 | 1019 | 0 | 353 |
| /za-majstore | 1 | 90 | 2259 | 280 | 0 | 337 |
| /upit | 1 | 88 | 2196 | 371 | 0 | 451 |
| /ponuda/… (contended, bench 1733) | 1 | 75 | 2741 | 629 | 0.001 | 366 |
| /kontakt (contended, bench 2731) | 1 | 83 | 2443 | 454 | 0 | 330 |

**Mobile, simulated (Lantern)**
- LCP medians: 4150–4500 ms on every template measured.
- FCP: 0.9–1.4 s.
- TBT: 28–274 ms.
- Observed (unthrottled) FCP equals LCP in every run; this is the artefact explained in perf-lh-09.

**Desktop preset:** perf 98–99, LCP 870–997 ms, TBT 0. CLS is 0.074 on Golf 7 and 0–0.001 elsewhere.

**Scores:** accessibility 100 everywhere except home (97, target-size). SEO 100, except the intentional noindex pages /pretraga (66) and /ponuda (69). Best practices 100, except /upit (96, CSP eval).

**LCP**
- Element: the cookie-banner paragraph on first visits; otherwise the RevealText lead or H1, or the product image.
- Phases: TTFB about 20–100 ms (cold first hits 240–450 ms), render delay 2.1–2.5 s.

**Critical path under slow 4G**
- The render-blocking CSS (19.7 KB) and 4 font preloads (80.3 KB) all finish at 1.66–1.80 s.
- The first document task takes 343–682 ms at 4×.

**Fonts per page:** 6–7 files, 118–134 KB. Four are preloaded:
- Archivo Condensed 600, 16.9 KB;
- Archivo Expanded 700, 17.0 KB;
- Public Sans latin, 27.3 KB;
- Public Sans latin-ext, 19.0 KB.
Archivo Expanded 600 (16.1 KB) and Martian Mono (24.2 KB, plus 16.2 KB on /upit) load late.

**JS breakdown (category)**
- React DOM 72.3 KB (33 % unused).
- GSAP + plugins 49.2 KB (56 % unused; 69 % on /upit).
- Next runtime 34.7 KB.
- zustand chunk 23.1 KB.
- Convex 22.9 KB.
- radix 13 KB.
- The /upit zod chunk is 102 KB (85 % unused).

**Trace at 4× CPU (category):** 17 long tasks with Σ(>50 ms) = 1916 ms. rAF callbacks: 333 totalling 397 ms (GSAP 293 ms). The TextRevealGlobal chunk task takes 298 ms.

**Failsafe race (slow 4G + 4× CPU):** FCP 2.05–3.3 s, tr-failsafe 5.30–5.77 s, TextRevealGlobal start 5.86–7.84 s. After the failsafe, 2–6 elements are hidden and animated again.

**Golf 7 shift (412 px):** the section moves 811 → 715 px when Martian Mono loads (CLS 0.0832).

### perf-bundle

| Template | Module JS gzip | brotli | raw | HTML wire/raw | inline RSC |
|---|---|---|---|---|---|
| home | 329.1 KB | 287.4 | 1013 | 33.3/243.6 KB | 136.9 KB |
| category | 330.9 | 289.0 | 1015 | 25.1/234.5 | 127.6 |
| product | 333.6 | 291.1 | 1024 | 29.2/217.6 | 135.1 |
| landing /ponuda | 340.2 | 296.7 | 1046 | 20.1/163.4 | 105.0 |
| generation | 324.7 | 283.5 | 994 | 28.9/322.3 | 167.3 |
| upit | 428.7 | 368.7 | 1427 | 24.6/144.4 | 94.5 |
| porudzbina | 429.9 | 369.8 | 1433 | 13.9/90.0 | 64.6 |
| korpa | 321.3 | 280.8 | 986 | 13.3/88.4 | 62.8 |
| prijava | 308.7 | 269.5 | 950 | 14.0/92.6 | 65.2 |

- Shared by all 12 templates: 18 scripts = 261.3 KB gz of module JS (plus a 38.7 KB gz nomodule polyfill that modern browsers skip)
- Largest shared chunks (gz): react-dom 71.6 · GSAP + 3 plugins 48.4 · Next router 34.0 · Convex client 22.1 · ShopChrome/consent/analytics 22.4 · home hero orchestrator 21.0 (home only)
- Deferrable in the shell (gz): Tooltip+Popper 13.2 · GSAP plugins ≈ 22 · overlays/toast/consent ≈ 24 (+6 header sheets) · icon weights ≈ 12–16 · duplicates ≈ 8–12 → ≈ 80–85 KB
- zod + react-hook-form chunk: 393.6 KB raw / 101.1 KB gz (esbuild: named import 91.0 → namespace 24.4 → zod/mini 5.6 KB gz)
- Ads landing: 32.2 KB gz loaded only for the root not-found fallback; 44 duplicated modules (77.7 KB raw)
- CSS: 1 file, 98.8 KB raw / 18.5 KB gz, 87 % used on home
- JS coverage home @390: 55 % of executed-chunk bytes unused
- Fonts preloaded: 4 = 75.8 KB (budget 150 KB, D29)
- 3D: canvas chunk 281.8 KB gz (budget 350) + BVH 27.1; car.glb 3553 KB (2052 gz), car-lite.glb 2567 KB (1648 gz), 290 k / 198 k tris; HDR 401 KB uncompressed
- Hero poster: 390 → 640w AVIF 11 KB; 1440 → 1440w AVIF 16 KB
- Cache: /_next/static immutable 1 y; /_next/image 4 h; /images, /models max-age=0; HTML no-store (dynamic)

### perf-3d

GPU = ANGLE D3D11, RTX 4060 Laptop; server localhost:3200; 60 wheel steps through the hero track.

| Scroll through the explode | runs | median | p95 | % > 33 ms | worst |
|---|---|---|---|---|---|
| Desktop 1440, 1×, GPU | 3 | 16.7 | 16.7 | 0 / 0 / 0 | 33 / 17 / 17 ms |
| Desktop 1440, 4×, GPU (hero-frames.mjs) | 3 | 16.7 | 50.0 / 33.4 / 50.0 | 7.9 / 4.6 / 8.1 | 100 / 83 / 83 ms |
| Desktop 1440, 4×, GPU (instrumented) | 3 | 16.7–33.3 | 49.9–66.6 | 8.8 / 8.4 / 16.4 | 100–150 ms |
| Desktop DPR 2, 4×, GPU | 3 | 16.7 | 33.3–33.4 | 1.5 / 5.5 / 3.3 | 50 / 567 / 83 ms |
| Mobile 390 @3×, 4×, GPU | 3+3 | 16.7 | 33.3–33.4 | 1.3–4.6 | 67–83 ms |
| Mobile 390, 6×, GPU | 3 | 16.7 | 66.7 / 83.4 / 100 | 21.8 / 32.6 / 25.1 | 133 / 184 / 433 ms |
| Mobile, 4×, cold (first scroll = intent) | 3 | 16.7 | 50 / 33.3 / 33.4 | 11.4 / 4.2 / 4.6 | 683 / 333 / 300 ms |
| Desktop, SwiftShader 4× / 1× | 3 / 2 | 33–50 / 16.7 | 1033–1133 / 1034–1050 | 46–53 / 38–40 | 1.3–1.98 s |

| 3D start | intent → first draw | intent → ready | worst long task | start TBT |
|---|---|---|---|---|
| Desktop 1× (cold) | 426–436 ms | 709–1443 ms | 374 ms (PMREM 336–457 ms in profiles) | 0–525 ms |
| Desktop 4× | 822–931 ms | 2158–2853 ms | 556 / 291 / 434 ms | 604–1113 ms |
| Mobile 4× | 963–1076 ms | 1492–2707 ms | 765 / 294 / 313 ms | 527–1603 ms |
| Mobile 6× | 1418–1789 ms | 2544–3758 ms | 897 / 435 / 616 ms | 1267–2293 ms |

Per frame: high tier 290 draws and 416,272 triangles (GLB 213 / 343,982); mid tier 172 draws and 257,044 triangles (lite GLB 149 / 233,664).

GPU memory estimate (high tier): buffers 5.9 MB + textures 14.8 MB + MSAA drawing buffer 41.3 MB = 62.1 MB at DPR 1; 113.7 MB at DPR 2 after the adaptive step to 1.5; about 194 MB at full DPR 2. Mid tier: 16.9–19.4 MB.

Interaction: desktop click 56 / 72 / 200 ms. Mobile tap at 4×: hauba 224 / 288 / 240 ms and akumulator 184 / 248 / 160 ms; the pointerup handler takes 103–208 ms (LoAF).

Leak, 5 home ↔ /delovi cycles after GC: reachable WebGL contexts 1 → 5; DOM +1107 nodes per visit; listeners +173 per visit; JS heap 14 → 18 MB; backing storage flat at 11.7 MB; live contexts off the home page 0.

Bytes after intent: car.glb 3.64 MB (2.05 MB gzip), car-lite.glb 2.63 MB, studio-512.hdr 411 KB uncompressed, 3D chunks 183 + 99 KB gzip, BVH 27 KB; 4 meshopt workers stay alive for the session.

### seo

| Metric | Value |
|---|---|
| URLs crawled (raw HTML, ≤ 2 concurrent) | 962 (all 200; 0 redirect chains; 0 broken internal links) |
| Indexable clean URLs / in sitemaps | 349 / 349 (0 noindex in sitemaps, 0 indexable missing) |
| Indexable parameter URLs (canonical ≠ self) | 121 crawled, 1,964 linked (vehicle-filtered categories) |
| noindex URLs crawled | 492 (447 landings below the guard, 28 ?motor, auth/cart/search) |
| Landings indexable / total | 50 / 497 (brand min 8 products, model min 6) |
| Product titles with the missing „s“ | 87 / 157 (55 %) |
| Duplicate titles among indexable URLs | 3 pairs (same OEM, different maker) |
| Category titles truncated with „…“ | 18 / 48 |
| Titles > 60 chars / descriptions > 155 | 0 / 0 |
| Pages with exactly one H1 | 962 / 962 |
| JSON-LD pages / parse errors | 955 / 0 |
| Product JSON-LD vs visible (price, availability, name) | 157 / 157 match |
| BreadcrumbList vs visible breadcrumb | 349 / 349 match (/upit and / have none) |
| Indexable pages < 150 / < 60 words | 38 / 29 |
| /kontakt inlinks from other pages | 0 |
| OG images checked | 13, all 1200×630 PNG, 81–128 KB |
| HTML size (uncompressed, median) | product 193 KB, category 159 KB, landing 197–222 KB, vehicle generation 251 KB; home 247 KB (≈ 35 KB gzip); max 335 KB (well under the 2 MB Googlebot cap) |
| Server response time (crawl, p50 / p90) | 104 ms / 337 ms (shared machine, indicative only) |
| Feeds (?demo=1) | Google 157 items valid, 28 backorder without availability_date; Meta CSV 157 rows, 12 columns |

### copy

| Metric | Value |
|---|---|
| Page loads read | 349 SSR (no-JS sitemap) + 45 JS @1440 + 7 @390 + 7 customer + 11 mechanic + 38 admin = 457 |
| Interactive states captured | 14 (consent, menu, vehicle picker, parts panel, back-in-stock, cart, checkout ×4 steps with errors, inquiry, sign-in/up, reset, mechanic registration) |
| E-mail templates read | 25 / 25 (plain text) |
| Source files AST-scanned | 557 |
| Rendered ijekavian / Cyrillic / ASCII-diacritic / „!“ / emoji / lorem-TODO hits | 0 / 0 / 0 / 0 / 0 / 0 |
| Straight quotes, "...", hyphen ranges, "x" dimensions in visible copy | 0 (hyphens only inside OEM numbers) |
| Prices without U+00A0 before RSD | 2 hard-coded strings („Preuzimanje 0 RSD“, checkout „0 RSD“) |
| Product titles missing „s“ | 73 / 157; descriptions cut mid-word or with a dangling „i“ | 32 / 157 |
| Pages with undeclined „za Škoda/Cupra“ | 65 |
| „24 meseci“ | 156 product pages |
| Landings with double „i“ in manufacturer list | 27 |
| Findings | 20 (P1 2 · P2 9 · P3 9) |

### backend

| Metric | Value |
|---|---|
| tsc --noEmit | exit 0 (4 m 52 s, shared machine) |
| npm run lint | 0 errors, 2 warnings (other reviewer's audit script) |
| 3D validate | PASS, 16 warnings (desktop 343 982 tris / 3.64 MB; lite 233 664 tris / 2.63 MB) |
| vitest (full, --maxWorkers=2) | 1090 passed / 2 failed (timeouts 6.4 s, 7.2 s > 5 s) / 4 skipped; 61 files; 166 s |
| vitest re-run of the 2 files | 41/41 pass ×2 |
| Exported Convex functions (source) | 298 = 227 builder-wrapped (40 publicQuery, 15 publicMutation, 12 userQuery, 14 userMutation, 65 staffQuery, 64 staffMutation, 4 ownerQuery, 13 ownerMutation) + 71 internal |
| Deployed spec | 305 = 230 public (227 + auth:isAuthenticated/signIn/signOut) + 75 internal; 0 drift vs source |
| Missing args / returns validators | 0 / 0 (auth library functions excepted) |
| .collect() / api.* scheduling | 0 / 0 |
| Live authz probe | 81 protected queries × 3 roles, 81 conclusive, 0 violations |
| Public queries payload-scanned | 40 (sensitive keys: only public company address) |
| Orders checked | 99 (0 total/line/VAT/count problems; numbering 1–99 no gaps) |
| Stock movements reconciled | 143 across 114 products, 0 chain or arithmetic problems |
| Products | 168 (157 demo, 157 active); 0 without category; 0 orphan-generation fitments |
| Rate-limit bypass | same UA: 20 ok / 1 limited; rotating UA: 21 ok / 0 limited |
| Credit bypass repro | limit 200.000 RSD, accepted deferred order 250.000 RSD (usedPara 25 000 000 para) |
| Consent forgery repro | stored termsVersion „QA-FORGED“, acceptedAt 2000-01-01; campaign string 200 000 chars stored and listed |
| Session refresh | 5/6 page loads rotated JWT + refresh token; 44 refreshSession vs 4 sign-ins in 3.5 min of logs |
| Convex insights (72 h) | no issues |
| Next server log errors | 2 × InvalidSecret (wrong password), 2 × stream closed early; perf server clean |
| Test records created | UP-2026-000059 (accepted → SK-2026-000100, cancelled), UP-2026-000060 (closed) |
