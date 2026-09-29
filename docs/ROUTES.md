# SKLOP — Routes and rendering

> Part of the SKLOP docs — index: [README](README.md) · source: [master plan](plans/01-master-plan.md). Business intent: `pipeline/BRIEF.md`.

Related: [ARCHITECTURE §0.3 Next 16 rules](ARCHITECTURE.md) · [SEO-ADS](SEO-ADS.md) (metadata, canonicals, sitemaps) · [SECURITY](SECURITY.md) (guards).

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
