# Euromotors Plus · OEM Parts — Security, privacy and backend audit (step 20)

> Part of the Euromotors Plus docs — index: [README](README.md). Rules: [SECURITY](SECURITY.md). Owner-facing companions (sr): [GO-LIVE-ENV](GO-LIVE-ENV.md), [PRIVACY-PROCESS](PRIVACY-PROCESS.md), [BACKUPS](BACKUPS.md). Decisions D201–D214 in [DECISIONS](DECISIONS.md).

Date: 2026-09-30 · Target: dev deployment `tame-impala-374` and a production build of the Next app on `localhost:3100`. Production was never touched.

## 1. Scope and method

| Pass | Tool / skill | Ran | Result |
|---|---|---|---|
| Authorization scan (identity from args, missing ownership, PII by client id, parent-ref writes) | convex-authz + manual review of every `public*` / `user*` function | ✓ | No raw `query`/`mutation`/`action` export; every public function goes through `publicQuery/…/ownerMutation` (`convex/lib/functions.ts`); identity only from `getAuthUserId`. Two review agents covered the 140 staff/owner functions and the Next server surface. |
| Code review (validators, indexes, scheduling, `.collect()`) | convex-reviewer | ✓ | No `.collect()`, no scheduling to `api.*`, `v.any()` only in `importChanges` schema; post-index `.filter()` only in paginated staff lists (D137). |
| Live insights (72 h OCC / read limits) | convex-advisor (`npx convex insights`, dev) | ✓ | „No issues found. The deployment is healthy over the last 72 hours.“ Prod: not assessed (no prod deployment). |
| Launch readiness score | convex-launch-readiness | ✓ | §5 |
| Upgrades / observability | convex-optimize | ✓ | `@convex-dev/*` current; `npm outdated` only patch/minor (next 16.3.7, react 19.3.0) — left for step 22/23. Prod error capture: none yet (HUMAN-TODO §7). |
| Backups + restore drill | convex-backup | ✓ (offline) | §6, [BACKUPS](BACKUPS.md) |
| Tests | convex-test | ✓ | `convex/security.test.ts` (13), unit + e2e below |
| HTTP headers / CSP, secrets in bundles, `npm audit` | manual | ✓ | §3, §4 |

Severity: **P0** exploitable now with serious impact · **P1** serious (exploitable with a precondition, or a missing pre-launch control) · **P2** real weakness / hardening with a concrete scenario · **P3** defence in depth / hygiene.

## 2. Findings (all fixed unless listed in §2.4)

### 2.1 P1

