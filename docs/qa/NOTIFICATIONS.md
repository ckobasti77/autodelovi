# QA — Step 18 notifications, e-mails and automations

Screens: `docs/qa/screens/step-18/`, captured from the production build on port 3100 by `tests/e2e/notifications.spec.ts` (e-mail frames) and `scripts/qa/notifications-shots.mjs` (admin and storefront pages).

## Key e-mails (680 px desktop frame and 375 px phone frame)
| E-mail | Desktop | Phone | Review |
|---|---|---|---|
| Porudžbina primljena | `email-order_received-desktop.png` | `email-order_received-mobile.png` | Order number in the title block, items with code and „1 × cena“, totals with PDV, delivery and payment facts, one orange action. The footer is empty-safe: dev settings have no company data, so it shows the brand and the hours only. |
| Porudžbina potvrđena (predračun) | `email-order_confirmed-desktop.png` | `email-order_confirmed-mobile.png` | Payment block first (primalac, račun, iznos, poziv na broj, svrha, link za štampu), then items. Dark mode checked with `prefers-color-scheme: dark`: night palette, and the mark inverts. |
| Osoblje: nova porudžbina | `email-staff_order_new-desktop.png` | `email-staff_order_new-mobile.png` | Mechanic notice with the tier, customer facts with a tap-to-call phone, source and campaign, the note, items, „Otvorite porudžbinu“. Admin links carry no UTM. |
| Stiglo je | `email-back_in_stock-desktop.png` | `email-back_in_stock-mobile.png` | Product facts, price with PDV, one action, „samo jednom“, and the unsubscribe link in the footer. |

## Admin and storefront screens
`admin-outbox-{1440,1024}.png`, `admin-outbox-message-1440.png`, `admin-templates-{desktop,phone,text}-{1440,1024}.png`, `admin-settings-notifications-{1440,1024}.png`, `admin-users-prefs-{1440,1024}.png`, `order-status-notices-{1440,390}.png`, `unsubscribe-{1440,390}.png`.

## Findings (all fixed in this step)
| # | Severity | Finding | Fix |
|---|---|---|---|
| N-1 | P1 | On phones the staff e-mail title broke the order number at a hyphen („SK-2026-“ / „000187“). | Document numbers are wrapped in a no-wrap span in headings and inline text (`keepCodes`). |
| N-2 | P2 | The „E-pošta“ label in the e-mail footer wrapped at its hyphen. | Non-breaking hyphen in the label. |
| N-3 | P2 | The gallery breadcrumb showed the slug „sabloni“. | Breadcrumb segment label „Šabloni“. |
| N-4 | P2 | The unsubscribe page stated the result before the click („Ne šaljemo vam više…“). | „Posle odjave više vam ne šaljemo…“. |
| N-5 | P2 | The gallery previewed placeholder bank data even when settings have real accounts. | The sample predračun takes the recipient and accounts from settings when they are set. |

No open P0/P1. Zero console errors on every captured page (`notifications-shots.mjs` → `errors: []`).
