# SKLOP — Architecture

> Part of the SKLOP docs — index: [README](README.md) · source: [master plan](plans/01-master-plan.md). Business intent: `pipeline/BRIEF.md`.

Related: [DATA-MODEL](DATA-MODEL.md) · [ROUTES](ROUTES.md) · [SECURITY](SECURITY.md) (auth) · [3D-CONTRACT](3D-CONTRACT.md) · [DECISIONS](DECISIONS.md) (D1–D22).

## 0. Context

SKLOP („Rasklopi auto. Nađi deo.") is a Serbian VAG-parts dealer's shop + B2B portal + back office: a 3D X-ray exploded car as a visual catalog, OEM-number-aware search, role-aware pricing (mechanic rabat), orders without online payment, VIN inquiries with quotes, Excel import, notifications, ad attribution. The repo is a fresh create-next-app (Next 16.3.6, React 19.2.8, Tailwind v4, Convex ^1.46 dev deployment `tame-impala-374`, empty `convex/`). Everything below is buildable unattended on Windows with the tools in `pipeline/env/ENVIRONMENT.md`.

### 0.2 Stack and versions (npm, 2026-09-29)

| Area | Package → version (pin major) | Notes / gotchas |
|---|---|---|
| Framework | `next` 16.3.6 (keep; patch bumps allowed), `react`/`react-dom` 19.2.8, `typescript` ^5, `tailwindcss` ^4, `eslint` ^9 + `eslint-config-next` 16.3.6 | Turbopack default; no custom webpack. |
| Backend | `convex` ^1.46, `@convex-dev/auth` 0.0.95 (+ peer `@auth/core` 0.41.1), `jose` (key generation only, dev), `@convex-dev/rate-limiter` 0.4.0, `@convex-dev/resend` 0.2.8 (peer `convex-helpers` ^0.1.106), `convex-helpers` 0.1.124, `@convex-dev/workpool` 0.4.12; later if needed `@convex-dev/migrations` 0.3.6 | `@convex-dev/auth` `2.0.0-alpha.2` exists (peer next ^16) — do **not** use alphas. Known issue #271: with `proxy.ts` `isAuthenticated()` stays false unless **both** server and client providers are mounted (we mount both). Better Auth (`@convex-dev/better-auth` 0.12.5 + `better-auth` `>=1.6.11 <1.7`) is the documented fallback (§O R1). Convex 1.46 facts: `ctx.meta.getRequestMetadata()` → `{ ip, userAgent, requestId, authToken }` in mutations/actions; `ctx.meta.getTransactionMetrics()` in queries/mutations; limits per transaction 16 MiB read/written, 32 000 docs scanned, 16 000 docs written, 4 096 index ranges, 1 s user code; search: ≤ 1 024 scanned results, 16 terms (32 bytes each), 16 filter fields, 4 search indexes/table, lowercase only — **no diacritic folding** (we fold ourselves); crons are UTC only. |
| 3D | `three` 0.186.1, `@types/three` 0.186.0, `@react-three/fiber` 9.8.1 (React 19), `@react-three/drei` 10.7.9, `three-mesh-bvh` 0.9.15; optional `postprocessing` 6.39.5 / `@react-three/postprocessing` 3.1.3 only if it pays for itself | Meshopt decoder from `three/addons/libs/meshopt_decoder.module.js` (drei `useGLTF` enables meshopt by default); `next/dynamic(..., { ssr:false })` only inside a Client Component. |
| Motion | `gsap` 3.15.0 (all plugins free, incl. ScrollTrigger, ScrollToPlugin, Draggable, InertiaPlugin, CustomEase, SplitText), `@gsap/react` 2.1.2 | Text entrances only via the text-reveal system (never SplitText for copy). |
| 3D tooling | Blender 5.1.1 (headless), `@gltf-transform/cli`, `/core`, `/functions`, `/extensions` 4.5.1, `meshoptimizer` 1.3.0, `sharp` 0.35.5, `gltf-validator` 2.0.0-dev.3.10 (dev tag — use `@gltf-transform` inspection if it misbehaves) | Poly Haven CC0 HDRI for renders only. |
| UI | `radix-ui` 1.6.7, `cmdk` 1.1.1, `zustand` 5.0.15, `@tanstack/react-table` ^8.21, `react-hook-form` 7.89.0, `@hookform/resolvers` 5.9.1, `zod` 4.6.5, `server-only` | No vaul/sonner/framer. |
| E-mail | `@react-email/components` 1.0.12, `@react-email/render` 2.1.0 | Render in `"use node"` action. |
| Excel | SheetJS CE **0.20.3**: `npm i --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (step 16 re-checks cdn.sheetjs.com for a newer version) | Never the npm-registry `xlsx`. CE writes cell comments (header help) but **not** data-validation dropdowns (Pro) → valid values go to helper sheets. `XLSX.writeFile` does not work in workers → `XLSX.write(wb, { type: "array" })` and download on the main thread. Windows-1250 CSV: decode with `TextDecoder("windows-1250")` then `XLSX.read(text, { type: "string" })` (no cptable). |
| Ads APIs | Meta Graph API **v26.0** (setting `META_GRAPH_VERSION`, default `v26.0`); gtag.js; Google Ads offline import via the (legacy) CSV template | Serbia is not a Google Merchant Center country today (D21). |
| OG fonts | `@fontsource/<family>` 5.x (WOFF files with `latin-ext`) | `ImageResponse` accepts ttf/otf/woff only; next/font files are not accessible to OG routes. |
| Tests | `vitest` 5.0.2, `@vitest/coverage-v8` 5.0.2, `convex-test` 0.0.60, `@edge-runtime/vm` 5.0.0, `jsdom` 30.1.1, `@testing-library/react` 16.3.3, `@playwright/test` 1.63.0, `@axe-core/playwright` 4.13.0, `lighthouse` 13.5.0 | Two Vitest projects: `unit` (jsdom/node) and `convex` (edge-runtime). |
| Tooling | `prettier` 3.9.x | Format only; no lint-staged hooks. |

### 0.3 Next.js 16 rules every later step must respect

Breaking changes versus Next 13–15 (source: `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` and API refs):
1. Node ≥ 20.9, TS ≥ 5.1; browsers Chrome/Edge/Firefox 111+, Safari 16.4+.
2. Turbopack is the default for `next dev` and `next build`; a custom `webpack` config fails the build; config key `turbopack` is top-level (`resolveAlias` replaces webpack fallbacks). File-system cache on by default.
3. **Async request APIs only**: `await cookies()`, `await headers()`, `await draftMode()`, `await params`, `await searchParams` (pages, layouts, route handlers, `default`, OG/icon images). Use generated helpers `PageProps<'/deo/[slug]'>`, `LayoutProps<...>`, `RouteContext<...>` (`npx next typegen`).
4. OG/twitter/icon image functions receive `params` and `id` as **Promises**; `generateImageMetadata` still gets sync params.
5. `sitemap({ id })`: `id` is a **Promise<string>**; `generateSitemaps` creates `/…/sitemap/[id].xml` but **no index** — we build the index ourselves (§J).
6. `middleware.ts` is deprecated → **`proxy.ts`** exporting `proxy` (or default). Runtime is **Node.js only**; `runtime` config is an error. `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`. Server Functions are POSTs to the page route — never rely on the proxy matcher for authorization; check inside every action.
7. `revalidateTag(tag, profile)` needs the second argument (`'max'` or `{ expire: 0 }` for immediate expiry from webhooks); `updateTag(tag)` only inside Server Actions (read-your-writes); `refresh()` refreshes the client router from a Server Action; `cacheLife`/`cacheTag` stable but only with Cache Components (not used, D2).
8. `experimental.dynamicIO` / `experimental.useCache` / `experimental_ppr` removed; PPR only via `cacheComponents` (off). `unstable_rootParams` → `next/root-params`. `unstable_cache` is "replaced by `use cache`" but supported — only `lib/server/catalog-cache.ts` may use it.
9. `next/image`: `priority` deprecated → `preload` (or `loading="eager"` / `fetchPriority="high"`); `qualities` default `[75]` (we set `[60, 75, 85]`); `minimumCacheTTL` default 4 h; `imageSizes` no longer contains 16; local `src` with query strings needs `images.localPatterns[].search`; `dangerouslyAllowLocalIP` default false; `maximumRedirects` 3; `images.domains` deprecated → `remotePatterns`; `next/legacy/image` deprecated.
10. `next lint` removed (use `eslint`); `eslint` key in next.config removed; flat config only.
11. `serverRuntimeConfig` / `publicRuntimeConfig` removed → env vars (`NEXT_PUBLIC_*` inlined at build).
12. Parallel route slots require `default.tsx`.
13. Next no longer overrides `scroll-behavior: smooth` on navigation — do not set global smooth scrolling (use GSAP ScrollToPlugin for in-page jumps).
14. `next build` no longer prints route sizes/First Load JS — measure with Lighthouse and a chunk-size script (§M).
15. `next dev` writes to `.next/dev` and holds a lockfile: one dev server per project; always stop background servers.
16. `error.tsx` props: `error`, `retry()` (preferred; `unstable_retry` in 16.2 — check `node_modules/next` types) and `reset()`; `global-error.tsx` renders its own `<html><body>`. `forbidden()`/`unauthorized()` require `experimental.authInterrupts`.
17. `next/dynamic` with `ssr: false` is not allowed in Server Components.
18. React 19.2: `<Activity>`, `useEffectEvent`, `<ViewTransition>` exist — do not use ViewTransition for motion (GSAP rule).
19. Keep the `<!-- BEGIN:nextjs-agent-rules -->` block that `next dev` writes into AGENTS.md.

Project rules on top: pages are dynamic (D2) — never read `cookies()`/`headers()` inside a cached function (pass values as arguments); `fetchMutation` only from Server Actions/POST handlers (no side effects on GET); JSON-LD via `<script type="application/ld+json">` with `JSON.stringify(data).replace(/</g, '\\u003c')`; the CSP nonce is read in the root layout with `(await headers()).get('x-nonce')` and passed to `next/script` and the two inline scripts; use `after()` for non-blocking logging; route handlers for sitemaps/feeds/OG use `export const revalidate = 3600` (previous-model ISR) and never touch cookies.

## A. Product and journeys

Personas: **majstor** (B2B, phone in the workshop, repeat buyer), **retail driver** (from Google/Meta ads or search), **returning mechanic**, **staff** (owner + 1–3 employees). Voice everywhere: experienced mechanic to a colleague.

### A1. Retail driver from an ad ("kočione pločice golf 7 cena")
1. Lands on `/delovi/kocione-plocice/volkswagen/golf?generacija=golf-7&utm_…&gclid=…` or an ads landing `/ponuda/<slug>`. Attribution (UTM, gclid, referrer, landing path) is captured in memory; the consent banner appears (non-blocking, no tags and no attribution cookie before a choice).
2. H1 „Kočione pločice za VW Golf", generation section „Golf VII (2012–2020)" pre-scrolled via the param; the vehicle chip offers „Izaberite motor za tačno poklapanje". Cards: name, manufacturer, quality badge, price incl. PDV, stock badge, ETA text from settings.
3. Product page: fitment badge (fits / fits generation, engine unverified / unknown), OEM + cross numbers with copy buttons, specs, price, stock/lead time, delivery & payment summary, „Dodaj u korpu", „Pošalji upit", call/Viber/WhatsApp.
4. Cart drawer → `/porudzbina`: Kontakt → Dostava (lično preuzimanje / kurir + adresa) → Plaćanje (pouzeće, gotovina ili kartica pri preuzimanju, virman uz predračun za firme) → Pregled (lines, delivery rule „besplatna dostava iznad 10.000 RSD", totals incl. PDV, terms consent) → „Pošalji porudžbinu".
5. The `orders.submit` Convex mutation re-validates and re-prices, creates `SK-2026-000123` (`nova`) and emits `order.created`; the client navigates to `/porudzbina/hvala/<token>`; `purchase` fires (after consent) with `transaction_id` = order number.
6. E-mails: „Porudžbina primljena" (customer), staff e-mail + bell. Later status e-mails; status page `/porudzbina/<token>` shows the timeline.

Edge cases: **out of stock** → add-to-cart disabled unless `po porudžbini` (lead time shown), offers „Javi mi kad stigne" + „Pošalji upit"; **stock/price changed since adding** → review step shows per-line notices („Na stanju je još 1 kom.", „Cena je promenjena") and requires a fresh confirmation; **unknown vehicle** → picker's „Ne nalazim svoje vozilo" opens `/upit` prefilled; **engine not in fitment** → amber „Proverite kompatibilnost" + VIN check CTA; **company buyer** → „Kupujem kao firma" (naziv, PIB with checksum, MB, adresa) unlocks virman; confirmation e-mail + `/porudzbina/<token>/predracun`; **guest checkout disabled** (flag) → login/registration keeps the cart; **consent denied** → order works, attribution travels with the order from memory (click IDs never sent to ad platforms), no pixel/CAPI; **abuse** → honeypot/timing/rate-limit message „Pokušajte ponovo za nekoliko minuta" with phone CTA.

### A2. VIN-only visitor („Ne nalazite deo?")
1. `/upit` (from zero results, product page, header, 3D panel, quick-order misses). VIN field: 17 chars, `[A-HJ-NPR-Z0-9]`; on valid VIN, WMI → brand prefill (e.g. `TMB` → Škoda), position 10 → model-year hint, VAG model code (positions 7–8, e.g. `5E` → Octavia III) → generation suggestion — all editable.
2. „Šta vam treba?" (text + optional category chips), up to 5 photos (client compression), contact (ime, telefon and/or e-mail), preferred channel (telefon/Viber/WhatsApp/e-mail), consent → `UP-2026-000045` (`nov`) → `/upit/hvala/<token>`.
3. Staff sends a quote → e-mail „Ponuda je spremna" with the status link; `/upit/<token>` shows lines, availability, lead time, validity.
4. „Prihvati ponudu" → short delivery/payment form (prefilled) → order (`source: "inquiry"`) → normal order flow.

Edge cases: **accepted after expiry** → server rejects (`now > validUntil`), page shows „Ponuda je istekla 06.10.2026." + „Zatraži obnovljenu ponudu" (inquiry back to `u_obradi`, staff notified); **revised quote** → old link shows „Ova ponuda je zamenjena novom" with a link; **declined** → optional reason → `odbijena`; **bad photo** → rejected by type/size sniffing with a Serbian message; **repeat VIN** → staff sees earlier inquiries for the same VIN.

### A3. New mechanic
1. `/za-majstore` → rabat by tier, brza porudžbina, prioritetni upiti, odloženo plaćanje po dogovoru, how approval works, FAQ → „Registrujte servis".
2. Registration (account e-mail + lozinka, firma, PIB, MB, kontakt osoba, telefon, grad, adresa, vrsta servisa, marke) → profile `pending` → `/za-majstore/hvala` + e-mail „Registracija primljena"; staff notified.
3. While pending: logs in, sees retail prices and a banner „Nalog čeka odobrenje (obično u toku radnog dana)".
4. Staff approves with a tier (+ personal override, credit flag) → e-mail „Nalog je odobren — Majstor Plus (15 %)"; prices switch live (reactive query).

Edge cases: PIB checksum fails → inline error; PIB already registered → „Ovaj PIB je već registrovan — prijavite se ili nas pozovite"; rejected → e-mail with reason, staff can reopen; suspended → retail prices + banner.

### A4. Returning mechanic (phone, workshop)
1. `/majstor`: sticky quick-order box. Paste `1K0615301AA 2`, `5Q0 698 151 x4`, `2x 1K0-698-151` … → parse, normalize, match → rows **tačno** (one product) / **više opcija** (pick manufacturer/quality with price & stock) / **nije pronađeno** → „Dodaj sve u korpu" + „Pošalji upit za nepronađene (3)" (one click, prefilled inquiry `kind: "quick_order_missing"`).
2. Checkout with saved company data, delivery to the workshop, `odloženo plaćanje` when credit is enabled.
3. History → „Poruči ponovo" (adds available lines, lists unavailable ones); favorites; saved customer vehicles (VIN, tablice, napomena → filtered catalog link); XLSX price list for chosen categories.

Edge cases: ambiguous codes sorted by quality then price; out-of-stock lines show lead time/backorder; credit limit reached → deferred payment disabled with the reason; tier change → prices update live.

### A5. Staff
1. Bell + e-mail „Nova porudžbina SK-2026-000123" → detail: items, customer, company, delivery, payment, attribution, timeline, internal notes, e-mail log.
2. „Potvrdi" (stock decremented, customer e-mailed) · edit items/prices while `nova` · „Čeka deo" (backorder) · „Otkaži" with reason (stock returned if committed).
3. Pickup: `spremna_za_preuzimanje` → `preuzeta`; courier: `poslata` (courier + tracking) → `isporucena`; both → `zavrsena` automatically 15 days later (withdrawal window) or manually.
4. Inquiries with SLA timers → compose quote (catalog search + free lines) → send → customer accepts → order.
5. Mechanic approvals, products, import, dashboard („Traženo, a nemamo" → add product or answer).

Edge cases: concurrent edits (optimistic `expectedUpdatedAt` precondition → „Porudžbina je u međuvremenu izmenjena — osvežite"); paid virman → „Označi kao plaćeno"; returned parcel → cancel with reason „Vraćena pošiljka"; changes after confirmation → internal note or cancel-and-recreate (edit only before confirmation, per brief).

### A6. Owner only
Settings (company, delivery/payment, notifications, SEO, tracking IDs, legal texts, feature flags), price tiers, users/invites, e-mail mode, „Obriši demo podatke" (typed confirmation).

## E. Backend surface (Convex)

### E1. Layout and conventions
```
convex/
  schema.ts  convex.config.ts  auth.ts  auth.config.ts  http.ts  crons.ts
  lib/       validators authz functions (builders) audit events rateLimits pricing productWriter stock
             tokens (random + SHA-256) time (Belgrade, EU DST rule) settings counters search files env
  users.ts  staff.ts  settings.ts  content.ts
  catalog/   categories.ts vehicles.ts manufacturers.ts products.ts productsAdmin.ts codes.ts
  search.ts  pricing.ts  carts.ts  orders.ts  ordersAdmin.ts  inquiries.ts  inquiriesAdmin.ts
  mechanics.ts  mechanicsAdmin.ts  account.ts  customersAdmin.ts  stock.ts  backInStock.ts
  notifications.ts  events.ts  emails/ (render.tsx "use node", templates/*.tsx, send.ts, admin.ts, resend.ts)
  imports.ts  images.ts  exports.ts  seo.ts  analytics.ts  capi.ts  dashboard.ts  audit.ts  files.ts
  seed.ts  seedData/ (vehicles.ts, categories.ts, manufacturers.ts, products.ts)  demo.ts  maintenance.ts  testing.ts
```
Rules: object syntax with `args` **and** `returns` validators on every function; `internal*` by default, public only when a client or the Next server calls it; `withIndex` for every WHERE, `.take(n)`/`.paginate()` — never unbounded `.collect()`; `ctx.db.get("table", id)` / `patch("table", id, …)` table-first signatures (current guidelines); `"use node"` only in action-only files; no wall clock in queries (pass `now` from the client, rounded to the minute, when needed); pure domain logic lives in `lib/domain/*` (shared with Next, unit-tested) and is imported into Convex.

### E2. Public API (client- or Next-callable)
| Module | Queries | Mutations / actions |
|---|---|---|
| users | `viewer` (role, names, mechanic status/tier name, unread count) | `updateMyProfile` |
| staff | `listUsers`, `listInvites` (owner) | `createInvite`, `revokeInvite`, `setRole`, `setBlocked` (owner); `acceptInvite` (user) |
| settings | `getPublic` (company, hours, delivery/payment labels & prices, flags, brand), `getTracking` (IDs only), `getAdmin` (staff) | `updateSection` (owner; one section per call, audited) |
| content | `pageBySlug`, `faqs(scope)`, `adLandingBySlug` | `upsertPage`, `upsertFaq`, `reorderFaqs`, `upsertAdLanding` (staff) |
| catalog.categories | `tree`, `bySlug` | `create`, `update`, `reorder`, `archive` (staff) |
| catalog.vehicles | `brands`, `models(brandSlug)`, `generations(modelId)`, `engines(generationId)`, `resolve(slugs)` | CRUD (staff) |
| catalog.manufacturers | `list` | CRUD (staff) |
| catalog.products | `bySlug`, `listByCategory({ categoryId, vehicle?, manufacturers?, qualities?, availability?, priceRange?, sort, page })`, `landing({ categoryId, brandId, modelId? })`, `forVehicle({ generationId, engineId? })`, `related`, `partPanel({ categorySlug, vehicle?, limit })` (role-aware price), `liveState({ productIds ≤ 60 })` (stock + `yourPricePara` for approved mechanics) | — |
| catalog.productsAdmin (staff) | `list`, `get` (incl. cost), `history` | `create`, `update`, `duplicate`, `setActive`, `bulkSetCategory`, `bulkAdjustPrice`, `adjustStock`, `generateImageUploadUrl`, `attachImage`, `reorderImages`, `removeImage` |
| catalog.codes | `lookup({ code, mode })` (mode `exact` or `prefix`) | — |
| search | `suggest({ q, vehicle? })` (codes by prefix, categories, top 6 products), `run({ q, vehicle?, page })`, `zeroResults({ days })` (staff) | `log` (publicMutation, called by the results page on mount) |
| pricing | `forProducts({ productIds ≤ 60 })` (viewer-specific), `tiers.list` (staff), `tiers.preview` (staff) | `tiers.create/update/archive` (owner) |
| carts | `get({ guestToken? })` (lines priced for the viewer, availability notices) | `addItem`, `setQuantity`, `removeItem`, `clear`, `addMany` (quick order), `mergeGuest` |
| orders | `getByToken({ token })` (customer-safe projection), `myOrders`, `myOrder({ number })` | `submit({ guestToken?, contact, company?, delivery, payment, vehicle?, note?, consent, attribution?, fbp?, fbc?, honeypot, startedAt })` (publicMutation, returns `{ number, token }`), `reorder` (user → cart) |
| ordersAdmin (staff) | `list({ filters, paginationOpts })`, `get`, `printData({ kind })` (kind `predracun` or `otpremnica`) | `transition({ orderId, to, reason?, tracking?, expectedUpdatedAt })`, `editItems`, `addNote`, `setTracking`, `markPaid` |
| inquiries | `getByToken`, `mine` | `generateUploadUrl`, `submit` (publicMutations), `acceptQuote({ token, quoteId, delivery, payment })`, `declineQuote`, `requestRenewal` (token capability, rate-limited) |
| inquiriesAdmin (staff) | `list`, `get` | `assign`, `setStatus`, `saveQuoteDraft`, `sendQuote`, `convertToOrder`, `close` |
| mechanics | `myProfile`, `quickOrderMatch({ lines ≤ 200 })` (approved) | `register` (user; creates the pending profile for the signed-in account — the form signs up first), `updateMyProfile`; action `exportPriceList({ categoryIds })` (approved) |
| mechanicsAdmin (staff) | `list`, `get` | `approve({ tierId, personalRules?, creditEnabled, creditLimitPara? })`, `reject({ reason })`, `suspend`, `reopen`, `update` |
| account (user) | `savedVehicles.list`, `favorites.list` | `savedVehicles.add/update/remove`, `favorites.toggle` |
| customersAdmin (staff) | `list`, `get` | `setBlocked`, `addNote` |
| stock (staff) | `movements({ productId?, paginationOpts })`, `lowStock` | `setThreshold` |
| backInStock | — | `subscribe` (publicMutation), `unsubscribe({ token })` |
| consent | — | `record({ consentId, choices, policyVersion })` (publicMutation) |
| notifications | `mine({ paginationOpts })`, `unreadCount`, `preferences` | `markRead`, `markAllRead`, `setPreferences` |
| emails.admin (staff) | `outbox({ filters, paginationOpts })`, `preview({ templateKey, sample })` | `resend({ emailLogId })`, `sendTest({ templateKey, to })` |
| imports (staff) | `list`, `get`, `rows({ batchId, action?, paginationOpts })`, `presets.list` | `createBatch`, `stageRows({ batchId, rows ≤ 500 })`, `finalizeStaging`, `commit`, `cancel`, `rollback`, `presets.save/remove` |
| exports / analytics (staff) | `exports.productsPage`, `exports.ordersPage`, `exports.customersPage`, `analytics.sourcesReport`, `analytics.offlineConversionsPage` | — |
| seo (anonymous) | `sitemapProducts({ cursor })`, `sitemapLandings`, `feedProducts({ cursor })`, `landingIndex` | — |
| dashboard (staff) | `kpis({ nowMinute })`, `ordersPerDay({ days: 30 })`, `byCategory`, `recentActivity`, `slaQueue({ nowMinute })` | — |
| audit (staff) | `list({ filters, paginationOpts })` | — |
| demo (owner) | `status` | `remove({ confirm: "OBRIŠI DEMO" })` |

### E3. Internal functions
`events.dispatch({ eventId })` (scheduled with `runAfter(0)` by `emitEvent`), `events.sweep`, `emails.render` (`"use node"` action: template + props → `{ subject, html, text }`), `emails.send` (writes `emailLog`, calls the Resend component in test/live mode), `capi.send` (action: builds the Meta payload, POSTs, records delivery), `revalidate.notify` (action: POST to `${NEXT_SITE_URL}/api/revalidate`), `imports.commitChunk` / `rollbackChunk` / `deactivateMissingChunk` (self-rescheduling, `ctx.meta.getTransactionMetrics()` guard), `images.fetchImage`, `files.sniff`, `files.cleanupOrphans`, `seo.recomputeLandingStats`, `maintenance.*` (`expireQuotes`, `autoCompleteOrders`, `reconcileCounts`, `pruneLogs`, `cleanupCarts`), `reminders.run`, `digest.run`, `stock.lowStockSweep`, `backInStock.notifyForProduct`, `seed.run`, `seed.createOwner`, `seed.stats`, `demo.removeChunk`.

### E4. HTTP actions (`convex/http.ts`)
Convex Auth routes (`auth.addHttpRoutes(http)`) · `POST /resend-webhook` → `resend.handleResendEventWebhook(ctx, req)` (signature verified with `RESEND_WEBHOOK_SECRET`), updates `emailLog.status` via `onEmailEvent`. Meta CAPI is outbound only (no inbound endpoint).

### E5. Components (`convex/convex.config.ts`)
`app.use(rateLimiter)` (`@convex-dev/rate-limiter`), `app.use(resend)` (`@convex-dev/resend`), `app.use(workpool, { name: "externalIo" })` (image fetches, CAPI, revalidation calls; maxParallelism 3, retries with backoff). Declare typed env with `defineApp({ env: { … } })` where supported (guidelines), otherwise `process.env` behind `convex/lib/env.ts`.

Convex env (dev values set in steps 05/18/19): `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL` (Convex Auth), `REVALIDATE_SECRET`, `NEXT_SITE_URL`, `IP_HASH_SALT`, `EMAIL_MODE=log`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `RESEND_API_KEY` (unset), `RESEND_WEBHOOK_SECRET` (unset), `META_CAPI_TOKEN` (unset), `META_GRAPH_VERSION=v26.0`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `E2E_HELPERS=1` + `E2E_SECRET` (dev only, never prod). Next `.env.local` (append only): `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, `REVALIDATE_SECRET`, `NEXT_PUBLIC_TEST_HOOKS` (e2e builds only). Secrets are generated with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

### E6. Rate limits (`convex/lib/rateLimits.ts`)
| Name | Kind | Limit | Key |
|---|---|---|---|
| `orderSubmit` | token bucket | 5 / 10 min (capacity 5) | clientKey |
| `orderSubmitEmail` | fixed window | 10 / day | e-mail |
| `orderSubmitGlobal` | fixed window | 300 / hour | `global` (circuit breaker) |
| `inquirySubmit` | token bucket | 5 / 10 min | clientKey |
| `uploadUrl` | token bucket | 20 / hour | clientKey or userId |
| `mechanicRegister` | fixed window | 3 / hour | clientKey |
| `backInStock` | token bucket + fixed window | 10 / hour per clientKey, 20 / day per e-mail | both |
| `searchLog` | token bucket | 60 / min (silently dropped) | clientKey |
| `cartWrite` | token bucket | 120 / min | cartId |
| `tokenAction` (quote accept/decline/renewal, unsubscribe) | token bucket | 10 / hour | token hash |
| `consentLog` | token bucket | 20 / hour | clientKey |
| `passwordReset` | fixed window | 3 / hour | e-mail |
| `quickOrderMatch` | token bucket | 30 / min | userId |
| `importStage` | token bucket | 600 / min | userId |
| `emailTest` | fixed window | 10 / hour | userId |

`clientKey = SHA-256(IP_HASH_SALT + ip + userAgent)` computed inside Convex from `ctx.meta.getRequestMetadata()` (never stored raw); when `ip` is null (scheduled/admin calls) the key falls back to the user id or a client session id. Password sign-in attempts are additionally limited by Convex Auth's built-in failed-attempt limiter (sign-in goes through the Next proxy, so Convex sees the server IP there — our limits for sign-up/reset are keyed by e-mail). Every public mutation also rejects a filled honeypot field and submissions faster than 3 s after `startedAt`.

### E7. File storage rules
Flow: purpose-specific `generateUploadUrl` (auth or publicMutation + rate limit, inserts `uploads` pending) → client POST → `attach…` mutation checks `_storage` metadata (`ctx.db.system.get`) for size/content type and the uploader key → schedules `files.sniff` (magic bytes: JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF…WEBP`, AVIF `ftypavif`, XLSX `50 4B 03 04`, XLS `D0 CF 11 E0`, CSV = decodable text) → mismatch deletes the blob and marks `rejected`. Limits: inquiry photos ≤ 5 × 8 MB (client compresses to ≤ 2 MB, long edge ≤ 2048 px, JPEG/WebP), product images ≤ 12 × 10 MB (jpeg/png/webp/avif), import files ≤ 25 MB, category images ≤ 5 MB. Store only `Id<"_storage">`; resolve URLs with `ctx.storage.getUrl` at read time; next/image `remotePatterns` for the deployment host (from `NEXT_PUBLIC_CONVEX_URL`). Nightly cleanup deletes `pending` uploads older than 24 h.

### E8. Seed and demo data
`npx convex run seed:run` (idempotent upserts by natural keys, `source: "seed"`): settings defaults (company empty), legal page templates + FAQs, brands VW/Audi/Škoda/SEAT/Cupra with WMI, common models and generations sold in Serbia 1998–2025 (Golf IV–VIII, Passat B5–B8, Polo IV–VI, Caddy, Touran, Tiguan I–II, Octavia I–IV, Fabia I–IV, Superb I–III, Rapid, Kodiaq, Karoq, Leon I–IV, Ibiza III–V, Ateca, Formentor, A3 8L–8Y, A4 B5–B9, A6 C5–C8 …) with years and VIN model codes, common engine codes with kW/KS/fuel (all „seed – proveriti" in HUMAN-TODO), categories from §F.1, ~30 manufacturers (Bosch, Valeo, LuK, Sachs, TRW, ATE, Brembo, Febi Bilstein, Meyle, Lemförder, Mann-Filter, Mahle, Garrett, NGK, Gates, ContiTech, INA, SKF, Hella, Original VAG, Pierburg, Nissens, KYB, Bilstein, Varta, Castrol, Continental, BorgWarner, Denso, Walker), tiers, ~150 `DEMO-` products with plausible demo-marked VAG-style OEM numbers, fitments, codes and varied stock, one approved demo mechanic, ~8 demo orders across statuses, ~4 demo inquiries (one with a quote) — all `isDemo: true`; then `seed:createOwner`. `seed:stats` prints counts per table. `demo.remove` (owner, typed confirmation „OBRIŠI DEMO") deletes every `isDemo` row and children in scheduled chunks, keeps reference data, writes one audit entry.

### E9. Query strategies and core algorithms
- **Category listing** (no vehicle): candidates via `by_categoryId_and_active_and_<sortKey>` `.take(3000)` (leaf categories; parents merge children) → in-memory filters (manufacturer, quality, availability, price), facet counts, sort, page slice of 24. Categories beyond 3 000 active products show „Suzite izbor" (vehicle/manufacturer filter) — revisit with an aggregate if the catalog grows. SSR results are cached per normalized filter key (`catalog-cache`).
- **Vehicle listing**: `fitments.by_generationId_and_categoryId_and_active` (or model/brand variants) → product ids (engine filter: `engineId` undefined or equal) → hydrate with `ctx.db.get` (≤ 1 500 per query — 4 096 index-range limit) → same filters/sort/page. `universal` products are appended for categories where they make sense.
- **Search** `search.run`: `q` → `normalizeCode(q)`; if ≥ 4 chars and contains a digit → exact `productCodes.by_code` (≤ 50) then prefix range (≤ 50) for partial codes; multi-code input (spaces/commas) → per-code lookup; text part → `foldForSearch(q)` (lowercase, č/ć→c, š→s, ž→z, đ→dj, Cyrillic→Latin) → `search_products` with `active: true` (+ category filter), `.take(48)`; merge: exact code hits first (labelled „Tačno poklapanje: OEM …"), then cross/mpn hits, then text hits; vehicle fit computed for each result; zero results → CTA + log.
- **Suggestions** `search.suggest`: code prefix (≤ 5), categories by folded name/alias (≤ 3), top 6 text hits; called debounced (150 ms) from the header combobox.
- **Quick-order parser** (`lib/domain/quickOrder.ts`): per line (≤ 200), tabs/`;`/`,` treated as separators; quantity = a trailing or leading integer 1–999 optionally with `x`, `×`, `kom`, `kom.` (`2x 1K0…`, `1K0… x2`, `1K0…;2`); when a line is only spaced groups (`1K0 615 301 AA 2`), the last integer ≤ 3 digits is the quantity only if the remaining tokens normalize to a known code, else the whole line is the code; default quantity 1. Matching: exact code → 1 product = `exact`, > 1 = `ambiguous` (options sorted quality → price → stock), 0 = `not_found`.
- **Fitment check** (product vs. selected vehicle): fits when a fitment matches generation and (no engine restriction or same engine) and the year (if set) is inside the range; `generation_only` when the engine is not selected; `unknown` when no fitment matches but the product is not universal.
- **Landing stats**: `productWriter` marks affected (category, brand, model) keys dirty; the hourly job recomputes dirty keys in batches and re-ranks the indexable set against `maxIndexableLandings`.
- **Sitemaps/feeds**: cursor pagination over `by_active_and_contentUpdatedAt`, 1 000 rows per call.
- **Dashboard**: KPIs from `statsDaily` + small index ranges (`by_status` for open orders/inquiries); never scans all orders.
- **Identifiers** (`lib/domain`): PIB = 9 digits, ISO 7064 MOD 11,10 (`s = 10; for 8 digits: s = (s + d) % 10; s = ((s || 10) * 2) % 11; check = (11 − s) % 10`); MB (legal entity) = 8 digits, weights 2,7,6,5,4,3,2 on digits 1–7, `k = 11 − (sum % 11)`, `k > 9 → 0`, must equal digit 8 (test vectors from public registry data, e.g. 104052135/20084693); VIN = 17 chars without I/O/Q, check digit not enforced (EU VINs), WMI table (WVW, WVG, WV1, WV2, WAU, WA1, WUA, TRU, TMB, VSS, plus 3VW/1VW/9BW/XW8 imports), model-year character at position 10 (30-year cycle → hint only), VAG model code at positions 7–8 → generation suggestion; phone → E.164 `+381…` (accepts `06x…`, `+3816x…`, `003816x…`, separators).

## G. Frontend architecture

### G1. Folder structure (repo root, no `src/`)
```
app/
  layout.tsx              <html lang="sr-Latn-RS"> · fonts · inline text-reveal CSS + boot script (nonce) ·
                          ConvexAuthNextjsServerProvider · Providers · SkipLink · TextRevealGlobal
  globals.css             Tailwind v4 @theme tokens (step 04)
  (shop)/layout.tsx       Header · Footer · ConsentBanner · CartDrawer · LiveOverlayProvider
  (shop)/…                routes of §B1 (each page: page.tsx, loading.tsx, optional copy.ts, opengraph-image.tsx)
  admin/layout.tsx        admin shell (guard, data-reveal="off")
  api/revalidate/route.ts · api/zdravlje/route.ts · feeds/* · sitemaps/* · sitemap.xml/route.ts
  robots.ts · manifest.ts · opengraph-image.tsx · not-found.tsx · error.tsx · global-error.tsx · forbidden.tsx · unauthorized.tsx
  styleguide/page.tsx
components/
  ui/          Button IconButton Link Input Textarea Select Combobox Checkbox Radio Switch Badge Price StockBadge Card Sheet
               Dialog Tabs Toast Tooltip Skeleton EmptyState Breadcrumbs Pagination DataTable Stepper Field CopyButton Kbd Spinner
  shell/       Header Footer MobileNav SearchBox (OEM combobox) VehiclePicker CartButton AccountMenu SkipLink ConsentBanner ContactStrip
  catalog/     CategoryGrid ProductCard ProductGrid Filters SortSelect FitmentTable FitmentBadge CodeList SpecTable Gallery RelatedParts
  cart/ checkout/ inquiry/ account/ mechanic/ admin/ three/ seo/ (JsonLd) analytics/ text-reveal/ (RevealText) TextRevealGlobal.tsx
lib/
  domain/      pricing orderStateMachine inquiryStateMachine stock money vat codes (normalizeCode, foldForSearch)
               quickOrder (parser) vin/ (validate, wmi, modelYear, vagModelCodes) pib mb phone slug time (Belgrade, EU DST)
  catalog/     taxonomy.ts (single source: systems, categories, labels, stages — used by seed, manifest check, UI)
  validation/  zod: checkout inquiry mechanicRegistration auth product importRow limits
  format/      money (formatRSD) date (29.09.2026.) phone number
  server/      auth.ts (DAL) · convex.ts (fetchPublic / fetchAsUser) · catalog-cache.ts (the only unstable_cache user) ·
               actions/ (setConsentCookies.ts) · revalidate.ts
  seo/         metadata builders · jsonld builders · canonical · landing guard
  analytics/   track.ts · events.ts · consent.ts · gtag.ts · metaPixel.ts · attribution.ts
  three/       manifest.ts (types + loader) · tier.ts · explode.ts · camera.ts · xrayMaterial.ts
  gsap/        client.ts (registration, eases) · refresh.ts
  i18n/sr/     common statuses errors emails seo (shared copy dictionaries)
  excel/       import.worker.ts · mapping.ts (synonyms) · parse.ts · numbers.ts · encoding.ts · template.ts · export.ts
  images/      compress.ts · sniff.ts
  textReveal.ts · textRevealCss.ts
constants/     textRevealConfig.ts · motion.ts · routes.ts · testIds.ts
config/        site.ts (brand, tagline, locale, currency, VAT, contact fallbacks, tel/Viber/WhatsApp link builders)
convex/        §E
3d/            blender/ · scripts/ · assets/hdri/ · build/ · renders/ (git-ignored)
tests/         unit/ · e2e/ · fixtures/ (import files) · lighthouse/
public/        models/ · images/hero · images/parts · images/og
docs/
```

### G2. Data access patterns
- **Server (anonymous, cached)**: `lib/server/catalog-cache.ts` exposes `getSettingsPublic`, `getCategoryTree`, `getCategoryPage(slug, normalizedFilters)`, `getProductBySlug`, `getLanding`, `getVehicleHub`, `getContentPage`, `getFaqs` — each `unstable_cache(fn, [key], { revalidate, tags })` + React `cache` for per-request dedupe; inside only `fetchQuery(api.…)` **without** a token.
- **Server (per user)**: `fetchAsUser(ref, args)` = `fetchQuery(ref, args, { token: await convexAuthNextjsToken() })` — never cached across requests.
- **Client**: one `ConvexReactClient` (`NEXT_PUBLIC_CONVEX_URL`) inside `ConvexAuthNextjsProvider`; `useQuery` / `usePaginatedQuery`; `LiveOverlayProvider` batches `catalog.liveState({ productIds })` for every card on the page (one subscription) → role-aware price + live stock over the SSR HTML.
- **Guest cart**: `sk_cart` token (128-bit, localStorage — strictly necessary for the requested service) passed to cart functions; merged into the user cart after login.
- **Selected vehicle**: Zustand `persist` store `sk.vehicle.v1` (`{ brand, model, generation, engine?, label }`); `VehicleAwareLink` appends vehicle params to catalog links; choosing a vehicle on a catalog page `router.push`es the same page with params; arriving without params but with a stored vehicle shows the chip „Prikaži samo za VW Golf VII?" (no auto-redirect).
- **URL state**: filters in `searchParams` (`marka`, `model`, `generacija`, `motor`, `proizvodjac` (comma list), `kvalitet`, `dostupnost=na-stanju`, `cena=2000-15000` (dinars), `sort=popularno|cena-rastuce|cena-opadajuce|novo`, `strana`), updated with `router.replace(…, { scroll: false })`.

### G3. UI kit
`radix-ui` primitives (Dialog, Popover, DropdownMenu, Tabs, Tooltip, Switch, Checkbox, RadioGroup, Toast, ScrollArea, VisuallyHidden, Slot) styled with tokens; own ARIA 1.2 **Combobox** (OEM search, searchable selects); own **Sheet** (Radix Dialog + GSAP Draggable/Inertia: snap points, drag-to-close, focus trap, background `inert`); **DataTable** on TanStack Table v8 (sorting, column visibility, row selection, sticky header, keyboard row navigation); `cmdk` for the admin command palette. Every component: forwarded ref, `asChild` where useful, `data-state` hooks, all states from the design system (default/hover/focus-visible/active/disabled/loading/error), targets ≥ 24×24 px (≥ 44×44 for primary touch actions), no hard-coded colours.

### G4. Forms and validation
`react-hook-form` + `zodResolver`; schemas in `lib/validation/*` reuse `lib/domain` validators (PIB MOD 11,10; MB mod 11; VIN; Serbian phone; 5-digit postal code). A parity test runs shared fixtures through the zod schema **and** the Convex function (convex-test) so client and server agree. Errors: inline via `aria-describedby`, plus an error summary that receives focus on submit; Serbian messages from `lib/i18n/sr/errors.ts`; proper `autocomplete` tokens and `inputmode`; labels always visible. Public forms carry a honeypot field and `startedAt`.

### G5. GSAP rules
One client module `lib/gsap/client.ts` registers `useGSAP`, ScrollTrigger, ScrollToPlugin, Draggable, InertiaPlugin, CustomEase and defines the eases/durations from `constants/motion.ts` (mirrored as CSS variables). Only `useGSAP({ scope })` (+ `contextSafe` for handlers); `gsap.matchMedia()` for reduced motion and breakpoints; `ScrollTrigger.refresh()` after `document.fonts.ready`, after route changes (`ScrollTriggerRefresher` in the shell) and after the poster/3D swap; transforms/opacity/filter only; ScrollTriggers created top-to-bottom (or `refreshPriority`); no ScrollSmoother (native scrolling keeps a11y and 3D sync simple); no `markers` in production; the admin uses restrained micro-interactions only.

### G6. Text reveal (mandatory)
- Files per the skill contract: `constants/textRevealConfig.ts` (`candidateSelector`, `skipSelector`, `maxWords: 60`, `enterRatio: 0.15`, stagger/duration/blur/lift values from step 03, `failsafeMs: 3500`), `lib/textReveal.ts` (`splitWords` moves — never clones — text nodes into `span.reveal-word`; `restoreWords`), `lib/textRevealCss.ts` (stylesheet generated from the same selectors), `components/TextRevealGlobal.tsx` (one IntersectionObserver with the bottom inset, a MutationObserver for streamed/route content, random word order, restores the DOM after the animation), plus the „Text Reveal" section in `.claude/rules/architecture.md` (fallback `docs/rules/architecture.md`).
- Candidates: `h1–h6, p, li, dt, dd, blockquote, figcaption`, `span` outside copy/links/buttons/labels, `[data-reveal="text"]`. Skipped: `[data-reveal="off"]` subtrees, navigation, form controls, dialogs/sheets, `[aria-live]`/`[role="status"]`, live values (Price, StockBadge, counters, toasts) and the whole admin shell.
- Root layout inlines the generated `<style>` and a nonce'd boot `<script>` that adds `tr-js` to `<html>` and a failsafe timer (`tr-failsafe` after 3.5 s reveals everything); `<noscript><style>` and `@media (scripting: none)` show all; `prefers-reduced-motion: reduce` → never hidden.
- **LCP-safe variant** `RevealText` (Server Component) for all above-the-fold copy on every template (hero H1/subline, page H1 + intro on the first screen): words split on the server into `span.rw` with a deterministic shuffled `--i` (seeded by a text hash), wrapper `data-reveal="off"`, pure CSS keyframes that start at first paint — first frame `opacity .35; filter: blur(10px); transform: translateY(.3em)` → rest, delay `var(--i) × 40 ms`, total ≤ 900 ms, no JS dependency. The first painted frame is readable, so LCP is not delayed.
- Acceptance: the skill's check snippet returns nothing after scrolling each page; `[data-reveal-state="pending"]` is empty at the bottom.

### G7. Images
`next/image` everywhere: `remotePatterns` for the Convex deployment host, `formats: ['image/avif','image/webp']`, `qualities: [60, 75, 85]`, `sizes` always set; hero poster `preload` + `fetchPriority="high"`; product page first gallery image `preload`; everything else lazy. Blender renders ship in `public/images/**` (AVIF/WebP masters from sharp) and still go through `next/image` for consistent `srcset`. Alt texts in Serbian with real data („Kočioni disk Brembo 09.A820.11 za VW Golf VII"); decorative images `alt=""`.

### G8. States
`loading.tsx` skeletons that match final layouts (no CLS) for catalog, product, account and admin tables; `error.tsx` per segment with `retry()` + contact CTA; global `not-found.tsx` with search, vehicle picker and popular categories; `forbidden.tsx`/`unauthorized.tsx`; minimal branded `global-error.tsx`; offline banner from `navigator.onLine` + Convex connection state („Nema veze — pokušavamo ponovo"); empty states always offer the next action (usually the inquiry).

### G9. Analytics layer (`lib/analytics/track.ts`)
```ts
type AnalyticsItem = { sku: string; name: string; manufacturer: string; system: string; category: string; pricePara: number; quantity: number };
type TrackEvent =
  | { name: "view_item"; item: AnalyticsItem }
  | { name: "view_item_list"; listId: string; listName: string; items: AnalyticsItem[] }
  | { name: "search"; term: string; results: number }
  | { name: "add_to_cart"; item: AnalyticsItem }
  | { name: "begin_checkout"; items: AnalyticsItem[]; valuePara: number }
  | { name: "purchase"; orderNumber: string; valuePara: number; shippingPara: number; taxPara: number; items: AnalyticsItem[] }
  | { name: "generate_lead"; leadType: "inquiry" | "mechanic_registration" | "quote_accept"; leadId: string; valuePara?: number }
  | { name: "contact_click"; channel: "phone" | "viber" | "whatsapp" | "email"; location: string };
export function track(event: TrackEvent, opts?: { eventId?: string }): void;
```
Adapters: gtag (GA4 + Ads), fbq (Pixel), `window.dataLayer` mirror (tests), dev console logger. No-op when IDs are empty or consent is missing (events before consent are dropped, never replayed). Step 12 wires the calls (no-op adapters); step 19 fills the adapters.

### G10. Copy, formatting, test ids
Shared strings in `lib/i18n/sr/*` (statuses, errors, CTAs, e-mail subjects, metadata templates); page marketing copy in `copy.ts` next to the page — so a second locale is possible later. `formatRSD(para)` → `12.990 RSD` / `12.990,50 RSD` (decimals only when para % 100 ≠ 0); `formatDate` → `29.09.2026.`; `formatPhone` → `+381 64 123 4567`. `data-testid` values live in `constants/testIds.ts` (kebab-case `<area>-<element>`), e.g. `header-search-input`, `vehicle-picker-trigger`, `product-card`, `product-add-to-cart`, `product-your-price`, `cart-count`, `checkout-step-contact|delivery|payment|review`, `checkout-submit`, `order-number`, `order-timeline`, `inquiry-vin-input`, `inquiry-photo-input`, `inquiry-submit`, `quote-accept`, `back-in-stock-form`, `hero-poster`, `hero-canvas`, `parts-list-trigger`, `parts-list-dialog`, `part-panel`, `part-panel-product`, `explode-toggle`, `consent-banner`, `consent-accept-all`, `consent-reject-all`, `consent-save`, `mechanic-quick-order-input`, `mechanic-quick-order-row`, `admin-order-row`, `admin-order-transition-<status>`, `admin-import-dropzone`, `admin-import-commit`, `admin-import-rollback`, `admin-notification-bell`.

### G11. `next.config.ts` (target)
`images` (remotePatterns from `NEXT_PUBLIC_CONVEX_URL`, formats, qualities), `experimental.authInterrupts: true`, `poweredByHeader: false`, `headers()` for static security headers (CSP comes from `proxy.ts`), `redirects()` (`/lab/koncept` → `/styleguide` from step 04), optional `typedRoutes: true` if it builds cleanly with Turbopack. No `webpack` key.
npm scripts (step 02): `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:unit`, `test:convex`, `e2e` (`playwright test --reporter=line`), `lighthouse` (`node tests/lighthouse/run.mjs`), `convex:push` (`npx convex dev --once`), `seed`, `3d:build`, `3d:render`, `3d:export`, `3d:optimize`, `3d:validate`, `3d:images`, `format`, `check` (typecheck + lint + test).

### G12. Foundation as built (step 04)
Decisions D41–D54. Everything below is live and covered by `tests/unit/**` and `tests/e2e/foundation.spec.ts`.
- **Tokens**: `app/globals.css` — Tailwind v4 `@theme` with defaults reset (colours, type, radii, shadows, eases, blur, animations, breakpoints); night on `:root`, paper on `[data-theme="paper"]`, night subtree on `[data-theme="night"]`; semantic helpers `--color-focus(-inverse)`, `--color-edge-overlay`, `--color-accent-edge`, `--shadow-overlay`, `--shadow-drawer`; utilities `type-*`, `px-page`, `py-section`, `z-*`, `transition-control`, `skeleton`, `corner-ticks`, `link-underline`, `focus-ring-inverse`, `focus-ring-inset`; variants `paper:`, `reduced-transparency:`, `hover-hover:`.
- **Fonts**: `lib/fonts.ts` — next/font variables `--nf-*` mapped to `--font-display`, `--font-display-600`, `--font-condensed`, `--font-ui` (= `--font-sans`), `--font-mono`.
- **Config/constants**: `config/site.ts` (brand, locale, RSD, VAT 0.2, empty-safe contact/company, `resolveContact`, `resolveCompany`, `contactLinks.tel/viber/whatsapp/email`, `contactLinkList`); `constants/{motion,textRevealConfig,routes,testIds}.ts` (`ROUTES`, `PRIMARY_NAV`, `LIVE_ROUTES`, `isLiveRoute`).
- **Utilities**: `lib/format/{money,date,phone,number,nbsp,plural}.ts`, `lib/domain/{slug,codes}.ts`, `lib/domain/vin/*`, `lib/pagination.ts`, `lib/cn.ts`.
- **GSAP**: `lib/gsap/client.ts` (registration + `sk.*` eases + defaults `overwrite: "auto"`), `lib/gsap/refresh.ts` (`requestScrollTriggerRefresh`), `lib/gsap/useMotionMedia.ts` (`gsap.matchMedia` in `useGSAP`), `components/motion/ScrollTriggerRefresher.tsx` (route change + `document.fonts.ready`). ESLint blocks direct `gsap`/`@gsap/react` imports outside `lib/gsap`.
- **Text reveal**: see `.claude/rules/architecture.md` → „Text Reveal“ (files, selectors, hydration guard, fallbacks, acceptance checks).
- **UI kit** (`components/ui/`): Button, IconButton, Link, RouteLink, Input, Textarea, Select, Combobox, Checkbox (+ CheckboxBox), RadioGroup, Switch, Badge (+ CountBadge), Price, StockBadge, Card, Sheet (drawer / draggable bottom sheet, modal or not), Dialog, Tabs (underline / segmented), Toast (`toast.success|info|warning|error`), Tooltip, Menu, Skeleton (+ SkeletonText, SkeletonRegion), EmptyState, Breadcrumbs, Pagination, DataTable (TanStack v8), Stepper, Field, CopyButton, QuantityStepper, Kbd, Spinner; overlay presence/motion helpers in `components/ui/motion.ts`.
- **Shell** (`components/shell/`): Header (wordmark, nav, `HeaderSearch`, `vehicleSlot`, contact when configured, account, `CartButton`, `MobileNav`), Footer (columns, contact, company lines, legal links, nominative-use disclaimer), `SiteShell`, `SkipLink` (`#sadrzaj`), `SearchBox` (OEM combobox, GET `/pretraga`), `VehicleField`/`VehicleChip`, `ErrorState`, `BrandMark`/`Wordmark`.
- **Routes**: `app/(shop)/layout.tsx` (SiteShell), `app/(shop)/page.tsx` (placeholder home), `app/(shop)/{loading,error}.tsx`, `app/{not-found,error,global-error}.tsx`, `app/styleguide/` (noindex), `app/manifest.ts`, `app/{icon.svg,favicon.ico,apple-icon.png}`; `/lab/koncept` → 308 `/styleguide`.
- **Tests**: `vitest.config.mts` (project `unit`), `playwright.config.ts` (production build on 3100; `E2E_BASE_URL` to reuse a server; projects `desktop-1440`, `mobile-390`; axe WCAG 2.2 AA in the suite).
