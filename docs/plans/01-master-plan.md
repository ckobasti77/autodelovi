# SKLOP — Master plan (step 01)

> Source of truth for steps 02–23. Business intent: `pipeline/BRIEF.md`. From step 02 on, `docs/` holds this plan split by topic (docs win for implementation details, the brief wins for business intent). Dates: 2026-09-29. Versions verified with `npm view` on that date.

## 0. Context

SKLOP („Rasklopi auto. Nađi deo.") is a Serbian VAG-parts dealer's shop + B2B portal + back office: a 3D X-ray exploded car as a visual catalog, OEM-number-aware search, role-aware pricing (mechanic rabat), orders without online payment, VIN inquiries with quotes, Excel import, notifications, ad attribution. The repo is a fresh create-next-app (Next 16.3.6, React 19.2.8, Tailwind v4, Convex ^1.46 dev deployment `tame-impala-374`, empty `convex/`). Everything below is buildable unattended on Windows with the tools in `pipeline/env/ENVIRONMENT.md`.

### 0.1 Key decisions (details and alternatives go to docs/DECISIONS.md)

| # | Decision | Why |
|---|---|---|
| D1 | **Auth = Convex Auth** (`@convex-dev/auth` 0.0.95, `Password` provider) with its Next.js integration (`convexAuthNextjsMiddleware` in `proxy.ts`, `ConvexAuthNextjsServerProvider` in the root layout, `convexAuthNextjsToken()` on the server). Keys generated headlessly with `jose` (skill procedure). | Brief delegates to the `convex-auth` skill; the served Convex capability doc confirms `@convex-dev/auth`. Email+password, roles in our `users` table, server-side checks — all unattended. |
| D2 | **Rendering = dynamic SSR for every page; `cacheComponents` stays OFF.** The root layout must read auth cookies (`ConvexAuthNextjsServerProvider` → `cookies()`), which prevents static shells anyway. Catalog data is cached across requests in ONE module (`lib/server/catalog-cache.ts`, `unstable_cache` + tags + revalidate); live price/stock come from Convex client subscriptions. | Cache Components with a cookie-reading root layout gives no static shell and adds build-time traps; the previous model is supported and predictable. One module isolates the (replaced-but-supported) `unstable_cache`, so switching to `'use cache'` later is local. Revisit if auth ever stops needing cookies in the root layout (DECISIONS: "static shells"). |
| D3 | **Price secrecy by construction**: server-rendered/cached HTML contains only anonymous retail data. Role-specific prices only via authenticated Convex queries; purchase cost lives in a separate staff-only table; every public query has a `returns` validator. | "Prices never leak to other roles." |
| D4 | **Public writes call public Convex mutations directly from the browser** (order, inquiry, mechanic registration, back-in-stock, consent log, search log). Each derives `clientKey = SHA-256(IP_HASH_SALT + ip + userAgent)` from `ctx.meta.getRequestMetadata()` (Convex 1.46) for rate limits; raw IP/UA are kept only inside the outbox event for Meta CAPI and deleted after sending. Attribution, consent and `_fbp`/`_fbc` travel as validated args. No shared "BFF" secret; Server Actions are used only to set server-side cookies (consent/attribution). | Fewer moving parts, realtime UX, real client IP (a Next server hop would hide it). Step 05 verifies `ip` is populated for websocket calls; fallback = client session id + global limits. |
| D5 | Money = integer **para**; enums from the brief stay Serbian (`nova`, `potvrdjena`, `nov`, `u_obradi` …), technical enums English; all labels from the Serbian dictionary. | Brief §6; stable URLs/exports. |
| D6 | **Codes table** (`productCodes`: normalized OEM / cross / MPN / SKU / EAN → product) for exact and prefix lookups; Convex full-text search only for names. | Arrays cannot be indexed; OEM search must be exact and instant. |
| D7 | **Taxonomy refined** (§F.1): 10 systems, 44 categories (42 with 3D nodes) + 4 filter subcategories; renamed `usis-filter-vazduha`→`usisna-grana`, `ulje-karter`→`karter-dihtunzi` (all filters live in `filteri`); added `kais-alternatora`, `nosaci-motora`, `termostat-creva`, `brisaci`. Slugs are frozen from here on. | Removes overlapping filter categories (import ambiguity); adds high-frequency mechanic purchases. |
| D8 | **3D**: glTF, meters, **Y-up, +Z = vehicle front, +X = vehicle left (driver side, LHD)**, origin on the ground at the wheelbase centre; nodes `part__<category>__<instance>`; manifest generated from Blender custom props; two GLBs (`car.glb` desktop, `car-lite.glb` mobile) with identical node names; meshopt; no post-processing by default; `RoomEnvironment` for web reflections. | Contract stability, performance, swap-ability. |
| D9 | **3D never blocks**: SSR poster (preloaded) + LCP-safe headline; CSS-reserved scroll track; 3D chunk loads on first user intent or after ≥ 4 s idle post-load, tier-gated. | LCP/TBT budgets. |
| D10 | **Text reveal** = skill contract (`constants/textRevealConfig.ts`, `lib/textReveal.ts`, `components/TextRevealGlobal.tsx`, generated inline stylesheet) + LCP-safe server-split hero variant whose first frame is visibly painted. | Mandatory site-wide system; LCP. |
| D11 | UI primitives: **`radix-ui`** (headless, accessible) + **GSAP for all motion** (custom Sheet with Draggable, Radix Toast animated with GSAP; no vaul / framer-motion / CSS transition libraries). Tables: `@tanstack/react-table` **v8** (pin `^8.21`). Command palette: `cmdk`. Charts: hand-rolled accessible SVG. | Brief: GSAP only; fewer deps; v9 table API too new for reliable unattended use. |
| D12 | Forms: `react-hook-form` + `zod` 4 (shared schemas in `lib/validation`); Convex args use `v` validators + shared pure validators (PIB, MB, VIN, phone) imported from `lib/domain`. | One truth for rules, native Convex validation. |
| D13 | Excel: **SheetJS CE from the official CDN tarball**, parsed in a Web Worker; CSV encoding detected with `TextDecoder` (`utf-8` fatal → fallback `windows-1250`). exceljs not used. | Brief; no codepage tables needed. |
| D14 | E-mail: **`@convex-dev/resend`**, React Email templates rendered in a `"use node"` internal action; `EMAIL_MODE=log` default (render + store in `emailLog`, never send). | Brief §5 notifications. |
| D15 | Consent: **basic Consent Mode v2** — `gtag('consent','default', all denied)`; Google/Meta scripts are not loaded before an explicit grant. | "No tracking requests before consent." |
| D16 | Attribution: captured from the landing URL + `document.referrer` into **memory only** (no cookie/storage) until consent; after an analytics or ads grant, a Server Action sets a server-side first-party cookie `sk_attr` (90 days, first + last touch). Leads carry attribution as args; click IDs are used for ad platforms only when `consent.ads` is true. | ZEK („Sl. glasnik RS" 35/2023) čl. 160: non-essential device storage needs prior consent; server-set cookie survives Safari ITP. |
| D17 | Programmatic SEO: category×brand and category×model landings only; generation handled by on-page sections (anchors) and vehicle pages; thresholds + hard cap on indexable landings. | Thin-content guard, crawl budget. |
| D18 | CSP: **nonce-based** (`'strict-dynamic'`) generated in `proxy.ts` — affordable because pages are dynamic anyway; `style-src 'self' 'unsafe-inline'`. | Strong XSS posture without breaking SSR styles. |
| D19 | `experimental.authInterrupts: true` (use `forbidden()` / `unauthorized()` + `forbidden.tsx`/`unauthorized.tsx`). React Compiler off in v1. | Clean admin guards; build speed. |
| D20 | Tests: Vitest 5 (unit, jsdom) + convex-test (edge-runtime), Playwright 1.63, @axe-core/playwright 4.13, Lighthouse 13 CLI. | Brief §7, §9. |
| D21 | **Google Merchant feed is built but dormant**: Serbia is not a supported Shopping/free-listings country (Google removed the announced RS expansion on 2026-08-18). The Meta catalog CSV is the live catalog feed. | Brief requires feeds; ADS-PLAYBOOK states the status and how to switch on. |
| D22 | **No consumer „stara cena" promotions in v1** (`compareAtPrice` not implemented); every retail price change is logged in `priceChanges` so the new consumer law's 30-day-lowest-price rule can be met when promotions are added. The mechanic view (MP cena crossed out + „Vaša cena") is a B2B rabat, not a promotion. | Zakon o zaštiti potrošača („Sl. glasnik RS" 35/2026, applied from 2 Aug 2026). |

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

## B. Route map and rendering

Legend — **SSR**: rendered per request (all pages, D2). **C(n)**: anonymous Convex reads through `catalogCache` with `revalidate: n` seconds + tags. **L**: live client islands (Convex subscriptions: role-aware price, stock, cart). **CSR**: client app inside a server-guarded layout. Index column: `idx` = indexable & in sitemap; `noidx` = `robots: { index: false, follow: true }` and not in sitemap.

### B1. Public storefront (route group `app/(shop)/` with header/footer shell)

| Route | Purpose | Data | Rendering | Index / canonical |
|---|---|---|---|---|
| `/` | Home: 3D hero, OEM search, vehicle picker, how ordering works (3 steps), categories grid with renders, „Za majstore" band, brands (text), trust facts, FAQ, contact strip | settings (public), category tree, FAQs(home) | SSR + C(900) + L (3D panel) | idx, canonical `/` |
| `/delovi` | All systems → categories | category tree + counts | SSR + C(900) | idx |
| `/delovi/[kategorija]` | System hub (`kind: system`) or category listing with filters + SEO intro | category, children, products page, facets | SSR + C(300) keyed by normalized filters + L overlay | idx for base and `?strana=n` (self-canonical); any filter/sort → canonical to base (or to the matching indexable landing) and noidx when ≥ 2 filter dimensions or sort |
| `/delovi/[kategorija]/[marka]` | Landing category × brand | `landingStats`, products | SSR + C(900) + L | idx only if `indexable`; noidx below threshold; 404 at 0 products |
| `/delovi/[kategorija]/[marka]/[model]` | Landing category × model with generation sections (`#golf-7`), `?generacija=` scrolls/filters | same | SSR + C(900) + L | idx if `indexable`; `?generacija` canonical to self without params |
| `/deo/[slug]` | Product | public product + content, category, fitments, related, settings | SSR + C(300) + L (mechanic price, stock, fitment vs. picked vehicle) | idx when active; inactive → 200 page „Artikal više nije u ponudi" + alternatives, noidx; renamed slug → 308 via `redirects` |
| `/vozila`, `/vozila/[marka]`, `/vozila/[marka]/[model]` | Vehicle hubs | brands/models/generations + counts | SSR + C(3600) | idx |
| `/vozila/[marka]/[model]/[generacija]` | Parts by category for a generation; `?motor=` filter | generation, engines, per-category counts + top products | SSR + C(900) + L | idx if ≥ 10 fitting products; `?motor` canonical to base |
| `/pretraga?q=` | Search results (OEM first, then text) | `search.run` | SSR (uncached); a client island logs the query via `search.log` on mount | noidx |
| `/korpa` | Cart page | cart (L) | SSR shell + CSR | noidx |
| `/porudzbina` | Checkout (4 steps in client state) | cart, delivery/payment rules, viewer | SSR shell + CSR | noidx |
| `/porudzbina/hvala/[token]` | Confirmation + purchase event | order by token | SSR + L | noidx |
| `/porudzbina/[token]` | Order status timeline | order by token (L) | SSR + L | noidx |
| `/porudzbina/[token]/predracun` | Printable predračun | order by token | SSR (print CSS) | noidx |
| `/upit` | VIN/part inquiry (`?q=`, `?proizvod=`, `?deo=`, `?kodovi=` prefills) | brands, settings | SSR + C(3600) | idx (landing for „delovi po broju šasije") |
| `/upit/hvala/[token]`, `/upit/[token]` | Inquiry confirmation; status + quote + accept/decline | inquiry + quote by token (L) | SSR + L | noidx |
| `/za-majstore` | B2B landing + FAQ | public tier names/%, settings | SSR + C(900) | idx |
| `/za-majstore/registracija`, `/za-majstore/hvala` | Registration, confirmation | brands | SSR + CSR form | noidx |
| `/prijava`, `/registracija`, `/zaboravljena-lozinka`, `/nova-lozinka` | Auth (proxy redirects signed-in users away) | — | SSR shell + CSR | noidx |
| `/nalog` + `/porudzbine`, `/porudzbine/[broj]`, `/upiti`, `/vozila`, `/omiljeno`, `/profil` | Customer account | own data (L) | proxy auth + layout guard + CSR | noidx |
| `/majstor` + `/brza-porudzbina`, `/porudzbine`, `/omiljeno`, `/vozila`, `/cenovnik`, `/profil` | Mechanic portal (pending → status screen) | own data (L) | proxy auth + layout guard + CSR | noidx |
| `/majstor/cenovnik/preuzmi?kategorije=` | Route handler → XLSX price list | Convex action with the user's token | dynamic | `X-Robots-Tag: noindex` |
| `/o-nama`, `/kontakt`, `/dostava-i-placanje`, `/reklamacije-i-povrat`, `/uslovi-koriscenja`, `/politika-privatnosti`, `/kolacici` | Static & legal (Markdown from `contentPages` with `{{firma.naziv}}`-style settings placeholders) | contentPages, settings | SSR + C(3600) | idx (legal pages low priority) |
| `/ponuda/[slug]` | Ads landing (message match) | adLanding + products | SSR + C(300) + L | noidx by default (per-landing flag), canonical self |
| `/obavestenja/odjava/[token]` | Back-in-stock unsubscribe | — | SSR + Server Action | noidx |
| `/styleguide` | Design system (step 04) | — | SSR | noidx, robots disallow |
| `/lab/koncept` | Step 03 concept; step 04 redirects it to `/styleguide` | — | SSR | noidx |

### B2. Admin (`app/admin/`, own shell; staff/owner; everything noidx + `X-Robots-Tag` + robots disallow)
`/admin` dashboard · `/admin/porudzbine` · `/admin/porudzbine/[broj]` (+ `/predracun`, `/otpremnica` print views) · `/admin/upiti` · `/admin/upiti/[broj]` · `/admin/proizvodi` · `/admin/proizvodi/novi` · `/admin/proizvodi/[id]` · `/admin/kategorije` · `/admin/vozila` · `/admin/proizvodjaci` · `/admin/lager` (stock movements, thresholds) · `/admin/kupci` · `/admin/kupci/[id]` · `/admin/majstori` · `/admin/majstori/[id]` · `/admin/cenovni-razredi` · `/admin/uvoz` · `/admin/uvoz/istorija` · `/admin/uvoz/[id]` · `/admin/izvoz` · `/admin/pretrage` · `/admin/izvori` (attribution report + offline conversions) · `/admin/mejlovi` (+ `/sabloni`) · `/admin/obavestenja` · `/admin/sadrzaj` (legal pages, FAQ, ads landings) · `/admin/podesavanja?tab=` · `/admin/korisnici` · `/admin/revizija` · `/admin/pozivnica/[token]` (public, token-guarded). Owner-only: podešavanja danger zone, korisnici, cenovni razredi (edit), demo removal. Rendering: server layout guard (`forbidden()` for non-staff) + CSR with Convex subscriptions.

### B3. Route handlers, metadata routes, HTTP endpoints
- `POST /api/auth` — handled inside `proxy.ts` by Convex Auth (no route file).
- `POST /api/revalidate` — header `x-revalidate-secret`; body `{ tags: string[] }` → `revalidateTag(tag, 'max')` (`{ expire: 0 }` for settings/legal).
- `GET /api/zdravlje` — health (build id, Convex reachability) for monitoring.
- `GET /sitemap.xml` — sitemap **index** (route handler) → `/sitemaps/staticne.xml`, `/sitemaps/kategorije.xml`, `/sitemaps/vozila.xml`, `/sitemaps/landing.xml`, `/sitemaps/proizvodi-[n].xml` (≤ 10 000 URLs each, `image:image`); all `revalidate = 3600`.
- `app/robots.ts`; `app/manifest.ts`; icons from step 03.
- `GET /feeds/google-merchant.xml`, `GET /feeds/meta-catalog.csv` — `revalidate = 3600`.
- OG images: `app/opengraph-image.tsx` (default), `app/(shop)/deo/[slug]/opengraph-image.tsx`, `app/(shop)/delovi/[kategorija]/opengraph-image.tsx`, landing OG; `revalidate = 86400`.
- `GET /admin/izvoz/[vrsta]` — `proizvodi.xlsx`, `porudzbine.csv`, `kupci.csv`, `offline-konverzije.csv` (staff token checked server-side).
- Convex HTTP (`*.convex.site`): Convex Auth routes (`auth.addHttpRoutes(http)`), `POST /resend-webhook`.

### B4. Canonical and caching rules
- `metadataBase = NEXT_PUBLIC_SITE_URL`; absolute canonicals; lowercase, no trailing slash, Serbian ASCII slugs; tracking params never in canonicals.
- Robots disallow only `/admin`, `/api`, `/nalog`, `/majstor` (auth areas); other noindex pages stay crawlable so the noindex is seen.
- Cache tags: `settings`, `categories`, `vehicles`, `manufacturers`, `category:<id>`, `product:<id>`, `products`, `landing:<categoryId>:<brandId>[:<modelId>]`, `content:<slug>`, `faqs`, `adLanding:<slug>`. Convex's dispatcher calls `/api/revalidate` on `product.changed`, `category.changed`, `settings.changed`, `content.changed` (no-op when `NEXT_SITE_URL` is unreachable, e.g. localhost).

## C. Data model (Convex)

Notation: `str` `num` `int` (v.number(), integer asserted in code) `bool` `id<t>` `opt<…>` (v.optional) `lit(a|b)` (v.union of v.literal) `arr<…>` `obj{…}`. Every table has `_id`, `_creationTime`. **Bounded arrays only** (limits noted); anything unbounded is its own table. Index names include all fields (`by_a_and_b`). Money: `int` para (1/100 RSD), prices **incl. PDV** unless named `…Net…`. Timestamps: ms since epoch (UTC); "day" strings are Europe/Belgrade `YYYY-MM-DD`.

### C0. Shared validators (`convex/lib/validators.ts`)
- `touchV = obj{ source?, medium?, campaign?, term?, content?, gclid?, gbraid?, wbraid?, fbclid?, msclkid?, referrer?, landingPath?, at: num }` (strings ≤ 300 chars)
- `attributionV = obj{ first?: touchV, last?: touchV, fbp?, fbc?, gaClientId?, consentAnalytics: bool, consentAds: bool }`
- `contactV = obj{ firstName, lastName, email, phone }` (e-mail lowercased, phone E.164 `+3816…`)
- `addressV = obj{ street, city, postalCode (5 digits), note? }` · `companyV = obj{ name, pib (9), mb? (8), address?: addressV }`
- `vehicleSnapshotV = obj{ brandId?, modelId?, generationId?, engineId?, year?: int, vin?, label: str }`
- `consentV = obj{ termsVersion, privacyVersion, acceptedAt: num, marketingEmail: bool, analytics: bool, ads: bool }`
- `actorV = obj{ type: lit(customer|mechanic|staff|owner|system), userId?: id<users>, name? }`
- Enums: `qualityV = lit(original|oem|aftermarket)` · `stockStateV = lit(in_stock|low_stock|out_of_stock|on_order)` · `orderStatusV = lit(nova|potvrdjena|ceka_deo|spremna_za_preuzimanje|poslata|preuzeta|isporucena|zavrsena|otkazana)` · `inquiryStatusV = lit(nov|u_obradi|ponuda_poslata|prihvacena|odbijena|istekla)` · `deliveryMethodV = lit(pickup|courier)` · `paymentMethodV = lit(cod|pickup_cash|pickup_card|bank_transfer|deferred)` · `roleV = lit(customer|staff|owner)` · `mechanicStatusV = lit(pending|approved|rejected|suspended)`.

### C1. Identity and access
**Convex Auth tables** (`...authTables`): `authSessions`, `authAccounts`, `authRefreshTokens`, `authVerificationCodes`, `authVerifiers`, `authRateLimits`, plus our customized `users`.

**users** — keeps Convex Auth fields (`name?`, `image?`, `email?`, `emailVerificationTime?`, `phone?`, `phoneVerificationTime?`, `isAnonymous?`) and adds (all optional so Convex Auth inserts validate): `role?: roleV` (missing = customer) · `status?: lit(active|blocked)` · `firstName?` `lastName?` `phoneE164?` · `mechanicStatus?: lit(none|pending|approved|rejected|suspended)` (denormalized from the profile) · `mechanicProfileId?: id<mechanicProfiles>` · `marketingConsent?: bool` · `lastSeenAt?` · `isDemo?` `isTest?`. Indexes: `email` [email] and `phone` [phone] (names required by Convex Auth), `by_role` [role], `by_mechanicStatus` [mechanicStatus].

**staffInvites** — `emailLower`, `role: lit(staff|owner)`, `tokenHash`, `expiresAt`, `createdBy: id<users>`, `acceptedAt?`, `acceptedBy?`, `revokedAt?`. Idx `by_tokenHash`, `by_emailLower`.

### C2. Settings and content
**settings** (singleton, `key: lit("global")`, idx `by_key`):
- `company{ legalName, displayName?, pib?, mb?, address{street, city, postalCode}, phones: arr≤5<{label, e164}>, viber?, whatsapp?, email?, bankAccounts: arr≤3<{bank, account}>, mapUrl?, registryNote? }` — empty by default; the UI hides empty parts (HUMAN-TODO).
- `hours: arr7<{ day: 0–6, open: "08:00", close: "16:00", closed: bool }>` · `holidays: arr≤30<{ date, note }>`
- `brand{ name: "SKLOP", tagline, orderPrefix: "SK", inquiryPrefix: "UP" }` · `trustFacts: arr≤6<{ label, value }>` (home „činjenice" band — only real, owner-entered facts; computed ones such as „artikala na stanju" come from queries)
- `commerce{ vatRateBp: 2000, freeShippingOverPara: 1_000_000, lowStockDefault: 3, stockDecrementOn: lit(confirmed|created) = confirmed, restockOnCancel: true, quoteValidityDays: 7, minMarginBp: 800, autoCompleteDays: 15, shipCutoff: "14:00", etaText }`
- `deliveryMethods: arr≤4<{ code: deliveryMethodV, label, description, pricePara, freeOverPara?, active, etaText }>` (defaults: pickup 0; courier 45 000 para, free over 1 000 000 para)
- `paymentMethods: arr≤6<{ code: paymentMethodV, label, instructions, active, requires: lit(none|company|mechanic_credit), deliveryCodes: arr<deliveryMethodV> }>` (cod→courier; pickup_cash/pickup_card→pickup; bank_transfer→both, requires company; deferred→both, requires mechanic_credit)
- `couriers: arr≤6<{ code, name, trackingUrlTemplate }>` (`…?code={broj}`)
- `notifications{ staffEmails: arr≤10<str>, digestEnabled, digestHour: 8, reminderAfterWorkingMinutes: 120, lowStockEmail: bool }`
- `seo{ titleSuffix: " | SKLOP", defaultDescription, ogImageStorageId?, landingMin{ brand: 8, model: 6, generationPage: 10 }, maxIndexableLandings: 300 }`
- `tracking{ ga4Id?, gadsId?, gadsLabels{ purchase?, lead?, mechanicSignup? }, metaPixelId?, metaCapiEnabled: false, metaTestEventCode?, gadsOfflineConversionName? }` — all empty ⇒ everything is a no-op.
- `flags{ publicPrices: true, guestCheckout: true, backInStock: true, mechanicRegistration: true, threeDHero: true, quickOrder: true, generationLandings: false }`
- `legalVersions{ terms, privacy, cookies }` · `updatedAt`, `updatedBy?`

**contentPages** — `slug`, `title`, `bodyMd` (placeholders `{{firma.naziv}}`, `{{firma.pib}}` …), `version: int`, `published`, `needsLegalReview`, `updatedAt`, `updatedBy?`. Idx `by_slug`.
**faqs** — `scope` (`home` | `za-majstore` | `dostava` | `category:<slug>` | `landing`), `question`, `answerMd`, `sortOrder`, `active`. Idx `by_scope_and_sortOrder`.
**counters** — `name` (`order:2026`, `inquiry:2026`), `value: int`. Idx `by_name`.
**redirects** — `fromPath`, `toPath`, `kind: lit(product|category|manual)`, `hits: int`. Idx `by_fromPath`.
**adLandings** — `slug`, `title`, `headline`, `subhead?`, `bodyMd?`, `categoryId?`, `brandId?`, `modelId?`, `generationId?`, `productIds: arr≤24<id<products>>`, `indexable`, `active`, `updatedAt`. Idx `by_slug`.

### C3. Vehicles
**vehicleBrands** — `name` („Škoda"), `slug` (`skoda`), `aliases: arr≤10` (`["skoda","škoda","scoda"]`), `wmi: arr≤20` (`["TMB"]`), `sortOrder`, `active`, `source: lit(seed|admin|import)`. Idx `by_slug`, `by_sortOrder`.
**vehicleModels** — `brandId`, `name`, `slug`, `aliases`, `sortOrder`, `active`, `source`. Idx `by_brandId_and_slug`, `by_brandId_and_sortOrder`.
**vehicleGenerations** — `brandId`, `modelId`, `name` („Golf VII"), `code?` („5G"), `vinModelCodes: arr≤6` (VIN positions 7–8), `slug` (`golf-7`; how people search: `golf-4`, `passat-b6`, `octavia-3`, `a4-b8`, `leon-3`), `aliases` („golf 7", „golf vii", „mk7"), `yearFrom: int`, `yearTo?: int`, `platform?` („MQB"), `sortOrder`, `active`, `source`. Idx `by_modelId_and_slug`, `by_modelId_and_yearFrom`.
**engines** — `name` („2.0 TDI 110 kW"), `slug`, `codes: arr≤8` (`["CRLB","DFGA"]`), `fuel: lit(benzin|dizel|hibrid|elektro|cng|lpg)`, `displacementCc?`, `powerKw`, `powerHp`, `source`. Idx `by_slug` (≤ ~500 rows).
**generationEngines** — `generationId`, `engineId`, `yearFrom?`, `yearTo?`. Idx `by_generationId`, `by_engineId`.
Picker = brand → model → generation → engine. A selected vehicle is `{ brandSlug, modelSlug, generationSlug, engineSlug? }`.

### C4. Catalog
**categories** — `slug` (globally unique; shares the `/delovi/[slug]` namespace), `name`, `kind: lit(system|category|subcategory)`, `parentId?`, `systemSlug`, `partKey?` (3D category key = own slug when it has nodes), `relatedSlugs: arr≤6`, `sortOrder`, `active`, `intro?` (SEO intro Markdown 80–180 words), `seoTitle?`, `seoDescription?`, `thumbnailPath?` (`/images/parts/<slug>.webp`), `thumbnailStorageId?`, `googleCategoryId?: int`, `productCount: int`, `inStockCount: int`, `updatedAt`, `source`. Idx `by_slug`, `by_parentId_and_sortOrder`, `by_kind_and_sortOrder`, `by_systemSlug_and_sortOrder`. Products attach to **leaf** categories only; a parent listing (e.g. `filteri`) merges its ≤ 10 children in memory.
**manufacturers** — `name`, `slug`, `aliases`, `isVagGenuine: bool` („Original VAG"), `defaultQuality: qualityV`, `country?`, `description?`, `active`, `productCount`, `source`. Idx `by_slug`, `by_name`.

**products** (listing-critical and compact; heavy fields in `productContent`):
`sku` (unique; demo `DEMO-…`), `slug` (unique, stable), `name` (≤ 160), `categoryId`, `systemSlug`, `manufacturerId`, `manufacturerName`, `quality: qualityV`, `mpn?` (manufacturer part number), `oemPrimary?`, `ean?`, `retailPricePara: int` (no `compareAt` promo price in v1 — D22), `stockQty: int` (available, ≥ 0), `stockState: stockStateV` (derived, stored), `lowStockThreshold?: int`, `leadTimeDays?: int`, `allowBackorder: bool`, `primaryImageId?: id<_storage>`, `imageCount: int`, `universal: bool` (fits all, e.g. oils by spec), `fitmentCount: int`, `fitmentSummary?` („VW Golf VII, Škoda Octavia III i još 6"), `searchText` (≤ 1 500 chars: name + ASCII-folded name + manufacturer + category + codes + vehicle names), `popularity: num`, `active: bool`, `deletedAt?`, `isDemo: bool`, `source: lit(seed|import|manual)`, `importBatchId?`, `lastImportBatchId?`, `updatedAt`, `contentUpdatedAt`.
Idx `by_sku`, `by_slug`, `by_categoryId_and_active_and_popularity`, `by_categoryId_and_active_and_retailPricePara`, `by_categoryId_and_active_and_updatedAt`, `by_manufacturerId_and_active`, `by_active_and_contentUpdatedAt` (sitemaps/feeds), `by_stockState_and_active`, `by_importBatchId`, `by_isDemo`.
Search idx `search_products` { searchField `searchText`, filterFields `active`, `categoryId`, `systemSlug`, `manufacturerId`, `quality`, `stockState` }.

**productContent** (1:1, idx `by_productId`) — `description?` (Markdown ≤ 5 000), `specs: arr≤40<{ label, value, unit? }>`, `oemNumbers: arr≤50<{ raw, normalized, brand? }>`, `crossNumbers: arr≤100<{ manufacturer, raw, normalized }>`, `images: arr≤12<{ storageId, alt, width, height, sourceUrl? }>`, `notes?` (public „Napomena"), `seoTitle?`, `seoDescription?`, `weightGrams?`, `warrantyMonths?`, `updatedAt`.
**productPrivate** (staff only, idx `by_productId`) — `costNetPara?` (purchase price **excl. PDV**), `supplierName?`, `supplierSku?`, `internalNote?`, `updatedAt`.
**productCodes** — `code` (normalized: uppercase, only `[A-Z0-9]`), `kind: lit(oem|cross|mpn|sku|ean)`, `productId`, `raw`, `label?` (manufacturer/brand), `active`, `categoryId` (denormalized). Idx `by_code` (exact match, plus prefix range `gte(code, p)` / `lt(code, p + "\uffff")`), `by_productId`.
**fitments** — `productId`, `brandId`, `modelId`, `generationId`, `engineId?` (absent = all engines of the generation), `yearFrom?`, `yearTo?`, `note?` („prednja osovina", „samo DSG"), denormalized `categoryId`, `active`, `manufacturerId`, `quality`. Idx `by_productId`, `by_generationId_and_categoryId_and_active`, `by_modelId_and_categoryId_and_active`, `by_brandId_and_categoryId_and_active`, `by_engineId`. ≤ 200 fitments per product (larger lists → `universal` or split products).

Catalog invariants (enforced by `convex/lib/productWriter.ts`, the only code that writes products): `productCodes` mirror sku/mpn/ean/oem/cross exactly; fitment and code denormalized fields match the product; `stockState` = qty 0 → (`leadTimeDays` or `allowBackorder` ? `on_order` : `out_of_stock`), qty ≤ threshold (product override or `settings.commerce.lowStockDefault`) → `low_stock`, else `in_stock`; `categories.productCount/inStockCount` and `manufacturers.productCount` adjusted in the same transaction (nightly reconcile cron corrects drift); slug changes insert a `redirects` row; every staff write goes through `audit()`; product changes emit `product.changed`.

### C5. Pricing and B2B
**priceTiers** — `name` („Majstor"), `slug`, `defaultDiscountBp: int` (1000 = 10 %), `categoryRules: arr≤100<{ categoryId, discountBp }>`, `manufacturerRules: arr≤200<{ manufacturerId, discountBp }>`, `minMarginBp?`, `active`, `sortOrder`, `isDefault`, `publicDescription?`. Idx `by_slug`, `by_sortOrder`. Seeds: Majstor 1000, Majstor Plus 1500, Partner 2000 (HUMAN-TODO „potvrditi sa klijentom").
**mechanicProfiles** — `userId`, `status: mechanicStatusV`, `companyName`, `pib`, `mb`, `contactPerson`, `phone`, `email`, `city`, `address`, `serviceTypes: arr≤7<lit(mehanika|elektrika|limarija|vulkanizer|dijagnostika|klima|ostalo)>`, `brandsServiced: arr≤5<id<vehicleBrands>>`, `tierId?`, `personalRules?: obj{ defaultDiscountBp?, categoryRules?: arr≤50, manufacturerRules?: arr≤100 }`, `creditEnabled: bool`, `creditLimitPara?`, `paymentTermsDays: int = 15`, `internalNote?`, `rejectionReason?`, `reviewedAt?`, `reviewedBy?`, `attribution?`, `consent: consentV`, `isDemo`, `updatedAt`. Idx `by_userId`, `by_status`, `by_pib`.
**savedVehicles** — `userId`, `label?`, `brandId?`, `modelId?`, `generationId?`, `engineId?`, `year?`, `vin?`, `plate?`, `note?`. Idx `by_userId`.
**favorites** — `userId`, `productId`. Idx `by_userId_and_productId`.

**Pricing function** (pure, `lib/domain/pricing.ts`, imported by Convex; 100 % branch coverage):
```ts
resolveUnitPrice(input: {
  retailPricePara: number; categoryPath: string[] /* nearest first */; manufacturerId: string;
  costNetPara?: number; vatRateBp: number; globalMinMarginBp: number;
  tier?: TierRules; personal?: PersonalRules; roundingPara?: number /* 100 */ }
): { unitPricePara: number; discountBp: number; rule: "manufacturer" | "category" | "default" | "none";
     source: "personal" | "tier" | "none"; marginGuardApplied: boolean }
```
Precedence (first defined wins): personal.manufacturer → tier.manufacturer → personal.category (walk ancestors, nearest first) → tier.category → personal.default → tier.default → 0. Price = round-half-up(retail × (10000 − bp) / 10000) to whole dinars. **Margin guard** when cost is known: `floor = ceilToDinar(costNet × (1 + minMarginBp/10000) × (1 + vatRateBp/10000))` with `minMarginBp = tier.minMarginBp ?? settings.commerce.minMarginBp`; price = max(price, floor), never above retail; if floor ≥ retail → retail, discountBp 0, `marginGuardApplied: true`. Called only server-side (`convex/lib/pricing.ts` loads tier/profile/cost).

### C6. Carts and orders
**carts** — `ownerType: lit(user|guest)`, `userId?`, `guestTokenHash?`, `status: lit(active|merged|converted|abandoned)`, `updatedAt`, `expiresAt?`. Idx `by_userId_and_status`, `by_guestTokenHash`, `by_status_and_updatedAt`. ≤ 1 active cart per user; the guest cart merges on login (quantities summed, capped by stock rules).
**cartItems** — `cartId`, `productId`, `quantity: int` (1–999), `source: lit(catalog|three_d|quick_order|reorder|quote|search)`, `addedAt`. Idx `by_cartId`, `by_cartId_and_productId`. Cart prices are **never stored**; computed per viewer on read.

**orders** — `number` (`SK-2026-000123`), `year`, `seq`, `publicTokenHash`, `status: orderStatusV`, `customerType: lit(guest|customer|mechanic)`, `userId?`, `mechanicProfileId?`, `tierSnapshot?: obj{ tierId, name }`, `contact: contactV`, `company?: companyV`, `delivery: obj{ method, pricePara, address?, courierCode?, trackingNumber?, trackingUrl? }`, `payment: obj{ method, status: lit(unpaid|paid|refunded), paidAt?, dueAt?, reference }` (poziv na broj derived from the number), `totals: obj{ itemsRetailPara, discountPara, itemsPara, deliveryPara, totalPara, vatPara, currency: lit("RSD") }`, `itemCount`, `hasBackorder`, `vehicle?: vehicleSnapshotV`, `customerNote?` (≤ 1 000), `consent: consentV`, `attribution?: attributionV`, `source: lit(web|inquiry|admin|quick_order|reorder)`, `inquiryId?`, `quoteId?`, `cancelReason?`, `cancelledBy?: actorV`, `confirmedAt?` `readyAt?` `shippedAt?` `pickedUpAt?` `deliveredAt?` `completedAt?` `cancelledAt?`, `stockCommitted: bool`, `lastStaffActionAt?`, `reminderLevel: int`, `searchText`, `isDemo`, `isTest?`, `updatedAt`.
Idx `by_number`, `by_publicTokenHash`, `by_status`, `by_userId`, `by_mechanicProfileId`, `by_contact_email` [`contact.email`], `by_inquiryId`, `by_isDemo`, `by_updatedAt`. Search `search_orders` { searchField `searchText`, filterFields `status`, `customerType` }.
**orderItems** — `orderId`, `productId?`, `sku`, `name`, `manufacturerName`, `quality`, `oem?`, `quantity`, `unitRetailPara`, `unitPricePara`, `discountBp`, `lineTotalPara`, `availabilityAtOrder: stockStateV`, `leadTimeDays?`, `isCustomLine`, `note?`. Idx `by_orderId`, `by_productId`.
**orderEvents** — `orderId`, `type: lit(created|status_changed|edited|note|tracking_set|payment_marked|email_sent|email_failed|reminder)`, `fromStatus?`, `toStatus?`, `message?`, `visibleToCustomer: bool`, `actor: actorV`, `at`. Idx `by_orderId_and_at`.

Totals invariants: `itemsPara = Σ lineTotalPara`; `discountPara = itemsRetailPara − itemsPara`; `deliveryPara` from settings (free-over rule applied to `itemsPara`); `totalPara = itemsPara + deliveryPara`; `vatPara = round(totalPara × vatRateBp / (10000 + vatRateBp))`. Numbering: `counters` row `order:<Belgrade year>` incremented in the creating transaction (gapless per year, 6 digits).

**Order state machine** (`lib/domain/orderStateMachine.ts`, pure, exhaustive tests):
```
            ┌──────────────► otkazana ◄──────────────────────────────┐ (reason required; from every open state)
nova ──potvrdi──► potvrdjena ──pripremi (pickup)──► spremna_za_preuzimanje ──preuzeto──► preuzeta ──┐
  │                 │  ▲    └──pošalji (courier + tracking)──► poslata ──isporučeno──► isporucena ────┤
  └──čeka deo──► ceka_deo ◄─┘  (potvrdjena ⇄ ceka_deo)                                                ▼
                                          auto after settings.commerce.autoCompleteDays, or manual ──► zavrsena
```
Allowed: `nova→{potvrdjena, ceka_deo, otkazana}` · `ceka_deo→{potvrdjena, otkazana}` · `potvrdjena→{spremna_za_preuzimanje (pickup only), poslata (courier only; tracking prompted), ceka_deo, otkazana}` · `spremna_za_preuzimanje→{preuzeta, otkazana}` · `poslata→{isporucena, otkazana („Vraćena pošiljka")}` · `preuzeta→{zavrsena}` · `isporucena→{zavrsena}`; `zavrsena`, `otkazana` terminal. Stock decrements on the first entry into `potvrdjena` (per `stockDecrementOn`) and returns on `otkazana` when `stockCommitted && restockOnCancel`. Items editable only in `nova`. Every transition = guard → patch → `orderEvents` → `domainEvents(order.status_changed)` → audit (staff), in one transaction with an `expectedUpdatedAt` precondition.

### C7. Inquiries and quotes
**inquiries** — `number` (`UP-2026-000045`), `year`, `seq`, `publicTokenHash`, `status: inquiryStatusV`, `kind: lit(vin|part|not_found|product_question|quick_order_missing)`, `vin?`, `vinInfo?: obj{ wmi, brandGuess?, modelYearHint?, modelCode? }`, `vehicle?: vehicleSnapshotV`, `message` (≤ 2 000), `categorySlugs: arr≤5`, `productId?`, `searchQuery?`, `requestedCodes: arr≤50`, `photos: arr≤5<id<_storage>>`, `contact: obj{ name, email?, phone?, preferredChannel: lit(phone|viber|whatsapp|email) }` (e-mail or phone required), `userId?`, `mechanicProfileId?`, `assignedTo?`, `attribution?`, `consent`, `orderId?`, `currentQuoteId?`, `firstResponseAt?`, `closedReason?`, `lastStaffActionAt?`, `reminderLevel`, `searchText`, `isDemo`, `isTest?`, `updatedAt`. Idx `by_number`, `by_publicTokenHash`, `by_status`, `by_userId`, `by_vin`, `by_assignedTo_and_status`. Search `search_inquiries`.
**inquiryEvents** — like orderEvents; types `created|status_changed|assigned|quote_sent|quote_accepted|quote_declined|renewal_requested|note|email_sent`.
**quotes** — `inquiryId`, `version: int`, `status: lit(draft|sent|accepted|declined|expired|superseded)`, `validUntil` (end of day Belgrade), `lines: arr≤30<{ productId?, sku?, name, manufacturer?, quality?, quantity, unitPricePara, availability: lit(in_stock|on_order), leadTimeDays?, note? }>`, `deliveryNote?`, `totalPara`, `sentAt?`, `sentBy?`, `acceptedAt?`, `declinedAt?`, `declineReason?`, `orderId?`. Idx `by_inquiryId_and_version`.

**Inquiry / quote state machine**:
```
nov ──staff opens/assigns──► u_obradi ──send quote v1──► ponuda_poslata ──accept (now ≤ validUntil)──► prihvacena ──► order (source inquiry)
 │                              ▲  │                         ├── customer declines ──► odbijena
 └── staff closes (reason) ─────┼──┴──► odbijena             ├── cron: validUntil passed ──► istekla ──„Zatraži obnovljenu ponudu"──► u_obradi
                                └──── staff revises: new version (old → superseded), stays ponuda_poslata
```
Accepting creates the order in the same transaction (quote lines → order items at quoted prices; delivery/payment from the accept form), sets `orderId`, emits `quote.accepted` + `order.created`.

**Mechanic profile states**: `pending → approved | rejected`; `approved ⇄ suspended`; `rejected → pending` (staff reopen). Each change emits `mechanic.*` and updates `users.mechanicStatus`.

### C8. Stock, subscriptions, search
**stockMovements** — `productId`, `delta`, `qtyBefore`, `qtyAfter`, `reason: lit(manual|order_confirmed|order_cancelled|order_edited|import|import_rollback|correction|receipt|return)`, `refType?: lit(order|import|manual)`, `refId?`, `actor`, `note?`, `importBatchId?`, `at`. Idx `by_productId_and_at`, `by_at`, `by_importBatchId`.
**priceChanges** — `productId`, `oldRetailPara`, `newRetailPara`, `oldCostNetPara?`, `newCostNetPara?` (staff-only projection), `reason: lit(manual|import|import_rollback|bulk)`, `actor`, `importBatchId?`, `at`. Idx `by_productId_and_at`, `by_at`. Written by `productWriter` on every price change (records + 30-day-lowest-price rule, D22).
**backInStockSubscriptions** — `productId`, `email`, `userId?`, `status: lit(active|notified|cancelled)`, `unsubscribeTokenHash`, `consentAt`, `notifiedAt?`, `isDemo?`. Idx `by_productId_and_status`, `by_email`, `by_unsubscribeTokenHash`.
**searchLogs** (raw, 180-day retention) — `query` (≤ 200), `normalized`, `kind: lit(code|text|mixed)`, `resultsCount`, `exactCodeHit`, `userType: lit(anon|customer|mechanic|staff)`, `generationId?`, `source: lit(header|search_page|quick_order|three_d|landing)`, `sessionHash?`, `at`. Idx `by_at`, `by_normalized_and_at`.
**searchDaily** — `day`, `normalized`, `sample`, `count`, `zeroCount`, `lastAt`. Idx `by_day_and_normalized`, `by_normalized_and_day`. Feeds „Traženo, a nemamo".

### C9. Events, notifications, e-mail
**domainEvents** (outbox) — `type` (§I), `aggregateType: lit(order|inquiry|quote|mechanic|product|category|settings|content|stock|import|user|system)`, `aggregateId`, `payload` (typed `v.union` per event type), `status: lit(pending|processing|done|failed|dead)`, `attempts`, `nextAttemptAt`, `lastError?`, `dedupeKey` (unique, e.g. `order.status_changed:<orderId>:potvrdjena:<n>`), `actor?`, `capiContext?: obj{ ip, userAgent, eventSourceUrl }` (deleted right after the CAPI send), `processedAt?`. Idx `by_status_and_nextAttemptAt`, `by_dedupeKey`, `by_aggregateType_and_aggregateId`.
**notifications** (in-app) — `userId`, `kind`, `title`, `body`, `href`, `eventId?`, `read: bool`, `readAt?`, `isDemo?`. Idx `by_userId_and_read`, `by_userId`.
**notificationDeliveries** (idempotency ledger) — `eventId`, `channel: lit(email|inapp|meta_capi|revalidate)`, `recipient`, `templateKey?`, `status: lit(pending|sent|failed|skipped)`, `attempts`, `lastError?`, `providerRef?`, `sentAt?`. Idx `by_eventId_and_channel_and_recipient`, `by_status`.
**staffPreferences** — `userId`, `email: obj{ orderNew, inquiryNew, mechanicNew, lowStock, reminders, digest }`, `inApp: obj{ … }`, `updatedAt`. Idx `by_userId`.
**emailLog** — `to: arr≤10`, `subject`, `templateKey`, `html?` (pruned after 90 days), `text`, `preheader?`, `mode: lit(log|test|live)`, `status: lit(logged|queued|sent|delivered|delivery_delayed|bounced|complained|failed|opened|clicked)`, `resendEmailId?`, `error?`, `eventId?`, `relatedType?: lit(order|inquiry|mechanic|user|product|digest|test|auth)`, `relatedId?`, `updatedAt`. Idx `by_status`, `by_relatedType_and_relatedId`, `by_resendEmailId`.

### C10. Import
**importBatches** — `fileName`, `fileSize`, `fileSha256?`, `sourceFileId?: id<_storage>`, `format: lit(xlsx|xls|csv)`, `encoding?: lit(utf-8|windows-1250)`, `delimiter?`, `sheetName?`, `headerRow: int`, `numberFormat: lit(sr|en)`, `mode: lit(full|stock_price)`, `deactivateMissing: bool`, `mapping: arr≤80<{ column, header, field }>`, `presetId?`, `status: lit(staging|validated|committing|committed|failed|rolling_back|rolled_back|cancelled)`, `counts: obj{ total, create, update, unchanged, skip, error, warning, committed, failed, deactivated }`, `progress: obj{ stagedRows, committedRows, rolledBackRows }`, `createdBy`, `validatedAt?`, `committedAt?`, `rolledBackAt?`, `rolledBackBy?`, `cursor?`, `note?`. Idx `by_status`, `by_createdBy`.
**importRows** — `batchId`, `rowNumber`, `sku?`, `data` (object of optional normalized fields), `action: lit(create|update|unchanged|skip|error)`, `errors: arr≤20<{ code, field?, message }>`, `warnings: arr≤20`, `productId?`, `matchKey?: lit(sku|oem_manufacturer)`, `changedFields: arr≤40`, `committed: bool`. Idx `by_batchId_and_rowNumber`, `by_batchId_and_action`, `by_batchId_and_sku`.
**importChanges** — `batchId`, `productId`, `action: lit(create|update|deactivate)`, `before?` (changed fields only, incl. stockQty, prices, active, codes/fitment snapshots), `after`, `rowNumber?`, `productUpdatedAtAfter`, `rolledBack: bool`, `rollbackSkippedReason?`. Idx `by_batchId`, `by_productId`.
**importMappingPresets** — `name`, `mapping: arr≤80<{ headerNormalized, field }>`, `createdBy`, `isDefault`, `updatedAt`. Idx `by_name`.
**imageFetchJobs** — `batchId?`, `productId`, `url`, `status: lit(pending|done|failed|skipped)`, `attempts`, `error?`, `storageId?`. Idx `by_status`, `by_batchId`.

### C11. Records, files, analytics
**auditLog** — `actor: actorV`, `action` (`product.update`, `order.transition`, `settings.update` …), `entityType`, `entityId`, `summary` (Serbian), `diff?: arr≤50<{ field, before?, after? }>` (stringified ≤ 500 chars each), `at`. Idx `by_entityType_and_entityId_and_at`, `by_actor_userId_and_at`, `by_at`, `by_action_and_at`.
**uploads** — `storageId`, `purpose: lit(inquiry_photo|product_image|import_file|category_image|content_image)`, `uploaderKey`, `status: lit(pending|attached|rejected)`, `contentType?`, `size?`, `attachedTo?: obj{ type, id }`, `checkedAt?`. Idx `by_storageId`, `by_status`.
**consentRecords** — `consentId` (uuid from the consent cookie), `choices: obj{ analytics, ads }`, `policyVersion`, `at`, `uaHash?`, `userId?`. Idx `by_consentId`.
**landingStats** — `categoryId`, `brandId`, `modelId?`, `productCount`, `inStockCount`, `minPricePara`, `maxPricePara`, `manufacturerCount`, `generationIds: arr≤30`, `indexable`, `reason?`, `dirty: bool`, `updatedAt`. Idx `by_categoryId_and_brandId_and_modelId`, `by_indexable`, `by_dirty`.
**statsDaily** — `day`, `ordersCount`, `ordersValuePara`, `cancelledCount`, `inquiriesCount`, `registrationsCount`, `zeroSearches`, `byCategory: record<categoryId, obj{ count, valuePara }>` (≤ 60 keys). Idx `by_day`. Updated in the same transaction as the source write.
**cronRuns** — `job`, `localKey` (`digest:2026-09-29`), `ranAt`. Idx `by_job_and_localKey`. Guarantees once-per-local-slot jobs.

Demo invariant: `isDemo` is set on every seeded product, user, mechanic profile, order, inquiry, cart and subscription and propagates to their child rows; reference data (brands, models, generations, engines, categories, manufacturers, tiers) is `source: "seed"` and is **not** removed by „Obriši demo podatke".

## D. Auth and authorization

### D1. Provider (unattended)
- `npm i @convex-dev/auth @auth/core@^0.41.1`, `npm i -D jose`. `convex/auth.ts`: `export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({ providers: [Password({ profile, reset: PasswordResetCode, validatePasswordRequirements })], session: { totalDurationMs: 30 days, inactiveDurationMs: 14 days }, jwt: { durationMs: 1 h } })` (confirm option names in `node_modules/@convex-dev/auth` types).
- `profile(params)` lowercases/validates the e-mail and sets `name`; `validatePasswordRequirements`: ≥ 10 characters, at least one letter and one digit, not equal to the e-mail.
- `PasswordResetCode`: `Email({ id: "password-reset", maxAge: 15 min, generateVerificationToken: 8 digits, sendVerificationRequest })` from `@convex-dev/auth/providers/Email`; the runtime passes the action ctx as an (undocumented) second argument — declare it optional and call `ctx.runMutation(internal.emails.enqueueAuthCode, …)` so the code flows through our e-mail pipeline (`auth.password_reset_requested`). In `log` mode the code is visible in `/admin/mejlovi` (HUMAN-TODO: go live with Resend).
- `callbacks`: keep the default user creation; `beforeSessionCreation(ctx, { userId })` throws for `users.status = "blocked"`. Built-in failed-password limiter: `signIn: { maxFailedAttempsPerHour: 10 }` (sic — the option name is misspelled in the library). Roles are **never** read from sign-up params.
- Keys: RS256 `JWT_PRIVATE_KEY` + `JWKS` generated with `jose` (skill command), set with `npx convex env set "NAME=VALUE"` (never `env set NAME value` — the leading `-` of the key breaks the CLI); `SITE_URL=http://localhost:3000`; delete the temporary key file.
- `convex/auth.config.ts`: `{ providers: [{ domain: process.env.CONVEX_SITE_URL, applicationID: "convex" }] }` (missing/incorrect = silently signed out).
- `convex/http.ts`: `auth.addHttpRoutes(http)`.
- Next: `proxy.ts` = `convexAuthNextjsMiddleware(handler, { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } })` exported as `proxy` (default export also accepted), `config.matcher = ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"]` (covers `/api/auth`; skips files with extensions such as sitemaps, feeds, models, images); root layout wraps `<html>` in `ConvexAuthNextjsServerProvider`; client provider `ConvexAuthNextjsProvider client={convex}`; forms call `useAuthActions().signIn("password", formData)` with `flow` = `signIn` | `signUp` | `reset` | `reset-verification`. Cookies (`__convexAuthJWT`, `__convexAuthRefreshToken`, `__Host-` prefix off localhost) are set by the proxy; the refresh token never reaches client JS.
- Step 05 proves a real round-trip on Next 16 first (sign up → cookie → `users.viewer` returns the user → sign out). If the Next integration fails on Next 16, apply fallback R1 (§O).

### D2. Roles and states
| Role | Source of truth | Access |
|---|---|---|
| anonymous | no session | retail prices (or „Cena na upit" when `flags.publicPrices=false`), guest cart via token, public forms |
| customer | `users.role` missing or `customer` | own orders, inquiries, saved vehicles, favorites, profile |
| mechanic pending / rejected / suspended | `mechanicProfiles.status` | customer access + status banner, retail prices |
| mechanic approved | `status = approved` | + own prices everywhere, quick order, price list, deferred payment if `creditEnabled` |
| staff | `users.role = staff` | admin except owner-only areas; sees cost and margin |
| owner | `users.role = owner` | everything incl. settings danger zone, users/invites, tier editing, demo removal |

Blocked users (`status = blocked`) fail every authenticated function.

### D3. Enforcement layers
1. **Convex (authoritative)** — `convex/lib/authz.ts`: `getViewer(ctx)` (via `getAuthUserId`) → `{ user, role, mechanic?: { status, profileId, tierId, creditEnabled } } | null`; `requireUser`, `requireStaff`, `requireOwner`, `requireApprovedMechanic`. Function builders (convex-helpers `customQuery`/`customMutation`): `publicQuery`, `publicMutation` (injects `ctx.client = { key, ip, userAgent }` from `ctx.meta.getRequestMetadata()`; key = SHA-256(`IP_HASH_SALT` + ip + UA)), `userQuery`/`userMutation`, `staffQuery`/`staffMutation`, `ownerMutation`. Never accept a user id for authorization; ownership checks on every document fetched by id or token.
2. **Next server (DAL)** — `lib/server/auth.ts` (`import 'server-only'`): `getViewer()` = React `cache()` around `fetchQuery(api.users.viewer, {}, { token: await convexAuthNextjsToken() })`; `requireStaffPage()` (redirect to `/prijava?next=` when anonymous, `forbidden()` when not staff), `requireAccountPage()`, `requireMechanicPage()`. Called in the admin/account/mechanic layouts **and** at the top of every page/route handler there (layouts do not stop sibling pages from rendering).
3. **Proxy (UX only)** — redirects anonymous users away from `/nalog`, `/majstor`, `/admin` and signed-in users away from `/prijava`, `/registracija`; no role checks, no DB calls beyond Convex Auth's own token refresh.
4. **Client forms** validate with the shared zod schema for UX; the Convex mutation re-validates everything (validators + shared pure checks). The few Server Actions (cookie setters) only touch cookies.

### D4. Price-visibility guarantees
- Public/cached queries (`catalog.*`, `search.*`, feeds, sitemaps) are anonymous projections with explicit `returns` validators (an extra field such as cost fails validation instead of leaking).
- `productPrivate` is read only by `staffQuery` functions and inside the server-side pricing helper, which returns only the final unit price.
- Mechanic prices come only from `pricing.forProducts`, `carts.get`, `catalog.partPanel` and `mechanics.*` for the authenticated approved mechanic; every other caller gets `yourPricePara: null`.
- SSR never renders a role-specific price; cached HTML is identical for all viewers.
- convex-test matrix (§M) asserts payloads for anonymous, customer, pending, approved (tier A vs. B) and staff.

### D5. Staff invites and owner seed
- Owner creates an invite (e-mail, role) → token shown once („Kopiraj link"), e-mailed when live → `/admin/pozivnica/<token>` → sign up/in with that e-mail → `staff.acceptInvite({ token })` binds the role (e-mail must match; not expired/revoked) → audit.
- `seed:createOwner` internal action reads `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` from Convex env (set with `npx convex env set`), calls `createAccount(ctx, { provider: "password", account: { id, secret }, profile: { email, name: "Vlasnik" } })` when missing, then sets `role = owner`. Idempotent; never logs the password.

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

## F. 3D contract

### F1. Final taxonomy (slugs frozen)
Stage = explode stage (§F6). Instances are node suffixes (`part__<category>__<instance>`). Service categories have no mesh (thumbnail render of a representative item only).

| System (slug · label) | Category slug | Label (sr) | Instances | Stage |
|---|---|---|---|---|
| `motor-i-usis` · Motor i usis | `motor` | Blok motora i glava | `block`, `head` | 5 |
| | `turbina` | Turbina (turbopunjač) | `main` | 5 |
| | `interkuler` | Interkuler | `main`, `pipes` | 4 |
| | `usisna-grana` | Usisna grana i kućište filtera | `manifold`, `airbox` | 4 |
| | `brizgaljke-pumpa-goriva` | Brizgaljke i pumpa goriva | `injectors`, `pump` | 5 |
| | `zupcasti-kais-vodena-pumpa` | Set zupčastog kaiša i vodena pumpa | `belt`, `water-pump` | 5 |
| | `kais-alternatora` | Kaiš alternatora i zatezači | `belt` | 4 |
| | `alternator` | Alternator | `main` | 4 |
| | `anlaser` | Anlaser | `main` | 4 |
| | `paljenje-grejaci` | Svećice, bobine i grejači | `coils` | 5 |
| | `karter-dihtunzi` | Karter, pumpa ulja i dihtunzi | `sump` | 5 |
| | `egr-ventil` | EGR ventil | `main` | 5 |
| | `nosaci-motora` | Nosači motora i menjača | `l`, `r`, `rear` | 4 |
| `izduvni-sistem` · Izduvni sistem | `dpf-katalizator` | DPF i katalizator | `main` | 7 |
| | `auspuh` | Auspuh (lonci i cevi) | `mid`, `rear` | 7 |
| `hladjenje-i-klima` · Hlađenje i klima | `hladnjak-ventilator` | Hladnjak i ventilator | `radiator`, `fan` | 4 |
| | `termostat-creva` | Termostat i creva hlađenja | `thermostat`, `hoses` | 4 |
| | `klima` | Kompresor i kondenzator klime | `compressor`, `condenser` | 4 |
| `transmisija` · Transmisija | `kvacilo-zamajac` | Kvačilo i zamajac | `main` | 6 |
| | `menjac` | Menjač (DSG) | `main` | 6 |
| | `poluosovine` | Poluosovine i homokinetički zglobovi | `l`, `r` | 6 |
| `vesanje-i-upravljanje` · Vešanje i upravljanje | `amortizeri-opruge` | Amortizeri i opruge | `fl`, `fr`, `rl`, `rr` | 3 |
| | `ramena-selen-blokovi` | Ramena i selen blokovi | `fl`, `fr`, `rear-axle` | 3 |
| | `spone-stabilizatori` | Spone i stabilizatori | `tie-rod-l`, `tie-rod-r`, `stabilizer` | 3 |
| | `letva-volana` | Letva volana | `main` | 3 |
| | `lezaj-glavcina` | Ležaj točka i glavčina | `fl`, `fr`, `rl`, `rr` | 3 |
| `kocnice` · Kočnice | `kocioni-diskovi` | Kočioni diskovi | `fl`, `fr`, `rl`, `rr` | 3 |
| | `kocione-plocice` | Kočione pločice | `fl`, `fr`, `rl`, `rr` | 3 |
| | `kocione-celjusti` | Kočione čeljusti | `fl`, `fr`, `rl`, `rr` | 3 |
| | `abs-senzori` | ABS senzori | `fl`, `fr`, `rl`, `rr` | 3 |
| `elektrika-i-svetla` · Elektrika i svetla | `akumulator` | Akumulator | `main` | 4 |
| | `farovi` | Farovi | `l`, `r` | 1 |
| | `stop-svetla` | Stop svetla | `l`, `r` | 1 |
| | `senzori` | Senzori (lambda, parking, temperatura) | `lambda` (7), `park-front` (1), `coolant-temp` (5) | per node |
| `karoserija` · Karoserija | `hauba` | Hauba | `main` | 1 |
| | `branici` | Branici | `front`, `rear` | 1 |
| | `blatobrani` | Blatobrani | `l`, `r` | 1 |
| | `vrata` | Vrata | `fl`, `fr`, `rl`, `rr` | 1 |
| | `retrovizori` | Retrovizori | `l`, `r` | 1 |
| | `stakla` | Stakla | `windshield`, `rear`, `side` | 1 |
| | `brisaci` | Brisači | `main` | 1 |
| `tockovi` · Točkovi | `felne-gume` | Felne i gume | `fl`, `fr`, `rl`, `rr` | 2 |
| `servis` · Servis i održavanje | `filteri` (subcategories `filter-ulja`, `filter-vazduha`, `filter-goriva`, `filter-kabine`) | Filteri | — (no mesh) | — |
| | `ulja-tecnosti` | Ulja i tečnosti | — (no mesh) | — |

Totals: 10 systems, 44 categories (42 with meshes, 91 clickable nodes), 4 filter subcategories. Corner codes: `fl/fr/rl/rr` = front/rear left/right from the driver's seat. Renames vs. the brief's initial list: `usis-filter-vazduha` → `usisna-grana` (air filters live in `filteri/filter-vazduha`), `ulje-karter` → `karter-dihtunzi` (oil filters live in `filteri/filter-ulja`); related links keep both paths discoverable (`relatedSlugs`, part panel „Povezano: Filteri vazduha").

### F2. Space, units, pivots
- glTF 2.0 binary, **meters**, **+Y up, +Z vehicle front, +X vehicle left** (LHD driver side). Blender authoring: Z-up, front = −Y, left = +X; the exporter's Y-up conversion maps Blender (x, y, z) → glTF (x, z, −y). All manifest vectors are in glTF space; `export.py` converts.
- Origin: ground plane (Y = 0), centred on the wheelbase midpoint and the vehicle centreline. Car ≈ 4.28 × 1.79 × 1.45 m, wheelbase ≈ 2.62 m, 205/55 R16 tyres (Ø ≈ 0.632 m) — step 07 finalizes.
- Every `part__*` node's origin = its mounting point or geometric centre (explode moves node positions); rotation/scale applied (identity scale); no negative scales.
- Non-clickable nodes: `body__structure` (X-ray shell: roof, pillars, quarter panels, sills, tailgate), optional `body__interior` (dash/seat silhouettes), `chassis__subframe`. Child meshes of multi-mesh parts: `mesh__<category>__<instance>__<n>` (no extras; runtime resolves the nearest `part__` ancestor).
- Hierarchy: `sklop_car` (root) → `sys__<system>` groups → `part__…` / `body__…` nodes. Names match `^(part|mesh|body|sys|chassis)__[a-z0-9-]+(__[a-z0-9-]+){0,2}$`, unique, ASCII (GLTFLoader sanitizes spaces, dots, colons, slashes, brackets — never use them).

### F3. Node extras (Blender custom properties → glTF `extras` → three.js `userData`)
```json
{ "partId": "kocioni-diskovi__fl", "category": "kocioni-diskovi", "system": "kocnice",
  "labelSr": "Kočioni disk — prednji levi", "clickable": true, "lod": "core",
  "explodeDir": [0.94, 0.0, 0.34], "explodeDist": 0.42, "explodeStage": 3, "explodeOrder": 0.25,
  "labelAnchor": [0.0, 0.16, 0.0], "focusDir": [0.62, 0.35, 0.70], "focusMinDist": 1.1 }
```
`explodeDir` unit vector in glTF space; `explodeDist` meters; `explodeOrder` 0–1 stagger inside the stage; `labelAnchor` local offset for the callout leader line; `lod: "detail"` nodes are dropped from the lite GLB (each category keeps ≥ 1 core node).

### F4. Manifest (`public/models/car.manifest.json`, generated by `3d/blender/export.py`, validated by `3d/scripts/validate.mjs`; TS types in `lib/three/manifest.ts`)
```ts
type Vec3 = [number, number, number]; type Box3 = { min: Vec3; max: Vec3 };
type Cam = { position: Vec3; target: Vec3; fov: number };
type CarManifest = {
  schemaVersion: 1; generatedAt: string;
  source: { blender: string; scriptsHash: string };
  models: { desktop: ModelFile; lite: ModelFile };           // same node names in both
  units: "meters"; axes: { up: "+Y"; front: "+Z"; left: "+X" };
  bbox: Box3;                                                // assembled car
  systems: { slug: string; labelSr: string; order: number }[];
  stages: { stage: number; key: string; labelSr: string; scroll: { desktop: [number, number]; mobile: [number, number] } }[];
  categories: { slug: string; labelSr: string; system: string; nodes: string[]; hasMesh: boolean;
                thumbnail: string; focus: { dir: Vec3; minDistance: number; fov: number } }[];
  parts: { node: string; partId: string; category: string; system: string; labelSr: string;
           clickable: boolean; lod: "core" | "detail";
           explode: { dir: Vec3; distance: number; stage: number; order: number };
           pivot: Vec3; bbox: Box3; labelAnchor: Vec3; triangles: { desktop: number; lite: number };
           materials: string[] }[];
  cameras: { hero: { desktop: Cam; mobile: Cam }; exploded: { desktop: Cam; mobile: Cam } };
  materials: { name: string; override?: "xray-body" | "xray-glass" }[];
};
type ModelFile = { url: string; bytes: number; sha256: string; triangles: number; drawCalls: number; textures: number };
```
The categories table in Convex (`partKey`) and `categories[]` in the manifest must match 1:1 (a unit test compares `lib/catalog/taxonomy.ts` — the single source for slugs/labels/systems — with the manifest and the seed).

### F5. Materials and budgets
Material slot names (≤ 24): `mat_body_xray`, `mat_glass_xray` (both replaced by the X-ray shader at runtime; exported opaque), `mat_glass_lens`, `mat_cast_iron`, `mat_machined_steel`, `mat_steel_dark`, `mat_brushed_alu`, `mat_cast_alu`, `mat_painted_black`, `mat_plastic_black`, `mat_plastic_grey`, `mat_rubber`, `mat_tyre`, `mat_hose`, `mat_chrome`, `mat_copper`, `mat_ceramic`, `mat_caliper` (graphite/accent — never an automaker's brand colour), `mat_battery`, `mat_heat_shield`, `mat_wire`, `mat_emissive_led`, `mat_emissive_tail`. glTF-compatible Principled inputs only; procedural nodes baked.

| Budget | `car.glb` (desktop) | `car-lite.glb` (mobile) |
|---|---|---|
| File size | target ≤ 6.5 MB, hard ≤ 8 MB | ≤ 3 MB |
| Triangles | target 450–600 k, hard < 800 k | ≤ 250 k |
| Draw calls (after merging per part × material) | ≤ 220 | ≤ 150 |
| Textures | ≤ 10, ≤ 1024², WebP (tyre sidewall/tread normal, radiator/condenser fins, disc surface, heat shield) | ≤ 512² |
| Nodes | ≤ 400 | ≤ 300 |
| Runtime | 60 fps desktop while scrubbing, GPU memory ≤ 60 MB | ≥ 30 fps mid-range phone |

Compression: gltf-transform `dedup → weld → prune → (lite: simplify ratio 0.5, error 0.001) → textureCompress webp (resize 1024 / 512) → meshopt`. Web decoding with the meshopt decoder (WASM, workers where available).

### F6. Explode choreography (scroll-bound)
Desktop track 320 vh pinned, mobile 200 vh; progress `p ∈ [0,1]`; each node moves `pivot + dir × distance × power2.inOut(local)` with `local` from its stage window, staggered by `explode.order`.

| Stage | Key / label | Desktop window | Mobile (grouped) |
|---|---|---|---|
| 0 | hold assembled, headline | 0.00–0.08 | 0.00–0.10 |
| 1 | `karoserija` — Karoserija, stakla i svetla | 0.08–0.24 | 0.10–0.32 (1+2) |
| 2 | `tockovi` — Točkovi | 0.18–0.32 | ″ |
| 3 | `kocnice-vesanje` — Kočnice, vešanje, upravljanje | 0.28–0.46 | 0.30–0.52 |
| 4 | `agregati` — Pomoćni agregati, hlađenje, usis | 0.42–0.58 | 0.50–0.74 (4+5) |
| 5 | `motor` — Motor, turbina, gorivo, paljenje | 0.54–0.72 | ″ |
| 6 | `transmisija` — Menjač, kvačilo, poluosovine | 0.68–0.84 | 0.72–0.92 (6+7) |
| 7 | `izduvni` — Izduvni sistem | 0.80–0.92 | ″ |
| — | hold exploded, hint „Kliknite na deo" | 0.92–1.00 | 0.92–1.00 |

Camera: dolly-out + ~12° orbit from `cameras.hero` to `cameras.exploded` across 0.08–0.92. X-ray shell opacity 0.22 → 0.10 during stage 1. Stage captions are HTML overlays (system name, part count, measurement ticks) revealed per stage. The exploded layout must read as a clean technical drawing from the hero camera (no overlaps at p = 1).

### F7. Loading, poster, fallback, tiers
1. SSR: hero section with a sticky frame; poster `car-assembled` via `next/image` (`preload`, `fetchPriority="high"`, `sizes="100vw"`; art-directed portrait crop < 768 px via `getImageProps` + `<picture>`), LCP-safe headline, OEM search (plain GET form to `/pretraga` without JS), vehicle-picker slot, „Lista delova" button. Scroll track height reserved by CSS media queries from the first paint (no layout shift when 3D arrives): `≥1024px & no-preference` → 320 vh, `<1024px & no-preference` → 200 vh, `reduce` → 100 vh.
2. After hydration: tier detection (`lib/three/tier.ts`): **high** (≥ 1024 px, WebGL2, ≥ 4 cores, `deviceMemory ≥ 4` when present, no Save-Data) → desktop GLB, DPR ≤ 2 adaptive; **mid** (capable phones/tablets) → lite GLB, DPR ≤ 1.5, simplified X-ray shader, tap-only; **low** (no WebGL2, Save-Data, `deviceMemory < 3`) → no 3D: GSAP crossfade assembled ↔ exploded posters along the same track + stage captions.
3. Start 3D on first intent (pointer over hero, scroll > 40 px, touchstart, focus inside hero) or `requestIdleCallback` ≥ 4 s after `load`. Then dynamic-import the canvas chunk (budget ≤ 350 KB gz for three + r3f + used drei parts), fetch manifest + GLB, decode, `renderer.compileAsync`, build BVH in idle slices.
4. First frame ready → GSAP crossfade poster → canvas (600 ms); poster stays underneath for context-loss fallback. Progress = 2 px hairline inside the hero frame (fixed size), no layout shift; SR text only after intent („Učitava se 3D prikaz").
5. WebGL context loss → poster, one restore attempt; persistent failure → stay on posters silently.
6. Reduced motion → no pin/scrub; „Rasklopi / Sklopi" toggles states instantly; camera moves are cuts.

### F8. Interaction contract
- **Hover** (fine pointer only): rAF-coalesced raycast against BVH; hover highlights **all nodes of the category** (rim/emissive tint via shader uniforms, no postprocessing) + HTML callout (label, part code style ornament) with a leader line to `labelAnchor`; cursor pointer.
- **Click/tap**: select category → camera glides (GSAP, 0.9 s, `power3.inOut`) to `focus` computed from the category's current bbox (`target = bbox centre`, `position = target + dir × max(minDistance, radius × 2.4)`) → **PartPanel** opens (desktop: right drawer; mobile: bottom sheet with drag) → URL `?deo=<category>` via `history.replaceState`. Esc / close / backdrop → camera returns, `?deo` removed. Empty-canvas click deselects.
- **PartPanel** data: `catalog.partPanel({ categorySlug, vehicle?, limit: 12 })` → in-stock first, fits-selected-vehicle first, then popularity; role-aware price; add to cart; „Pošalji upit" (prefilled); „Svi delovi: Kočioni diskovi (48) →" to `/delovi/<slug>` with vehicle params; empty state with inquiry CTA.
- **Keyboard / SR**: visible „Lista delova" button opens an accessible dialog grouped by system (mirrors the 3D; each item selects exactly like a click); a server-rendered „Delovi po sistemima" section below the hero lists the same categories as links (no-JS and SEO equivalent). Canvas has `role="img"` + `aria-label` („Interaktivni 3D prikaz automobila…") and is not a tab stop; focus returns to the trigger on close.
- **Deep link** `/?deo=<category>`: valid slug → explode to that stage's end, select, open panel (works in the low tier too — the panel is HTML). Unknown slug → ignored.
- **Test hooks** (only when `NEXT_PUBLIC_TEST_HOOKS=1`): `window.__sklop3d = { ready: boolean, tier, selectPart(slug), explode(p), getState() }`.
- Rendering stack: R3F `<Canvas frameloop="demand">` (invalidate on scroll/hover/animation), DPR clamp `[1, tier max]` with adaptive drop on sustained < 50 fps, `useGLTF(url, false, true)` (Draco off → no gstatic fetch; meshopt on), `<Bvh>` for raycasts, pause when the hero is off-screen (IntersectionObserver), dispose on unmount, no postprocessing unless step 10 proves it costs < 2 ms/frame on mid tier.

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

## H. Design direction brief (for step 03 — constraints and north star only)
- **North star „Rendgen"**: an engineering X-ray at night — precise, technical, calm, confident; a premium engineering exhibition / technical drawing. Not a tuning shop, not generic e-commerce, not gaming UI, not sci-fi HUD kitsch.
- **Colour**: dark graphite base, warm off-white text, exactly **one** signal accent (safety orange or electric lime — chosen by measured contrast and character), a cool rim tone reserved for the X-ray glass. Never VW blue, Škoda green, SEAT copper, Audi red as brand colours. Stock and status colours must stay distinguishable without colour alone (icon/label).
- **Type**: display grotesk or condensed face + legible UI sans + monospace for part numbers; all with `latin-ext` (č ć ž š đ verified), tabular numerals for prices/quantities; ≤ 3 families, variable fonts preferred, next/font with `latin` + `latin-ext`; the same families must exist in `@fontsource` (WOFF) for OG images.
- **Ornament with purpose**: 1 px hairlines, measurement ticks, coordinates, part codes in mono, callout leader lines — used to explain (3D callouts, specs, stage captions), never as noise.
- **Imagery**: only Blender renders (posters, part thumbnails) and later the client's photos; no stock, no AI people, no VAG logos; brand names as plain text + nominative-use disclaimer in the footer.
- **Layout**: 360–2560 px; content max width and dense-but-calm product grids; the 3D hero owns the first viewport on desktop, poster-first on mobile.
- **Motion**: GSAP only; text reveal site-wide (LCP-safe variant above the fold); restrained, physical easing; reduced motion fully respected.
- **Accessibility**: WCAG 2.2 AA contrast (4.5:1 text, 3:1 large text/UI), visible 2 px focus with offset, target size ≥ 24 px (44 px primary touch), no information by colour alone.
- **Admin**: same brand, optimized for density and speed; step 03 decides light or dark with reasons (long daylight sessions, print parity for predračun/otpremnica, status colour semantics, glare in the shop).
- **E-mails**: table-based, dark-mode-safe, brand wordmark as text, Serbian, plain-text twin.
- **Deliverables** are defined in step 03's prompt; the design system must give real values (tokens, clamp() scales, durations, eases, contrast table).

## I. Notifications and automations

### I1. Architecture
`emitEvent(ctx, type, payload, dedupeKey)` inserts `domainEvents` (pending) **in the same transaction** as the business write and schedules `events.dispatch` with `runAfter(0)`. The dispatcher resolves recipients (settings + staff preferences), writes `notificationDeliveries` rows (unique per event × channel × recipient — idempotent), creates in-app `notifications`, and enqueues e-mails (`emails.render` → `emails.send`), CAPI (`capi.send`) and cache revalidation (`revalidate.notify`) through the `externalIo` workpool. Failures retry with exponential backoff (1 min, 5 min, 30 min, 2 h, 12 h) → `dead` after 5 attempts (visible in admin). `events.sweep` (every minute) re-dispatches stuck `pending`/`failed` events whose `nextAttemptAt` passed.

**E-mail modes** (`EMAIL_MODE`, default `log`): `log` → render and store in `emailLog` only (**never call the Resend component** — it throws without `RESEND_API_KEY`); `test` → Resend component with `testMode: true`, recipients rewritten to `delivered@resend.dev`; `live` → real recipients (needs `RESEND_API_KEY`, verified domain, `EMAIL_FROM`). Webhook `/resend-webhook` updates statuses; cron `cleanupOldEmails` on the component (7 days) while our `emailLog` keeps metadata 2 years. All templates: Serbian, responsive, dark-mode-safe, preheader, plain-text twin, company data from settings (empty-safe), links with UTM `utm_source=email&utm_medium=transactional`.

### I2. Matrix
| Event | Recipients → channel · template | Timing |
|---|---|---|
| `order.created` | customer → e-mail `order_received`; staff → e-mail `staff_order_new` + in-app; Meta CAPI `Purchase` (if enabled and `consent.ads`) | immediate |
| `order.status_changed` → `potvrdjena` | customer → `order_confirmed` (predračun data + „poziv na broj" when bank transfer; due date for deferred) | immediate |
| → `ceka_deo` | customer → `order_backordered` (lead time) | immediate |
| → `spremna_za_preuzimanje` | customer → `order_ready_pickup` (address, hours, map link) | immediate |
| → `poslata` | customer → `order_shipped` (courier + tracking link) | immediate |
| → `isporucena` / `preuzeta` | customer → `order_delivered` (reklamacije + 14-day withdrawal info) | immediate |
| → `otkazana` | customer → `order_cancelled` (reason) | immediate |
| `inquiry.created` | customer → `inquiry_received`; staff → `staff_inquiry_new` + in-app; CAPI `Lead` | immediate |
| `quote.sent` | customer → `quote_ready` (status link, validity) | immediate |
| `quote.accepted` | staff → `staff_quote_accepted` + in-app (customer gets `order_received` for the new order) | immediate |
| `quote.renewal_requested` | staff → in-app + e-mail | immediate |
| quote expiring | customer → `quote_expiring` (24 h before `validUntil`) | cron |
| `quote.expired` | staff → in-app | cron |
| `mechanic.registered` | applicant → `mechanic_registration_received`; staff → `staff_mechanic_new` + in-app; CAPI `CompleteRegistration` | immediate |
| `mechanic.approved` / `rejected` / `suspended` | mechanic → `mechanic_approved` (tier, how to log in) / `mechanic_rejected` (reason) / `mechanic_suspended` | immediate |
| `stock.low` | staff → in-app immediately; e-mail batched `staff_low_stock` (≤ 1/hour) | sweep hourly |
| `stock.back_in_stock` | subscribers → `back_in_stock` (once, then `notified`) | immediate + hourly safety sweep |
| `auth.password_reset_requested` | user → `password_reset_code` | immediate |
| `staff.invited` | invitee → `staff_invite` (live mode only; link always shown in admin) | immediate |
| `email.bounced` / `complained` | staff → in-app flag on the related order/inquiry | webhook |
| `import.completed` / `import.rolled_back` | initiator → in-app | immediate |
| daily digest | staff with digest on → `staff_daily_digest` (yesterday's orders/value, open inquiries with ages, pending mechanics, low stock, top zero-result searches) | 08:00 Europe/Belgrade |
| reminders | staff → in-app + `staff_reminder` for orders in `nova` and inquiries in `nov` older than `reminderAfterWorkingMinutes` **working** minutes (settings hours/holidays); escalation levels 1 → 2 (+2 h) | every 15 min, working hours only |
| `product.changed` / `category.changed` / `settings.changed` / `content.changed` | Next cache → `revalidate.notify` (tags) | immediate |

### I3. Crons (`convex/crons.ts`; Convex cron times are **UTC**, local logic via `lib/domain/time.ts` — EU DST rule, last Sunday of March/October 01:00 UTC; `Intl` not required)
| Job | Schedule (UTC) | Logic |
|---|---|---|
| `events.sweep` | every 1 min | retry due events |
| `reminders.run` | `*/15 * * * *` | only inside Belgrade working hours; dedupe via `reminderLevel` |
| `digest.run` | `0 * * * *` | runs when Belgrade hour = `digestHour`; `cronRuns` key `digest:<day>` guarantees once per local day across DST |
| `quotes.expire` | `*/15 * * * *` | sent quotes past `validUntil` → `expired`; inquiries → `istekla`; 24 h reminders |
| `stock.lowStockSweep` | `5 * * * *` | batched staff e-mail |
| `backInStock.sweep` | `10 * * * *` | safety net for missed events |
| `seo.recomputeLandingStats` | `20 * * * *` | thresholds + cap → `landingStats.indexable` |
| `maintenance.nightly` | `30 1 * * *` (02:30/03:30 local) | orphan uploads, prune logs (retention §L), reconcile counters, auto-complete orders after `autoCompleteDays`, stale guest carts, Resend component cleanup |

## J. SEO, Google Ads, Meta Ads, analytics

### J1. Metadata templates (Serbian; titles ≤ 60 chars keyword-first + `settings.seo.titleSuffix`; descriptions 120–155 chars)
| Template | Title | Description pattern |
|---|---|---|
| Home | „Auto delovi za VW, Audi, Škoda, SEAT i Cupra \| SKLOP" | what we sell + OEM search + delivery/payment („pouzećem, preuzimanje u radnji") |
| System hub | „{Sistem} — delovi za VAG vozila" | categories in the system + counts |
| Category | „{Kategorija} za VW, Audi, Škoda, SEAT" (+ „ — strana n") | count, price from, in-stock count, manufacturers |
| Landing brand | „{Kategorija} za {Marka} — cene i stanje" | real counts, price range, top manufacturers |
| Landing model | „{Kategorija} za {Marka} {Model}" | generations covered, counts, price range |
| Vehicle generation | „Delovi za {Marka} {Generacija} ({godine})" | categories with counts, engines |
| Product | „{Naziv} {Proizvođač} {OEM/MPN}" (smart-truncated) | „{Naziv} ({proizvođač}, {kvalitet}) za {vozila}. Cena {cena} sa PDV-om, {stanje}. Kat. br. {OEM}." |
| Static/legal | „{Naslov}" | page summary |
| Za majstore | „Delovi za auto servise — rabat i brza porudžbina" | tiers, quick order, approval |
| Upit | „Upit za deo po broju šasije (VIN)" | how it works, response time |

OpenGraph/Twitter from the same builders; dynamic OG images (product: render/photo + name + OEM + manufacturer, **no price**; category/landing: thumbnail + counts); `alternates.canonical` per §B4; `robots` per route table.

### J2. Structured data (typed builders in `lib/seo/jsonld.ts`, unit tests parse JSON-LD out of rendered pages)
- Home & `/kontakt`: `Organization` + `AutoPartsStore` (name, url, logo, telephone, email, address, geo if known, `openingHoursSpecification` from settings, `priceRange`, `areaServed: "RS"`) — only filled fields are emitted.
- Home: `WebSite` + `SearchAction` (`/pretraga?q={search_term_string}`; machine-readable only — no sitelinks box).
- Every page with breadcrumbs: `BreadcrumbList`.
- Product: `Product` (`name`, `image[]`, `description`, `sku`, `mpn` = manufacturer part number or the OEM number for Original VAG, `gtin13` when EAN exists, `brand` = `Brand{ name: manufacturer }`, `category`) + `Offer` (`price` "12990.00", `priceCurrency` "RSD", `availability` InStock/OutOfStock/BackOrder, `itemCondition` NewCondition, `url`, `seller`, `shippingDetails` (RS, rates from settings, handling/transit days), `hasMerchantReturnPolicy` (`returnPolicyCountry` "RS", 14 days, `MerchantReturnFiniteReturnWindow`)). No `aggregateRating`/`review` (no fake reviews).
- Category/landing listings: `ItemList` of product URLs (position, url, name).
- `FAQPage` only where FAQs are visible on the page (info-level value: Google retired FAQ rich results on 2026-05-07); no `HowTo`.

### J3. Sitemaps and robots
Index `/sitemap.xml` → `staticne.xml` (home, delovi, vozila hubs, za-majstore, upit, legal), `kategorije.xml` (systems + categories with products), `vozila.xml` (brand/model hubs + indexable generation pages), `landing.xml` (indexable landings only), `proizvodi-[n].xml` (10 000 per file, active products, `lastmod` = `contentUpdatedAt`, `image:image` for up to 3 images). Noindex URLs never appear. `robots.ts`: allow all; disallow `/admin`, `/api`, `/nalog`, `/majstor`; `Sitemap:` absolute URL.

### J4. Programmatic landings and thin-content guard
- Candidates: every (category, brand) and (category, brand, model) with fitting active products (`landingStats`, hourly).
- Indexable only when: productCount ≥ `landingMin.brand` (8) / `landingMin.model` (6), ≥ 2 in stock, ≥ 2 manufacturers or ≥ 2 generations, and within `maxIndexableLandings` (300, ranked by productCount × inStock); below threshold → `noindex, follow`, excluded from sitemap; 0 products → 404.
- Unique content assembled from data (never „mad-libs"): H1, intro paragraph with real numbers (count, price range, in-stock count, generations and years, manufacturers present, most common OEM numbers), generation sections with products, FAQ generated from data („Koji delovi odgovaraju za Golf VII 2.0 TDI?" → engine-specific counts), links to sibling landings (same category other models; same model other categories), link to the vehicle page and the inquiry.
- Rollout: the guard is enforced in code; ADS-PLAYBOOK tells the owner to watch Search Console coverage before raising the cap.

### J5. Internal linking
Header mega-menu by system; breadcrumbs everywhere; category pages link to related categories and top landings; product pages link to category, landing for the selected vehicle, compatible parts (same fitment, related categories), same OEM alternatives; vehicle pages link to category landings; footer links to systems, za-majstore, upit, legal; home „Delovi po sistemima" section links every category (also the 3D accessible equivalent).

### J6. Consent Mode v2 (basic implementation)
- Banner (bottom sheet, `role="dialog"` non-modal, no layout shift, keyboard-complete): „Prihvati sve", „Odbij sve", „Podešavanja" (Neophodni — always on; Analitika; Oglašavanje), link to `/kolacici`; reopen from the footer („Podešavanja kolačića").
- Before any tag: `gtag('consent','default',{ ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied', analytics_storage:'denied', functionality_storage:'denied', personalization_storage:'denied', security_storage:'granted', wait_for_update: 500 })` is defined in our loader; **gtag.js and fbevents.js are not requested until the user grants a category** (Playwright asserts zero requests to Google/Meta domains before consent).
- Choice stored in first-party cookie `sk_consent` (`{ v, analytics, ads, at, id }`, 180 days, set server-side by the `setConsentCookies` Server Action together with `sk_attr`) + `consent.record` log; `gtag('consent','update', …)`; Meta `fbq('consent','grant'|'revoke')`; ads grant also enables `ad_user_data` + `ad_personalization`.
- Enhanced conversions only with ads consent: `gtag('set','user_data',{ email, phone_number: '+3816…', address:{ first_name, last_name, city, country:'RS' } })` on purchase/lead confirmation pages.

### J7. Event map (dedup and IDs)
| Our event | GA4 | Google Ads conversion | Meta Pixel | Meta CAPI (server) |
|---|---|---|---|---|
| `view_item` | `view_item` | — | `ViewContent` | — |
| `view_item_list` | `view_item_list` | — | — | — |
| `search` | `search` (`search_term`) | — | `Search` | — |
| `add_to_cart` | `add_to_cart` | — | `AddToCart` | — |
| `begin_checkout` | `begin_checkout` | — | `InitiateCheckout` | — |
| `purchase` | `purchase` (`transaction_id` = order no., `value`, `tax`, `shipping`, `currency: "RSD"`, items) | `send_to: AW-…/{purchase label}`, `transaction_id` | `Purchase` (`eventID` = order no.) | `Purchase` (`event_id` = order no.) |
| `generate_lead` (inquiry) | `generate_lead` | `{lead label}` | `Lead` (`eventID` = inquiry no.) | `Lead` (same id) |
| `generate_lead` (mechanic) | `generate_lead` (`lead_source: "mechanic_registration"`) | `{mechanicSignup label}` | `CompleteRegistration` (`eventID` = `mech-<profileId>`) | same |
| `contact_click` | custom `contact_click` (`channel`, `location`) | optional „Poziv" conversion (phone only) | `Contact` | — |

GA4 items: `item_id` = SKU, `item_name`, `item_brand` = manufacturer, `item_category` = system, `item_category2` = category, `price` (RSD, decimal), `quantity`. CAPI: Graph `v26.0` `POST /{pixel}/events`, `action_source: "website"`, `event_time` (s), `event_source_url`, `user_data` (SHA-256 of normalized `em`, `ph` digits with 381, `fn`, `ln` (lowercase, diacritics kept), `ct` (lowercase, no spaces), `country` `rs`, `external_id`; unhashed `client_ip_address`, `client_user_agent`, `fbp`, `fbc` = `fb.1.<ms>.<fbclid>`), `custom_data` (`currency: "RSD"`, `value`, `content_ids`, `contents`, `content_type: "product"`, `num_items`, `order_id`); `test_event_code` from settings when set; sent only if `metaCapiEnabled`, `META_CAPI_TOKEN`, pixel ID and `consent.ads`. Purchase fires once (sessionStorage guard `sk_tracked_<order>` on the thank-you page).

### J8. Attribution
Client module captures `utm_source|medium|campaign|term|content`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `msclkid`, external `document.referrer`, landing path, timestamp → memory; after consent a Server Action writes `sk_attr` (server-set, 90 days, first touch kept, last touch updated on new campaign params). Leads send `attribution` (sanitized, length-limited) + `_fbp`/`_fbc` when present. Admin: „Izvor" column + filters on orders/inquiries/mechanics, `/admin/izvori` report (source/medium/campaign → leads, orders, value, completed value), **offline conversions CSV** (legacy Google Ads template):
```
Parameters:TimeZone=Europe/Belgrade
Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency
```
rows = completed orders with `gclid` and `consent.ads`, time `yyyy-MM-dd HH:mm:ss`, value in RSD, name from `tracking.gadsOfflineConversionName`; GBRAID/WBRAID rows are listed separately (template support unverified — HUMAN-TODO: download the current template or use Data Manager).

### J9. Feeds
- `/feeds/google-merchant.xml`: RSS 2.0 + `xmlns:g`; per active product with price: `g:id` (SKU), `g:title` (≤ 150: name + manufacturer + OEM), `g:description`, `g:link`, `g:image_link` (≥ 500 px; category render fallback), `g:additional_image_link`, `g:availability` (`in_stock`/`out_of_stock`/`backorder`), `g:price` („12990.00 RSD"), `g:brand` (manufacturer), `g:mpn`, `g:gtin` only when a valid EAN exists, `g:identifier_exists` `no` when neither, `g:condition` `new`, `g:google_product_category` (per category: 899 Motor Vehicle Parts and children — 2977 kočnice, 2820 motor, 2550 podmazivanje, 908 izduvni, 2727 gorivo, 3318 svetla, 2935 vešanje, 2641 transmisija, 8231 elektrika, 8234 senzori, 2805 klima/grejanje, 8227 karoserija, 2642 retrovizori, 3020 točkovi, 2534 stakla), `g:product_type` („Kočnice > Kočioni diskovi"), `g:shipping` (RS, courier price). **Dormant for Google (D21)**.
- `/feeds/meta-catalog.csv`: `id,title,description,availability (in stock|out of stock|available for order),condition,price (12990.00 RSD),link,image_link,brand,mpn,google_product_category,product_type` — `id` = SKU = Pixel/CAPI `content_ids`.
- Both: `revalidate = 3600`, streamed/paged from `seo.feedProducts`, only active products with a price, XML/CSV escaping tested.

### J10. Ads landing `/ponuda/[slug]`
Fast template for message match: H1 = ad promise, 3 proof points (stock, delivery, payment on delivery), up to 24 curated products or a category/vehicle-filtered list, vehicle picker, prominent phone/Viber/WhatsApp, inquiry CTA, minimal navigation, no 3D (poster optional), noindex by default. Managed in `/admin/sadrzaj`.

### J11. Core Web Vitals budgets (mobile Lighthouse lab, production build on :3100)
| Template | Perf | LCP | CLS | TBT | JS (first load, gz, excl. 3D chunk) |
|---|---|---|---|---|---|
| Home | ≥ 85 (target 90) | ≤ 2.5 s (target 2.0) | ≤ 0.05 | ≤ 200 ms | ≤ 180 KB |
| Category / landing / product | ≥ 90 | ≤ 2.0 s | ≤ 0.05 | ≤ 150 ms | ≤ 160 KB |
| Checkout / inquiry | ≥ 85 | ≤ 2.5 s | ≤ 0.05 | ≤ 200 ms | ≤ 200 KB |

Also: accessibility ≥ 95, SEO ≥ 95, best practices ≥ 95; 3D chunk ≤ 350 KB gz; fonts ≤ 3 families, preloaded files ≤ 150 KB total; hero poster ≤ 120 KB (mobile AVIF) / 220 KB (desktop); INP ≤ 200 ms (field, later).

### J12. ADS-PLAYBOOK.md (Serbian, step 19)
Account structure (Search per brand × high-intent category, brand-protection campaign, DSA on categories later; Performance Max/Shopping blocked while RS is unsupported by Merchant Center), keyword themes with and without diacritics (kočione pločice / kocione plocice, turbina golf 7, zamajac passat b6 …), match types, negatives (polovni, otpad, besplatno, šema, uputstvo, servis cena, posao …), RSA copy examples in the brand voice, assets (sitelinks, call, location, callouts: „Plaćanje pouzećem", „Preuzimanje u radnji"), conversion actions + enhanced conversions, offline import routine, Meta (Pixel + CAPI test events, catalog from CSV, Advantage+ catalog — verify RSD/country in Commerce Manager), GA4 setup, UTM conventions (`utm_source=google|meta|viber|email`, `utm_medium=cpc|paid_social|referral|transactional`), first-30-days checklist, Google Business Profile checklist, Search Console + sitemap submission.

## K. Excel import

### K1. Formats and parsing (browser, Web Worker)
- Inputs: `.xlsx`, `.xls`, `.csv` (UTF-8 with/without BOM or Windows-1250; delimiter `;`, `,` or tab), ≤ 25 MB, ≤ 50 000 rows.
- `lib/excel/import.worker.ts` (`new Worker(new URL("./import.worker.ts", import.meta.url), { type: "module" })`): xlsx/xls via `XLSX.read(bytes, { type: "array", cellDates: true, dense: true })`; CSV via bytes → BOM check → `new TextDecoder("utf-8", { fatal: true })`, on failure `new TextDecoder("windows-1250")` (user can override) → `XLSX.read(text, { type: "string", FS: detectedDelimiter })`. Delimiter = the most consistent of `;` `,` `\t` over the first 20 lines outside quotes. Header row = first of the first 10 rows with ≥ 3 cells matching known synonyms (override possible). Text is NFC-normalized so č ć ž š đ survive.
- The worker posts headers, a 50-row preview and the row count, then streams normalized rows in chunks of 500. Writing files (template, error report, exports on the client) uses `XLSX.write(…, { type: "array" })` + a Blob download on the main thread.

### K2. Target fields and header synonyms (headers normalized: lowercase, diacritics folded, punctuation/spaces removed; exact → alias → Levenshtein ≤ 2)
| Field | Synonyms |
|---|---|
| `sku` | šifra, sifra, šifra artikla, šifra proizvoda, sku, artikal, kod, kod artikla, id artikla, interna šifra, broj artikla |
| `name` | naziv, naziv artikla, naziv proizvoda, ime, opis kratki, name, product name |
| `oem` | oem, oe, oe broj, oem broj, kataloški broj, kat. br., kat br, originalni broj, orig. broj, vag broj, broj dela |
| `mpn` | broj proizvođača, šifra proizvođača, kataloški broj proizvođača, mpn, ref, referenca, part number |
| `cross` | zamenski, zamenski broj, zamenski brojevi, cross, cross reference, uporedni broj, ekvivalent, alternativa |
| `manufacturer` | proizvođač, proizvodjac, brend, brand, marka dela, manufacturer |
| `quality` | kvalitet, tip, vrsta |
| `priceRetail` (with PDV) | mp cena, mpc, maloprodajna cena, cena sa pdv, cena, cena rsd, price, retail price |
| `priceNet` (without PDV) | vp cena, vpc, veleprodajna cena, cena bez pdv, net price (→ retail = round(net × 1.2), warning) |
| `cost` (net) | nabavna cena, nc, nabavna, cost, purchase price |
| `stock` | količina, kolicina, stanje, lager, zaliha, na stanju, stock, qty, quantity, kom |
| `category` | kategorija, grupa, grupa artikala, podgrupa, category |
| `fitment` | primena, vozilo, vozila, odgovara za, model, kompatibilnost, fits, applications |
| `description` | opis, opis artikla, description, napomena |
| `images` | slika, slike, slika url, url slike, image, image url, fotografija |
| `weight` | težina, tezina, masa, weight (kg; `g` suffix accepted) |
| `ean` | ean, barkod, bar kod, gtin |
| `leadTimeDays` | rok isporuke, isporuka dana, lead time |
| `active` | aktivan, status, active (da/ne, 1/0, true/false) |
| `lowStockThreshold` | minimalna zaliha, min. količina, prag |

Mapping UI: auto-mapped columns with confidence, manual override, „Ne uvozi", saved presets (`importMappingPresets`; a preset is suggested when ≥ 80 % of its headers match).

### K3. Values, validation, upsert keys, modes
- Shared rules in `lib/validation/importRow.ts` (also used by the manual product editor, so both paths validate identically).
- Numbers: `numberFormat` `sr` (default: `1.234,56`) or `en` (`1,234.56`), chosen per batch; ambiguous cells (e.g. `12.990`) produce a warning; prices → integer para (half-up); negative prices → error; stock must be an integer ≥ 0.
- Text: trim, collapse whitespace, strip control characters, max lengths (name 160, description 5 000).
- Codes: split multi-values on `;`, `|`, `,` or newlines (never `/` or space — they occur inside codes), normalize, each 4–25 chars.
- Category: slug, folded name or alias; unknown → error with top-3 suggestions and a one-time „mapiranje vrednosti" step (map each unknown value to an existing category for the whole file). Manufacturer: name/alias; unknown → warning + „Kreiraj proizvođača" on commit. Quality: original/orig/vag → `original`, oem/oe → `oem`, aftermarket/zamenski/zamena → `aftermarket`, default from the manufacturer.
- Fitment text: segments split on `;`, `|` or newlines, each `Marka Model Generacija [godine] [motori]` (e.g. `VW Golf VII 2012-2020 [CRLB, CUNA]`, `Škoda Octavia III`, `Audi A4 B8 1.8 TFSI`), matched via aliases; unmatched segments → warning (row still importable).
- Images: http(s) URLs only, ≤ 12.
- Row errors block the row; warnings don't. Duplicate SKU within the file → error on later rows.
- Upsert key: `sku`; fallback `oem (normalized) + manufacturer` only in full mode and only with exactly one match (else error „Više proizvoda sa istim OEM brojem i proizvođačem").
- Modes: **full** (create + update mapped fields; unmapped fields untouched), **stock_price** (only stock, prices, cost, active, lead time for existing SKUs; unknown SKUs skipped with a warning), optional **deactivateMissing** (full mode only, typed confirmation „DEAKTIVIRAJ": active non-demo products absent from the file are deactivated).

### K4. Pipeline within Convex limits
1. `createBatch` (file metadata, mapping, mode; original file stored for records) → `batchId`.
2. `stageRows` in chunks of 500 (client-normalized) → server re-validates, matches existing products (`by_sku` / codes), computes `action` + `changedFields`, writes `importRows`, updates counts (≈ 2 000 reads / 501 writes per call — far below 32 000 / 16 000).
3. `finalizeStaging` → `validated`; UI shows the dry-run diff (counts, sample rows per action, filterable errors/warnings) and „Preuzmi izveštaj o greškama" (.xlsx).
4. `commit` → `committing`; `commitChunk` handles ≤ 100 rows or until any `getTransactionMetrics()` remaining value drops below 25 %, then `runAfter(0)` with the cursor; every row goes through `productWriter` (products, productContent, productCodes, fitments, productPrivate, stockMovements, priceChanges, importChanges) and is idempotent (`committed` flag). Live progress via reactive query.
5. After commit: image fetch jobs (workpool, 3 parallel, 10 s timeout, ≤ 10 MB, sniffed), deactivate-missing chunks, category counts + landing stats refresh, `import.completed` event, audit entry.
6. **Rollback** → `rolling_back`; `rollbackChunk` walks `importChanges` newest → oldest: update → restore `before` if the product's `updatedAt` still equals `productUpdatedAtAfter`, else skip („izmenjeno posle uvoza"); create → delete with children when untouched and not referenced by order items, else deactivate; deactivate → reactivate; stock restored with `import_rollback` movements; final `rolled_back` (skips listed).

Target: 50 000 rows staged + committed in ≤ 15 minutes; resumable after interruptions.

### K5. Templates, exports, fixtures
- `/admin/uvoz/sablon` (.xlsx): sheet „Proizvodi" with canonical Serbian headers (Šifra, Naziv, Kategorija, Proizvođač, Kvalitet, OEM brojevi, Broj proizvođača, Zamenski brojevi, MP cena (sa PDV), Nabavna cena (bez PDV), Količina, Rok isporuke (dana), Primena (vozila), Opis, Slike (URL), Težina (kg), EAN, Aktivan) and header cell comments; „Uputstvo"; „Kategorije"; „Proizvođači"; „Vozila" (names the fitment parser accepts).
- Exports (staff route handlers `/admin/izvoz/*`, server-generated from paginated queries): products .xlsx (round-trips with the template), orders .csv and customers/mechanics .csv (UTF-8 BOM + `;` for Serbian Excel), offline conversions .csv (§J8).
- Fixtures (`scripts/make-import-fixtures.mjs` → `tests/fixtures/import/`): `proizvodi-500.xlsx` (seeded errors: bad price, unknown category, duplicate SKU, negative stock, invalid URL, missing name), `proizvodi-1250.csv` (Windows-1250, `;`, all of č ć ž š đ), `lager-cene.xlsx` (stock/price only).

## L. Security and privacy

### L1. Authorization rules
Every Convex function authorizes through the builders (§D3); public functions return anonymous projections or act on unguessable token capabilities (256-bit, stored as SHA-256); ownership checked on every fetch by id/token; identity never from args; `returns` validators on all public functions; staff writes audited; owner-only: settings danger zone, users/invites/roles, tier editing, demo removal, e-mail mode. Admin pages guarded in proxy (UX) + server layout/page (`requireStaffPage`) + Convex (authoritative).

### L2. Abuse protection
Rate limits (§E6) on every public write; honeypot + 3 s minimum form time; payload caps (message 2 000 chars, quick-order lines 200, cart lines 100, search query 200, list page size ≤ 60); upload validation (§E7); token pages `Referrer-Policy: no-referrer`; e-mail enumeration avoided on reset („Ako nalog postoji, poslali smo kod").

### L3. Headers and CSP (set in `proxy.ts`, nonce per request)
```
default-src 'self'; script-src 'self' 'nonce-{nonce}' 'strict-dynamic' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.convex.cloud https://www.googletagmanager.com
https://*.google-analytics.com https://*.g.doubleclick.net https://*.google.com https://www.facebook.com;
font-src 'self'; connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site
https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.g.doubleclick.net
https://*.google.com https://connect.facebook.net https://www.facebook.com; frame-src https://www.googletagmanager.com
https://td.doubleclick.net https://www.facebook.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self';
form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```
(dev adds `'unsafe-eval'`). Also `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (production only), `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`, `Cross-Origin-Opener-Policy: same-origin`. Step 20 verifies 3D (WASM decoder, blob workers), fonts, images, Convex websockets and post-consent analytics under the policy.

### L4. Secrets
Only in Convex env and server-side Next env; nothing secret behind `NEXT_PUBLIC_*`; step 20 greps `.next/static` for secret patterns; `.env*`, `pipeline/env/`, logs git-ignored; `docs/GO-LIVE-ENV.md` lists every variable with purpose and where to set it.

### L5. Privacy (ZZPL „Sl. glasnik RS" 87/2018, ZEK 35/2023 čl. 160, Zakon o zaštiti potrošača 35/2026, Zakon o elektronskoj trgovini)
| Data | Purpose / basis | Retention (default — confirm, HUMAN-TODO) |
|---|---|---|
| Orders, items, company data | contract, accounting obligation | 10 years (confirm with the accountant) |
| Inquiries without order (+ photos) | pre-contract / legitimate interest | 2 years (photos 1 year) |
| Customer accounts, saved vehicles, favorites | contract | until deletion request or 3 years inactive |
| Mechanic profiles | contract | while active + 3 years |
| Back-in-stock subscriptions | consent | until notified + 30 days or unsubscribe; max 12 months |
| Search logs | legitimate interest (assortment) | 180 days, no IP (session hash) |
| Consent records | proof of consent | 2 years |
| E-mail log | records, support | HTML 90 days, metadata 2 years |
| Audit log | security, records | 5 years |
| Click IDs / fbp / fbc | ads consent; aggregate reporting | click IDs pruned after 180 days |
| CAPI context (IP, UA) | ads consent | deleted right after sending (≤ 7 days on failure) |
| Guest carts | service | 30 days inactivity |

Rights: access/export and erasure within 30 days (+60): admin tools „Izvoz podataka kupca" (JSON/CSV) and „Anonimizuj kupca" (PII replaced in orders while keeping accounting totals; account, inquiries, subscriptions, favorites deleted); process in `docs/PRIVACY-PROCESS.md` (Serbian). DPO not mandatory for this profile; records-of-processing exemption (< 250 employees) has exceptions → legal check. Legal page templates cover: e-commerce info duties (naziv, sedište, PIB, MB, registar, kontakt, cene sa PDV, koraci zaključenja ugovora, ispravka grešaka pri unosu), privacy, cookies (consent per ZEK čl. 160 st. 4–5), delivery/payment, reklamacije i povrat per the 2026 law (14-day withdrawal from receipt, refund ≤ 14 days, reply to a complaint ≤ 8 days, resolution ≤ 15 days / 30 days for technical goods, remedy choice in the first 30 days, 2-year liability, published complaint procedure, withdrawal form). All flagged `needsLegalReview`.

### L6. Backups and dependencies
Convex snapshot export (`npx convex export --path backups/<date>.zip`) and a restore drill into a throwaway deployment (convex-backup skill) documented in `docs/BACKUPS.md` with a daily schedule recommendation; code in Git; 3D reproducible from scripts. `npm audit --omit=dev` in step 20 (fix or justify); pinned majors.

## M. Testing strategy

### M1. Vitest (two projects in `vitest.config.ts`)
- **unit** (`jsdom` for DOM code, `node` otherwise): `lib/domain` (pricing — 100 % branches; order/inquiry state machines — every pair of states; `normalizeCode`, `foldForSearch` incl. Cyrillic; quick-order parser; VIN/WMI/model year; PIB/MB with known valid/invalid vectors; phone; Belgrade time across both DST switches; money/VAT), `lib/format`, validation parity fixtures, `lib/excel` (synonyms, number formats, 1250 bytes, delimiters), `lib/seo` (title/description lengths, JSON-LD shapes), feeds (XML/CSV validity, escaping), analytics (event mapping, consent gating, CAPI payload builder with mocked fetch), text reveal (split/restore keeps node identity), `lib/three` (manifest schema vs. taxonomy, tier rules, explode math).
- **convex** (`environment: "edge-runtime"`, `server.deps.inline: ["convex-test"]`, tests in `convex/**/*.test.ts`, `convexTest(schema, import.meta.glob("./**/*.ts"))`, components registered with their test helpers or wrapped behind mockable modules): authz negatives for every function family × role; price-visibility matrix; order submit (re-pricing, stock rules, numbering, invalid payloads, rate limits); state machines through Convex; inquiry → quote → accept → order incl. expiry; carts + merge; quick-order matching; import stage/commit/idempotency/rollback; dispatcher idempotency + retries with fake timers and `t.finishAllScheduledFunctions`; cron local-time logic; seed idempotency; demo removal. ≥ 40 tests by step 06, ~150 by step 17.

### M2. Playwright
`playwright.config.ts`: `webServer` = build + `next start -p 3100` with `NEXT_PUBLIC_TEST_HOOKS=1`; `baseURL` `http://localhost:3100`; projects `desktop-chromium` (1440×900), `mobile-chromium` (390×844, touch), `reduced-motion`, plus `firefox`/`webkit` for the audit; `reporter: "line"`; traces on retry; screenshots on failure. Data: seeded dev deployment; tests create their own records with e-mails `e2e+<run>-<n>@sklop.test` (flagged `isTest` by `testing.*` helpers, which exist only when `E2E_HELPERS=1` and require `E2E_SECRET`); `testing.cleanup` removes them; admin logs in with `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`. Flow list per step in §N.

### M3. Accessibility, visuals, performance
- axe: `new AxeBuilder({ page }).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"])` on every template → zero serious/critical; keyboard walkthroughs (order, visible focus, dialog trap/return).
- Screenshots: `tests/e2e/screens.spec.ts` at 360/390/768/1024/1280/1440/1920/2560 → `docs/qa/screens/<step>/`; steps open and critique them (docs/qa/*.md).
- Lighthouse: `tests/lighthouse/run.mjs` (lighthouse 13 CLI, `--chrome-path="$CHROME_PATH"`, JSON output, mobile default + `--preset=desktop`, 3 runs → median) against §J11 budgets; results in `.lighthouse/` + summary table; non-zero exit on budget failure.
- Text-reveal check snippet after a full scroll on home, category, product.
- 3D: `3d/scripts/validate.mjs` (size, triangles, draw calls, names vs. manifest vs. taxonomy, coverage, materials, bbox 4.2–4.4 m) + render QA (docs/3d/QA.md) + web QA (docs/3d/WEB-QA.md, frame times under 4× CPU throttle).

### M4. Definition of Done (every change)
`npx tsc --noEmit` · `npm run lint` · relevant unit + Convex tests · e2e for touched flows · screenshots reviewed for UI changes · no console errors · docs/PROGRESS.md entry · commit.

## N. Build plan (steps 02–23)

| Step | Goal | Deliverables | Acceptance (measurable) | Risks |
|---|---|---|---|---|
| 02 Docs & conventions | Plan → living docs | docs/ARCHITECTURE, DATA-MODEL, ROUTES, 3D-CONTRACT, DESIGN-BRIEF, NOTIFICATIONS, SEO-ADS, IMPORT, SECURITY, TESTING, ROADMAP, DECISIONS (D1–D22 + defaults of §O2), PROGRESS, HUMAN-TODO (sr), README; CLAUDE.md „Project conventions" (incl. §0.3 Next rules, Convex rules, text-reveal/GSAP rules, DoD); `.gitignore` additions (`.lighthouse/`, `coverage/`, `blob-report/`, `playwright-report/`, `test-results/`, `3d/renders/`, `*.blend1`, `3d/build/*.blend` only if > 50 MB); prettier config; scripts `typecheck`, `test`, `e2e` | all docs exist and match the plan; tsc passes; committed | losing detail when splitting — cross-check section by section |
| 03 Design system | „Rendgen" made concrete | docs/design/DESIGN-SYSTEM.md, design-dna.json, CRITIQUE.md (≥ 2 rounds), `/lab/koncept` | real values for every token; computed contrast table ≥ AA; fonts verified latin-ext and available in @fontsource; screenshots 1440 + 390 reviewed; tsc passes | generic look; accent contrast on dark |
| 04 Frontend foundation | Tokens, fonts, shell, UI kit, GSAP, text reveal | `app/globals.css` @theme, `config/site.ts`, `lib/domain`/`lib/format` utilities with tests, UI kit, header/footer, GSAP module, text reveal + `RevealText`, `/styleguide`, placeholder home; root layout with a plain `ConvexProvider` (step 05 swaps in the auth providers) | ≥ 60 unit tests pass; tsc/lint/build pass; /styleguide at 390 + 1440 reviewed; reveal check empty; visible focus on tab-through; no console errors | text hidden by CSS forever (failsafe), CLS from fonts |
| 05 Backend foundation | Schema, auth, catalog, orders, inquiries, seed | everything in §C–§E except e-mail/CAPI/revalidate channels (dispatcher creates in-app notifications only); Convex Auth wired (proxy.ts auth part, providers in root layout, sign-in pages minimal), owner seed, demo seed, `lib/catalog/taxonomy.ts`, `lib/domain/pricing.ts` | `npx convex dev --once` clean; sign-in round-trip proven on Next 16; `getRequestMetadata().ip` verified; ≥ 40 convex tests incl. negative authz; `seed:stats` non-zero counts | Convex Auth on Next 16 (R1); schema churn |
| 06 Backend goal | Proof | — | goal file conditions; DATA-MODEL.md matches schema.ts | — |
| 07 3D plan | Blender plan within the contract | docs/plans/07-3d-plan.md | covers every contract category/node, stages, cameras, budgets, QA protocol | over-ambitious modeling |
| 08 3D build | GLBs, manifest, posters, thumbnails | `3d/blender/**`, `3d/scripts/{optimize,validate,images}.mjs`, `public/models/car.glb`, `car-lite.glb`, `car.manifest.json`, posters (desktop 16:9 + mobile 4:5, assembled + exploded, AVIF/WebP widths 640–2560), `public/images/parts/<slug>.webp` for all 44 categories + 4 filter subcategories, docs/3d/{PLAN,BUILD-NOTES,QA}.md | validator PASS (≤ 8 MB, < 800 k tris, names/coverage); QA verdicts recorded | procedural quality, render time |
| 09 3D quality goal | Art-direction pass | — | goal file conditions | — |
| 10 3D web | Hero experience | `components/three/**`, hero section, PartPanel, parts-list dialog, deep links, tiers, test hooks | Playwright 1440/390: poster → 3D, part via list + hook opens panel with Convex products, `?deo=` works; Lighthouse home mobile ≥ 85, LCP < 2.5 s, CLS < 0.05, TBT < 300 ms (target 200); WEB-QA verdicts | TBT from shader compile; X-ray shader cost |
| 11 3D web goal | Proof | — | goal file conditions | — |
| 12 Storefront | Shop pages + ordering | home (with hero), catalog, landings, vehicle pages, search, product, cart/checkout, order status + predračun, inquiry + quote accept, account, auth pages, static/legal, states, `track()` no-op adapters, attribution capture (memory) | e2e: OEM search → product → cart → guest order (pouzeće) exists in Convex `nova` + domain event; vehicle filtering; VIN inquiry with photo; back-in-stock; axe zero serious/critical on 6 templates; screenshots reviewed (docs/qa/STOREFRONT.md); reveal check empty | scope size; SSR latency to Convex |
| 13 Storefront goal | Proof | — | goal file conditions | — |
| 14 Mechanics portal | B2B | `/za-majstore` + registration, approval UI (`/admin/majstori` minimal), role-aware prices everywhere, `/majstor` (quick order, history + reorder, favorites, vehicles, XLSX price list), deferred payment | convex-test price/visibility matrix + quick-order matching + approval authz; e2e: register → approve (test helper) → discounted prices on 4 surfaces → quick order mixed lines → deferred-payment order | price leaks through cached HTML (must stay retail) |
| 15 Admin panel | Back office | shell (+ command palette, bell), dashboard, orders (+ print views), inquiries (+ quotes), products (editor, images, codes, fitments, SEO preview), categories/3D mapping, vehicles, manufacturers, stock, customers/mechanics, tiers, settings, users/invites, audit, e-mail outbox shell, search analytics, sources | convex-test staff vs. owner + audit + transitions; e2e: login, product create + image, order nova → potvrdjena → poslata + tracking, quote, mechanic approval, settings save; screenshots 1440/1024 reviewed (docs/qa/ADMIN.md) | admin scope; data-table performance |
| 16 Excel import/export | §K | wizard, worker, presets, dry-run, commit, rollback, image fetch, history, template, exports, fixtures | unit (mapping, numbers, encodings); convex-test (upsert, idempotency, rollback, authz); e2e: template download, 500-row fixture → preview errors → commit counts → rollback; 1250 CSV keeps č ć ž š đ | transaction limits; worker bundling in Turbopack |
| 17 Admin + import goal | Proof | — | goal file conditions | — |
| 18 Notifications | §I | dispatcher channels, Resend component (modes), templates (React Email) + gallery + „Pošalji test", crons, webhook, preferences, click-to-chat links | convex-test fan-out, idempotency, retries, cron local-time logic; template snapshot tests; e2e: order → e-mail log has customer + staff entries, bell shows it; status change → customer e-mail logged; 4 e-mails screenshot-reviewed | Resend key absent → log mode must never call the component |
| 19 SEO + Ads | §J | metadata for all routes, JSON-LD builders, sitemaps index, robots, OG images, landings guard, internal linking, consent banner + basic Consent Mode, gtag/fbq adapters, CAPI action, attribution cookie + admin „Izvor" + offline CSV, feeds, `/ponuda/[slug]`, ADS-PLAYBOOK.md | tests: metadata, JSON-LD parse, sitemap/feed validity, **zero Google/Meta requests before consent**, dataLayer after consent, CAPI payload; Lighthouse SEO ≥ 95 on home/category/product | over-indexing; consent regressions |
| 20 Security audit | §L | convex-authz/reviewer/launch-readiness fixes, payload leak review, CSP + headers in proxy, secrets scan, privacy tools (export/anonymize), retention jobs verified, `npm audit`, backups doc | docs/SECURITY-AUDIT.md; a test per authz bug fixed; tsc/lint/build/tests pass | CSP breaking 3D/analytics |
| 21 QA audit | Multi-agent audit | docs/qa/AUDIT.md with IDs, severity, evidence, scorecards, top-10 quick wins | every track covered; findings reproduced | noisy findings |
| 22 Fix goal | Resolve audit | fixes | P0/P1 all FIXED or justified WONTFIX; ≥ 70 % P2; all suites green; Lighthouse mobile home/category/product perf ≥ 85, a11y ≥ 95, SEO ≥ 95 | regressions — re-run suites |
| 23 Handoff | Package | README (en), docs/PREDAJA.md (sr), docs/GO-LIVE.md (sr, merged HUMAN-TODO), docs/showcase/index.html + screenshots, pipeline/REPORT.md | a newcomer can run, demo and go live from the docs; final build/tests pass | stale screenshots |

Cross-step notes: step 04 builds the root layout; step 05 adds `ConvexAuthNextjsServerProvider` + `proxy.ts` (auth redirects); step 19 sets consent/attribution cookies through a Server Action (no proxy change); step 20 adds the CSP nonce and security headers to `proxy.ts` — edits are additive. Step 05 must already expose `catalog.partPanel`, `catalog.liveState`, `pricing.forProducts` (used by steps 10–14). Step 10 builds the hero as a self-contained section that step 12 composes into the full home.

## O. Risks and decisions

### O1. Top risks
| # | Risk | Mitigation |
|---|---|---|
| R1 | Convex Auth's (experimental) Next.js SSR integration misbehaves on Next 16 `proxy.ts` (issue #271: `isAuthenticated()` false without both providers) | Mount both providers; matcher includes `/api/auth`; step 05 proves the round-trip before anything else. Fallback A: client-only `ConvexAuthProvider` (Convex enforces everything; admin pages become fully client-guarded; proxy guard dropped — record in DECISIONS). Fallback B: `@convex-dev/better-auth` 0.12.5 + `better-auth@~1.6` (documented Next integration, client token fetch). |
| R2 | Dynamic SSR on every page costs TTFB/LCP | Anonymous catalog data cached in `catalog-cache.ts`; streaming with Suspense around slow parts; LCP-safe text; poster preload; measured in steps 10–13 and 22. |
| R3 | Procedural Blender car looks cheap | X-ray concept (stylized shell), detail budget on high-search parts, render-critique loop (steps 08–09), stable node names allow swapping in a purchased model later. |
| R4 | 3D hurts TBT/INP on mobile | Tiers, lite GLB, intent/idle loading, `compileAsync`, BVH, `frameloop="demand"`, Lighthouse gate in step 11. |
| R5 | Text reveal hides content or delays LCP | Failsafe class, no-JS CSS, LCP-safe server variant above the fold, check snippet in e2e. |
| R6 | Convex transaction limits during 50 k-row imports | Staged 500-row chunks, metrics-guarded commit chunks, resumable cursor, idempotent rows. |
| R7 | Search misses (no diacritic folding, messy OEM formats, Cyrillic input) | Folded `searchText` + folded queries, Cyrillic→Latin transliteration, codes table exact/prefix, zero-result log feeding the dashboard. |
| R8 | Role prices or cost leak | Separate `productPrivate`, `returns` validators, SSR retail-only rule, payload tests per role, step 20 review. |
| R9 | Missing company data / legal texts | Settings-driven empty-safe UI, templates flagged `needsLegalReview`, HUMAN-TODO, never visible TODO text. |
| R10 | Ad platforms: Merchant Center unsupported in RS; CAPI/consent correctness | Dormant Google feed, Meta catalog, Search-first playbook; consent tests; CAPI test events. |
| R11 | Unattended interruptions (network, limits) | Per-step checklists in docs/progress, idempotent seeds/scripts, frequent commits, resumable jobs. |
| R12 | `getRequestMetadata().ip` null for websocket calls | Verified in step 05; fallback key = client session id + e-mail/phone limits + global circuit breaker. |
| R13 | E-mail not live (no Resend key/domain) | `log` mode with full admin outbox and previews; HUMAN-TODO go-live steps. |
| R14 | Windows paths with spaces, Blender headless quirks | Quote every path; blender-pipeline skill rules; `--python-exit-code 1`. |
| R15 | Next 16 API drift vs. model knowledge | §0.3 rules in CLAUDE.md; always read `node_modules/next/dist/docs` first. |

### O2. Open questions and chosen defaults (all editable; „potvrditi sa klijentom" in HUMAN-TODO)
Final brand name → „SKLOP" from `config/site.ts` + settings. Company data, bank accounts, address, hours → empty-safe (placeholder hours Mon–Fri 08–17, Sat 08–14 shown only when set). Delivery → lično 0 RSD, kurir pouzećem 450 RSD, free over 10.000 RSD. Couriers → D Express, BEX, AKS, Post Express as editable list with tracking URL templates. Tiers → Majstor 10 %, Majstor Plus 15 %, Partner 20 %. Stock decrement → on confirmation; restock on cancel → yes. Auto-complete → 15 days after pickup/delivery. Quote validity → 7 days. Minimum margin → 8 % over net cost when cost is known. Guest checkout → on. Public prices → on. Orders require phone + e-mail. Deferred payment → only approved mechanics with the credit flag; terms 15 days; credit limit blocks deferred payment when exceeded. Price rounding → whole dinars. Consumer promos with „stara cena" → not in v1 (D22). Reklamacija deadlines → per the 2026 law (lawyer to confirm whether parts count as technical goods). Retention → §L5 (accountant/lawyer to confirm). Google Merchant → dormant (D21). Admin theme → decided in step 03. E-mail sender/domain → HUMAN-TODO; `log` mode until then. Seeded vehicles/engines/VIN model codes → „seed – proveriti". Staff seeing cost → yes. Language → Serbian Latin only, copy centralized.

### O3. Further decisions to log in docs/DECISIONS.md
Guest cart token in localStorage (strictly necessary) · vehicle filter carried in URL params, never auto-redirect · no ScrollSmoother · TanStack Table v8 · custom SVG charts · custom GSAP Sheet (vaul is unmaintained) · no postprocessing by default · `RoomEnvironment` on the web, Poly Haven HDRI only for Blender renders · Draco disabled in `useGLTF` (no gstatic dependency) · single `lib/catalog/taxonomy.ts` shared by seed, manifest validation and UI · `productWriter` as the only product write path · Belgrade time via the EU DST rule (no `Intl` dependency in Convex) · e-mails rendered in a Node action · OG fonts from `@fontsource` · orders CSV with BOM + `;` · `/lab/koncept` redirected to `/styleguide` after step 04 · React Compiler off in v1.

---

## Step report

- **Summary**
  - I wrote the full master plan above (sections A–O plus the stack, the decisions and the Next 16 rules). Plan mode: no repo files were edited.
  - Auth follows the convex-auth skill: Convex Auth 0.0.95 with the Password provider. Its server provider reads cookies in the root layout, so every page renders dynamically and `cacheComponents` stays off. Catalog data is cached in one module, and live price and stock come from Convex subscriptions.
  - Convex 1.46 exposes the client's IP and user agent to mutations (`ctx.meta.getRequestMetadata()`). So public forms call Convex directly, with rate limits and Meta CAPI data taken from that metadata; the Next server is not a middleman.
  - Taxonomy refined and frozen: 10 systems, 44 categories (42 with 3D nodes, 91 clickable nodes). The 3D contract is final: axes, node naming, manifest schema, budgets, stages, interactions and loading.
  - Two research findings changed the plan. Serbia is **not** supported by Google Merchant Center (Google removed the announced expansion on 2026-08-18), so the Google feed is built but unused for now. The new consumer protection law (35/2026, applied since 2 Aug 2026) led to no "stara cena" promotions in v1 and a price-change log.
- **Key files created / changed**
  - Plan working copy: `C:\Users\admin\.claude\plans\step-01-radiant-kahan.md` (outside the repo).
  - The orchestrator saves this message to `docs/plans/01-master-plan.md`. No project files were changed.
- **Verification**
  - `npm view` confirmed current versions for about 50 packages, listed in §0.2.
  - Read locally: the Next 16 upgrade, caching, cacheLife, use-cache, instant and CSP docs, the proxy docs, `next/image` `preload`, and `error.tsx` `retry`.
  - Read the Convex guidelines and the installed `convex` `meta.d.ts` types (confirmed `getRequestMetadata` and `getTransactionMetrics`).
  - Unpacked `@convex-dev/auth` 0.0.95 and confirmed that the server provider calls `cookies()` and that the client provider is not exported on its own.
  - Web research covered Convex Auth / Resend / rate-limiter / limits, Meta CAPI v26.0, Consent Mode v2, the Merchant Center country list, SheetJS 0.20.3, and Serbian law (PIB/MB checksums, ZZPL, ZEK čl. 160, the consumer law 35/2026).
  - All 14 required skills were invoked.
  - Nothing was run: no tsc, build or tests, since no code changed.
- **Decisions made**: D1–D22 in §0.1, defaults in §O2, and further items in §O3. Step 02 copies them into `docs/DECISIONS.md`.
- **Open issues / HUMAN-TODO**:
  - Company data, bank accounts and working hours.
  - Legal review of all legal texts under the 2026 consumer law, and the retention periods (lawyer and accountant).
  - Resend API key and domain.
  - GA4, Google Ads and Meta IDs and the CAPI token.
  - Google Merchant Center for Serbia is unavailable for now.
  - Confirm the current Google Ads offline-conversion template (whether GBRAID/WBRAID fit in the same CSV).
  - Seeded vehicle, engine and VIN model codes need checking ("seed – proveriti").
  - Placeholder business rules to confirm: delivery prices, tiers, margin, quote validity.
- **Notes for the next step**:
  - Step 02: split this plan into the docs listed in the step 02 prompt, map §N to ROADMAP, and add §0.3 plus the Convex and text-reveal rules to CLAUDE.md.
  - Step 04: build the root layout with a plain `ConvexProvider`.
  - Step 05: first prove the Convex Auth round-trip on Next 16 `proxy.ts` and that `getRequestMetadata().ip` is filled for websocket calls. If either fails, use the fallback in §O R1.
  - Use `lib/catalog/taxonomy.ts` as the single source of slugs.