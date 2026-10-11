# Euromotors Plus · OEM Parts — Notifications and automations

> Part of the Euromotors Plus docs — index: [README](README.md) · source: [master plan](plans/01-master-plan.md). Business intent: `pipeline/BRIEF.md`.

Related: [DATA-MODEL §C9](DATA-MODEL.md) (outbox, notifications, emailLog) · [ARCHITECTURE §E](ARCHITECTURE.md) · [SEO-ADS §J7](SEO-ADS.md) (Meta CAPI).

## I. Notifications and automations

### I1. Architecture
`emitEvent(ctx, type, payload, dedupeKey)` inserts `domainEvents` (pending) **in the same transaction** as the business write and schedules `events.dispatch` with `runAfter(0)`. The dispatcher resolves recipients (settings + staff preferences), writes `notificationDeliveries` rows (unique per event × channel × recipient — idempotent), creates in-app `notifications`, and enqueues e-mails (`emails.render` → `emails.send`), CAPI (`capi.send`) and cache revalidation (`revalidate.notify`) through the `externalIo` workpool. Failures retry with exponential backoff (1 min, 5 min, 30 min, 2 h, 12 h) → `dead` after 5 attempts (visible in admin). `events.sweep` (every minute) re-dispatches stuck `pending`/`failed` events whose `nextAttemptAt` passed.

**E-mail modes** (`EMAIL_MODE`, default `log`): `log` → render and store in `emailLog` only (**never call the Resend component** — it throws without `RESEND_API_KEY`); `test` → Resend component with `testMode: true`, recipients rewritten to `delivered@resend.dev`; `live` → real recipients (needs `RESEND_API_KEY`, verified domain, `EMAIL_FROM`). Webhook `/resend-webhook` updates statuses; cron `cleanupOldEmails` on the component (7 days) while our `emailLog` keeps metadata 2 years. All templates: Serbian, responsive, dark-mode-safe, preheader, plain-text twin, company data from settings (empty-safe), links with UTM `utm_source=email&utm_medium=transactional`.

