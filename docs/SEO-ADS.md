# SKLOP — SEO, Google Ads, Meta Ads, analytics

> Part of the SKLOP docs — index: [README](README.md) · source: [master plan](plans/01-master-plan.md). Business intent: `pipeline/BRIEF.md`.

Related: [ROUTES](ROUTES.md) (index/canonical per route) · [DATA-MODEL](DATA-MODEL.md) (attribution, landingStats) · [SECURITY §L3/§L5](SECURITY.md) (CSP, privacy).

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