| ID | Finding | Scenario | Fix | Evidence |
|---|---|---|---|---|
| S01 | **Owner seed promoted an existing account without checking its password** (`convex/seed.ts` `createOwner`). Password sign-up has no e-mail verification. | On a fresh deployment the storefront is live before `seed:createOwner` runs; an attacker registers the owner's (public) address; the seed sees the account and makes the attacker owner. | An existing account is promoted only when `retrieveAccount` accepts `SEED_ADMIN_PASSWORD` (or it already is owner); otherwise the action returns `password_mismatch`. | `security.test.ts › owner seed (P1)` |
| S02 | **Open redirect after sign-in / sign-up**: `next` was accepted when it started with `/` and not `//`. `/\evil.com`, `/\t/evil.com` pass and browsers resolve them off-site. | Phishing link `/prijava?next=/%5Cevil.com` → the victim signs in on the real site and lands on a fake page. | `lib/domain/redirect.ts` `safeNextPath`: rejects `\` and control characters and re-resolves against a fixed origin; also used for relative links in owner-written markdown. | `tests/unit/domain/redirect.test.ts` (14); e2e `security.spec.ts › admin under the policy` (signs in with `next=/\evil.example/steal`, lands on `/prijava`) |
| S03 | **No security headers at all** — no CSP, no `frame-ancestors`/`X-Frame-Options`, no HSTS, `Referrer-Policy`, `Permissions-Policy`, `nosniff`. | Admin screens could be framed (clickjacking of staff actions); no XSS backstop while the guest cart token sits in `localStorage`. | `lib/security/headers.ts`: static headers for every response in `next.config.ts` (nosniff, DENY, strict-origin-when-cross-origin, Permissions-Policy, COOP, HSTS in production builds); per-request **nonce CSP** in `proxy.ts` (§3). | `tests/unit/lib/securityHeaders.test.ts` (7); e2e `security.spec.ts` (6 on the production build) |
| S04 | **Status-link secret failed open**: without `LINK_TOKEN_SECRET` the HMAC key was a constant in the source. | Production deployed without the variable → anyone who knows the constant computes `/porudzbina/<token>` for any order number (sequential) and reads name, phone, address. | `linkTokenSecret()` throws when the site URL is not local; the rate-limit salt now derives from the link secret when `IP_HASH_SALT` is missing. | `security.test.ts › status-link secret` |
| S05 | **Password-reset e-mails were not rate-limited** — the `passwordReset` limit existed but was never applied. | Script requests reset codes for a victim address in a loop: inbox flooding, Resend quota burned, domain reputation damaged. | `authEmails.sendPasswordResetCode`: 3 per address per hour, 60 per hour overall; over the limit the code is silently not sent (no enumeration signal). | `security.test.ts › password-reset codes: at most 3 …` |

### 2.2 P2

| ID | Finding | Fix | Evidence |
|---|---|---|---|
| S06 | Staff could register a mechanic profile on their own account and approve it / set up to 90 % personal discount and unlimited credit (bypassing owner-only tiers); the audit recorded field names only. | `mechanicsAdmin.approve/update/reactivate` refuse the caller's own profile unless the caller is the owner; audit diffs now carry before/after values (update and every status transition). | `security.test.ts › staff cannot approve or change their own mechanic profile …` |
| S07 | SSRF in the import image fetcher (staff-triggered): IPv4-mapped IPv6 (`[::ffff:127.0.0.1]`), trailing-dot names (`localhost.`), redirects followed without re-checking, unbounded chunked bodies, distinct error texts usable as a port scanner; `fc`/`fd` prefix blocked real domains. | `lib/import/remoteUrl.ts` (IPv6 allow-list = global unicast minus 6to4, trailing dots, `.home.arpa`, multicast/benchmark ranges, no credentials); manual redirects (≤ 3 hops, each re-checked — verified on the dev runtime that `redirect: "manual"` exposes `Location`); byte-capped stream reader; one generic network error. | `tests/unit/import/remoteUrl.test.ts` (32); `imports.test.ts › image URLs …` now includes a 302 → `169.254.169.254` case |
| S08 | CSV formula injection: customer names, companies, UTM values and click ids reached staff CSV exports verbatim. | `neutralizeCsvFormula` in `toCsv` (apostrophe before `= + - @ \t \r` unless the cell is a plain number); offline-conversion rows whose gclid is outside `[A-Za-z0-9_-]` are dropped. | `adminFormat.test.ts`, `sitemapFeeds.test.ts` |
| S09 | Capability tokens (order/inquiry status, thank-you pages) reached Google Analytics / Meta in page URLs and could leak via `Referer`. | Token pages: `Referrer-Policy: no-referrer` (header + meta); GA4 `config` carries a redacted `page_location` (`/porudzbina/[token]`); token pages are entered only by full page loads (checkout, inquiry, quote acceptance, thank-you links) so enhanced-measurement history hits never see them; the Meta Pixel (URL cannot be overridden) sends nothing on token pages, its own history tracking is off, autoConfig off. | `tests/unit/analytics/redact.test.ts`; e2e `security.spec.ts › analytics after consent …` (dataLayer has `[token]`, no request or dataLayer entry contains the token, no Pixel `track`) |
| S10 | Real sign-ups never received `role`, so they were missing from Admin → Kupci and the customer CSV (both read `by_role = customer`) — also a blind spot for privacy requests. | `afterUserCreatedOrUpdated` sets `role: "customer"` for new accounts; `maintenance:backfillCustomerRole` (run on dev: 25 accounts). | `security.test.ts › accounts without a role are backfilled …` |
| S11 | Meta CAPI context (IP, user agent) stayed on `domainEvents` up to 90 days; SECURITY §L5 says deleted after sending, ≤ 7 days. | Cleared in `capi.finish` once the send is final; nightly sweep clears anything older than 7 days (watermark). | `security.test.ts › CAPI context is cleared …`, `› nightly …` |
| S12 | Click ids / `fbp` / `fbc` / GA client id were kept forever (policy: 180 days). | Nightly pass masks click ids as `pruned` (channel classification unchanged, offline export skips them) and drops browser ids on orders, inquiries and mechanic profiles older than 180 days. | `security.test.ts › nightly …` |
| S13 | Unlimited guest-cart creation: every new random token created a cart row (the limiter was per cart). | `cartCreate` limit per client key (100/h) before a guest cart is created. | `security.test.ts › new guest carts are rate-limited …` |
| S14 | Guest-cart pruning could starve (100 stale *user* carts filled the batch forever) and merged/converted guest shells were never pruned. | Index `carts.by_ownerType_and_status_and_updatedAt`; all guest states pruned after 30 days. | `security.test.ts › nightly …` |
| S15 | No limit on account creation. | Global `signUpGlobal` limit in `afterUserCreatedOrUpdated` (burst 30, 60/h; sign-ups arrive through the Next `/api/auth` proxy, so there is no per-visitor IP). | code review (Convex Auth sign-up is not callable from convex-test) |
| S16 | No tooling for ZZPL access / erasure requests (planned in SECURITY §L5). | `convex/privacy.ts` (owner only): `customerData` (JSON export by account or e-mail), `anonymize` (orders kept without personal data, the rest deleted, login removed; bounded idempotent passes); `/admin/privatnost` + link from the customer page; process in [PRIVACY-PROCESS](PRIVACY-PROCESS.md). New indexes `inquiries.by_contact_email`, `consentRecords.by_userId`. | `security.test.ts › privacy tools` (3); e2e export download; screenshots `docs/qa/screens/step-20/` |

### 2.3 P3 (fixed)

| ID | Finding | Fix |
|---|---|---|
| S17 | Admin print pages (`/admin/porudzbine/[broj]/otpremnica|predracun`, `/admin/stampa/otpremnice`) and five account pages relied on the layout guard only (SECURITY §D3 asks for a page-level check). Nothing leaked (Convex re-checks). | `requireStaffPage` / `requireAccountPage` at the top of each page. |
| S18 | `/api/revalidate` compared the secret with `!==`. | SHA-256 + `timingSafeEqual`. |
| S19 | The OG image renderer fetched any http(s) URL (staff-controlled `thumbnailPath`) server-side. | Remote inputs only from this deployment's Convex storage, `redirect: "error"`, 10 MB cap. |
| S20 | Import commit (incl. „deactivate missing“), cancel and rollback were audited only when the background job finished. | Audit entries at request time (`import.commit_requested`, `import.cancel`, `import.rollback_requested`). |
| S21 | The admin outbox showed customers' status / unsubscribe links, letting staff act as the customer (audited under the customer's name); resend was unlimited. | Links masked in `emailsAdmin.get`; resend limited to 30/h per staff member. |
| S22 | `convex/testing.ts` writers and the status-token reader had no environment gate (internal, but a CLI call against the wrong deployment would create test orders / read tokens). | `E2E_TEST_HELPERS=1` required (set on dev; never on prod). |
| S23 | Rate-limit IP hashes used a public constant salt when `IP_HASH_SALT` was missing. | Falls back to a salt derived from `LINK_TOKEN_SECRET`. |

### 2.4 Accepted / open (documented, not fixed)

| ID | Sev | Item | Why accepted / next step |
|---|---|---|---|
| R01 | P2 | Password sign-up has no e-mail verification. Anyone can register any address; an invite link works for whoever registers the invited address first. | No data is ever linked to an account by e-mail (checked: orders, inquiries, subscriptions link by session only); the owner seed is fixed (S01); invites are single-use capabilities. Enable Convex Auth `verify` (e-mail OTP) once Resend is live — D212, HUMAN-TODO §4. |
| R02 | P3 | Guest cart token is 128-bit in `localStorage` (other capabilities are 256-bit). | Guessing is infeasible; XSS now has a CSP backstop. |
| R03 | P3 | `flags.publicPrices = false` is a display preference: a guest who adds an item sees its price in the cart. | Business setting; if prices must be secret, also disable guest checkout (documented in PRIVACY/HUMAN-TODO). |
| R04 | P3 | Back-in-stock `subscribe` answers `already` for an address already subscribed to that product. | Reveals only „this address wants this part“; rate-limited 10/h per client, 20/day per address. |
| R05 | P3 | An approved mechanic can infer `cost × (1 + minimum margin)` when the margin guard sets the price. | Inherent to the margin rule the owner chose (D-pricing); no cost is ever returned. |
| R06 | P3 | Paginated staff lists post-filter after the index (orders, inquiries, customers segments, stock, audit); `vehiclesAdmin.unlinkEngine` filters fitments of one engine. | Fine at shop scale (D137); indexes when a table passes ~50 k rows. |
| R07 | P3 | A few queries read `Date.now()` (invite expiry, category tree, notification preferences). | Only cache-reuse cost; values are correct on the next change. |
| R08 | P3 | Hostnames that *resolve* to private addresses (DNS rebinding, `127.0.0.1.nip.io`) cannot be detected in the Convex runtime (no DNS API). | Staff-only trigger; Convex egress is outside the shop's network. |
| R09 | P3 | `pricing.forProducts` returns the retail price of an inactive product by id. | Retail price is public information. |
| R10 | P3 | After anonymization the audit log still names the person as actor of their own actions; back-in-stock e-mails (`relatedType: product`) are not linked to the subscriber. | Audit log = security record (5 years, SECURITY §L5); e-mail HTML is stripped after 90 days, metadata after 2 years. Documented in PRIVACY-PROCESS. |
| R11 | P3 | Restore into a throwaway deployment was not executed (the pipeline may not create deployments). | Offline drill proves the snapshot is complete and schema-valid (§6); the owner runs the full drill — BACKUPS §3. |

## 3. HTTP headers and CSP (production build)

Static (every response, `next.config.ts`): `X-Content-Type-Options: nosniff` · `X-Frame-Options: DENY` · `Referrer-Policy: strict-origin-when-cross-origin` (`no-referrer` on token routes) · `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), hid=(), browsing-topics=()` · `Cross-Origin-Opener-Policy: same-origin` · `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (production builds; ignored by browsers on http).

