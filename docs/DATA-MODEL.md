# SKLOP — Data model (Convex)

> Part of the SKLOP docs — index: [README](README.md) · source: [master plan](plans/01-master-plan.md). Business intent: `pipeline/BRIEF.md`.

Related: [ARCHITECTURE §E](ARCHITECTURE.md) (functions, query strategies) · [SECURITY](SECURITY.md) (authz, price visibility) · [IMPORT](IMPORT.md) · [NOTIFICATIONS](NOTIFICATIONS.md). Step 05/06 keep this file in sync with `convex/schema.ts`.

## C. Data model (Convex)

Notation: `str` `num` `int` (v.number(), integer asserted in code) `bool` `id<t>` `opt<…>` (v.optional) `lit(a|b)` (v.union of v.literal) `arr<…>` `obj{…}`. Every table has `_id`, `_creationTime`. **Bounded arrays only** (limits noted); anything unbounded is its own table. Index names include all fields (`by_a_and_b`). Money: `int` para (1/100 RSD), prices **incl. PDV** unless named `…Net…`. Timestamps: ms since epoch (UTC); "day" strings are Europe/Belgrade `YYYY-MM-DD`.

### C0. Shared validators (`convex/lib/validators.ts`)
- `touchV = obj{ source?, medium?, campaign?, term?, content?, gclid?, gbraid?, wbraid?, fbclid?, msclkid?, referrer?, landingPath?, at: num }` (strings ≤ 300 chars)
- `attributionV = obj{ first?: touchV, last?: touchV, fbp?, fbc?, gaClientId?, consentAnalytics: bool, consentAds: bool }`
- `contactV = obj{ firstName, lastName, email, phone }` (e-mail lowercased, phone E.164 `+3816…`)
- `addressV = obj{ street, city, postalCode (5 digits), note? }` · `companyV = obj{ name, pib (9), mb? (8), address?: addressV }`
- `vehicleSnapshotV = obj{ brandId?, modelId?, generationId?, engineId?, year?: int, vin?, label: str }`
- `consentV = obj{ termsVersion, privacyVersion, acceptedAt: num, marketingEmail: bool, analytics: bool, ads: bool }`
- `actorV = obj{ type: lit(customer|mechanic|staff|owner|system), userId?: id<users>, name? }`
- Enums: `qualityV = lit(original|oem|aftermarket)` · `stockStateV = lit(in_stock|low_stock|out_of_stock|on_order)` · `orderStatusV = lit(nova|potvrdjena|ceka_deo|spremna_za_preuzimanje|poslata|preuzeta|isporucena|zavrsena|otkazana)` · `inquiryStatusV = lit(nov|u_obradi|ponuda_poslata|prihvacena|odbijena|istekla)` · `deliveryMethodV = lit(pickup|courier)` · `paymentMethodV = lit(cod|pickup_cash|pickup_card|bank_transfer|deferred)` · `roleV = lit(customer|staff|owner)` · `mechanicStatusV = lit(pending|approved|rejected|suspended)`.

### C1. Identity and access
**Convex Auth tables** (`...authTables`): `authSessions`, `authAccounts`, `authRefreshTokens`, `authVerificationCodes`, `authVerifiers`, `authRateLimits`, plus our customized `users`.

**users** — keeps Convex Auth fields (`name?`, `image?`, `email?`, `emailVerificationTime?`, `phone?`, `phoneVerificationTime?`, `isAnonymous?`) and adds (all optional so Convex Auth inserts validate): `role?: roleV` (missing = customer) · `status?: lit(active|blocked)` · `firstName?` `lastName?` `phoneE164?` · `mechanicStatus?: lit(none|pending|approved|rejected|suspended)` (denormalized from the profile) · `mechanicProfileId?: id<mechanicProfiles>` · `marketingConsent?: bool` · `lastSeenAt?` · `isDemo?` `isTest?`. Indexes: `email` [email] and `phone` [phone] (names required by Convex Auth), `by_role` [role], `by_mechanicStatus` [mechanicStatus], `by_isDemo` [isDemo].

**staffInvites** — `emailLower`, `role: lit(staff|owner)`, `tokenHash`, `expiresAt`, `createdBy: id<users>`, `acceptedAt?`, `acceptedBy?`, `revokedAt?`. Idx `by_tokenHash`, `by_emailLower`.

