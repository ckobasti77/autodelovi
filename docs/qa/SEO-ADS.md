# QA — SEO, ads and consent (step 19)

Production build (`NEXT_PUBLIC_TEST_HOOKS=1 npm run build && next start -p 3100`), 2026-09-30. Screens: `node scripts/qa/seo-shots.mjs` → `docs/qa/screens/step-19/`. Zero console errors in the final capture run.

## Screens and verdicts

| Screen | 1440 | 390 | Verdict |
|---|---|---|---|
| Consent banner, first visit (home) | `banner-home-1440.png` | `banner-home-390.png` | PASS — in the first HTML, fixed bottom sheet, „Prihvati sve“ / „Odbij sve“ same weight, „Podešavanja“ as a quiet third action, link to `/kolacici`. |
| Consent banner, granular | `banner-settings-1440.png` | `banner-settings-390.png` | PASS — Neophodni (on, disabled), Analitika, Oglašavanje as switches with descriptions; „Sačuvaj izbor“ first. |
| Landing category × model | `landing-1440.png` | `landing-390.png` | PASS — H1 „Amortizeri i opruge za VW Golf“, intro with counts/price range/generations/makers, generation list, FAQ from data, sibling and cross-category links, vehicle + inquiry CTAs. |
| Ads landing `/ponuda/kocione-plocice-golf` | `ponuda-1440.png` | `ponuda-390.png` | PASS — message-match H1, three proof points from data/settings, inquiry + vehicle picker, 7 parts from the category × vehicle listing, minimal header/footer. |
| Admin → Izvori | `admin-izvori-1440.png` | — | PASS — per channel and per source/medium/campaign, offline conversions summary with the missing-name warning and download. Demo orders have no attribution, so everything reads „Direktno“ (expected). |
| Admin → Podešavanja → SEO | `admin-seo-1440.png` | — | PASS — curated searches, landing guard overview („50 od 816“, reasons, top pages), „Preračunaj sada“. |
| Admin → Podešavanja → Praćenje | `admin-pracenje-1440.png` | — | PASS — CAPI token and cache purge status, feed and sitemap addresses. |
| Admin → Podešavanja → Oglasne strane (+ editor) | `admin-oglasne-strane-1440.png`, `admin-oglasna-strana-editor-1440.png` | — | PASS — list with status badges, editor with limits, category/vehicle selects, product picker, switches. |
| Admin → Upiti (Izvor column) | `admin-upiti-1440.png` | — | PASS — „Izvor“ column (≥ 1280 px) + source filter. |
| OG images | `test-results/og_*.png` (not committed) | — | PASS — default (hero render + promise), product (render, name, OEM · maker, quality; no price), category (render + counts), landing (render, vehicle, generations, counts). |

## Findings fixed during the step

| ID | Severity | Finding | Fix |
|---|---|---|---|
| SEO-1 | P1 | Pages that define `openGraph` lost the root OG image (no `og:image` on home, /delovi, /za-majstore …). | Default image set in `buildMetadata`; segments with their own file pass `ogFile` (a config image would override the segment file) — D192. |
| SEO-2 | P2 | Product titles cut the OEM number („… ventilirani ATE… \| SKLOP“). | Smart template keeps the code (suffix → maker → name) — D193. |
| SEO-3 | P2 | Product description ended the vehicle list with „….“. | Vehicle list shortened with a single ellipsis. |
| SEO-4 | P1 | Desktop banner: buttons collapsed to thin outlines in the column layout. | Buttons in a row, form centred, `lg:flex-none`. |
| SEO-5 | P2 | Focus dropped to `<body>` after a choice (buttons disabled while saving). | Focus captured before saving and moved to `<main>`. |
| SEO-6 | P2 | Ads landing editor showed two character counters for text areas. | Duplicate help counters removed. |
| SEO-7 | P3 | Admin breadcrumb read „izvori“. | Label map entry. |
| SEO-8 | P3 | `/admin/upiti?status=<unknown>` failed the list query (pre-existing). | Unknown status values list everything. |
| SEO-9 | P2 | Settings status panels touched the section above. | Spacing. |

Note: the orange „Preskoči na sadržaj“ box visible mid-page in the full-page captures is a capture artefact (fixed elements are stitched at the scroll position; the skip link sits just above the viewport), not a focused element.

## Lighthouse (mobile, applied throttling, 3-run medians, fresh profile — banner visible)

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| `/` | 88 | 97 | 100 | **100** | 2 193 ms | 0.001 | 356 ms |
| `/delovi/kocioni-diskovi` | 89 | 100 | 100 | **100** | 2 129 ms | 0.001 | 352 ms |
| `/deo/kocioni-disk-zadnji-272-10-mm-puni-demo-0003` | 88 | 100 | 100 | **100** | 2 168 ms | 0.001 | 359 ms |

SEO ≥ 95 on all three (step 19 bar). Home accessibility 97 is the known `target-size` note on the systems index links (SF-16, step 12), not the banner. TBT on this machine is noisy (297–472 ms on the same page in back-to-back runs, with or without the banner — measured with and without a consent cookie), so the TBT budget (≤ 300 ms) is not attributed to the consent code; performance tuning belongs to step 22. With simulated throttling the home LCP is 4.4 s (Lantern), the same pattern documented in `docs/3d/WEB-QA.md`.
