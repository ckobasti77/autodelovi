# SKLOP — Documentation index

Business intent: [`pipeline/BRIEF.md`](../pipeline/BRIEF.md) (wins for intent). These docs win for implementation details. Unabridged source: [plans/01-master-plan.md](plans/01-master-plan.md).

| Doc | What it holds | Plan section |
|---|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Context, stack & versions, **Next 16 rules**, product journeys, Convex backend surface (API, rate limits, files, seed, algorithms), frontend architecture (folders, data access, UI kit, forms, GSAP, text reveal, analytics, test ids) | §0, A, E, G |
| [DATA-MODEL.md](DATA-MODEL.md) | Every Convex table, validators, indexes, invariants, pricing function, state machines | §C |
| [ROUTES.md](ROUTES.md) | Every route, rendering/caching, indexability, canonical rules, route handlers | §B |
| [3D-CONTRACT.md](3D-CONTRACT.md) | Frozen taxonomy, node naming, axes, manifest schema, budgets, choreography, loading, interactions | §F |
| [DESIGN-BRIEF.md](DESIGN-BRIEF.md) | Constraints and north star for the design system | §H |
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
| [HUMAN-TODO.md](HUMAN-TODO.md) | (sr) What only the owner/client can provide; „potvrditi sa klijentom" | — |

Created later: `docs/3d/*` (steps 07–11), `docs/qa/*` (steps 12–22), `docs/progress/<step>.md` (checklists), `docs/ADS-PLAYBOOK.md` (19), `docs/SECURITY-AUDIT.md`, `docs/GO-LIVE-ENV.md`, `docs/PRIVACY-PROCESS.md`, `docs/BACKUPS.md` (20), `docs/PREDAJA.md`, `docs/GO-LIVE.md`, `docs/showcase/` (23).
