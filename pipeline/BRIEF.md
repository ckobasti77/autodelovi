# SKLOP — Product Brief (source of truth for the build pipeline)

> Every pipeline step reads this file first. When this brief and your training data disagree, this brief wins.
> From step 02 on, `docs/` holds the detailed plan: docs/ wins for implementation details, this brief wins for business intent.

## 1. The client and the problem
- A parts dealer in **Serbia** with a large catalog of auto parts for the **Volkswagen Group (VAG): Volkswagen, Audi, Škoda, SEAT and Cupra** (the client calls it "Škoda grupacija").
- A big share of sales goes through **mechanics (majstori / auto servisi)** who buy his parts for their customers' cars. The rest are retail drivers.
- Today everything is manual (phone, Viber, spreadsheets). He needs **process automation**: a catalog that is easy to keep current (Excel import), orders and inquiries in one place, automatic e-mails, and records of everything.
- He will soon run **Google Ads and Meta Ads**. The site must convert paid traffic and measure it correctly.
- **No online payment.** The customer places an order (porudžbina) and pays on delivery (pouzeće), at pickup, or by bank transfer against a pro-forma invoice (predračun).
- The shop has **no final name yet**. Working brand: **SKLOP** (Serbian for "assembly"), tagline **„Rasklopi auto. Nađi deo."** ("Take the car apart. Find the part."). Name, wordmark, contact and company data come from ONE config + admin settings, so renaming takes minutes.

