# SKLOP build pipeline — final report

Unattended build on one Windows PC, 29.09.–01.10.2026, 23 steps run by Claude Opus 5.5 through `pipeline/run-pipeline.ps1`. Each step's own report is in `pipeline/logs/<step>-result.md`; the dated log is [`docs/PROGRESS.md`](../docs/PROGRESS.md); decisions D1–D298 are in [`docs/DECISIONS.md`](../docs/DECISIONS.md).

## Final state (step 23, 01.10.2026, on the final code)

| Gate | Result |
|---|---|
| `npm run build` (incl. compile hints) | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | 0 problems |
| `npm test` (Vitest unit + convex-test) | 70 files passed, 1 skipped · **1,223 tests passed**, 4 skipped (backup drill without a snapshot) |
| Playwright, production build on :3100 (desktop 1440 + mobile 390) | **105 passed**, 27 skipped by design (desktop-only and run-once specs on the mobile project), 0 failed, 9.2 min |
| `npm run dev` | ready in under 1 s; `/`, `/delovi/kocioni-diskovi`, `/prijava`, `/api/zdravlje` return 200, `/admin` redirects anonymous visitors (307) |
| Lighthouse mobile, applied throttling (step 22 final verification) | home 97 · category 98 · product 97 performance; accessibility 100 and SEO 100 on all three; TBT 0–25 ms |
| QA audit (step 21 → 22) | 180 findings: P1 18/18 fixed, P2 85/87 fixed, P3 47/75 fixed |
| Security audit (step 20) | 23 findings fixed (5 serious), 11 accepted risks documented; `npm audit` 0 vulnerabilities |

Nothing has been deployed or pushed. Everything runs on the Convex dev deployment `tame-impala-374` with demo data.

## Per step

| # | Step | Status | Time |
|---|---|---|---|
| 01 | Master plan | done | 53m |
| 02 | Docs and conventions | done | 3m |
| 03 | Design direction and design system | done | 1h 34m |
| 04 | Frontend foundation | done | 1h 20m |
| 05 | Convex backend | done | 1h 16m |
| 06 | Backend goal | done | 1m |
| 07 | 3D plan | done | 2h 02m |
| 08 | 3D build in Blender | done | 2h 21m |
| 09 | 3D quality goal | done | 1h 15m |
| 10 | 3D on the web | done | 3h 32m |
| 11 | 3D web goal | done | 29m |
| 12 | Storefront | done | 1h 53m |
| 13 | Storefront goal | done | 18m |
| 14 | Mechanics portal | done | 1h 14m |
| 15 | Admin panel | done | 2h 35m |
| 16 | Excel import and export | done | 1h 22m |
| 17 | Admin + import goal | done | 11m |
| 18 | Notifications and automations | done | 1h 04m |
| 19 | SEO, ads, analytics, feeds | done | 1h 54m |
| 20 | Security and Convex audit | done | 1h 40m |
| 21 | Multi-agent QA audit | done | 1h 45m |
| 22 | Audit fixes goal | done | 8h 49m |
| 23 | Handoff | done | this step |

### 01 · Master plan
- **Built:** the full plan (architecture, data model, routes, 3D contract, design brief, notifications, SEO/ads, import, security, testing, roadmap, decisions D1–D22). Taxonomy frozen: 10 systems, 44 categories, 91 clickable 3D nodes. Auth chosen: Convex Auth 0.0.95 (Password).
- **Verified:** ~50 package versions with `npm view`; Next 16 and Convex docs read locally; legal and platform research (Merchant Center country list, consumer law 35/2026, PIB/MB checksums).
- **Open:** Serbia is not a Google Merchant Center country (feed built but unused).

### 02 · Docs and conventions
- **Built:** the plan split verbatim into 13 topic docs + index, `DECISIONS.md`, `HUMAN-TODO.md`, `PROGRESS.md`, project conventions in `CLAUDE.md`, Prettier.
- **Verified:** `tsc` exit 0.

### 03 · Design system „Rendgen“
- **Built:** `docs/design/DESIGN-SYSTEM.md` (tokens, type scale, contrast table, motion, 3D art direction, 22 components, 13 page blueprints, Serbian microcopy). Safety orange `#FF6B1A` (6.74:1), dark storefront, light admin, Archivo + Public Sans + Martian Mono, the „lifted part“ mark. Concept page went through 4 critique rounds (24/40 → ship).
- **Verified:** tsc, lint, build; 60 contrast pairs pass; axe 0 violations at 5 widths; screenshots 360–2560 px.

