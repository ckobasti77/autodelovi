# SKLOP — Auth, security and privacy

> Part of the SKLOP docs — index: [README](README.md) · source: [master plan](plans/01-master-plan.md). Business intent: `pipeline/BRIEF.md`.

Related: [DATA-MODEL](DATA-MODEL.md) · [ROUTES](ROUTES.md) · [ARCHITECTURE §E6 rate limits, §E7 files](ARCHITECTURE.md).

## D. Auth and authorization

### D1. Provider (unattended)
- `npm i @convex-dev/auth @auth/core@^0.41.1`, `npm i -D jose`. `convex/auth.ts`: `export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({ providers: [Password({ profile, reset: PasswordResetCode, validatePasswordRequirements })], session: { totalDurationMs: 30 days, inactiveDurationMs: 14 days }, jwt: { durationMs: 1 h } })` (confirm option names in `node_modules/@convex-dev/auth` types).
- `profile(params)` lowercases/validates the e-mail and sets `name`; `validatePasswordRequirements`: ≥ 10 characters, at least one letter and one digit, not equal to the e-mail.
- `PasswordResetCode`: `Email({ id: "password-reset", maxAge: 15 min, generateVerificationToken: 8 digits, sendVerificationRequest })` from `@convex-dev/auth/providers/Email`; the runtime passes the action ctx as an (undocumented) second argument — declare it optional and call `ctx.runMutation(internal.emails.enqueueAuthCode, …)` so the code flows through our e-mail pipeline (`auth.password_reset_requested`). In `log` mode the code is visible in `/admin/mejlovi` (HUMAN-TODO: go live with Resend).
- `callbacks`: keep the default user creation; `beforeSessionCreation(ctx, { userId })` throws for `users.status = "blocked"`. Built-in failed-password limiter: `signIn: { maxFailedAttempsPerHour: 10 }` (sic — the option name is misspelled in the library). Roles are **never** read from sign-up params.
- Keys: RS256 `JWT_PRIVATE_KEY` + `JWKS` generated with `jose` (skill command), set with `npx convex env set "NAME=VALUE"` (never `env set NAME value` — the leading `-` of the key breaks the CLI); `SITE_URL=http://localhost:3000`; delete the temporary key file.
- `convex/auth.config.ts`: `{ providers: [{ domain: process.env.CONVEX_SITE_URL, applicationID: "convex" }] }` (missing/incorrect = silently signed out).
- `convex/http.ts`: `auth.addHttpRoutes(http)`.
- Next: `proxy.ts` = `convexAuthNextjsMiddleware(handler, { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } })` exported as `proxy` (default export also accepted), `config.matcher = ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"]` (covers `/api/auth`; skips files with extensions such as sitemaps, feeds, models, images); root layout wraps `<html>` in `ConvexAuthNextjsServerProvider`; client provider `ConvexAuthNextjsProvider client={convex}`; forms call `useAuthActions().signIn("password", formData)` with `flow` = `signIn` | `signUp` | `reset` | `reset-verification`. Cookies (`__convexAuthJWT`, `__convexAuthRefreshToken`, `__Host-` prefix off localhost) are set by the proxy; the refresh token never reaches client JS.
- Step 05 proves a real round-trip on Next 16 first (sign up → cookie → `users.viewer` returns the user → sign out). If the Next integration fails on Next 16, apply fallback R1 (§O).