### I2. Matrix
| Event | Recipients → channel · template | Timing |
|---|---|---|
| `order.created` | customer → e-mail `order_received`; staff → e-mail `staff_order_new` + in-app; Meta CAPI `Purchase` (if enabled and `consent.ads`) | immediate |
| `order.status_changed` → `potvrdjena` | customer → `order_confirmed` (predračun data + „poziv na broj" when bank transfer; due date for deferred) | immediate |
| → `ceka_deo` | customer → `order_backordered` (lead time) | immediate |
| → `spremna_za_preuzimanje` | customer → `order_ready_pickup` (address, hours, map link) | immediate |
| → `poslata` | customer → `order_shipped` (courier + tracking link) | immediate |
| → `isporucena` / `preuzeta` | customer → `order_delivered` (reklamacije + 14-day withdrawal info) | immediate |
| → `otkazana` | customer → `order_cancelled` (reason) | immediate |
| `inquiry.created` | customer → `inquiry_received`; staff → `staff_inquiry_new` + in-app; CAPI `Lead` | immediate |
| `quote.sent` | customer → `quote_ready` (status link, validity) | immediate |
| `quote.accepted` | staff → `staff_quote_accepted` + in-app (customer gets `order_received` for the new order) | immediate |
| `quote.renewal_requested` | staff → in-app + e-mail | immediate |
| quote expiring | customer → `quote_expiring` (24 h before `validUntil`) | cron |
| `quote.expired` | staff → in-app | cron |
| `mechanic.registered` | applicant → `mechanic_registration_received`; staff → `staff_mechanic_new` + in-app; CAPI `CompleteRegistration` | immediate |
| `mechanic.approved` / `rejected` / `suspended` | mechanic → `mechanic_approved` (tier, how to log in) / `mechanic_rejected` (reason) / `mechanic_suspended` | immediate |
| `stock.low` | staff → in-app immediately; e-mail batched `staff_low_stock` (≤ 1/hour) | sweep hourly |
| `stock.back_in_stock` | subscribers → `back_in_stock` (once, then `notified`) | immediate + hourly safety sweep |
| `auth.password_reset_requested` | user → `password_reset_code` | immediate |
| `staff.invited` | invitee → `staff_invite` (live mode only; link always shown in admin) | immediate |
| `email.bounced` / `complained` | staff → in-app flag on the related order/inquiry | webhook |
| `import.completed` / `import.rolled_back` | initiator → in-app | immediate |
| daily digest | staff with digest on → `staff_daily_digest` (yesterday's orders/value, open inquiries with ages, pending mechanics, low stock, top zero-result searches) | 08:00 Europe/Belgrade |
| reminders | staff → in-app + `staff_reminder` for orders in `nova` and inquiries in `nov` older than `reminderAfterWorkingMinutes` **working** minutes (settings hours/holidays); escalation levels 1 → 2 (+2 h) | every 15 min, working hours only |
| `product.changed` / `category.changed` / `settings.changed` / `content.changed` | Next cache → `revalidate.notify` (tags) | immediate |

### I3. Crons (`convex/crons.ts`; Convex cron times are **UTC**, local logic via `lib/domain/time.ts` — EU DST rule, last Sunday of March/October 01:00 UTC; `Intl` not required)
| Job | Schedule (UTC) | Logic |
|---|---|---|
| `events.sweep` | every 1 min | retry due events |
| `reminders.run` | `*/15 * * * *` | only inside Belgrade working hours; dedupe via `reminderLevel` |
| `digest.run` | `0 * * * *` | runs when Belgrade hour = `digestHour`; `cronRuns` key `digest:<day>` guarantees once per local day across DST |
| `quotes.expire` | `*/15 * * * *` | sent quotes past `validUntil` → `expired`; inquiries → `istekla`; 24 h reminders |
| `stock.lowStockSweep` | `5 * * * *` | batched staff e-mail |
| `backInStock.sweep` | `10 * * * *` | safety net for missed events |
| `seo.recomputeLandingStats` | `20 * * * *` | thresholds + cap → `landingStats.indexable` |
| `maintenance.nightly` | `30 1 * * *` (02:30/03:30 local) | orphan uploads, prune logs (retention §L), reconcile counters, auto-complete orders after `autoCompleteDays`, stale guest carts, Resend component cleanup |

### I4. Implementation (step 18)
Code map — pure templates in `lib/email/` (shared by Convex, the admin gallery and tests), delivery in `convex/`:

| Piece | File | Notes |
|---|---|---|
| HTML builder | `lib/email/html.ts` | Table layout, inline styles, paper palette + `prefers-color-scheme: dark` overrides (night palette), preheader, bulletproof button, `**bold**` / `[label](url)` inline markup (everything else escaped, only http(s)/mailto/tel/viber links), document numbers never break. Every block renders HTML **and** its plain-text twin. |
| Context | `lib/email/context.ts` | Brand, company, hours from settings (empty-safe); `siteLink` adds `utm_source=email&utm_medium=transactional&utm_campaign=<template>`; footer phone / Viber / WhatsApp (prefilled with the document number) / e-mail only when set. |
| Templates | `lib/email/templates/{order,customer,staff}.ts`, `catalog.ts` (labels), `registry.ts` (renderers + samples), `samples.ts` | 25 keys (below). `catalog.ts` has no renderers, so client components import it without pulling templates into the bundle. |
| Status links | `convex/lib/linkTokens.ts` | Token = base64url(HMAC-SHA-256(`LINK_TOKEN_SECRET`, `order:<number>` / `inquiry:<number>`)); DB keeps SHA-256(token) only. `maintenance:rekeyStatusLinks` re-derives hashes (after a secret rotation — old links die). |
| Config | `convex/lib/emailConfig.ts` | Requested mode: settings `email.mode` (owner) → `EMAIL_MODE` → `log`. Effective mode falls back to `log` without `RESEND_API_KEY` (test/live) or `EMAIL_FROM` (live). Warnings (Serbian) for the admin banner. |
| Mailer | `convex/lib/mailer.ts` | The only writer of `emailLog` and the only caller of the Resend component. `log`: store only. `test`: `testMode: true`, recipients → delivered@resend.dev (`originalTo` kept). `live`: real recipients, Reply-To = settings `email.replyTo` → company e-mail. Demo and e2e (`isTest`) aggregates are always logged. Idempotency key `<eventId>:<recipient>`. |
| Dispatcher | `convex/events.ts` | Per event: in-app rows inline (staff with preferences; the mechanic whose profile changed; import → initiator), then one ledger row + one scheduled `notify.deliverEmail` per e-mail recipient. |
| Delivery | `convex/notify.ts` | Loads data (`convex/lib/emailData.ts`), renders, sends, writes `orderEvents`/`inquiryEvents` `email_sent` (visible to the customer only outside `log`). Missing aggregate / invalid address → `skipped`; a thrown render or provider error → `failed` + retry after 1 min, 5 min, 30 min, 2 h, 12 h; stops after 5 attempts. `onEmailEvent` (webhook) moves `emailLog.status` forward only; bounced/complained → `email.bounced`/`email.complained` event → staff bell + `orderEvents(email_failed)`. |
| Direct sends | `convex/lib/directEmail.ts` | Password reset code (`authEmails.sendPasswordResetCode`), staff invite (live mode only), „Pošalji probnu poruku“. |
| Webhook | `convex/http.ts` `POST /resend-webhook` | Svix signature checked by the component with `RESEND_WEBHOOK_SECRET`; 503 without the secret. |
| Automations | `convex/automations.ts`, `convex/crons.ts` | See the cron table below. |
| Admin | `/admin/mejlovi` (outbox: status + template filters, message sheet, „Pošalji ponovo“), `/admin/mejlovi/sabloni` (gallery: live preview with sample data + current settings at 680 / 375 px or plain text, test send 10/h), Podešavanja → Obaveštenja (mode, sender name, Reply-To, webhook URL, own preferences), Korisnici → Obaveštenja (owner edits anyone's preferences). |
| Storefront | `/obavestenja/odjava/[token]` (one-click confirmation; cancels every active alert of the address), „Obaveštenja“ box on `/porudzbina/[token]`, a line on `/upit/[token]`, WhatsApp/e-mail contact links prefilled with the order/inquiry number or the product. |

Templates: customer — `order_received`, `order_confirmed` (predračun: primalac, račun, iznos, poziv na broj, svrha, link za štampu; rok za odloženo plaćanje), `order_backordered`, `order_ready_pickup` (adresa, mapa, radno vreme, iznos), `order_shipped` (kurir, broj pošiljke, praćenje), `order_delivered` (isporučena / preuzeta; reklamacije; 14 dana samo za potrošače), `order_cancelled`, `inquiry_received`, `quote_ready`, `quote_expiring`, `back_in_stock`; mechanic — `mechanic_registration_received`, `mechanic_approved` (razred, rabat, odloženo plaćanje), `mechanic_rejected`, `mechanic_suspended`; account — `password_reset_code`, `staff_invite`; staff — `staff_order_new`, `staff_inquiry_new`, `staff_mechanic_new`, `staff_quote_accepted`, `staff_quote_renewal`, `staff_low_stock`, `staff_daily_digest`, `staff_reminder`.

Staff e-mail recipients: every active owner/staff account whose own preference is on, plus `settings.notifications.staffEmails` (deduplicated; an address that belongs to a staff account follows that account's preference). `digestEnabled` and `lowStockEmail` switch those e-mails off for everyone. An order created by accepting a quote e-mails staff once („Ponuda prihvaćena“), not twice.

Crons as built (UTC schedule, Belgrade logic in the job):

| Job | Schedule | Logic |
|---|---|---|
| `events.sweep` | every 1 min | re-dispatch due `pending`/`failed` events |
| `automations.runReminders` | `*/15 * * * *` | only inside opening hours (settings hours + holidays); orders `nova`, inquiries `nov`; working minutes since creation or the last staff action; level 1 at `reminderAfterWorkingMinutes`, level 2 at +120; `reminder.due` → bell + `staff_reminder` |
| `automations.runDigest` | `0 * * * *` | Belgrade hour = `digestHour` and no `cronRuns` `digest:<day>` → `digest.daily` for yesterday |
| `maintenance.expireQuotes` | `*/15 * * * *` | sent quotes past `validUntil` → expired / `istekla` |
| `automations.quoteExpiringSweep` | `7,22,37,52 * * * *` | sent quotes expiring within 24 h (valid for more than 36 h) → `quote.expiring` once |
| `automations.lowStockSweep` | `5 * * * *` | `stock.low` events since the last run (index `domainEvents.by_type`), products still low/out → one `stock.low_digest` per hour |
| `automations.backInStockSweep` | `10 * * * *` | products available again with active subscriptions → `stock.back_in_stock` (safety net) |
| `maintenance.autoCompleteOrders` | `30 1 * * *` | unchanged |
| `automations.nightly` | `40 1 * * *` | orphan uploads (no `uploads` row after 24 h, creation-time watermark), retention (SECURITY §L5: e-mail HTML 90 d, e-mail log 2 y, search logs 180 d, done events + deliveries 90 d, in-app 180 d, subscriptions 30 d after notify / 12 months, consent 2 y, audit 5 y, cron runs 90 d, guest carts 30 d), Resend component cleanup (only with a key); bounded batches, re-schedules itself ≤ 10 rounds |

Environment (Convex): `EMAIL_MODE` (optional default), `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM`, `LINK_TOKEN_SECRET` (set on dev; production value in HUMAN-TODO §4), `NEXT_SITE_URL`/`SITE_URL` (link origin). SMS and Telegram stay future options: a channel would be one more `notificationDeliveries.channel` value, a mailer-like sender and a column in the preference matrix; nothing is built for them in v1.
