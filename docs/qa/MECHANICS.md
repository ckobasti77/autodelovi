# Mechanics portal QA (step 14)

> Screens of every new page at 390 and 1440 px (admin: 1440 and 1024), reviewed against DESIGN-SYSTEM §9–§11, the impeccable craft floor and design-taste-frontend rules. Captured on the production build with `node scripts/qa/mechanic-shots.mjs` (registers a workshop through the UI, captures the pending state, approves it with `testing:approveMechanic`, adds two favorites, a customer vehicle, runs a quick order with exact / „više opcija“ / not-found / ignored lines, places a deferred-payment order, downloads the XLSX price list, then signs in as the owner for `/admin/majstori`) into `docs/qa/screens/step-14/`.

Severity: **P0** blocks the flow or breaks the page · **P1** visible defect or wrong information · **P2** polish · **P3** nice to have.

## Pages captured

| Page | Files | Console errors |
|---|---|---|
| `/za-majstore` landing (tiers, benefits, live quick-order demo, approval steps, FAQ, contact) | `landing-*` | 0 |
| `/za-majstore/registracija` (empty; with the error summary after a send attempt) | `registration-*`, `registration-errors-1440` | 0 |
| `/za-majstore/hvala` | `thanks-*` | 0 |
| `/majstor` while pending (status screen) | `portal-pending-*` | 0 |
| `/majstor` overview (quick order + terms + tiles) | `portal-*` | 0 |
| `/majstor/brza-porudzbina` empty and with results | `quick-order-empty-*`, `quick-order-results-*` | 0 |
| Orders, order detail, favorites, customer vehicles, price list, inquiries, profile | `orders-*`, `order-*`, `favorites-*`, `vehicles-*`, `price-list-*`, `inquiries-*`, `profile-*` | 0 |
| Product and search as an approved mechanic („Vaša cena“) | `product-mechanic-*`, `search-mechanic-*` | 0 |
| Checkout as a mechanic (company + workshop prefilled; deferred payment with the remaining limit) | `checkout-contact-mechanic-1440`, `checkout-payment-mechanic-1440` | 0 |
| Admin: registrations list, approved mechanic's terms (the pending decision panel is driven by the e2e; no registration was pending at capture time) | `admin-mechanics-*`, `admin-mechanic-*` | 0 |
| Downloaded price list | `cenovnik-auto-servis-jovic-2026-09-30.xlsx` | — |

Full-page captures show two known artifacts of the capture method, not of the page: sticky bars (quick-order action bar, price-list download bar, header) are drawn where they sat in the first viewport, and on very long pages the `cv-auto` sections below the fold (D121) can render blank. A viewport capture at the bottom of `/za-majstore` confirmed FAQ, contact strip and footer render normally.

## Findings (round 1) — all fixed

| ID | Sev | Page | Finding | Fix |
|---|---|---|---|---|
| MP-01 | P1 | Quick order | Demo „više opcija“ grouped two unrelated turbos (1.9 TDI / 1.4 TSI) under one OEM number — a mechanic would distrust the whole list. | Demo equivalents are now the same part from another maker (`DEMO-E001…E007`); the earlier cross-links were repaired (D135). |
| MP-02 | P1 | Registration | The error summary appeared on the first blur, before any send attempt. | Summary only after a submit; fields still validate on blur. |
| MP-03 | P2 | Quick order | Remove button floated below the stepper on not-found rows; „2 × = 16.134 RSD“ read oddly. | Stepper and remove share one row; line total reads „2 kom. · 16.134 RSD“. |
| MP-04 | P2 | Quick order (phone) | After „Proveri brojeve“ the answer sat below the input box, out of view. | Results scroll into view on < 1024 px (offset for the sticky header). |
| MP-05 | P2 | Quick order | Draft stayed in the box after everything went to the cart / inquiry. | The box clears when no rows remain. |
| MP-06 | P2 | Favorites (390) | Price block right-aligned in a left column under the thumbnail; product links wrapped their arrow to the far edge. | Price follows the controls on phones; product names are plain underlined links (also in quick-order rows). |
| MP-07 | P2 | Landing | Quick-order demo quantities in the accent colour (orange is reserved for „yours / next“). | Quantities in ink. |
| MP-08 | P2 | Registration, thanks | „Pitanja pre registracije?“ / „Hitno vam treba deo?“ shown with no contact channels (settings empty). | Hidden while no channel is configured. |

**Round 2 (after fixes, production build):** quick order, favorites, landing and registration re-captured at 390 and 1440 and reviewed; no open P0/P1.

## Accessibility and motion
- axe (wcag2a/aa, 21a/aa, 22aa): zero serious/critical on `/za-majstore`, `/za-majstore/registracija`, `/admin/majstori` and the approval detail (`tests/e2e/mechanics.spec.ts`).
- Text reveal: no stuck copy on `/za-majstore` after a full scroll, no pending elements. Portal views are live data and opt out (`data-reveal="off"`); headings above the fold use `RevealText`.
- Touch targets ≥ 44 px on phones (chips, steppers, remove buttons, filter chips, list links); quick-order and price-list actions stick to the bottom of the viewport.
- No new animation: rows, badges and prices update instantly (live values); reduced motion unaffected.

## Open (P3)
- Checkout: the skip link can show in captures after the step change moves focus (pre-existing, step 12 behaviour).
- `/admin` shell is intentionally minimal until step 15.