### 04 · Frontend foundation
- **Built:** Tailwind v4 tokens, fonts, root layout, 27 UI components, header/footer/menus, the site-wide text-reveal system (incl. LCP-safe `RevealText`, no-JS and reduced-motion fallbacks), GSAP setup, `/styleguide`, utilities (money, OEM, VIN, phone, dates).
- **Verified:** 428 unit tests; 20 e2e (no console errors, reveal leaves nothing hidden, focus rings, axe 0).
- **Bugs fixed:** hydration mismatch from early splitting, headings stuck hidden after fast scroll, cards hidden whole.

### 05 · Convex backend
- **Built:** full schema, Convex Auth with roles, auth builders, server-side pricing (`resolveUnitPrice`), catalog, OEM search, carts, orders (gapless numbers, state machine, stock commit/restock, token status pages), inquiries and quotes, mechanics, stock log, back-in-stock, event outbox, audit log, rate limits, demo removal, idempotent seed (150 demo products, vehicles, 58 categories).
- **Verified:** 620 tests (65 Convex, pricing and state machines at 100 % branches); seed run twice (0 created on re-run); 26 e2e incl. sign-in on Next 16.

### 06 · Backend goal
- **Verified:** push, tsc, 620 tests with refusal cases, non-zero seed stats, DATA-MODEL ↔ schema compared both ways (3 doc gaps fixed).

### 07 · 3D plan
- **Built:** the Blender plan (hard points, 91 part nodes, materials, explode vectors and timing, cameras, export, validation, QA). Two review agents simulated motion and found ~15 collisions, fixed in the plan.
- **Verified:** Blender 5.1.1 headless renders (EEVEE, Cycles OptiX); exporter and gltf-transform sources read.

### 08 · 3D build
- **Built:** the whole car from Python in headless Blender, desktop and lite GLBs + manifest, 28 poster files, 48 thumbnails, contact shadows, `npm run 3d` end to end (~5 min).
- **Verified:** `validate.mjs` PASS; 0 overlaps at full explode, 0 visibility errors, 0 parts through the body; both GLBs load in three.js.

### 09 · 3D quality goal
- **Built:** detail pass (engine, turbo, gearbox, caliper, radiator…), rebuilt starter/crank damper/clutch cover, 20 mm clearance rule with a local solver.
- **Verified:** validate PASS (desktop 3.64 MB, 344k triangles, 213 draw calls); every QA render reviewed.

### 10 · 3D on the web
- **Built:** server-rendered poster → live 3D on intent with crossfade, 8-stage scroll explode, hover callouts, click → part panel with Convex products, accessible parts list, `?deo=` deep links, device tiers, context-loss recovery, test hooks.
- **Verified:** 659 tests, 44 e2e, Lighthouse applied throttling perf 89 / LCP 2.39 s; 3D chunk 282 KB gzip.

### 11 · 3D web goal
- **Built:** Draggable/Inertia loaded on demand (−18 KB first-load JS).
- **Verified:** hero spec 18/18, suite 44/44, Lighthouse perf 92, TBT 226 ms.

### 12 · Storefront
- **Built:** home sections, catalog with filters and SEO intros, vehicle pages, landing pages, OEM-first search with logging, product page, cart drawer, 4-step checkout with PIB/MB checks, confirmation and status timeline, pro-forma, VIN inquiry with photos and quote acceptance, account pages, legal pages, attribution capture.
- **Verified:** 690 tests, 56 e2e (OEM search → guest order in Convex, vehicle filter, VIN inquiry, back-in-stock, axe), Lighthouse home 92 / category 88 / product 91.

### 13 · Storefront goal
- **Verified:** storefront spec 12/12, axe on six templates, 88 screenshots reviewed (SF-01…SF-19, all P0/P1 fixed), reveal check clean.

### 14 · Mechanics portal
- **Built:** `/za-majstore` landing and registration, staff approval with tiers/overrides/credit, „Vaša cena“ everywhere (never in cached HTML), quick order with two readings of spaced numbers, one-click inquiry for misses, history, favorites, customer vehicles, XLSX price list, deferred payment with limit.
- **Verified:** 753 tests, 60 e2e incl. the full register → approve → quick order → deferred order flow.

### 15 · Admin panel
- **Built:** admin shell (sidebar, command palette, realtime bell, shortcuts), dashboard, orders, inquiries + quote composer, products editor with bulk edits and undo, categories, vehicles, manufacturers, stock, customers, mechanics, tiers, settings, users and invites, audit, outbox, search analytics.
- **Verified (in step 16):** `admin.test.ts` 17/17, `admin.spec.ts` 6/6; 32 design findings fixed.
- **Note:** the step's own report was cut off when the run ended mid-e2e; its PROGRESS entry was written in step 16.

### 16 · Excel import and export
- **Built:** 5-step import wizard (SheetJS in a Web Worker, Windows-1250, synonym auto-mapping, presets, validation, server dry run, batched commit, rollback, image fetching with SSRF guards), history and record pages, template, exports (products xlsx round-trip, orders/customers/mechanics csv).
- **Verified:** 842 tests, admin + import e2e 9/9 (500-row fixture, 1250 CSV keeps č ć ž š đ).
- **Note:** the step report file is empty for the same reason as step 15; PROGRESS has the full entry.

