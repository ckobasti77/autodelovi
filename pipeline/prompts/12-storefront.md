<!-- META | Korak 12 | Opus 5.5 | effort: xhigh | sesija: NOVA | mode: auto -->
# Step 12 — Storefront: pages, search, cart and ordering

You are a senior product designer-engineer building the public shop around the 3D hero. Every page must feel like part of one flagship product, convert paid traffic, and serve mechanics at speed.

## Read first
pipeline/BRIEF.md §3, §5, §6, §9 · docs/ROUTES.md · docs/design/DESIGN-SYSTEM.md (blueprints, components, voice) · docs/ARCHITECTURE.md · docs/DATA-MODEL.md · docs/SEO-ADS.md (on-page parts only; the full SEO/ads work is step 19) · docs/progress/*.md.

## Skills to invoke (by name)
impeccable · design-taste-frontend · ui-ux-pro-max · text-reveal · gsap-react · gsap-scrolltrigger · motion-design · apple-design · site-architecture · seo-page · convex.

## Build — all copy in Serbian; server-render everything indexable
1. **Home** — the 3D hero from step 10 with headline, OEM search and vehicle picker; how ordering works (3 steps, no online payment); categories grid with rendered thumbnails; „Za majstore" band; brands covered (text chips, no logos); trust facts from settings (empty-safe); a FAQ with genuinely useful answers; contact strip (phone, Viber, WhatsApp, hours, address, map link).
2. **Vehicle picker** (brand → model → generation → engine), persisted per visitor, reflected in URLs where it matters, used by category, search, product fitment badges and the 3D panel.
3. **Catalog** — /delovi (all categories grouped by system); /delovi/[kategorija] (filters: vehicle, manufacturer, quality, availability, price; sort; server pagination; filter state in the URL; SEO intro); vehicle pages /vozila/[marka]/[model]/[generacija] with parts by category.
4. **Search** /pretraga — normalized OEM / cross-number exact matches first, then name/text; instant suggestions in the header (debounced, keyboard navigable); zero results → VIN-inquiry CTA and the query is logged.
5. **Product** /deo/[slug] — gallery (category thumbnail as placeholder until real photos), title, manufacturer, quality badge, OEM + cross numbers with copy buttons, fitment table plus an „odgovara vašem vozilu" badge, specs, price block (retail incl. PDV; mechanic price when approved), stock and lead time, quantity, add to cart, „Pošalji upit", call / Viber / WhatsApp, related and compatible parts, back-in-stock subscription when unavailable.
6. **Cart** (drawer + /korpa) and **order flow** /porudzbina — contact → delivery → payment → review; guest or logged in; optional company data (PIB 9 digits with checksum, MB 8 digits); delivery and payment methods from settings with their rules (deferred payment only for approved mechanics with credit); notes, optional VIN, terms consent; spam protection (honeypot + timing + rate limit); server-side re-pricing; confirmation /porudzbina/hvala/[token]; status page /porudzbina/[token] with a timeline.
7. **VIN inquiry** /upit — VIN validation + VAG WMI decode prefill, vehicle selects, description, up to 5 photos (client-side compression, size/type checks, upload to Convex storage), contact + preferred reply channel; confirmation; status page /upit/[token] showing the quote when staff responds, with „Prihvati ponudu" → creates the order.
8. **Account** /nalog (customer) — orders, inquiries, saved vehicles, profile; auth pages (prijava, registracija, zaboravljena lozinka) consistent with the design.
9. **Static & legal** — /o-nama, /kontakt, /dostava-i-placanje, /reklamacije-i-povrat, /uslovi-koriscenja, /politika-privatnosti, /kolacici: solid Serbian templates (ZZPL, Zakon o zaštiti potrošača, Zakon o elektronskoj trgovini) filled from settings; list what needs legal review in docs/HUMAN-TODO.md.
10. **States** — loading skeletons, empty states, errors, 404/500 with search and vehicle picker, friendly offline messages.
11. **Analytics hooks** — route all tracking through one `track()` abstraction (a no-op until step 19) at view_item, view_item_list, search, add_to_cart, begin_checkout, generate_lead, purchase and contact clicks. Capture attribution parameters on landing into a first-party cookie now (step 19 completes it).

## Verify
- Playwright e2e: OEM search → product → add to cart → guest order with pouzeće → the order exists in Convex (status nova) and a domain event was emitted; category filtering by vehicle; VIN inquiry with a photo; back-in-stock subscription.
- axe scan with zero serious/critical violations on home, category, product, cart, checkout, inquiry.
- Screenshots of every page at 390 and 1440 → open, critique (impeccable + design-taste-frontend), fix; log in docs/qa/STOREFRONT.md.
- The text-reveal check snippet returns nothing on home, category and product.
- tsc, lint, build pass · commit · Step report.
