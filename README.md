# SKLOP — VAG parts shop, mechanic portal and back office

SKLOP („Rasklopi auto. Nađi deo.“) is an online shop for a Serbian dealer of Volkswagen Group parts (VW, Audi, Škoda, SEAT, Cupra). It has three parts:

- **Storefront** (Serbian, RSD, prices incl. 20 % PDV): a 3D X-ray car on the home page that explodes on scroll, where every part opens the in-stock products of its category; OEM-aware search; catalog with vehicle filters; product pages; a 4-step checkout with **no online payment** (cash on delivery, pay at pickup, bank transfer against a pro-forma invoice); VIN inquiries with quotes the customer accepts online.
- **Mechanic portal** (B2B): registration and approval, discount tiers computed server-side, quick order from pasted OEM lists, reorder, favorites, customer vehicles, an XLSX price list, deferred payment for approved accounts.
- **Admin**: dashboard, orders, inquiries and quotes, products, Excel import with dry run and rollback, categories, vehicles, stock log, customers and mechanics, price tiers, settings, staff, audit log, e-mail outbox, search and traffic-source reports, privacy tools.

Working name: **SKLOP**. The name, contact and company data come from `config/site.ts` and Admin → Podešavanja, so a rename takes minutes. Empty fields are hidden on the site.

Client-facing documents are in Serbian: [`docs/PREDAJA.md`](docs/PREDAJA.md) (handoff and admin guide), [`docs/GO-LIVE.md`](docs/GO-LIVE.md) (launch checklist), [`docs/showcase/index.html`](docs/showcase/index.html) (screenshot tour for the demo). The build history is in [`pipeline/REPORT.md`](pipeline/REPORT.md).

---

## Stack

| Area | Packages (see `package.json`) |
|---|---|
| Framework | Next.js **16.3.6** App Router (Turbopack), React 19.2.8, TypeScript 5 (strict), Tailwind CSS v4 |
| Backend | Convex ^1.46 (database, functions, crons, file storage), Convex Auth 0.0.95 (e-mail + password), `@convex-dev/rate-limiter`, `@convex-dev/resend` |
| 3D | three 0.186, @react-three/fiber 9, three-mesh-bvh; assets built headless in **Blender 5.1** from Python scripts, optimized with glTF-Transform + meshopt |
| Motion | GSAP 3.15 + @gsap/react (the only animation library); a site-wide CSS text reveal |
| UI | radix-ui, TanStack Table v8, react-hook-form + zod 4, Phosphor icons, zustand |
| Excel | SheetJS CE 0.20.3 from the official CDN tarball (parsing runs in a Web Worker) |
| Tests | Vitest 5 (unit + convex-test), Playwright 1.63, axe-core, Lighthouse 13 |

Requirements: **Node ≥ 20.9** (built and tested on Node 22.23), npm 10, a Convex account. Blender 5.1 only if you rebuild the 3D assets. Windows, macOS and Linux all work; the pipeline ran on Windows.

Next.js 16 differs from older versions (async `params`/`cookies()`, `proxy.ts` instead of middleware, `revalidateTag(tag, profile)`, `next/image` `preload`). Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §0.3 and `node_modules/next/dist/docs/` before touching Next APIs, and `convex/_generated/ai/guidelines.md` before writing Convex code.

---

## Setup from zero

```bash
git clone <repo> sklop && cd sklop
npm install
```

### 1. Convex dev deployment

```bash
npx convex dev --once          # logs you in, creates/links a dev deployment, writes .env.local, pushes functions
```

