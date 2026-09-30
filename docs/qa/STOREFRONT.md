# Storefront QA (step 12)

> Screens of every storefront page at 390 and 1440 px, reviewed against DESIGN-SYSTEM §9–§12, the impeccable craft floor and design-taste-frontend (anti-slop) rules. Captured with `node scripts/qa/storefront-shots.mjs` (scrolls each page end to end so the text reveal runs, reports stuck copy, horizontal overflow and console errors) into `docs/qa/screens/step-12/`. Tall captures are cut with `node scripts/qa/crop.mjs`. Demo order / inquiry for the confirmation and status pages: `node scripts/qa/make-demo-flows.mjs`; quote page token: `npx convex run testing:quotedInquiryToken`.

Severity: **P0** blocks a purchase or breaks the page · **P1** visible defect or wrong information · **P2** polish · **P3** nice to have.

## Pages captured (390 + 1440)

| Page | Files | Stuck copy | Overflow-x | Console errors |
|---|---|---|---|---|
| Home `/` | `home-*` | 0 (a transient 13 at the top during the 3D crossfade was not reproducible; the e2e reveal check passes) | 0 | 0 |
| Delovi `/delovi`, system hub `/delovi/kocnice` | `parts-*`, `system-*` | 0 | 0 | 0 |
| Category `/delovi/kocioni-diskovi` (+ vehicle filter, landing `/…/volkswagen/golf`) | `category-*`, `category-vehicle-*`, `landing-*` | 0 | 0 | 0 |
| Product in stock / out of stock | `product-*`, `product-out-*` | 0 | 0 | 0 |
| Search with results / zero results | `search-*`, `search-zero-*` | 0 | 0 | 0 |
| Cart page, cart drawer, checkout | `cart-*`, `cart-drawer-*`, `checkout-*` | 0 | 0 | 0 |
| Order confirmation, status, predračun | `order-thanks-*`, `order-status-*`, `proforma-*` | 0 | 0 | 0 |
| VIN inquiry, confirmation, quote page | `inquiry-*`, `inquiry-thanks-*`, `inquiry-quote-*` | 0 | 0 | 0 |
| Vehicle hubs (4 levels) | `vehicles-*`, `vehicle-brand-*`, `vehicle-model-*`, `vehicle-gen-*` | 0 | 0 | 0 |
| Auth: prijava, registracija, zaboravljena lozinka | `signin-*`, `signup-*`, `forgot-*` | 0 | 0 | 0 |
| Static & legal (7) + `/za-majstore` | `about-*`, `contact-*`, `delivery-*`, `returns-*`, `terms-*`, `privacy-*`, `cookies-*`, `mechanics-*` | 0 | 0 | 0 |
| Search without a query | `search-empty-*` | 0 | 0 | 0 |
| 404 (unknown URL, unknown product) | `notfound-*`, `product-missing-*` | 0 | 0 | 1 (the document's own 404 status, expected) |
| Account: overview, orders, order detail, inquiries, vehicles, profile, signed-in `/prijava` | `account-*`, `signin-signed-*` | 0 | 0 | 0 |

Account pages are captured with `node scripts/qa/account-shots.mjs` (registers a customer through the UI, orders while signed in, saves a vehicle, then signs in per viewport — Convex Auth rotates refresh tokens, so a copied session expires).

**Final round (goal verification, production build):** every page above re-captured at 390 and 1440 after the last change and reviewed; no open P0/P1.

## Findings

| ID | Sev | Page | Finding | Status |
|---|---|---|---|---|
| SF-01 | P0 | Cart drawer | The drawer closed itself right after the lazy chunk mounted (the „close on navigation“ effect ran on mount), so the header cart looked dead. | FIXED — effect skips the first render; e2e opens the drawer and checks out from it; `cart-drawer-*` re-shot. |
| SF-02 | P1 | Product (mobile) | Lighthouse CLS 0.068: the OEM / šifra row re-wrapped when Martian Mono finished loading. | FIXED — code lines stacked (D127); CLS 0.000–0.001. |
| SF-03 | P1 | Home, `/delovi` | „Filteri — Po upitu“: a parent category (products live in subcategories) showed no count; the catalogue total missed subcategory products. | FIXED — `categoryProductCount` / `catalogProductCount`. |
| SF-04 | P1 | Home „Vozila koja pokrivamo“ | „VOLKSWAGEN“ squeezed its model count into two lines. | FIXED — count under the name. |
| SF-05 | P1 | All pages with `pb-section` | Bottom section spacing missing (`pb-section` is not a utility; only `py-section` exists) — forms and lists ran straight into the footer. | FIXED — `pb-(--space-section)`. |
| SF-06 | P1 | Order status / predračun | Customer phone shown raw (`+381635551234`). | FIXED — `formatPhone` (`+381 63 555 1234`). |
| SF-07 | P1 | Unknown product / category URLs | Streamed `loading.tsx` turned `notFound()` into HTTP 200 (soft 404). | FIXED — D119; `/deo/nepostoji` and `/delovi/nepostoji` → 404. |
| SF-08 | P1 | Category (a11y) | `heading-order`: filter group titles were h3 without an h2; cards (h3) had no h2 above them. | FIXED — group titles h2, visually hidden „Artikli“ h2; Lighthouse a11y 100. |
| SF-09 | P1 | Cart, checkout, order (axe serious) | `definition-list`: paragraphs inside `<dl>`. | FIXED — notes moved out of the lists; axe clean on six templates at 390 and 1440. |
| SF-10 | P2 | Quote page | „Važi do 06.10.2026..“ (double period). | FIXED. |
| SF-11 | P2 | Category (mobile) | Filteri + Sortiraj row is not sticky under the header (DS §10.2 mobile note). | OPEN — P2, step 21 polish. |
| SF-12 | P2 | Performance | Applied-throttling Lighthouse mobile: home perf 92 (TBT 222 ms), product 91 (TBT 223 ms), category 88 (TBT 397 ms: a ~240 ms document task at first paint plus hydration of the filter rail and 3 client islands per card). | PARTLY FIXED — D120, D121; category TBT left for the step 21/22 performance pass (target ≥ 90). |
| SF-13 | P2 | Search | Results are not narrowed or annotated by the selected vehicle (the category and product pages are). | OPEN — needs `search.run` with a vehicle filter (ARCHITECTURE §E2 lists `vehicle?`); step 13/21. |
| SF-14 | P3 | Mobile shell | The sticky bottom contact bar on scroll-up (DS §10.1 mobile) is not built; contact is in the header menu, the footer and every product/checkout page. | OPEN — P3. |
| SF-15 | P3 | Confirmation copy | „Poslali smo potvrdu na {e-mail}“ is true once step 18 sends e-mails (log mode until the owner connects Resend). | NOTE — step 18. |

| SF-17 | P2 | Checkout, profile (signed in) | First/last name empty after registration (sign-up stores only the full name). | FIXED — `viewerNames` splits the account name for prefills. |
| SF-18 | P2 | Profile, checkout (signed in) | Saved phone prefilled as raw E.164. | FIXED — `formatPhone` (`+381 64 222 3344`). |
| SF-19 | P3 | Search without a query | Sparse page (field only). | OPEN — popular categories could follow (step 21). |

No open P0 or P1.

## Checks (production build, `next start -p 3100`)

- Playwright `tests/e2e/storefront.spec.ts` at 1440 and 390: OEM search (messy spelling) → product → add → header drawer → 4-step guest checkout with courier + pouzeće → confirmation; Convex probe: status `nova`, payment `cod`, delivery `courier`, customer `guest`, domain event `order.created`; `purchase` tracked. Category filtering through the shared vehicle picker (desktop rail / mobile sheet) and chip removal. VIN inquiry with VAG decode (make prefilled) and a photo upload → probe: `nov`, kind `vin`, 1 photo, `inquiry.created`. Back-in-stock subscription → probe: active. Axe (serious/critical = 0) on home, category, product, cart, checkout, inquiry. Text-reveal snippet empty on home, category, product; no pending/split words.
- Lighthouse mobile, applied throttling (`node tests/lighthouse/run.mjs --throttling devtools`), medians: 5 runs — home perf 92 (LCP 2086 ms, CLS 0.001, TBT 222 ms), category 88 (LCP 1888 ms, CLS 0.001, TBT 397 ms, a11y 100), product 91 (LCP 2154 ms, CLS 0.001, TBT 223 ms, a11y 100); SEO 100 and best practices 100 everywhere. Final build, home 3 runs: perf 88, a11y 97, LCP 2675 ms, TBT 197 ms (LCP spread 2.1–2.7 s between batches on this machine).
- SF-16 (P2, OPEN): Lighthouse home a11y 97 — `target-size` reports systems-index links as „partially obscured“ in Lighthouse's mobile emulation only; the Playwright axe run (390 and 1440, after scrolling) finds no violation. Investigate with the step 21 audit.