## 2. Market and language
- Country: Serbia. Currency: **RSD**. Prices include **PDV 20 %**.
- Site language: **Serbian, Latin script, ekavian** („deo", „delovi", „cena", „uslovi", „rešenje"). Always correct diacritics: č ć ž š đ / Č Ć Ž Š Đ. `<html lang="sr-Latn-RS">`. Serbian only in v1 (no language switch), but keep copy centralized so a second locale is possible later.
- Formats: `12.990 RSD` (decimals only when they matter: `12.990,50 RSD`), dates `29.09.2026.`, phones `+381 6x xxx xxxx`.
- Voice: an experienced mechanic talking to a colleague — calm, precise, short sentences, zero fluff. Lowercase „vi" forms. No exclamation-mark marketing, no emojis in the UI.

## 3. Users and what they need
1. **Mechanic (majstor, B2B, repeat buyer, often on a phone in the workshop)** — find the right part fast: by **OEM / catalog number**, by vehicle (brand → model → generation → engine code), or visually on the 3D car. See stock and **his own price** (rabat). Order in seconds, reorder, paste a list of OEM numbers. Likes Viber and phone for questions.
2. **Retail driver (B2C, arrives from Google/Meta ads or search)** — "Do you have X for my car, how much, when can I get it?" Needs a clear price, stock, delivery or pickup, trust, and an easy way to ask (VIN inquiry, call, Viber).
3. **Admin / staff (the owner + 1–3 employees)** — manage catalog, stock, prices, orders, inquiries and mechanics; import Excel exports; see what people search for and don't find; get notified instantly.

## 4. The signature: the 3D exploded car
- The home hero is a **3D car in "X-ray" style**: the body is a ghosted glass shell with a glowing rim; the components inside are solid and realistic. On scroll the car **explodes** (exploded view) into its systems. Every part is **hoverable and clickable**.
- Click a part (e.g. the turbo) → a panel shows **all parts of that category in stock**, filtered by the visitor's selected vehicle, with role-aware price, stock, and add-to-cart / inquiry actions, plus a link to the full category page.
- It is a **visual catalog navigator**, not an exact per-model CAD: one generic, unbranded compact hatchback (MQB-like proportions: Golf / Octavia / Leon class), left-hand drive, transverse front engine with turbo, DSG-style gearbox.
- Built by the pipeline **in Blender via Python scripts** (no manual modeling, Blender runs headless). Honesty rule: we do not fake photorealism of the whole car. The X-ray concept turns the body into a stylized shell and invests the detail in the parts. Every part has a stable ID, so a purchased or pro-made model can later replace any node without code changes.
- It must never block the page: poster image first, 3D loads after first paint, an accessible parts list as an equivalent, reduced-motion support.

**Initial part taxonomy** (step 01 may refine; slugs must stay stable once chosen). Serbian label — slug:
- Motor i usis: Blok motora i glava — `motor` · Turbina (turbopunjač) — `turbina` · Interkuler — `interkuler` · Usisna grana i filter vazduha — `usis-filter-vazduha` · Brizgaljke i pumpa goriva — `brizgaljke-pumpa-goriva` · Set zupčastog kaiša i vodena pumpa — `zupcasti-kais-vodena-pumpa` · Alternator — `alternator` · Anlaser — `anlaser` · Svećice, bobine i grejači — `paljenje-grejaci` · Filter ulja, karter i dihtunzi — `ulje-karter` · EGR ventil — `egr-ventil`
- Izduvni sistem: DPF i katalizator — `dpf-katalizator` · Auspuh (lonci i cevi) — `auspuh`
- Hlađenje i klima: Hladnjak i ventilator — `hladnjak-ventilator` · Kompresor i kondenzator klime — `klima`
- Transmisija: Kvačilo i zamajac — `kvacilo-zamajac` · Menjač (DSG) — `menjac` · Poluosovine i homokinetički zglobovi — `poluosovine`
- Vešanje i upravljanje: Amortizeri i opruge — `amortizeri-opruge` · Ramena i selen blokovi — `ramena-selen-blokovi` · Spone i stabilizatori — `spone-stabilizatori` · Letva volana — `letva-volana` · Ležaj točka i glavčina — `lezaj-glavcina`
- Kočnice: Kočioni diskovi — `kocioni-diskovi` · Kočione pločice — `kocione-plocice` · Kočione čeljusti — `kocione-celjusti` · ABS senzori — `abs-senzori`
- Elektrika i svetla: Akumulator — `akumulator` · Farovi — `farovi` · Stop svetla — `stop-svetla` · Senzori (lambda, parking, temperatura) — `senzori`
- Karoserija: Hauba — `hauba` · Branici — `branici` · Blatobrani — `blatobrani` · Vrata — `vrata` · Retrovizori — `retrovizori` · Stakla — `stakla`
- Točkovi: Felne i gume — `felne-gume`
- Servis (no 3D node required): Filteri (ulje, vazduh, gorivo, kabina) — `filteri` · Ulja i tečnosti — `ulja-tecnosti`

## 5. Scope — must have in v1

### Storefront (public)
- **Home**: 3D hero + OEM/number search + vehicle picker; how ordering works (no online payment); categories with rendered thumbnails; "za majstore" band; brands covered (plain text, no logos); trust facts from settings; FAQ; contact strip (phone, Viber, WhatsApp, hours, address, map link).
- **Catalog**: all categories; category pages with filters (vehicle: brand/model/generation/engine; manufacturer; quality: original VAG / OEM / aftermarket; availability; price) and an SEO intro; vehicle pages (brand → model → generation); curated landing pages per category × brand/model only where enough products exist.
- **Search**: OEM/catalog-number aware (normalize spaces, dots, dashes, slashes, case), cross-reference numbers, name search; zero results → VIN inquiry CTA and the query is logged.
- **Product page**: gallery, name, manufacturer, quality, OEM + cross numbers with copy buttons, fitment table, specs, **price incl. PDV** (mechanics see their price), stock + lead time, quantity, add to cart, „Pošalji upit", call / Viber / WhatsApp, related and compatible parts, back-in-stock subscription.
- **Cart & order (no payment)**: guest or logged in; contact → delivery → payment → review; optional company data (naziv firme, PIB 9 digits with checksum, MB 8 digits); delivery: pickup in store / courier with cash on delivery; payment: pouzeće, cash or card at pickup, bank transfer against predračun (companies), deferred payment (only approved mechanics with the credit flag); notes; optional VIN; consent to terms. Confirmation page + tokenized order status page with a timeline.
- **VIN / part inquiry** („Ne nalazite deo?"): VIN (17 chars, validated, basic VAG WMI decode to prefill the brand), brand/model/year, what is needed, up to 5 photos, contact + preferred reply channel. A tokenized status page shows the quote once staff answers; the customer can accept → it becomes an order.
- „Javi mi kad stigne" back-in-stock subscriptions.
- Customer account (optional): orders, inquiries, saved vehicles.
- Static & legal: o nama, kontakt, dostava i plaćanje, reklamacije i povrat, uslovi korišćenja, politika privatnosti, kolačići — solid templates based on Serbian law with company data from settings; everything needing legal review is listed in docs/HUMAN-TODO.md (never visible as TODO text on the site).

### Mechanics (B2B) — model: discount tiers (rabat)
- `/za-majstore` landing + registration (firma, PIB, MB, kontakt osoba, telefon, e-mail, grad, adresa, vrsta servisa, marke koje servisira). Status pending → staff approves/rejects → e-mail.
- Approved mechanics see **their price everywhere** (retail crossed out + „Vaša cena"), computed **server-side only** from their **tier** (default % + per-category + per-manufacturer overrides) plus an optional personal override; margin guard (never below cost + minimum margin when the cost is known). Prices never leak to other roles.
- Quick order: paste lines like `1K0615301AA 2` → parse, normalize, match (ambiguous / not found shown) → add to cart; not found → one-click inquiry.
- Order history with status, reorder, favorites, saved customer vehicles (VIN + plate + note), downloadable personal price list (XLSX) for chosen categories.
- Deferred payment only if staff enabled credit for that mechanic.

### Admin panel
- **Dashboard**: today/week orders and value, inquiries waiting for a reply (SLA timers), pending mechanic approvals, low stock, **"searched but not found"** report, recent activity, simple charts.
- **Orders**: list / filter / search; detail with items, customer, delivery, payment, **ad attribution**, timeline; status transitions (each notifies); edit before confirmation; internal notes; courier tracking number; cancel with reason; print views (predračun, otpremnica).
- **Inquiries**: list/detail with photos; reply with a quote (catalog items or free lines with price, availability, lead time, validity); send → customer e-mail with accept link; convert to order.
- **Products**: table with search, filters, bulk actions; editor (all fields, drag-drop images with reorder, OEM/cross numbers with normalization preview, fitment editor, stock, prices, cost, SEO fields with snippet preview); duplicate; per-product history.
- **Excel import** (xlsx / xls / csv incl. Windows-1250 CSV): template download; column auto-mapping with Serbian/English synonyms + saved mapping presets; validation preview (errors/warnings per row); dry-run diff (create/update/skip); modes (full upsert / only stock & prices); batched commit with live progress; import history; error report download; **rollback** of an import. Plus **manual one-by-one** entry. Exports: products xlsx (round-trip), orders csv, customers csv.
- Categories (tree, SEO texts, thumbnail, 3D part mapping), vehicles (brands / models / generations / engines), stock movements log (every change with reason and actor), low-stock thresholds.
- Customers & mechanics (approve, tier, override, credit flag, notes, block), price tiers.
- Settings: company data (naziv, PIB, MB, adresa, telefoni, Viber, WhatsApp, e-mail, radno vreme), delivery & payment methods and prices, notification recipients/toggles, SEO defaults, tracking IDs (GA4, Google Ads, Meta Pixel), legal texts, feature flags.
- Users & roles (owner, staff), audit log of every admin write, e-mail outbox with template previews and "send test".

### Notifications & automation
- Transactional e-mails (Serbian, branded, plain-text alternative) for every customer-visible event: order received / confirmed / ready / shipped / delivered / cancelled; inquiry received; quote ready (accept link); back in stock; mechanic registration received / approved / rejected; account e-mails if auth needs them.
- Staff: instant e-mail + realtime in-app notification for new order, new inquiry, new mechanic registration, low stock; daily digest at 08:00 Europe/Belgrade; reminders for inquiries and orders left unanswered during working hours.
- Architecture: **domain events outbox → dispatcher → channels** (e-mail, in-app). Provider: **Resend via the Convex component**. Until an API key and a verified domain exist, run in log/test mode and show everything in the admin e-mail outbox.
- Click-to-chat Viber and WhatsApp links (no paid APIs). SMS / Telegram only as documented future options.

### SEO, Google Ads, Meta Ads
- Server-rendered, indexable pages with unique titles/descriptions/H1, canonical rules, breadcrumbs, JSON-LD (AutoPartsStore/LocalBusiness, WebSite + SearchAction, BreadcrumbList, Product + Offer, ItemList, FAQPage), dynamic sitemaps, robots, OG images, programmatic landing pages with a thin-content guard, internal linking, image SEO, Core Web Vitals budgets.
- Consent Mode v2 banner (default denied, granular). GA4 + Google Ads (gtag) events: view_item, view_item_list, search, add_to_cart, begin_checkout, generate_lead (inquiry, mechanic registration), purchase (order submitted, RSD value), phone / Viber / WhatsApp clicks. Enhanced conversions (hashed e-mail/phone) only after consent.
- Meta Pixel + **Conversions API** (server-side from Convex, event_id dedup, hashed PII, fbp/fbc).
- Attribution capture (utm_*, gclid, gbraid, wbraid, fbclid, referrer, landing page; 90-day first-party cookie) stored on orders, inquiries and registrations; visible in admin; offline-conversion CSV export for Google Ads.
- Feeds: Google Merchant Center XML and Meta catalog CSV generated from Convex.
- Ads landing template + `docs/ADS-PLAYBOOK.md` (Serbian): campaign structure, keyword themes (with and without diacritics), negatives, conversion setup, Merchant Center / Meta catalog steps, Google Business Profile checklist.
- All tracking IDs are empty by default → everything is a no-op until the owner fills the settings.

### Records ("evidencija svega")
Audit log of all admin writes · stock movements · order and inquiry histories · import batches with per-row changes · e-mail log · search log · attribution on every lead.

## 6. Business rules (defaults — editable in admin; list them in docs/HUMAN-TODO.md as "potvrditi sa klijentom")
- Money stored as integer **para** (1/100 RSD); displayed rounded to dinars unless decimals exist.
- Order number `SK-YYYY-000123` (prefix from settings). Inquiry number `UP-YYYY-000045`.
- Order statuses: `nova` → `potvrdjena` → (`spremna_za_preuzimanje` | `poslata`) → (`preuzeta` | `isporucena`) → `zavrsena`; `otkazana` from any open state; `ceka_deo` for backorders.
- Inquiry statuses: `nov` → `u_obradi` → `ponuda_poslata` → (`prihvacena` → order | `odbijena` | `istekla`).
- Stock: available quantity; statuses: na stanju / malo na stanju (≤ threshold) / nema na stanju / po porudžbini (lead time in days). Stock decrements when an order is confirmed and returns on cancel (configurable).
- Delivery defaults (placeholders): lično preuzimanje 0 RSD; kurirska služba pouzećem 450 RSD, besplatno iznad 10.000 RSD.
- Mechanic tiers (placeholders): Majstor 10 %, Majstor Plus 15 %, Partner 20 %.
- Consumers: 14-day withdrawal for distance sales and a complaints (reklamacije) process — legal templates flagged for review.
- Demo data: every seeded product / customer / order is flagged `isDemo` and removable with one admin action; demo SKUs start with `DEMO-`.

## 7. Technical constraints
- Existing repo: Next.js **16** App Router (read `node_modules/next/dist/docs/` — APIs differ from training data), React 19.2, TypeScript strict, Tailwind CSS v4, ESLint, **Convex** (the dev deployment is configured in `.env.local`; read `convex/_generated/ai/guidelines.md`).
- 3D: three.js + @react-three/fiber + @react-three/drei (+ postprocessing only if it pays for itself on mobile); GLB with meshopt compression; assets built by scripts in `3d/`.
- Motion: **GSAP** (+ @gsap/react, ScrollTrigger; all GSAP plugins are free) is the only library for UI motion. The **text-reveal** system is mandatory site-wide and must be LCP-safe.
- E-mail: Resend via the Convex component. Auth: whatever the `convex-auth` skill recommends for Next 16, provided it can be set up fully unattended (no third-party dashboards), supports e-mail + password, roles and server-side checks.
- Excel: SheetJS from the official CDN tarball (never the outdated npm `xlsx`), or exceljs if justified; parse in a Web Worker.
- Tests: Vitest (+ convex-test), Playwright e2e, axe, Lighthouse.
- No paid SaaS, no production deploy, no pushing to remotes. Target hosting later: Vercel + Convex cloud (documented in docs/GO-LIVE.md).

## 8. Design north star (step 03 turns this into the design system)
- Concept: **"Rendgen" — an engineering X-ray at night.** Precise, technical, confident, calm. Think premium engineering exhibition / technical drawing — not a tuning shop, not generic e-commerce, not a gaming UI.
- Dark graphite base, warm off-white text, **one** signal accent (e.g. safety orange or electric lime — decided by contrast and character), a cool rim tone reserved for the X-ray glass. Never use VW blue, Škoda green, SEAT copper or Audi red as our brand color.
- Technical details as ornament with purpose: 1 px hairlines, measurement ticks, coordinates, part codes in monospace, callout leader lines.
- Typography: a characterful grotesk or condensed display face + a highly legible UI sans + a monospace for part numbers — all with **latin-ext** (č ć ž š đ); tabular numerals for prices and numbers.
- Imagery: only our Blender renders (hero posters, part thumbnails) and, later, the client's product photos. No stock photos, no AI people.
- No VW/Audi/Škoda/SEAT/Cupra logos anywhere. Brand names as plain text for compatibility, with a nominative-use disclaimer in the footer.
- Admin: same brand, optimized for speed and density; light or dark decided in the design system with reasons.

## 9. Quality bars ("world-class")
- Visual: stands next to award-level automotive sites; zero generic "AI template" tells.
- Performance (mobile, Lighthouse lab): LCP ≤ 2.5 s (target 2.0), CLS ≤ 0.05, TBT ≤ 200 ms; performance ≥ 85 on home and ≥ 90 on catalog/product; 3D chunk lazy; GLB ≤ 8 MB.
- Accessibility: WCAG 2.2 AA; full keyboard use; the 3D has an accessible equivalent; reduced motion respected.
- SEO: Lighthouse SEO ≥ 95; valid JSON-LD; no indexable thin pages.
- Reliability: tsc strict clean, lint clean, unit + Convex + e2e tests green, no console errors.
- Security: every Convex function authorizes; rate limits on public writes; no secrets client-side.

## 10. Non-goals (v1)
Online payment · marketplace for third-party sellers · native apps · multi-language · ERP/accounting integration (the importer must handle their exports) · SMS · live chat widget · production deployment.

## 11. Glossary (Serbian → meaning)
deo/delovi = part/parts · rezervni delovi = spare parts · majstor / auto servis = mechanic / workshop · rabat = trade discount · porudžbina = order · upit = inquiry · ponuda = quote · predračun = pro-forma invoice · otpremnica = delivery note · pouzeće = cash on delivery · lično preuzimanje = in-store pickup · lager / stanje = stock · šifra (artikla) = SKU · kataloški / OEM broj = OEM part number · zamenski broj = cross-reference number · proizvođač = manufacturer · original / OEM kvalitet / aftermarket = genuine / OE-supplier / aftermarket · PIB = tax ID (9 digits) · MB = company registration number (8 digits) · PDV = VAT · turbina = turbocharger · interkuler = intercooler · zupčasti kaiš = timing belt · vodena pumpa = water pump · anlaser = starter motor · svećica = spark plug · bobina = ignition coil · grejač = glow plug · brizgaljka / dizna = injector · karter = oil sump · dihtung = gasket · hladnjak = radiator · kvačilo = clutch · dvomaseni zamajac = dual-mass flywheel · menjač = gearbox · poluosovina = driveshaft · homokinetički zglob = CV joint · amortizer = shock absorber · opruga = coil spring · rame / vilica = control arm · selen blok = bushing · spona = tie rod · stabilizator (štangla) = stabilizer link · letva volana = steering rack · ležaj točka = wheel bearing · glavčina = hub · kočioni disk / pločice / čeljust = brake disc / pads / caliper · akumulator = battery · far = headlight · stop svetlo = tail light · retrovizor = mirror · branik = bumper · hauba = bonnet · blatobran = fender · felna = rim · guma = tyre · auspuh / lonac = exhaust / silencer.
