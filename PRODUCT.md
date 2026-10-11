# Product

<!-- impeccable:product-schema 1 -->

> Source: the owner-authored brief `pipeline/BRIEF.md` (business intent) and `docs/` (implementation). Written in step 03 of the unattended build pipeline: no live interview was possible, so every fact below is taken from the written brief, not inferred from taste. Visual decisions live in `docs/design/DESIGN-SYSTEM.md`, not here.

## Platform

web

## Users
- **Majstor (mechanic, B2B, repeat buyer)** — usually on a phone in the workshop, hands dirty, customer car on the lift. Job: find the exact part fast by OEM/catalog number, by vehicle (brand → model → generation → engine) or visually; see stock and his own price (rabat); order in seconds, reorder, paste a list of OEM numbers. Likes phone and Viber.
- **Retail driver (B2C)** — arrives from Google/Meta ads or search with one question: „Imate li X za moj auto, koliko košta, kada mogu da ga dobijem?“ Needs a clear price, stock, delivery or pickup, trust, and an easy way to ask (VIN inquiry, call, Viber, WhatsApp).
- **Staff (owner + 1–3 employees)** — manage catalog, stock, prices, orders, inquiries and mechanics; import Excel exports from the accounting program; see what people searched for and did not find; get notified instantly. Long daylight sessions at a counter PC, often printing predračun / otpremnica.

## Product Purpose
Online shop, B2B portal and back office for a Serbian dealer of Volkswagen Group parts (VW, Audi, Škoda, SEAT, Cupra). It replaces phone/Viber/spreadsheet work with a catalog that stays current through Excel import, orders and inquiries in one place, automatic e-mails and a record of everything. Success: paid-ad visitors convert to orders or inquiries, mechanics reorder without calling, staff answer faster and keep stock correct.

## Positioning
A visual catalog navigator no other Serbian parts shop has: a 3D car in „X-ray“ style that explodes into its systems on scroll; every part is clickable and opens the in-stock parts of that category for the visitor's selected vehicle, with role-aware price. Underneath it: OEM-number-aware search that normalizes messy numbers, and mechanic pricing computed server-side.

## Operating Context
- No online payment: order (porudžbina) then pay on delivery (pouzeće), at pickup, or by bank transfer against a predračun. Deferred payment only for approved mechanics with credit.
- Serbia, RSD, prices include PDV 20 %; formats `12.990 RSD`, `29.09.2026.`, `+381 64 123 4567`.
- Mechanics use phones in bright workshops; staff use desktop PCs through the working day and print documents.
- Paid traffic from Google Ads and Meta Ads lands on category, product and landing pages.

## Capabilities and Constraints
- Storefront: home with 3D hero, OEM search, vehicle picker; catalog with vehicle/manufacturer/quality/availability/price filters; product page; cart and 4-step checkout (no payment); VIN / part inquiry with photos and quotes; back-in-stock alerts; account.
- Mechanics: registration + approval, tier rabat, quick order by pasted OEM lines, reorder, favorites, saved customer vehicles, XLSX price list.
- Admin: dashboard, orders, inquiries + quotes, products, Excel import with dry-run and rollback, categories, vehicles, stock log, customers/mechanics, tiers, settings, users, audit log, e-mail outbox.
- Stack (existing codebase): Next.js 16 App Router, React 19.2, Tailwind v4, Convex, three.js / R3F, GSAP (the only motion library), SheetJS.
- Serbian Latin (ekavian) only in v1, copy centralized for a later locale.
- Brand (step 25): Euromotors Plus, known shop name OEM Parts. Still open: company data, contact data, legal texts — all read from config/settings and hidden while empty.

## Brand Commitments
- Brand **Euromotors Plus** with the endorsement „by OEM Parts“ in the logo (naming rules: `lib/domain/brand.ts`), tagline **„Rasklopi auto. Nađi deo.“**. The working name „SKLOP“ is retired.
- Voice: an experienced mechanic talking to a colleague — calm, precise, short sentences, zero fluff; „vi“ forms; no exclamation-mark marketing; no emojis in the UI.
- Binding visual north star from the brief (§8): „Rendgen“ — an engineering X-ray at night; dark graphite base, warm off-white text, exactly one signal accent, a cool rim tone reserved for the X-ray glass; technical ornament with purpose (hairlines, ticks, coordinates, mono part codes, leader lines); a characterful grotesk/condensed display + legible UI sans + monospace, all with latin-ext. Not a tuning shop, not generic e-commerce, not gaming UI.
- Never use VW blue, Škoda green, SEAT copper or Audi red as a brand color. No VW/Audi/Škoda/SEAT/Cupra logos; brand names only as plain text with a nominative-use disclaimer.

## Evidence on Hand
- No real product photos yet (client provides later). Imagery = Blender renders built by the pipeline (hero posters, 44 category thumbnails).
- No testimonials, reviews, customer counts, years-in-business or awards exist — none may be invented. Trust facts are read from settings and hidden while empty.
- Demo catalog data is flagged `isDemo` / `DEMO-` and removable.

## Product Principles
1. The part number is the product: every surface makes the exact part identifiable (OEM / cross numbers, fitment) before it asks for anything.
2. Answer the three questions first: fits my car? in stock? how much? — price, stock and fitment are never below the fold of a decision.
3. Always a next step: zero results, out of stock or unknown vehicle end in an inquiry, call or Viber, never in a dead end.
4. Speed for the repeat buyer: the mechanic's path (search → quantity → cart → reorder) takes seconds on a phone.
5. Honest by construction: no fake scarcity, no invented facts, prices never leak across roles.

## Accessibility & Inclusion
WCAG 2.2 AA; full keyboard use; the 3D car has an equivalent accessible parts list; `prefers-reduced-motion` respected; responsive 360–2560 px; primary touch targets ≥ 44 px (workshop phones, gloves).