### D2. Roles and states
| Role | Source of truth | Access |
|---|---|---|
| anonymous | no session | retail prices (or „Cena na upit" when `flags.publicPrices=false`), guest cart via token, public forms |
| customer | `users.role` missing or `customer` | own orders, inquiries, saved vehicles, favorites, profile |
| mechanic pending / rejected / suspended | `mechanicProfiles.status` | customer access + status banner, retail prices |
| mechanic approved | `status = approved` | + own prices everywhere, quick order, price list, deferred payment if `creditEnabled` |
| staff | `users.role = staff` | admin except owner-only areas; sees cost and margin |
| owner | `users.role = owner` | everything incl. settings danger zone, users/invites, tier editing, demo removal |

Blocked users (`status = blocked`) fail every authenticated function.

### D3. Enforcement layers
1. **Convex (authoritative)** — `convex/lib/authz.ts`: `getViewer(ctx)` (via `getAuthUserId`) → `{ user, role, mechanic?: { status, profileId, tierId, creditEnabled } } | null`; `requireUser`, `requireStaff`, `requireOwner`, `requireApprovedMechanic`. Function builders (convex-helpers `customQuery`/`customMutation`): `publicQuery`, `publicMutation` (injects `ctx.client = { key, ip, userAgent }` from `ctx.meta.getRequestMetadata()`; key = SHA-256(`IP_HASH_SALT` + ip + UA)), `userQuery`/`userMutation`, `staffQuery`/`staffMutation`, `ownerMutation`. Never accept a user id for authorization; ownership checks on every document fetched by id or token.
2. **Next server (DAL)** — `lib/server/auth.ts` (`import 'server-only'`): `getViewer()` = React `cache()` around `fetchQuery(api.users.viewer, {}, { token: await convexAuthNextjsToken() })`; `requireStaffPage()` (redirect to `/prijava?next=` when anonymous, `forbidden()` when not staff), `requireAccountPage()`, `requireMechanicPage()`. Called in the admin/account/mechanic layouts **and** at the top of every page/route handler there (layouts do not stop sibling pages from rendering).
3. **Proxy (UX only)** — redirects anonymous users away from `/nalog`, `/majstor`, `/admin` and signed-in users away from `/prijava`, `/registracija`; no role checks, no DB calls beyond Convex Auth's own token refresh.
4. **Client forms** validate with the shared zod schema for UX; the Convex mutation re-validates everything (validators + shared pure checks). The few Server Actions (cookie setters) only touch cookies.

### D4. Price-visibility guarantees
- Public/cached queries (`catalog.*`, `search.*`, feeds, sitemaps) are anonymous projections with explicit `returns` validators (an extra field such as cost fails validation instead of leaking).
- `productPrivate` is read only by `staffQuery` functions and inside the server-side pricing helper, which returns only the final unit price.
- Mechanic prices come only from `pricing.forProducts`, `carts.get`, `catalog.partPanel` and `mechanics.*` for the authenticated approved mechanic; every other caller gets `yourPricePara: null`.
- SSR never renders a role-specific price; cached HTML is identical for all viewers.
- convex-test matrix (§M) asserts payloads for anonymous, customer, pending, approved (tier A vs. B) and staff.

### D5. Staff invites and owner seed
- Owner creates an invite (e-mail, role) → token shown once („Kopiraj link"), e-mailed when live → `/admin/pozivnica/<token>` → sign up/in with that e-mail → `staff.acceptInvite({ token })` binds the role (e-mail must match; not expired/revoked) → audit.
- `seed:createOwner` internal action reads `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` from Convex env (set with `npx convex env set`), calls `createAccount(ctx, { provider: "password", account: { id, secret }, profile: { email, name: "Vlasnik" } })` when missing, then sets `role = owner`. Idempotent; never logs the password.

## L. Security and privacy

### L1. Authorization rules
Every Convex function authorizes through the builders (§D3); public functions return anonymous projections or act on unguessable token capabilities (256-bit, stored as SHA-256); ownership checked on every fetch by id/token; identity never from args; `returns` validators on all public functions; staff writes audited; owner-only: settings danger zone, users/invites/roles, tier editing, demo removal, e-mail mode. Admin pages guarded in proxy (UX) + server layout/page (`requireStaffPage`) + Convex (authoritative).

Order and inquiry status tokens (step 18, D171) are HMAC-SHA-256(`LINK_TOKEN_SECRET`, `<kind>:<number>`) — still 256-bit capabilities stored only as SHA-256, but re-derivable so every later e-mail can link to the status page. The secret is a deployment env var (never in code or git); rotating it invalidates all links issued before (`maintenance:rekeyStatusLinks` re-hashes). E-mail content with secrets (reset codes, invite links) is masked in the admin outbox and never resent.

### L2. Abuse protection
Rate limits (§E6) on every public write; honeypot + 3 s minimum form time; payload caps (message 2 000 chars, quick-order lines 200, cart lines 100, search query 200, list page size ≤ 60); upload validation (§E7); token pages `Referrer-Policy: no-referrer`; e-mail enumeration avoided on reset („Ako nalog postoji, poslali smo kod").

### L3. Headers and CSP (set in `proxy.ts`, nonce per request)
```
default-src 'self'; script-src 'self' 'nonce-{nonce}' 'strict-dynamic' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.convex.cloud https://www.googletagmanager.com
https://*.google-analytics.com https://*.g.doubleclick.net https://*.google.com https://www.facebook.com;
font-src 'self'; connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site
https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.g.doubleclick.net
https://*.google.com https://connect.facebook.net https://www.facebook.com; frame-src https://www.googletagmanager.com
https://td.doubleclick.net https://www.facebook.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self';
form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```
(dev adds `'unsafe-eval'`). Also `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (production only), `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`, `Cross-Origin-Opener-Policy: same-origin`. Step 20 verifies 3D (WASM decoder, blob workers), fonts, images, Convex websockets and post-consent analytics under the policy.

### L4. Secrets
Only in Convex env and server-side Next env; nothing secret behind `NEXT_PUBLIC_*`; step 20 greps `.next/static` for secret patterns; `.env*`, `pipeline/env/`, logs git-ignored; `docs/GO-LIVE-ENV.md` lists every variable with purpose and where to set it.

### L5. Privacy (ZZPL „Sl. glasnik RS" 87/2018, ZEK 35/2023 čl. 160, Zakon o zaštiti potrošača 35/2026, Zakon o elektronskoj trgovini)
| Data | Purpose / basis | Retention (default — confirm, HUMAN-TODO) |
|---|---|---|
| Orders, items, company data | contract, accounting obligation | 10 years (confirm with the accountant) |
| Inquiries without order (+ photos) | pre-contract / legitimate interest | 2 years (photos 1 year) |
| Customer accounts, saved vehicles, favorites | contract | until deletion request or 3 years inactive |
| Mechanic profiles | contract | while active + 3 years |
| Back-in-stock subscriptions | consent | until notified + 30 days or unsubscribe; max 12 months |
| Search logs | legitimate interest (assortment) | 180 days, no IP (session hash) |
| Consent records | proof of consent | 2 years |
| E-mail log | records, support | HTML 90 days, metadata 2 years |
| Audit log | security, records | 5 years |
| Click IDs / fbp / fbc | ads consent; aggregate reporting | click IDs pruned after 180 days |
| CAPI context (IP, UA) | ads consent | deleted right after sending (≤ 7 days on failure) |
| Guest carts | service | 30 days inactivity |

Rights: access/export and erasure within 30 days (+60): admin tools „Izvoz podataka kupca" (JSON/CSV) and „Anonimizuj kupca" (PII replaced in orders while keeping accounting totals; account, inquiries, subscriptions, favorites deleted); process in `docs/PRIVACY-PROCESS.md` (Serbian). DPO not mandatory for this profile; records-of-processing exemption (< 250 employees) has exceptions → legal check. Legal page templates cover: e-commerce info duties (naziv, sedište, PIB, MB, registar, kontakt, cene sa PDV, koraci zaključenja ugovora, ispravka grešaka pri unosu), privacy, cookies (consent per ZEK čl. 160 st. 4–5), delivery/payment, reklamacije i povrat per the 2026 law (14-day withdrawal from receipt, refund ≤ 14 days, reply to a complaint ≤ 8 days, resolution ≤ 15 days / 30 days for technical goods, remedy choice in the first 30 days, 2-year liability, published complaint procedure, withdrawal form). All flagged `needsLegalReview`.

### L6. Backups and dependencies
Convex snapshot export (`npx convex export --path backups/<date>.zip`) and a restore drill into a throwaway deployment (convex-backup skill) documented in `docs/BACKUPS.md` with a daily schedule recommendation; code in Git; 3D reproducible from scripts. `npm audit --omit=dev` in step 20 (fix or justify); pinned majors.
