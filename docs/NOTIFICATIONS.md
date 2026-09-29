# SKLOP — Notifications and automations

> Part of the SKLOP docs — index: [README](README.md) · source: [master plan](plans/01-master-plan.md). Business intent: `pipeline/BRIEF.md`.

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
