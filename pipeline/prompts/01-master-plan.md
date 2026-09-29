<!-- META | Korak 01 | Opus 5.5 | effort: max | sesija: NOVA | mode: plan -->
# Step 01 — Master plan

You are the principal architect of this project: a senior product engineer, creative technologist and 3D/web-performance specialist with 15+ years of shipping world-class commerce sites. This step runs in **plan mode**: research and think deeply, do not edit files. Your final message becomes the master plan that every later step builds on, so make it complete, concrete and internally consistent.

## Read first (fully)
1. pipeline/BRIEF.md — the product brief. Everything serves it.
2. CLAUDE.md, AGENTS.md, package.json, tsconfig.json, next.config.ts, app/, convex/.
3. convex/_generated/ai/guidelines.md.
4. node_modules/next/dist/docs/ — find the index, then read what you need about: App Router routing and layouts, data fetching and caching (including Cache Components / `use cache` if present), metadata, sitemap and robots routes, OG images, `proxy` (formerly middleware), fonts, images, route handlers, server actions, error / not-found. List every breaking change versus older Next.js that later steps must respect.
5. pipeline/env/ENVIRONMENT.md.

## Skills to invoke (Skill tool, by name)
convex · convex-design · convex-auth · text-reveal · 3d-scrollytelling · threejs-fundamentals · threejs-interaction · gsap-react · gsap-scrolltrigger · site-architecture · seo · seo-programmatic · seo-ecommerce · blender-pipeline. Absorb what matters for planning; you implement nothing now.

## Research (WebSearch / WebFetch, official sources)
Current compatible versions and integration notes for: @react-three/fiber + @react-three/drei with React 19.2 / Next 16; meshopt loading in three.js; gsap + @gsap/react; the Convex auth approach for Next 16 (follow the convex-auth skill); @convex-dev/resend; @convex-dev/rate-limiter; convex-test; SheetJS distribution (cdn.sheetjs.com); Playwright; @axe-core/playwright; Lighthouse CLI; @gltf-transform/cli. Record versions and gotchas.

## The pipeline you are planning for
Each later step is its own Claude run that gets this plan as input:
02 docs & conventions · 03 design direction & design system · 04 frontend foundation (tokens, fonts, shell, UI kit, text-reveal, GSAP) · 05 Convex backend foundation (schema, auth/roles, catalog, orders, inquiries, seed) · 06 backend verification goal · 07 3D plan · 08 3D build in Blender · 09 3D quality goal · 10 3D web experience · 11 3D web verification goal · 12 storefront pages & ordering · 13 storefront verification goal · 14 mechanics (B2B) portal · 15 admin panel · 16 Excel import/export · 17 admin & import verification goal · 18 notifications & automations · 19 SEO + Google/Meta Ads + analytics · 20 security & backend audit · 21 full QA audit · 22 fix-everything goal · 23 handoff docs.

## The master plan — sections
A. **Product & journeys** — mechanic, retail visitor from an ad, returning mechanic, staff; step-by-step flows with edge cases (out of stock, unknown vehicle, VIN only, company buyer, quote accepted after expiry).
B. **Route map & rendering** — every route (public, account, mechanic, admin, feeds, API) with Serbian slugs, purpose, data needs, rendering and caching strategy under Next 16, indexability and canonical rules.
C. **Data model** — every Convex table: fields with validators, indexes, search indexes, relations, invariants. Include: settings singleton; brands / models / generations / engines; categories (tree + 3D part ids); products (SKU, slug, OEM + cross numbers raw and normalized, manufacturer, quality, fitments, specs, images, prices in para, cost, stock, lead time, SEO, isDemo, importBatchId); price tiers and mechanic profiles; carts; orders (snapshots, numbering, status history, attribution); inquiries (+ quotes); stock movements; back-in-stock subscriptions; search logs; **domain events outbox**; notifications; e-mail log; import batches and per-row changes; audit log; users and roles. Draw the order and inquiry state machines.
D. **Auth & authorization** — provider and why (it must be set up fully unattended), roles (customer, mechanic pending/approved/rejected, staff, owner), server-side checks in Server Components, route handlers and Convex functions, admin protection, price-visibility guarantees.
E. **Backend surface** — modules with their public queries / mutations / actions and internal functions; HTTP actions (Resend webhook, anything Meta CAPI needs); crons; components to install; rate limits; file-storage rules; seed and demo-data removal.
F. **3D contract** — final part taxonomy (slugs, Serbian labels, system groups), GLB node naming and hierarchy, manifest JSON schema (partId, category, system, labelSr, explode vector / distance / stage, focus camera, bbox), units / axes / scale, pivots, material slot names, budgets (triangles, draw calls, file size, textures), mobile strategy, loading strategy versus LCP, poster and fallback, interactions (hover, click, keyboard, deep links `?deo=`), explode choreography stages tied to scroll.
G. **Frontend architecture** — folder structure, UI-kit approach (accessible primitives), state (Convex reactivity, cart for guests vs. users, selected vehicle), forms and validation (shared schemas), GSAP rules, text-reveal implementation per the skill contract **plus an LCP-safe variant for above-the-fold copy** (server-split words + CSS keyframes, no-JS fallback), images, error / loading states, analytics layer (`track()`), test ids.
H. **Design direction brief** for step 03 (constraints and north star only).
I. **Notifications matrix** — event → recipients → channel → template → timing; crons in Europe/Belgrade time, DST-safe.
J. **SEO & Ads architecture** — metadata templates, JSON-LD per template, sitemaps, programmatic landing rules with a thin-content guard, Consent Mode v2, GA4 / Google Ads / Meta event map with dedup, attribution capture and storage, feeds, landing template, CWV budgets.
K. **Excel import design** — formats (including Windows-1250 CSV), header synonyms (Serbian/English), validation rules, upsert keys, modes, batching within Convex limits, progress, rollback, templates, exports.
L. **Security & privacy** — authorization rules, rate limits, uploads, PII and retention (Serbian ZZPL), CSP and headers, secrets, backups.
M. **Testing strategy** — unit, convex-test (including negative authz), Playwright e2e flows, screenshot review, axe, Lighthouse budgets; test-data strategy.
N. **Step-by-step build plan** — for every pipeline step 02–23: goal, deliverables, measurable acceptance criteria, risks.
O. **Risks & decisions** — top risks with mitigations; every open question with the default you chose.

## Output
Non-interactive run — nobody will approve anything. When the plan is complete, output the **entire plan as your final message** in Markdown (the orchestrator saves it to docs/plans/01-master-plan.md, and the next step writes it into docs/). Be specific: names, fields, routes, numbers. No filler. Finish with the Step report.