`.env.local` now contains `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL`. Add the Next-side values (see [`.env.example`](.env.example)):

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
REVALIDATE_SECRET=<random string, same value as on Convex>
```

### 2. Convex environment variables (dev)

```bash
node scripts/setup/auth-keys.mjs                        # JWT_PRIVATE_KEY + JWKS for Convex Auth
npx convex env set SITE_URL http://localhost:3000
npx convex env set NEXT_SITE_URL http://localhost:3000
npx convex env set LINK_TOKEN_SECRET <48 random chars>   # status-link signing key
npx convex env set REVALIDATE_SECRET <same as .env.local>
npx convex env set EMAIL_MODE log                       # write e-mails to Admin → E-pošta only
npx convex env set E2E_TEST_HELPERS 1                   # dev only: enables convex/testing.ts for e2e
npx convex env set SEED_ADMIN_EMAIL you@example.com
npx convex env set SEED_ADMIN_PASSWORD <password>
```

Random value: `node -e "console.log(require('crypto').randomBytes(36).toString('base64url'))"`. The full list with meanings is in [`docs/GO-LIVE-ENV.md`](docs/GO-LIVE-ENV.md) (Serbian).

### 3. Seed and owner account

```bash
npm run seed          # convex run seed:run && convex run seed:createOwner
npm run seed:stats    # brands 5, models 21, generations 56, engines 25, categories 58, products 157 …
```

The seed is idempotent. It loads reference data (vehicles, categories with Serbian SEO intros, manufacturers, tiers, content pages, FAQs) and demo data (157 `DEMO-` products, a demo mechanic, 8 orders, 4 inquiries, one ads landing page). Everything demo is flagged `isDemo` and removed with Admin → Podešavanja → Opasna zona → „Obriši demo podatke“.

### 4. Run

```bash
npm run dev           # http://localhost:3000 (Convex functions are already pushed in step 1)
npx convex dev        # optional, in a second terminal: re-pushes Convex functions on every save
```

Sign in at `/prijava` with the seed owner and open `/admin`. Change the password at `/zaboravljena-lozinka`; while `EMAIL_MODE=log`, the reset code appears in Admin → E-pošta.

`/styleguide` (noindex) shows the design system and every UI component.

---

## Environment variables

| Where | Name | Required | Purpose |
|---|---|---|---|
| `.env.local` / Vercel | `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL` | yes | Convex endpoints (also used in the CSP) |
| | `NEXT_PUBLIC_SITE_URL` | yes | canonical URLs, OG images, sitemaps |
| | `REVALIDATE_SECRET` | recommended | Convex → Next cache purge after catalog/settings changes (otherwise pages refresh within 5–60 min) |
| | `CONVEX_DEPLOY_KEY` | Vercel only | lets the Vercel build deploy Convex functions |
| | `NEXT_PUBLIC_CONTACT_PHONE/VIBER/WHATSAPP/EMAIL` | no | fallback contact until Admin → Podešavanja → Firma is filled |
| | `NEXT_PUBLIC_TEST_HOOKS` | never in prod | `window.__sklop3d` hooks and `?3d=` tier override for e2e |
| Convex | `JWT_PRIVATE_KEY`, `JWKS` | yes | Convex Auth signing keys (`scripts/setup/auth-keys.mjs`) |
| | `SITE_URL`, `NEXT_SITE_URL` | yes | site URL for auth and links in e-mails |
| | `LINK_TOKEN_SECRET` | yes | HMAC key for order/inquiry status links. Production refuses orders without it; never change it after launch |
| | `IP_HASH_SALT` | recommended | salt for hashed IPs in rate limits (derived from `LINK_TOKEN_SECRET` if empty) |
| | `EMAIL_MODE` | yes | `log` · `test` · `live` |
| | `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM` | for e-mail | Resend sending and delivery webhook (`https://<deployment>.convex.site/resend-webhook`) |
| | `META_CAPI_TOKEN`, `META_GRAPH_VERSION` | for Meta ads | server-side Conversions API (default `v26.0`) |
| | `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | once | `seed:createOwner`; remove after the first sign-in |
| | `E2E_TEST_HELPERS` | dev only | enables the internal test helpers |

Tracking IDs (GA4, Google Ads, Meta Pixel) are **not** env vars: they live in Admin → Podešavanja → Praćenje and stay empty (no tags load) until filled.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next dev server on :3000 (one per project; `.next/dev` holds a lock) |
| `npm run build` | `next build` **plus** `scripts/build/compile-hints.mjs` (V8 compile hints for the framework chunks, D294). Always build with this, not a bare `next build` |
| `npm run start` | serve the production build (`-- -p 3100` for e2e) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint flat config (blocks direct `next/link` and GSAP imports) |
| `npm test` | Vitest, both projects (`unit` in jsdom/node, `convex` in edge-runtime with convex-test) |
| `npm run test:unit` / `npm run test:convex` | one project only |
| `npm run e2e` | Playwright; builds with `NEXT_PUBLIC_TEST_HOOKS=1` and serves on :3100 unless `E2E_BASE_URL` is set |
| `npm run convex:push` | `convex dev --once` |
| `npm run seed` / `npm run seed:stats` | seed + owner / row counts |
| `npm run 3d` / `3d:validate` / `3d:preview` | rebuild the 3D assets / check budgets and names / load both GLBs in headless Chromium |
| `npm run format` | Prettier |
| `node scripts/showcase/shots.mjs` + `node scripts/showcase/build.mjs` | re-capture the showcase screenshots (needs a test-hooks build on :3100) and rebuild `docs/showcase/index.html` |

---

## Architecture map

```
app/
  (shop)/            storefront: /, /delovi/[kategorija]/[marka]/[model], /deo/[slug], /pretraga, /vozila/…,
                     /korpa, /porudzbina (checkout), /porudzbina/[token] (status), /upit, /upit/[token],
                     /za-majstore, /majstor/* (portal), /nalog/* (account), legal and static pages
  (landing)/ponuda/  ads landing pages (managed in Admin → Podešavanja → Oglasne strane)
  admin/(panel)/     admin screens (paper theme); admin/(print)/ pro-forma and delivery notes
  api/               atribucija (90-day source cookie), revalidate, zdravlje (health check)
  feeds/             google-merchant.xml, meta-catalog.csv
  sitemap.xml, sitemaps/[file], robots.ts, slike/deo/[file] (SEO image URLs), OG image routes
components/          ui (kit), shell, catalog, product, cart, checkout, inquiry, mechanic, admin, three, consent, …
lib/
  domain/            pure business logic shared by Next and Convex: pricing, state machines, totals, OEM
                     normalisation, quick-order parser, VIN/PIB/MB checks, Belgrade time, product rules
  server/            server-only data access (catalog-cache.ts is the only cached reader), auth
  seo/ analytics/ email/ excel/ import/ three/ gsap/ validation/ i18n/sr/ (shared Serbian strings) …
convex/              schema.ts, function modules per area, lib/functions.ts (auth builders), crons.ts, http.ts,
                     seed.ts + seedData/, testing.ts (internal e2e probes), *.test.ts
config/site.ts       brand, locale, currency, VAT, contact fallbacks
constants/           routes (LIVE_ROUTES), test ids, text-reveal config, X-ray values
3d/                  blender/ (Python builders), scripts/ (Node pipeline), assets/, build/ (ignored)
public/models, public/images/{hero,parts}   generated 3D outputs (never edit by hand)
tests/               unit/, e2e/, fixtures/, lighthouse/run.mjs
scripts/             build, qa (screenshots, audit repros), showcase, setup, fonts, design
docs/                all design and technical documentation (index: docs/README.md)
```

Rules that are easy to break:

- **Rendering:** pages are dynamic (auth cookies in the root layout; `cacheComponents` is off). Catalog data is cached only in `lib/server/catalog-cache.ts` and purged by Convex through `/api/revalidate`.
- **Convex:** every public function declares `args` + `returns` validators and authorizes through the builders in `convex/lib/functions.ts` (`publicQuery`, `userMutation`, `staffMutation`, `ownerMutation`, …). Identity never comes from args. Products are written only through `productWriter`; staff writes go through `audit()`; business events through `emitEvent`. Public queries never return cost or another role's price.
- **Prices** are integer *para* (1/100 RSD). Mechanic prices are computed server-side by `resolveUnitPrice` (`lib/domain/pricing.ts`): tier default, category/manufacturer overrides, personal override, margin guard.
- **Notifications:** domain events outbox → dispatcher (`convex/events.ts`) → channels (in-app, e-mail via Resend, Meta CAPI, cache revalidation). E-mail modes `log` / `test` / `live`; demo and test orders are never sent.
- **Text reveal:** every heading/paragraph arrives word by word through one global system. Never write a text entrance animation; above-the-fold copy uses `RevealText`. See `.claude/rules/architecture.md`.
- **Security:** nonce CSP in `proxy.ts`, static headers in `next.config.ts`, rate limits on every public write, status pages reached by HMAC tokens (only hashes stored). Details: [`docs/SECURITY.md`](docs/SECURITY.md), [`docs/SECURITY-AUDIT.md`](docs/SECURITY-AUDIT.md).

Detailed docs: [`docs/README.md`](docs/README.md) (index), [ARCHITECTURE](docs/ARCHITECTURE.md), [ROUTES](docs/ROUTES.md), [DATA-MODEL](docs/DATA-MODEL.md), [NOTIFICATIONS](docs/NOTIFICATIONS.md), [SEO-ADS](docs/SEO-ADS.md), [IMPORT](docs/IMPORT.md), [design system](docs/design/DESIGN-SYSTEM.md), [DECISIONS](docs/DECISIONS.md) (D1–D298).

---

## Data model summary

55 tables in `convex/schema.ts` (the source of truth; [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) documents every field and index).

| Area | Tables |
|---|---|
| Identity and access | `users` (role: customer · mechanic · staff · owner), `staffInvites`, `customerNotes`, `staffPreferences` + Convex Auth tables |
| Settings and content | `settings` (company, delivery, payment, notifications, SEO, tracking, flags), `contentPages`, `faqs`, `redirects`, `adLandings`, `counters` (gapless `SK-YYYY-000123` / `UP-YYYY-000045`) |
| Vehicles | `vehicleBrands` → `vehicleModels` → `vehicleGenerations`, `engines`, `generationEngines` |
| Catalog | `categories` (tree, SEO text, 3D part key), `manufacturers`, `products` (public fields), `productContent`, `productPrivate` (cost, staff only), `productCodes` (normalised OEM/cross numbers), `fitments` |
| Pricing and B2B | `priceTiers`, `mechanicProfiles` (status, tier, overrides, credit), `savedVehicles`, `favorites` |
| Orders | `carts`, `cartItems`, `orders`, `orderItems`, `orderEvents` |
| Inquiries | `inquiries`, `inquiryEvents`, `quotes` |
| Stock and search | `stockMovements`, `priceChanges`, `backInStockSubscriptions`, `searchLogs`, `searchDaily` |
| Events and e-mail | `domainEvents` (outbox), `notifications` (in-app), `notificationDeliveries`, `emailLog` |
| Import | `importBatches`, `importRows`, `importChanges`, `importMappingPresets`, `imageFetchJobs` |
| Records and analytics | `auditLog`, `uploads`, `consentRecords`, `landingStats`, `statsDaily`, `cronRuns` |

Order statuses: `nova` → `potvrdjena` → (`spremna_za_preuzimanje` | `poslata`) → (`preuzeta` | `isporucena`) → `zavrsena`, plus `otkazana` and `ceka_deo`. Stock is taken on confirmation and returned on cancel. Inquiry statuses: `nov` → `u_obradi` → `ponuda_poslata` → (`prihvacena` → order | `odbijena` | `istekla`).

---

## The 3D pipeline

The car, posters, thumbnails and environment map are generated from versioned scripts. Never edit a GLB, the manifest or an image by hand. Full notes: [`docs/3d/BUILD-NOTES.md`](docs/3d/BUILD-NOTES.md); runtime contract: [`docs/3D-CONTRACT.md`](docs/3D-CONTRACT.md) (frozen slugs, node names `part__<category>__<instance>`, glTF +Y up / +Z front / +X left, budgets).

**Rebuild everything** (about 5 minutes on an RTX 4060):

```bash
export BLENDER_EXE="/c/Program Files/Blender Foundation/Blender 5.1/blender.exe"   # or your path
npm run 3d            # taxonomy → build → explode → export → optimize → posters → env → images → thumbs → validate
npm run 3d:validate   # sizes, triangles, draw calls, names vs manifest vs taxonomy (exit 1 on errors)
npm run 3d:preview    # loads car.glb and car-lite.glb in headless Chromium with three + meshopt
```

Selected stages run in order: `node 3d/scripts/run.mjs build export optimize validate`. One system only: `"$BLENDER_EXE" -b --factory-startup --python-exit-code 1 -P 3d/blender/build.py -- --only brakes`, then `explode export optimize validate`. Outputs: `public/models/car.glb` (desktop, ~3.6 MB), `car-lite.glb` (~2.6 MB), `car.manifest.json`, `public/images/hero/*` (posters for desktop, tablet, mobile in AVIF + WebP), `public/images/parts/<slug>.webp` (48 thumbnails). The optional studio HDRI (CC0, Poly Haven) goes to `3d/assets/hdri/`.

**Swap a part for a purchased model** (BUILD-NOTES §3): the runtime relies only on the part node (name, pivot, extras), so the geometry below it can change. Check the licence, put the file in `3d/assets/purchased/<slug>/` with its `LICENSE.txt`, replace that node's builder in `3d/blender/parts/<system>.py` with an import parented as the single child `mesh__<category>__<instance>__0`, map materials to the contract slots, keep the triangle budget, then rebuild the module and run `explode export optimize thumbs images validate`.

**Add a category or clickable part** (BUILD-NOTES §4): add it to `lib/catalog/taxonomy.ts` (slugs are frozen once live) and a hover note in `lib/catalog/partNotes.ts`; run `node 3d/scripts/taxonomy-json.mjs`; model it in the right `parts/<system>.py`; add its explode intent in `3d/blender/config/explode.py` (and a thumbnail composition in `config/thumbs.py` if needed); run `npm run 3d`, fix what `explode.py` reports, and map the category to the part key in Admin → Kategorije.

The X-ray values live twice (`3d/blender/config/xray.py` for posters, `constants/xray.ts` for the runtime) and a unit test fails when they drift. A camera change needs new posters, or the poster → canvas crossfade jumps.

---

## Testing

```bash
npm run typecheck && npm run lint
npm test                                   # 1,223 tests (unit + Convex), 4 skipped (backup drill without a snapshot)
npm run e2e                                # builds with test hooks, serves :3100, runs desktop-1440 and mobile-390
E2E_BASE_URL=http://localhost:3000 npm run e2e   # reuse a running server instead
node tests/lighthouse/run.mjs --throttling devtools --runs 3 /     # against `npm run start -- -p 3100`
```

- e2e needs the dev deployment with `E2E_TEST_HELPERS=1`, `SEED_ADMIN_EMAIL/PASSWORD` in the environment, and `REVALIDATE_SECRET` matching `.env.local` (the consent tests purge the settings cache). Specs create their own records with unique `e2e-<timestamp>@primer.rs` addresses; Convex state is read through internal probes in `convex/testing.ts` run with the Convex CLI.
- Headless Chromium renders WebGL through SwiftShader, which the tier probe classes as low. 3D tests force a tier with `?3d=high|mid` (test-hooks builds only).
- The Lighthouse budget method is **applied throttling** (D112). Simulated throttling reports LCP around 4 s on localhost because it charges all first-load JS to LCP; check real numbers on PageSpeed Insights after launch.
- Screenshot and QA scripts live in `scripts/qa/`; the audit reproduction kit is in `scripts/qa/audit/`.

More: [`docs/TESTING.md`](docs/TESTING.md).

---

## Deployment

Production is Vercel (Next.js) + Convex cloud (EU region). Nothing has been deployed yet. Follow [`docs/GO-LIVE.md`](docs/GO-LIVE.md): it lists the domain, Vercel project, `npx convex deploy`, environment variables, Resend domain, owner account, demo-data removal, tracking IDs, feeds, Search Console and backups in order.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `npm run dev` says another dev server is running | Next 16 holds a lock in `.next/dev`; stop the other `next dev` of this project. Use another port with `npm run dev -- -p 3001` if :3000 belongs to a different app. |
| Sign-in fails with a JWT / key error | `JWT_PRIVATE_KEY`/`JWKS` missing or set with a shell that broke the key. Re-run `node scripts/setup/auth-keys.mjs` (it passes `NAME=VALUE` without a shell). |
| Checkout or inquiry fails with „LINK_TOKEN_SECRET is not set“ | Set it on the Convex deployment. Only `localhost` site URLs get a development fallback. |
| Pages show old prices or settings | `REVALIDATE_SECRET` differs between `.env.local`/Vercel and Convex, or is missing. Without it pages refresh on their own within 5–60 minutes. |
| No e-mails arrive | `EMAIL_MODE` is `log` (the default), or `RESEND_API_KEY`/`EMAIL_FROM` is missing, which falls back to `log` with a warning in Podešavanja → Obaveštenja. Every message is in Admin → E-pošta. |
| The 3D car never loads in headless tests | The device tier is low under SwiftShader; build with `NEXT_PUBLIC_TEST_HOOKS=1` and add `?3d=high`. On real devices it starts on the first scroll or touch. |
| e2e fails with „E2E_TEST_HELPERS“ | `npx convex env set E2E_TEST_HELPERS 1` on the **dev** deployment (never on production). |
| Lighthouse in Git Bash only measures `/` | Run it with `MSYS_NO_PATHCONV=1`, otherwise `/delovi/…` is rewritten to a Windows path. |
| Lint errors about `next/link` or `gsap` imports | Use `RouteLink` (`components/ui/RouteLink`) and `@/lib/gsap/client`; new routes must be added to `LIVE_ROUTES` in `constants/routes.ts` or their links won't prefetch. |
| Copy stays invisible | Something hides text outside the text-reveal system, or splits it without restoring. See `.claude/rules/architecture.md` → „Checking your work“. |
| Import shows broken characters (č, ć, ž, š, đ) | The CSV is Windows-1250; the importer detects it, but a file saved as „ANSI“ in another code page will not. Save as UTF-8 or xlsx. |
