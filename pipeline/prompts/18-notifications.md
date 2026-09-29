<!-- META | Korak 18 | Opus 5.5 | effort: xhigh | sesija: NOVA | mode: auto -->
# Step 18 — Notifications, e-mails and automations

Make the business run itself: every event reaches the right person at the right time, and nothing falls through the cracks.

## Read first
docs/NOTIFICATIONS.md · docs/DATA-MODEL.md (events outbox, notifications, e-mail log) · docs/design/DESIGN-SYSTEM.md (e-mail design, voice) · pipeline/BRIEF.md §5 (Notifications) · docs/progress/*.md.

## Skills to invoke (by name)
convex · convex-add (e-mail capability) · convex-crons · convex-env · convex-test · impeccable.

## Build
1. **Dispatcher** — consumes the domain-events outbox (scheduled, retries with backoff, idempotent per event + recipient + channel), resolves recipients and preferences, writes in-app notifications (realtime bell for staff; notices on customer status pages) and sends e-mails.
2. **E-mail provider** — Resend through the Convex component. Modes from settings/env: `log` (default for now: render and store in the e-mail log only), `test` (Resend test mode), `live` (needs RESEND_API_KEY + a verified domain + from-address). A webhook HTTP action updates delivery status (delivered / bounced / complained). Put the go-live steps in docs/HUMAN-TODO.md.
3. **Templates** (React Email or equivalent; Serbian; branded per the design system; responsive; dark-mode-safe; plain-text version; preheaders):
   - customer — porudžbina primljena / potvrđena (with predračun details for bank transfer) / spremna za preuzimanje / poslata (tracking) / isporučena / otkazana; upit primljen; ponuda spremna (accept link); deo je ponovo na stanju
   - mechanic — registracija primljena / odobrena (tier) / odbijena; account e-mails if auth needs them
   - staff — nova porudžbina, novi upit, nova registracija majstora, malo na stanju, dnevni izveštaj, podsetnici
4. **Crons** (Europe/Belgrade business time, DST-safe): daily digest at 08:00; reminders for inquiries and orders untouched for N working hours; low-stock sweep; back-in-stock matcher; expiring old quotes; cleaning orphaned uploads; pruning old logs per the retention policy.
5. **Admin** — e-mail outbox (filters, status, resend), template gallery with live previews and „Pošalji test", notification preferences per staff user, working-hours settings.
6. **Click-to-chat** — Viber (`viber://chat?number=`) and WhatsApp (`https://wa.me/`) links wherever contact appears (settings-driven). SMS / Telegram documented as future options only.

## Verify
convex-test: event → notification fan-out, preferences, idempotency, retries, cron logic with fake time. Template render tests (snapshots). Playwright: place an order → the e-mail log has customer + staff entries and the bell shows it; change a status → the customer e-mail is logged. Screenshots of 4 key e-mails (desktop and mobile widths) reviewed. tsc, lint, build and tests pass · commit · Step report.
