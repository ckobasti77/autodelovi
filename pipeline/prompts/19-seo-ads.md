<!-- META | Korak 19 | Opus 5.5 | effort: xhigh | sesija: NOVA | mode: auto -->
# Step 19 — SEO, Google Ads, Meta Ads and analytics

The client starts paid campaigns soon. Make every page rank-ready and every dinar of ad spend measurable — and privacy-correct.

## Read first
docs/SEO-ADS.md · docs/ROUTES.md · docs/DATA-MODEL.md (attribution) · pipeline/BRIEF.md §5 (SEO, Google Ads, Meta Ads) and §9 · node_modules/next/dist/docs (metadata, sitemap, robots, OG images).

## Skills to invoke (by name)
seo · seo-plan · seo-technical · seo-schema · seo-sitemap · seo-ecommerce · seo-programmatic · seo-local · seo-page · seo-images · seo-content · seo-geo · site-architecture · convex.

## Build
1. **Metadata** for every route — Serbian title/description templates (keyword first, ≤ 60 / ≤ 155 characters, brand suffix from config), canonical rules (filters, sort, pagination), robots (noindex for account, cart, checkout, admin, and search results except curated ones), OpenGraph/Twitter, dynamic OG images (product, category, landing) matching the design.
2. **Structured data** — AutoPartsStore / LocalBusiness (from settings), WebSite + SearchAction, BreadcrumbList, Product + Offer (RSD, availability, condition, brand = manufacturer, mpn = OEM, sku), ItemList on listings, FAQPage only for real on-page FAQs. Typed builders + tests that parse the JSON-LD out of rendered pages.
3. **Sitemaps** (index + chunked children for products, categories, vehicles, landings) and robots.txt through metadata routes reading Convex.
4. **Programmatic landing pages** category × brand / model with a thin-content guard (minimum product count, unique intro built from real data, FAQs, internal links); internal-linking modules; Serbian image alt texts and file names.
5. **Consent** — Consent Mode v2 banner: default denied for ad_storage, analytics_storage, ad_user_data, ad_personalization; granular; remembers the choice; links to /kolacici; accessible; no layout shift.
6. **Google** — gtag loader (GA4 + Google Ads IDs from settings; nothing loads when they are empty); implement `track()` with ecommerce parameters in RSD; purchase on order submission (transaction_id = order number); generate_lead on inquiry and mechanic registration; contact clicks; Enhanced Conversions (hashed e-mail/phone) only after consent.
7. **Meta** — Pixel (ID from settings) + **Conversions API** from a Convex action (token via `npx convex env set META_CAPI_TOKEN` — leave it unset now), a shared event_id for dedup, hashed PII, fbp/fbc capture, test_event_code support.
8. **Attribution** — complete the capture (utm_*, gclid, gbraid, wbraid, fbclid, referrer, landing page; 90-day first-party cookie) → stored on orders, inquiries and registrations; an admin „Izvor" column, filters and a sources report; an **offline-conversions CSV** export for Google Ads (completed orders with a gclid).
9. **Feeds** — /feeds/google-merchant.xml (RSS 2.0 with the g: namespace, required attributes, RSD prices, availability, google_product_category, product_type, shipping) and /feeds/meta-catalog.csv — cached, valid, only active products with a price.
10. **Ads landing** template /ponuda/[slug] (list managed in settings): fast, focused, built for message match.
11. **docs/ADS-PLAYBOOK.md (in Serbian)** — account structure; campaigns per brand and high-intent category; keyword themes with and without diacritics; match types; negatives; ad copy examples; assets (sitelinks, call, location); conversion actions and enhanced conversions setup; Merchant Center and Meta catalog steps (check current availability for Serbia with WebSearch and state it); GA4 setup; UTM conventions; a first-30-days optimization checklist; Google Business Profile checklist; Search Console and sitemap submission.

## Verify
Tests for metadata templates, JSON-LD parsing, sitemap and feed XML validity and required fields, consent default-deny (no tracking requests before consent — check the network in Playwright), events after consent (dataLayer assertions), the CAPI payload builder (mocked fetch). Lighthouse SEO ≥ 95 on home, category and product. tsc, lint, build and tests pass · commit · Step report.
