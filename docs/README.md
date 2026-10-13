# Euromotors Plus · OEM Parts — Documentation index

Developer setup: [`../README.md`](../README.md). Build report: [`../pipeline/REPORT.md`](../pipeline/REPORT.md). Business intent: [`pipeline/BRIEF.md`](../pipeline/BRIEF.md) (wins for intent). These docs win for implementation details. Unabridged source: [plans/01-master-plan.md](plans/01-master-plan.md).

| Doc | What it holds | Plan section |
|---|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Context, stack & versions, **Next 16 rules**, product journeys, Convex backend surface (API, rate limits, files, seed, algorithms), frontend architecture (folders, data access, UI kit, forms, GSAP, text reveal, analytics, test ids) | §0, A, E, G |
| [DATA-MODEL.md](DATA-MODEL.md) | Every Convex table, validators, indexes, invariants, pricing function, state machines | §C |
| [ROUTES.md](ROUTES.md) | Every route, rendering/caching, indexability, canonical rules, route handlers | §B |
| [3D-CONTRACT.md](3D-CONTRACT.md) | Frozen taxonomy, node naming, axes, manifest schema, budgets, choreography, loading, interactions | §F |
| [3d/HERO-V2.md](3d/HERO-V2.md) | **Hero v2 plan** (step 30, not built): critique of the current 3D hero with measurements at 1440 and 390 px, the „radni sto“ design (parts leave the car and dock in a labelled grid, six pages of whole systems, system navigator, accessibility, fallbacks, budgets), what a prototype on the real model settled, test plan and implementation plan. Evidence in `3d/hero-v2/` | — |
| [DESIGN-BRIEF.md](DESIGN-BRIEF.md) | Constraints and north star for the design system | §H |
| [design/UI-BOOST.md](design/UI-BOOST.md) | **UI boost** (steps 26–28; §12 = the independent verification of step 28: corners, reveal, screenshots at four widths, Lighthouse): critique of the whole site at 390 and 1440 px, the target in words, what the system step changed (radius scale, night elevation, block reveal, header, mobile action bar, page transition) and the per-template work list for step 27 | — |
| [design/DESIGN-SYSTEM.md](design/DESIGN-SYSTEM.md) | **Design system „Rendgen“** (step 03): concept, brand, colour tokens + computed contrast table, typography, layout, icons/imagery, 3D art direction, motion + text reveal, components, page blueprints, Serbian microcopy, a11y checklist. Companions: [design/tokens.json](design/tokens.json), [design/design-dna.json](design/design-dna.json), [design/CRITIQUE.md](design/CRITIQUE.md); repo-root `PRODUCT.md` / `DESIGN.md` (impeccable records) | — |
| [../.claude/rules/architecture.md](../.claude/rules/architecture.md) | **Rules that are easy to break** (step 04): the site-wide Text Reveal contract (files, selectors, hydration guard, fallbacks, acceptance checks), GSAP import/motion rules, token rules. Live reference: `/styleguide` (noindex). Foundation inventory: [ARCHITECTURE §G12](ARCHITECTURE.md) | — |
| [NOTIFICATIONS.md](NOTIFICATIONS.md) | Outbox → dispatcher → channels, e-mail modes, event matrix, crons | §I |
| [SEO-ADS.md](SEO-ADS.md) | Metadata, JSON-LD, sitemaps, landings guard, consent, event map, attribution, feeds, CWV budgets | §J |
| [IMPORT.md](IMPORT.md) | Excel/CSV import pipeline, synonyms, validation, rollback, templates, exports | §K |
| [SECURITY.md](SECURITY.md) | Auth (Convex Auth), roles, enforcement layers, price visibility, abuse, CSP, secrets, privacy/retention, backups | §D, L |
| [SECURITY-AUDIT.md](SECURITY-AUDIT.md) | Step-20 audit: findings with severity, fix and evidence, CSP as built, secrets scan, readiness score, accepted risks | — |
| [GO-LIVE-ENV.md](GO-LIVE-ENV.md) | (sr) Every environment variable (Convex / Vercel), secret or not, required or not | — |
| [PRIVACY-PROCESS.md](PRIVACY-PROCESS.md) | (sr) Data inventory, retention as implemented, access/erasure requests (Admin → Privatnost), consent logging | — |
| [BACKUPS.md](BACKUPS.md) | (sr) Convex export, schedule, monthly restore drill, emergency restore | — |
| [TESTING.md](TESTING.md) | Vitest (unit + convex-test), Playwright, axe, Lighthouse, DoD | §M |
| [ROADMAP.md](ROADMAP.md) | Steps 02–23 with deliverables, measurable acceptance, risks; goal-step conditions | §N |
| [DECISIONS.md](DECISIONS.md) | D1–D25 + risks, defaults, log format for new decisions | §0.1, O |
| [PROGRESS.md](PROGRESS.md) | Dated log per step | — |
| [HUMAN-TODO.md](HUMAN-TODO.md) | (sr) Per-step history of owner items; merged into GO-LIVE in step 23. §0 (step 29) is current: the three things that hold the launch — the client's approval of the logo, the real domain and e-mail sender, the real company data | — |
| [PREDAJA.md](PREDAJA.md) | (sr) Handoff for developer and client: modules, admin step by step with screenshots, import, order and inquiry flows, notifications, mechanics, temporary data, demo removal, demo script; since step 29 also §11 name and logo kit (where it is, which file for whom), §12 „Šta je novo“ (soft corners, reveal, header, mobile bar, page improvements), §13 how to tune the reveal trigger line (`REVEAL_LINE`, `constants/revealConfig.ts`, default 0.18) | — |
| [GO-LIVE.md](GO-LIVE.md) | (sr) Launch checklist: client inputs, business rules, domain, Vercel, Convex prod, owner, Resend, settings, legal, ads, feeds, GBP, Search Console, test orders, backups, follow-ups | — |
| [brand/LOGO.md](brand/LOGO.md) · [brand/site/](brand/site/) | (sr) Logo guide for the owner; screenshots of the logo on the site (step 25: header, footer, admin, e-mail, OG, favicon) — rebuild with `scripts/brand/site/*.mjs` | 24–25 |
| [showcase/index.html](showcase/index.html) | (sr) Self-contained tour for the client demo (step 29): the brand board and logo sheets, the 3D car, „Šta je novo“, customer, mechanic, shop, before launch — 73 screenshots at 1440 and 390 px taken after a scroll-through. Rebuild: `scripts/showcase/shots.mjs` → `build.mjs`; check: `scripts/showcase/check.mjs` (no external requests) | — |
| [brand/LOGO.md](brand/LOGO.md) | (sr) **Logo „Euromotors Plus by OEM Parts“** (step 24): the idea, every lockup and file, colours, usage rules, fonts and licences, alternatives, open points. Rebuild: `scripts/brand/logo/` | — |
| [brand/BRAND-BOARD.html](brand/BRAND-BOARD.html) | (sr) Self-contained brand board for the client (`BRAND-BOARD.png` = its render at 1600 px) | — |
| [brand/BRAND-BRIEF.md](brand/BRAND-BRIEF.md) · [brand/concepts/README.md](brand/concepts/README.md) · [brand/concepts/CRITIQUE.md](brand/concepts/CRITIQUE.md) | Brand brief, the seven concept directions with scores, the critique of the finalists | — |

Created later: `docs/3d/*` (steps 07–11), `docs/qa/*` (steps 12–22), `docs/progress/<step>.md` (checklists), `docs/ADS-PLAYBOOK.md` (19), `docs/SECURITY-AUDIT.md`, `docs/GO-LIVE-ENV.md`, `docs/PRIVACY-PROCESS.md`, `docs/BACKUPS.md` (20), `docs/PREDAJA.md`, `docs/GO-LIVE.md`, `docs/showcase/` (23), `docs/brand/*` (24–25), `docs/design/UI-BOOST.md` (26–28); the handoff set was brought up to date in step 29 (check: `node scripts/docs/check-links.mjs`).