### 17 · Admin + import goal
- **Verified:** build, tsc, lint, 842 tests, 9/9 e2e, screenshots at 1440/1024, ADMIN.md 0 P0 and 6 P1 fixed.

### 18 · Notifications
- **Built:** dispatcher with idempotency and retries, Resend in three modes (log/test/live), delivery webhook, 25 Serbian templates with plain text, crons in Belgrade time (reminders in working hours, 08:00 digest, quote expiry, low stock, retention cleanup), outbox and template gallery, HMAC-derived status links (`LINK_TOKEN_SECRET`).
- **Verified:** 953 tests (20 Convex incl. DST), notifications e2e 4/4, touched specs 33 passed.

### 19 · SEO, ads, analytics
- **Built:** metadata templates, canonical/noindex rules, OG images, JSON-LD, sitemap index, robots, landing-page guard (50 of 816 indexable), Consent Mode v2 banner (works without JS), GA4 + Ads + Pixel after consent, Meta CAPI with dedup, 90-day attribution, sources report, offline-conversion CSV, Merchant XML and Meta CSV feeds, ads landing pages, `ADS-PLAYBOOK.md`.
- **Verified:** 1,012 tests, 85 e2e, Lighthouse SEO 100 on three templates.

### 20 · Security
- **Built/fixed:** 23 findings (owner takeover via seed, open redirect, missing CSP, link-secret fallback, reset-mail flooding, self-approval, SSRF, CSV formula injection, token leaks to analytics, missing customer role, retention jobs), privacy tools (export/anonymize), backup verification.
- **Verified:** 1,092 tests, security e2e (no CSP violations incl. live 3D and analytics), `npm audit` 0, client bundles free of secrets.

### 21 · QA audit
- **Built:** 16 specialist reviewers across nine tracks, each finding verified independently; `docs/qa/AUDIT.md` with 180 confirmed findings (0 P0, 18 P1, 87 P2, 75 P3) and reproduction scripts.
- **Verified:** full e2e 91 passed, 0 failed.

### 22 · Audit fixes
- **Built:** fixes for all 18 P1 and 85 of 87 P2 (focus handling, checkout, auth forms posting before hydration, credit-limit bypass on quotes, rate-limit keys, search ranking, mobile hero framing with re-rendered posters, sticky buy bar, CLS, header overflow, copy). Performance: TBT brought under budget (Intl-free formatting, on-demand validation, content-visibility, compile hints).
- **Verified:** build, tsc, lint, 1,223 tests, 105 e2e, Lighthouse 97/98/97 perf, 100 a11y, 100 SEO.
- **Open:** FLOW-05 (page-thrown 404/403 server HTML is an empty shell in Next 16.3.6), FLOW-10 (no „price changed“ notice), 28 P3.

### 23 · Handoff
- **Built:** `README.md` (developer setup, env, scripts, architecture, data model, 3D pipeline, testing, troubleshooting), `docs/PREDAJA.md` (Serbian handoff and admin guide with screenshots), `docs/GO-LIVE.md` (Serbian launch checklist, HUMAN-TODO merged and prioritized), `docs/showcase/` (51 fresh screenshots + self-contained `index.html`), this report, `.env.example`, `scripts/setup/auth-keys.mjs`, `scripts/showcase/{shots,build}.mjs`.
- **Verified:** the gates in the table at the top, run on the final code in this step.

## What remains before launch

The ordered list is [`docs/GO-LIVE.md`](../docs/GO-LIVE.md). The blocking items:

1. Client inputs: final name, domain, company and bank data, couriers, lawyer review of legal texts.
2. Accounts and infrastructure: Vercel project (Frankfurt), Convex production (EU) with its env vars, Resend domain (SPF/DKIM/DMARC) and key.
3. Owner account on production before the site is public; demo data removed.
4. E-mail verification at sign-up (Convex Auth `verify`) once Resend is live.
5. Test orders on production, first backup, uptime monitor.

## Environment notes from the run

- Steps 15 and 16 ended while their final e2e run was in the background, so `15-result.md` / `16-result.md` hold only a status line; `docs/PROGRESS.md` has their full entries and step 17 re-verified both.
- Step 21 lost its first run to a network switch and hit the account usage limit once; step 22 hit the limit twice and resumed after resets.
- The orchestrator's pre-run snapshot of step 21 committed ~136 MB of audit evidence; it is removed from the tree but remains in git history.
- `.claude/rules/architecture.md` and `.claude/skills/text-reveal/SKILL.md` describe the earlier GSAP text reveal; agents may not edit `.claude/**` (GO-LIVE §D).