### C2. Settings and content
**settings** (singleton, `key: lit("global")`, idx `by_key`):
- `company{ legalName, displayName?, pib?, mb?, address{street, city, postalCode}, phones: arr≤5<{label, e164}>, viber?, whatsapp?, email?, bankAccounts: arr≤3<{bank, account}>, mapUrl?, registryNote? }` — empty by default; the UI hides empty parts (HUMAN-TODO).
- `hours: arr7<{ day: 0–6, open: "08:00", close: "16:00", closed: bool }>` · `holidays: arr≤30<{ date, note }>`
- `brand{ name: "SKLOP", tagline, orderPrefix: "SK", inquiryPrefix: "UP" }` · `trustFacts: arr≤6<{ label, value }>` (home „činjenice" band — only real, owner-entered facts; computed ones such as „artikala na stanju" come from queries)
- `commerce{ vatRateBp: 2000, freeShippingOverPara: 1_000_000, lowStockDefault: 3, stockDecrementOn: lit(confirmed|created) = confirmed, restockOnCancel: true, quoteValidityDays: 7, minMarginBp: 800, autoCompleteDays: 15, shipCutoff: "14:00", etaText }`
- `deliveryMethods: arr≤4<{ code: deliveryMethodV, label, description, pricePara, freeOverPara?, active, etaText }>` (defaults: pickup 0; courier 45 000 para, free over 1 000 000 para)
- `paymentMethods: arr≤6<{ code: paymentMethodV, label, instructions, active, requires: lit(none|company|mechanic_credit), deliveryCodes: arr<deliveryMethodV> }>` (cod→courier; pickup_cash/pickup_card→pickup; bank_transfer→both, requires company; deferred→both, requires mechanic_credit)
- `couriers: arr≤6<{ code, name, trackingUrlTemplate }>` (`…?code={broj}`)
- `notifications{ staffEmails: arr≤10<str>, digestEnabled, digestHour: 8, reminderAfterWorkingMinutes: 120, lowStockEmail: bool }`
- `seo{ titleSuffix: " | SKLOP", defaultDescription, ogImageStorageId?, landingMin{ brand: 8, model: 6, generationPage: 10 }, maxIndexableLandings: 300 }`
- `tracking{ ga4Id?, gadsId?, gadsLabels{ purchase?, lead?, mechanicSignup? }, metaPixelId?, metaCapiEnabled: false, metaTestEventCode?, gadsOfflineConversionName? }` — all empty ⇒ everything is a no-op.
- `flags{ publicPrices: true, guestCheckout: true, backInStock: true, mechanicRegistration: true, threeDHero: true, quickOrder: true, generationLandings: false }`
- `legalVersions{ terms, privacy, cookies }` · `updatedAt`, `updatedBy?`

**contentPages** — `slug`, `title`, `bodyMd` (placeholders `{{firma.naziv}}`, `{{firma.pib}}` …), `version: int`, `published`, `needsLegalReview`, `updatedAt`, `updatedBy?`. Idx `by_slug`.
**faqs** — `scope` (`home` | `za-majstore` | `dostava` | `category:<slug>` | `landing`), `question`, `answerMd`, `sortOrder`, `active`. Idx `by_scope_and_sortOrder`.
**counters** — `name` (`order:2026`, `inquiry:2026`), `value: int`. Idx `by_name`.
**redirects** — `fromPath`, `toPath`, `kind: lit(product|category|manual)`, `hits: int`. Idx `by_fromPath`.
**adLandings** — `slug`, `title`, `headline`, `subhead?`, `bodyMd?`, `categoryId?`, `brandId?`, `modelId?`, `generationId?`, `productIds: arr≤24<id<products>>`, `indexable`, `active`, `updatedAt`. Idx `by_slug`.