Documents (`proxy.ts`, fresh 128-bit nonce per request; every HTML route is dynamic — the root layout reads `headers()`):

```
default-src 'self';
script-src 'self' 'nonce-…' 'strict-dynamic' 'wasm-unsafe-eval';        (+ 'unsafe-eval' in next dev)
style-src 'self' 'unsafe-inline';                                         (style attributes carry text-reveal vars)
img-src 'self' data: blob: <convex cloud> <site url> Google tag / Ads hosts (incl. www.google.rs) www.facebook.com;
font-src 'self' data:;
connect-src 'self' blob: data: <convex https + wss> <convex site> Google tag / Analytics / Ads hosts, www.facebook.com, connect.facebook.net;
media-src 'self' blob:; frame-src td.doubleclick.net www.googletagmanager.com www.facebook.com;
worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';
frame-ancestors 'none'; upgrade-insecure-requests                          (https only)
```

Why each exception: `strict-dynamic` lets the nonced Next runtime load its chunks and lets the consent manager inject gtag.js / fbevents.js after consent; `wasm-unsafe-eval` + `worker-src blob:` for the meshopt decoder of the 3D model; `connect-src blob:` because GLTFLoader reads the GLB's embedded textures through blob URLs (found by the e2e smoke — the first run blocked them); `worker-src 'self'` for the Excel import worker.