### C3. Vehicles
**vehicleBrands** — `name` („Škoda"), `slug` (`skoda`), `aliases: arr≤10` (`["skoda","škoda","scoda"]`), `wmi: arr≤20` (`["TMB"]`), `sortOrder`, `active`, `source: lit(seed|admin|import)`. Idx `by_slug`, `by_sortOrder`.
**vehicleModels** — `brandId`, `name`, `slug`, `aliases`, `sortOrder`, `active`, `source`. Idx `by_brandId_and_slug`, `by_brandId_and_sortOrder`.
**vehicleGenerations** — `brandId`, `modelId`, `name` („Golf VII"), `code?` („5G"), `vinModelCodes: arr≤6` (VIN positions 7–8), `slug` (`golf-7`; how people search: `golf-4`, `passat-b6`, `octavia-3`, `a4-b8`, `leon-3`), `aliases` („golf 7", „golf vii", „mk7"), `yearFrom: int`, `yearTo?: int`, `platform?` („MQB"), `sortOrder`, `active`, `source`. Idx `by_modelId_and_slug`, `by_modelId_and_yearFrom`, `by_slug` (generation slugs are globally unique: `cupra-leon`, `cupra-ateca` for Cupra).
**engines** — `name` („2.0 TDI 110 kW"), `slug`, `codes: arr≤8` (`["CRLB","DFGA"]`), `fuel: lit(benzin|dizel|hibrid|elektro|cng|lpg)`, `displacementCc?`, `powerKw`, `powerHp`, `source`. Idx `by_slug` (≤ ~500 rows).
**generationEngines** — `generationId`, `engineId`, `yearFrom?`, `yearTo?`. Idx `by_generationId`, `by_engineId`, `by_generationId_and_engineId`.
Picker = brand → model → generation → engine. A selected vehicle is `{ brandSlug, modelSlug, generationSlug, engineSlug? }`.

### C4. Catalog
**categories** — `slug` (globally unique; shares the `/delovi/[slug]` namespace), `name`, `kind: lit(system|category|subcategory)`, `parentId?`, `systemSlug`, `partKey?` (3D category key = own slug when it has nodes), `relatedSlugs: arr≤6`, `sortOrder`, `active`, `intro?` (SEO intro Markdown 80–180 words), `seoTitle?`, `seoDescription?`, `thumbnailPath?` (`/images/parts/<slug>.webp`), `thumbnailStorageId?`, `googleCategoryId?: int`, `productCount: int`, `inStockCount: int`, `updatedAt`, `source`. Idx `by_slug`, `by_parentId_and_sortOrder`, `by_kind_and_sortOrder`, `by_systemSlug_and_sortOrder`. Products attach to **leaf** categories only; a parent listing (e.g. `filteri`) merges its ≤ 10 children in memory.
**manufacturers** — `name`, `slug`, `aliases`, `isVagGenuine: bool` („Original VAG"), `defaultQuality: qualityV`, `country?`, `description?`, `active`, `productCount`, `source`. Idx `by_slug`, `by_name`.

**products** (listing-critical and compact; heavy fields in `productContent`):
`sku` (unique; demo `DEMO-…`), `slug` (unique, stable), `name` (≤ 160), `categoryId`, `systemSlug`, `manufacturerId`, `manufacturerName`, `quality: qualityV`, `mpn?` (manufacturer part number), `oemPrimary?`, `ean?`, `retailPricePara: int` (no `compareAt` promo price in v1 — D22), `stockQty: int` (available, ≥ 0), `stockState: stockStateV` (derived, stored), `lowStockThreshold?: int`, `leadTimeDays?: int`, `allowBackorder: bool`, `primaryImageId?: id<_storage>`, `imageCount: int`, `universal: bool` (fits all, e.g. oils by spec), `fitmentCount: int`, `fitmentSummary?` („VW Golf VII, Škoda Octavia III i još 6"), `searchText` (≤ 1 500 chars: name + ASCII-folded name + manufacturer + category + codes + vehicle names), `popularity: num`, `active: bool`, `deletedAt?`, `isDemo: bool`, `source: lit(seed|import|manual)`, `importBatchId?`, `lastImportBatchId?`, `updatedAt`, `contentUpdatedAt`.
Idx `by_sku`, `by_slug`, `by_categoryId_and_active_and_popularity`, `by_categoryId_and_active_and_retailPricePara`, `by_categoryId_and_active_and_updatedAt`, `by_manufacturerId_and_active`, `by_active_and_contentUpdatedAt` (sitemaps/feeds), `by_stockState_and_active`, `by_importBatchId`, `by_isDemo`, `by_categoryId_and_universal_and_active` (universal parts appended to vehicle listings).
Search idx `search_products` { searchField `searchText`, filterFields `active`, `categoryId`, `systemSlug`, `manufacturerId`, `quality`, `stockState` }.

**productContent** (1:1, idx `by_productId`) — `productId`, `description?` (Markdown ≤ 5 000), `specs: arr≤40<{ label, value, unit? }>`, `oemNumbers: arr≤50<{ raw, normalized, brand? }>`, `crossNumbers: arr≤100<{ manufacturer, raw, normalized }>`, `images: arr≤12<{ storageId, alt, width, height, sourceUrl? }>`, `notes?` (public „Napomena"), `seoTitle?`, `seoDescription?`, `weightGrams?`, `warrantyMonths?`, `updatedAt`.
**productPrivate** (staff only, idx `by_productId`) — `productId`, `costNetPara?` (purchase price **excl. PDV**), `supplierName?`, `supplierSku?`, `internalNote?`, `updatedAt`.
**productCodes** — `code` (normalized: uppercase, only `[A-Z0-9]`), `kind: lit(oem|cross|mpn|sku|ean)`, `productId`, `raw`, `label?` (manufacturer/brand), `active`, `categoryId` (denormalized). Idx `by_code` (exact match, plus prefix range `gte(code, p)` / `lt(code, p + "\uffff")`), `by_productId`.
**fitments** — `productId`, `brandId`, `modelId`, `generationId`, `engineId?` (absent = all engines of the generation), `yearFrom?`, `yearTo?`, `note?` („prednja osovina", „samo DSG"), denormalized `categoryId`, `active`, `manufacturerId`, `quality`. Idx `by_productId`, `by_generationId_and_categoryId_and_active`, `by_modelId_and_categoryId_and_active`, `by_brandId_and_categoryId_and_active`, `by_engineId`. ≤ 200 fitments per product (larger lists → `universal` or split products).

Catalog invariants (enforced by `convex/lib/productWriter.ts`, the only code that writes products): `productCodes` mirror sku/mpn/ean/oem/cross exactly; fitment and code denormalized fields match the product; `stockState` = qty 0 → (`leadTimeDays` or `allowBackorder` ? `on_order` : `out_of_stock`), qty ≤ threshold (product override or `settings.commerce.lowStockDefault`) → `low_stock`, else `in_stock`; `categories.productCount/inStockCount` and `manufacturers.productCount` adjusted in the same transaction (nightly reconcile cron corrects drift); slug changes insert a `redirects` row; every staff write goes through `audit()`; product changes emit `product.changed`.

### C5. Pricing and B2B
**priceTiers** — `name` („Majstor"), `slug`, `defaultDiscountBp: int` (1000 = 10 %), `categoryRules: arr≤100<{ categoryId, discountBp }>`, `manufacturerRules: arr≤200<{ manufacturerId, discountBp }>`, `minMarginBp?`, `active`, `sortOrder`, `isDefault`, `publicDescription?`. Idx `by_slug`, `by_sortOrder`. Seeds: Majstor 1000, Majstor Plus 1500, Partner 2000 (HUMAN-TODO „potvrditi sa klijentom").
**mechanicProfiles** — `userId`, `status: mechanicStatusV`, `companyName`, `pib`, `mb`, `contactPerson`, `phone`, `email`, `city`, `address`, `serviceTypes: arr≤7<lit(mehanika|elektrika|limarija|vulkanizer|dijagnostika|klima|ostalo)>`, `brandsServiced: arr≤5<id<vehicleBrands>>`, `tierId?`, `personalRules?: obj{ defaultDiscountBp?, categoryRules?: arr≤50, manufacturerRules?: arr≤100 }`, `creditEnabled: bool`, `creditLimitPara?`, `paymentTermsDays: int = 15`, `internalNote?`, `rejectionReason?`, `reviewedAt?`, `reviewedBy?`, `attribution?`, `consent: consentV`, `isDemo`, `updatedAt`. Idx `by_userId`, `by_status`, `by_pib`, `by_isDemo`.
**savedVehicles** — `userId`, `label?`, `brandId?`, `modelId?`, `generationId?`, `engineId?`, `year?`, `vin?`, `plate?`, `note?`. Idx `by_userId`.
**favorites** — `userId`, `productId`. Idx `by_userId_and_productId`.

**Pricing function** (pure, `lib/domain/pricing.ts`, imported by Convex; 100 % branch coverage):
```ts
resolveUnitPrice(input: {
  retailPricePara: number; categoryPath: string[] /* nearest first */; manufacturerId: string;
  costNetPara?: number; vatRateBp: number; globalMinMarginBp: number;
  tier?: TierRules; personal?: PersonalRules; roundingPara?: number /* 100 */ }
): { unitPricePara: number; discountBp: number; rule: "manufacturer" | "category" | "default" | "none";
     source: "personal" | "tier" | "none"; marginGuardApplied: boolean }
```
Precedence (first defined wins): personal.manufacturer → tier.manufacturer → personal.category (walk ancestors, nearest first) → tier.category → personal.default → tier.default → 0. Price = round-half-up(retail × (10000 − bp) / 10000) to whole dinars. **Margin guard** when cost is known: `floor = ceilToDinar(costNet × (1 + minMarginBp/10000) × (1 + vatRateBp/10000))` with `minMarginBp = tier.minMarginBp ?? settings.commerce.minMarginBp`; price = max(price, floor), never above retail; if floor ≥ retail → retail, discountBp 0, `marginGuardApplied: true`. Called only server-side (`convex/lib/pricing.ts` loads tier/profile/cost).

### C6. Carts and orders
**carts** — `ownerType: lit(user|guest)`, `userId?`, `guestTokenHash?`, `status: lit(active|merged|converted|abandoned)`, `updatedAt`, `expiresAt?`, `isDemo?`. Idx `by_userId_and_status`, `by_guestTokenHash`, `by_status_and_updatedAt`, `by_isDemo`. ≤ 1 active cart per user; the guest cart merges on login (quantities summed, capped by stock rules).
**cartItems** — `cartId`, `productId`, `quantity: int` (1–999), `source: lit(catalog|three_d|quick_order|reorder|quote|search)`, `addedAt`. Idx `by_cartId`, `by_cartId_and_productId`. Cart prices are **never stored**; computed per viewer on read.

**orders** — `number` (`SK-2026-000123`), `year`, `seq`, `publicTokenHash`, `status: orderStatusV`, `customerType: lit(guest|customer|mechanic)`, `userId?`, `mechanicProfileId?`, `tierSnapshot?: obj{ tierId, name }`, `contact: contactV`, `company?: companyV`, `delivery: obj{ method, pricePara, address?, courierCode?, trackingNumber?, trackingUrl? }`, `payment: obj{ method, status: lit(unpaid|paid|refunded), paidAt?, dueAt?, reference }` (poziv na broj derived from the number), `totals: obj{ itemsRetailPara, discountPara, itemsPara, deliveryPara, totalPara, vatPara, currency: lit("RSD") }`, `itemCount`, `hasBackorder`, `vehicle?: vehicleSnapshotV`, `customerNote?` (≤ 1 000), `consent: consentV`, `attribution?: attributionV`, `source: lit(web|inquiry|admin|quick_order|reorder)`, `inquiryId?`, `quoteId?`, `cancelReason?`, `cancelledBy?: actorV`, `confirmedAt?` `readyAt?` `shippedAt?` `pickedUpAt?` `deliveredAt?` `completedAt?` `cancelledAt?`, `stockCommitted: bool`, `lastStaffActionAt?`, `reminderLevel: int`, `searchText`, `isDemo`, `isTest?`, `updatedAt`.
Idx `by_number`, `by_publicTokenHash`, `by_status`, `by_userId`, `by_mechanicProfileId`, `by_contact_email` [`contact.email`], `by_inquiryId`, `by_isDemo`, `by_updatedAt`. Search `search_orders` { searchField `searchText`, filterFields `status`, `customerType` }.
**orderItems** — `orderId`, `productId?`, `sku`, `name`, `manufacturerName`, `quality`, `oem?`, `quantity`, `unitRetailPara`, `unitPricePara`, `discountBp`, `lineTotalPara`, `availabilityAtOrder: stockStateV`, `leadTimeDays?`, `isCustomLine`, `note?`, `committedQty?` (units actually taken from stock when the order committed — stock is clamped at 0 — and returned exactly on cancel). Idx `by_orderId`, `by_productId`.
**orderEvents** — `orderId`, `type: lit(created|status_changed|edited|note|tracking_set|payment_marked|email_sent|email_failed|reminder)`, `fromStatus?`, `toStatus?`, `message?`, `visibleToCustomer: bool`, `actor: actorV`, `at`. Idx `by_orderId_and_at`.

Totals invariants: `itemsPara = Σ lineTotalPara`; `discountPara = itemsRetailPara − itemsPara`; `deliveryPara` from settings (free-over rule applied to `itemsPara`); `totalPara = itemsPara + deliveryPara`; `vatPara = round(totalPara × vatRateBp / (10000 + vatRateBp))`. Numbering: `counters` row `order:<Belgrade year>` incremented in the creating transaction (gapless per year, 6 digits).

**Order state machine** (`lib/domain/orderStateMachine.ts`, pure, exhaustive tests):
```
            ┌──────────────► otkazana ◄──────────────────────────────┐ (reason required; from every open state)
nova ──potvrdi──► potvrdjena ──pripremi (pickup)──► spremna_za_preuzimanje ──preuzeto──► preuzeta ──┐
  │                 │  ▲    └──pošalji (courier + tracking)──► poslata ──isporučeno──► isporucena ────┤
  └──čeka deo──► ceka_deo ◄─┘  (potvrdjena ⇄ ceka_deo)                                                ▼
                                          auto after settings.commerce.autoCompleteDays, or manual ──► zavrsena
```
Allowed: `nova→{potvrdjena, ceka_deo, otkazana}` · `ceka_deo→{potvrdjena, otkazana}` · `potvrdjena→{spremna_za_preuzimanje (pickup only), poslata (courier only; tracking prompted), ceka_deo, otkazana}` · `spremna_za_preuzimanje→{preuzeta, otkazana}` · `poslata→{isporucena, otkazana („Vraćena pošiljka")}` · `preuzeta→{zavrsena}` · `isporucena→{zavrsena}`; `zavrsena`, `otkazana` terminal. Stock decrements on the first entry into `potvrdjena` (per `stockDecrementOn`) and returns on `otkazana` when `stockCommitted && restockOnCancel`. Items editable only in `nova`. Every transition = guard → patch → `orderEvents` → `domainEvents(order.status_changed)` → audit (staff), in one transaction with an `expectedUpdatedAt` precondition.

### C7. Inquiries and quotes
**inquiries** — `number` (`UP-2026-000045`), `year`, `seq`, `publicTokenHash`, `status: inquiryStatusV`, `kind: lit(vin|part|not_found|product_question|quick_order_missing)`, `vin?`, `vinInfo?: obj{ wmi, brandGuess?, modelYearHint?, modelCode? }`, `vehicle?: vehicleSnapshotV`, `message` (≤ 2 000), `categorySlugs: arr≤5`, `productId?`, `searchQuery?`, `requestedCodes: arr≤50`, `photos: arr≤5<id<_storage>>`, `contact: obj{ name, email?, phone?, preferredChannel: lit(phone|viber|whatsapp|email) }` (e-mail or phone required), `userId?`, `mechanicProfileId?`, `assignedTo?`, `attribution?`, `consent`, `orderId?`, `currentQuoteId?`, `firstResponseAt?`, `closedReason?`, `lastStaffActionAt?`, `reminderLevel`, `searchText`, `isDemo`, `isTest?`, `updatedAt`. Idx `by_number`, `by_publicTokenHash`, `by_status`, `by_userId`, `by_vin`, `by_assignedTo_and_status`, `by_isDemo`. Search `search_inquiries` { filterFields `status`, `kind` }.
**inquiryEvents** — `inquiryId`, `type: lit(created|status_changed|assigned|quote_sent|quote_accepted|quote_declined|renewal_requested|note|email_sent)`, `fromStatus?: inquiryStatusV`, `toStatus?: inquiryStatusV`, `message?`, `visibleToCustomer: bool`, `actor: actorV`, `at`. Idx `by_inquiryId_and_at`.
**quotes** — `inquiryId`, `version: int`, `status: lit(draft|sent|accepted|declined|expired|superseded)`, `validUntil` (end of day Belgrade), `lines: arr≤30<{ productId?, sku?, name, manufacturer?, quality?, quantity, unitPricePara, availability: lit(in_stock|on_order), leadTimeDays?, note? }>`, `deliveryNote?`, `totalPara`, `sentAt?`, `sentBy?`, `acceptedAt?`, `declinedAt?`, `declineReason?`, `orderId?`, `isDemo?`. Idx `by_inquiryId_and_version`, `by_status_and_validUntil` (expiry job). Drafts have `validUntil: 0` and are never shown to the customer.

**Inquiry / quote state machine**:
```
nov ──staff opens/assigns──► u_obradi ──send quote v1──► ponuda_poslata ──accept (now ≤ validUntil)──► prihvacena ──► order (source inquiry)
 │                              ▲  │                         ├── customer declines ──► odbijena
 └── staff closes (reason) ─────┼──┴──► odbijena             ├── cron: validUntil passed ──► istekla ──„Zatraži obnovljenu ponudu"──► u_obradi
                                └──── staff revises: new version (old → superseded), stays ponuda_poslata
```
Accepting creates the order in the same transaction (quote lines → order items at quoted prices; delivery/payment from the accept form), sets `orderId`, emits `quote.accepted` + `order.created`.

**Mechanic profile states**: `pending → approved | rejected`; `approved ⇄ suspended`; `rejected → pending` (staff reopen). Each change emits `mechanic.*` and updates `users.mechanicStatus`.

### C8. Stock, subscriptions, search
**stockMovements** — `productId`, `delta`, `qtyBefore`, `qtyAfter`, `reason: lit(manual|order_confirmed|order_created|order_cancelled|order_edited|import|import_rollback|correction|receipt|return)` (`order_created` when `stockDecrementOn = created`), `refType?: lit(order|import|manual)`, `refId?`, `actor`, `note?`, `importBatchId?`, `at`. Idx `by_productId_and_at`, `by_at`, `by_importBatchId`.
**priceChanges** — `productId`, `oldRetailPara`, `newRetailPara`, `oldCostNetPara?`, `newCostNetPara?` (staff-only projection), `reason: lit(manual|import|import_rollback|bulk)`, `actor`, `importBatchId?`, `at`. Idx `by_productId_and_at`, `by_at`. Written by `productWriter` on every price change (records + 30-day-lowest-price rule, D22).
**backInStockSubscriptions** — `productId`, `email`, `userId?`, `status: lit(active|notified|cancelled)`, `unsubscribeTokenHash`, `consentAt`, `notifiedAt?`, `isDemo?`. Idx `by_productId_and_status`, `by_email`, `by_unsubscribeTokenHash`, `by_isDemo`.
**searchLogs** (raw, 180-day retention) — `query` (≤ 200), `normalized`, `kind: lit(code|text|mixed)`, `resultsCount`, `exactCodeHit`, `userType: lit(anon|customer|mechanic|staff)`, `generationId?`, `source: lit(header|search_page|quick_order|three_d|landing)`, `sessionHash?`, `at`. Idx `by_at`, `by_normalized_and_at`.
**searchDaily** — `day`, `normalized`, `sample`, `count`, `zeroCount`, `lastAt`. Idx `by_day_and_normalized`, `by_normalized_and_day`. Feeds „Traženo, a nemamo".

### C9. Events, notifications, e-mail
**domainEvents** (outbox) — `type` (§I), `aggregateType: lit(order|inquiry|quote|mechanic|product|category|settings|content|stock|import|user|system)`, `aggregateId`, `payload` (typed `v.union` of per-aggregate shapes discriminated by `kind`: `order` {orderId, number, totalPara?, customerType?, from?, to?, reason?} · `inquiry` {inquiryId, number, quoteId?, version?, orderId?, from?, to?, reason?} · `mechanic` {profileId, userId, companyName, tierName?, reason?} · `stock` {productId, sku, name, qty, threshold?} · `catalog` {productId?, categoryId?, slug?, section?, fields?} · `user` {userId}), `status: lit(pending|processing|done|failed|dead)`, `attempts`, `nextAttemptAt`, `lastError?`, `dedupeKey` (unique, e.g. `order.status_changed:<orderId>:potvrdjena:<n>`), `actor?`, `capiContext?: obj{ ip, userAgent, eventSourceUrl }` (deleted right after the CAPI send), `processedAt?`. Idx `by_status_and_nextAttemptAt`, `by_dedupeKey`, `by_aggregateType_and_aggregateId`.
**notifications** (in-app) — `userId`, `kind`, `title`, `body`, `href`, `eventId?`, `read: bool`, `readAt?`, `isDemo?` (set by the dispatcher when the event's aggregate is demo data). Idx `by_userId_and_read`, `by_userId`, `by_isDemo`.
**notificationDeliveries** (idempotency ledger) — `eventId`, `channel: lit(email|inapp|meta_capi|revalidate)`, `recipient`, `templateKey?`, `status: lit(pending|sent|failed|skipped)`, `attempts`, `lastError?`, `providerRef?`, `sentAt?`. Idx `by_eventId_and_channel_and_recipient`, `by_status`.
**staffPreferences** — `userId`, `email: obj{ orderNew, inquiryNew, mechanicNew, lowStock, reminders, digest }`, `inApp: obj{ … }`, `updatedAt`. Idx `by_userId`.
**emailLog** — `to: arr≤10`, `subject`, `templateKey`, `html?` (pruned after 90 days), `text`, `preheader?`, `mode: lit(log|test|live)`, `status: lit(logged|queued|sent|delivered|delivery_delayed|bounced|complained|failed|opened|clicked)`, `resendEmailId?`, `error?`, `eventId?`, `relatedType?: lit(order|inquiry|mechanic|user|product|digest|test|auth)`, `relatedId?`, `updatedAt`. Idx `by_status`, `by_relatedType_and_relatedId`, `by_resendEmailId`.

### C10. Import
**importBatches** — `fileName`, `fileSize`, `fileSha256?`, `sourceFileId?: id<_storage>`, `format: lit(xlsx|xls|csv)`, `encoding?: lit(utf-8|windows-1250)`, `delimiter?`, `sheetName?`, `headerRow: int`, `numberFormat: lit(sr|en)`, `mode: lit(full|stock_price)`, `deactivateMissing: bool`, `mapping: arr≤80<{ column, header, field }>`, `presetId?`, `status: lit(staging|validated|committing|committed|failed|rolling_back|rolled_back|cancelled)`, `counts: obj{ total, create, update, unchanged, skip, error, warning, committed, failed, deactivated }`, `progress: obj{ stagedRows, committedRows, rolledBackRows }`, `createdBy`, `validatedAt?`, `committedAt?`, `rolledBackAt?`, `rolledBackBy?`, `cursor?`, `note?`. Idx `by_status`, `by_createdBy`.
**importRows** — `batchId`, `rowNumber`, `sku?`, `data` (object of optional normalized fields), `action: lit(create|update|unchanged|skip|error)`, `errors: arr≤20<{ code, field?, message }>`, `warnings: arr≤20`, `productId?`, `matchKey?: lit(sku|oem_manufacturer)`, `changedFields: arr≤40`, `committed: bool`. Idx `by_batchId_and_rowNumber`, `by_batchId_and_action`, `by_batchId_and_sku`.
**importChanges** — `batchId`, `productId`, `action: lit(create|update|deactivate)`, `before?` (changed fields only, incl. stockQty, prices, active, codes/fitment snapshots), `after`, `rowNumber?`, `productUpdatedAtAfter`, `rolledBack: bool`, `rollbackSkippedReason?`. Idx `by_batchId`, `by_productId`.
**importMappingPresets** — `name`, `mapping: arr≤80<{ headerNormalized, field }>`, `createdBy`, `isDefault`, `updatedAt`. Idx `by_name`.
**imageFetchJobs** — `batchId?`, `productId`, `url`, `status: lit(pending|done|failed|skipped)`, `attempts`, `error?`, `storageId?`. Idx `by_status`, `by_batchId`.

### C11. Records, files, analytics
**auditLog** — `actor: actorV`, `action` (`product.update`, `order.transition`, `settings.update` …), `entityType`, `entityId`, `summary` (Serbian), `diff?: arr≤50<{ field, before?, after? }>` (stringified ≤ 500 chars each), `at`. Idx `by_entityType_and_entityId_and_at`, `by_actor_userId_and_at`, `by_at`, `by_action_and_at`.
**uploads** — `storageId`, `purpose: lit(inquiry_photo|product_image|import_file|category_image|content_image)`, `uploaderKey`, `status: lit(pending|attached|rejected)`, `contentType?`, `size?`, `attachedTo?: obj{ type, id }`, `checkedAt?`, `rejectReason?`. Idx `by_storageId`, `by_status`. The row is written when a file is **attached** (the storage id is unknown when the upload URL is issued); a storage id with an existing row cannot be attached again; `files.sniff` (magic bytes) runs right after and rejects/deletes/detaches a mismatch.
**consentRecords** — `consentId` (uuid from the consent cookie), `choices: obj{ analytics, ads }`, `policyVersion`, `at`, `uaHash?`, `userId?`. Idx `by_consentId`.
**landingStats** — `categoryId`, `brandId`, `modelId?`, `productCount`, `inStockCount`, `minPricePara`, `maxPricePara`, `manufacturerCount`, `generationIds: arr≤30`, `indexable`, `reason?`, `dirty: bool`, `updatedAt`. Idx `by_categoryId_and_brandId_and_modelId`, `by_indexable`, `by_dirty`.
**statsDaily** — `day`, `ordersCount`, `ordersValuePara`, `cancelledCount`, `inquiriesCount`, `registrationsCount`, `zeroSearches`, `byCategory: record<categoryId, obj{ count, valuePara }>` (≤ 60 keys). Idx `by_day`. Updated in the same transaction as the source write.
**cronRuns** — `job`, `localKey` (`digest:2026-09-29`), `ranAt`. Idx `by_job_and_localKey`. Guarantees once-per-local-slot jobs.

Demo invariant: `isDemo` is set on every seeded product, user, mechanic profile, order, inquiry, cart and subscription and propagates to their child rows; reference data (brands, models, generations, engines, categories, manufacturers, tiers) is `source: "seed"` and is **not** removed by „Obriši demo podatke".


### C12. Implementation notes (step 05, `convex/schema.ts` is the source of truth)
- **State machines** live in `lib/domain/orderStateMachine.ts` and `lib/domain/inquiryStateMachine.ts` (also the mechanic-profile machine). Refinement: staff may send a quote straight from `nov` (`nov → ponuda_poslata`) and re-quote an expired inquiry (`istekla → ponuda_poslata | odbijena`); the diagram above stays the normal path.
- **Pricing** (`lib/domain/pricing.ts`): a matched rule of 0 bp (or no rule) returns the retail price unchanged, para included; `discountBp` in the result is the *effective* discount after the margin guard (e.g. 928 bp when the floor lifts a 25 % rule). A defined 0 bp personal rule wins (explicit „no discount“).
- **Order submit** re-reads the cart, re-prices every line for the viewer, checks stock (`canOrderQuantity`), optionally compares `expectedTotalPara` (→ `PRICE_CHANGED`), validates contact/company/address/payment rules server-side, then creates order + items + `orderEvents(created)` + `domainEvents(order.created)` + `statsDaily` in one transaction. Stock commits on the first entry into `potvrdjena` (per `stockDecrementOn`) and records `orderItems.committedQty`.
- **Errors**: every expected failure is `ConvexError({ code, message })` with a Serbian message (`convex/lib/errors.ts`): `UNAUTHENTICATED`, `FORBIDDEN`, `BLOCKED`, `NOT_FOUND`, `INVALID` (+ `field`), `RATE_LIMITED` (+ `retryAfterMs`), `CONFLICT`, `OUT_OF_STOCK` (+ `available`), `PRICE_CHANGED` (+ `totalPara`), `EMPTY_CART`, `SPAM`, `DISABLED`, `EXPIRED`, `DUPLICATE`.
- **Rate limits** (`convex/lib/rateLimits.ts`) add `backInStockEmail` (20/day per e-mail) as a separate name next to `backInStock`.
- **importRows.data** is `record<string, string | number | boolean | null>`; **importChanges.before/after** are `record<string, any>` snapshots (step 16 narrows them).
- **Settings**: courier tracking URL templates are empty until the owner confirms them (HUMAN-TODO §2).
- **Seed** (`convex/seed.ts`, `convex/seedData/*`): 5 brands, 21 models, 56 generations, 25 engines (345 generation–engine links), 58 categories (10 systems + 44 + 4), 30 manufacturers, 3 tiers, 150 demo products (619 codes, ~2 260 fitments) + 7 demo equivalents `DEMO-E001…E007` (step 14: the same part from another maker under the source's OEM number, `seed:seedAlternatives`), 1 approved demo mechanic, 8 demo orders across statuses, 4 demo inquiries (one quote sent).