Verified on the production build (`tests/e2e/security.spec.ts`, 6 passed): headers present; two requests get different nonces; every executable `<script>` in the server HTML carries the nonce; **zero CSP violations** on home with the live 3D hero, category, product, cart, inquiry, sign-in (1440 and 390), with GA4 + Ads + Pixel loaded after consent, and in the admin (dashboard, import, e-mail template previews, privacy page). Full suite on the same build: 88 passed, 27 skipped (desktop-only specs on the mobile project), 2 failed → both were test-side (an assertion on the old dataLayer shape; a DOM nonce check racing lazily loaded chunks — now checks the server HTML), fixed. Final build: security, storefront, auth and seo specs 35 passed, 13 skipped.

## 4. Secrets, dependencies, cookies

- **Client bundles** (`.next/static`, 168 files, build with test hooks): no match for `BEGIN PRIVATE KEY`, `JWT_PRIVATE_KEY`, `JWKS`, `REVALIDATE_SECRET`, `RESEND_API_KEY`, `META_CAPI_TOKEN`, `LINK_TOKEN_SECRET`, `IP_HASH_SALT`, `SEED_ADMIN`, `CONVEX_DEPLOY_KEY`, `CONVEX_DEPLOYMENT`, Resend (`re_…`) / Meta (`EAA…`) token shapes, nor the actual values of `REVALIDATE_SECRET` and the seed password. `costNetPara` appears in 7 chunks only as a field name of shared domain code (pricing, import validation, audit labels) — no values; `productPrivate` never.
- `NEXT_PUBLIC_*`: Convex URLs, site URL, contact channels, `TEST_HOOKS` — none secret. All `lib/server/*` modules import `server-only`. The only Server Action (`app/actions/consent.ts`) writes consent/attribution cookies only.
- **`npm audit --omit=dev`: 0 vulnerabilities** (also 0 including dev).
- Cookies: Convex Auth `httpOnly`, `secure` off localhost, `SameSite=Lax`, 30 days; `sk_consent` / `sk_attr` readable by JS by design (consent manager), `SameSite=Lax`, `secure` in production.
- Every variable, where it lives and whether it is secret: [GO-LIVE-ENV](GO-LIVE-ENV.md).

## 5. Launch-readiness score (code + dev insights; prod not assessed)

Formula: start 100; per **confirmed open** finding high −15, med −5, low −1; floor 0.

- Before step 20: 5 high (S01–S05) + 11 med (S06–S16) + 7 low → 100 − 75 − 55 − 7 → **0**.
- After step 20: open = R01 (med) + R02–R11 (10 low) → 100 − 5 − 10 = **85** (code-level; passes run: authz, reviewer, advisor on dev, insights on dev; skipped: prod insights — no prod deployment).

Ordered plan for what is left: R01 e-mail verification with Resend (step 23 go-live), prod error capture (Convex log streams / Sentinel, HUMAN-TODO §7), R06 indexes when data grows.

## 6. Backups and restore drill

`npx convex export --include-file-storage --path backups/dev-2026-09-30.zip` (2.4 MB: 60 tables, `_storage` files, component data) → extracted → `BACKUP_DIR=… BACKUP_STATS=… npx vitest run tests/unit/backup` — **4/4 passed**: every table with rows present, **every document validates against today's schema** (so `npx convex import --replace` accepts it), every `_storage` file present, row counts equal to `seed:stats` of the live deployment. Negative control: one corrupted order status → the drill fails with the exact document and field. Local copies deleted afterwards (`backups/` is git-ignored). Schedule, retention and the full restore runbook: [BACKUPS](BACKUPS.md).

## 7. Checked and OK (no change needed)

- **Price / PII projections**: public catalogue, search, feeds, sitemaps and landings return anonymous projections with `returns` validators; mechanic prices only from `pricing.forProducts`, carts, part panel, live state and `mechanicPortal.*` for the approved caller (`priceVisibility.test.ts` matrix); `productPrivate` read only by staff queries and the pricing helper; order/inquiry views only by capability token or `ownOrder` (user id check); staff queries never return token hashes, invite tokens or reset codes.
- **Rate limits on public writes**: order submit (per client, per e-mail, global), inquiry submit, upload URL, mechanic registration, back-in-stock (per client + per address), search log (silent), cart writes (per cart) + cart creation (new), token actions (accept/decline/renew, unsubscribe, invite accept), consent log, quick-order match, reset e-mails and sign-ups (new); honeypot + 3 s minimum on order/inquiry forms; payload caps (message 2 000, codes 50, photos 5, cart lines 100, quantity 999, search 200, page size ≤ 60).
- **Uploads**: declared type allow-list, 8 MB (inquiry) / 10 MB (import images), ≤ 5 photos, reuse refused, magic-byte sniff after attaching (mismatch deletes the blob and detaches it), orphans without an `uploads` row deleted after 24 h (nightly, watermark).
- **Owner-only operations** (settings, users/invites/roles, tiers, demo removal, e-mail mode, privacy tools) use `owner*` builders; staff cannot change roles; the last owner cannot be removed; blocked users fail every authenticated function and are anonymous to public ones.
- **Crons / scheduler** target `internal.*` only; retention jobs are bounded and self-continuing.
- **Webhook**: Resend webhook signature-verified by the component; 503 without the secret.
