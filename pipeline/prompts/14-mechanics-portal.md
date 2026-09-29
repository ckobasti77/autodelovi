<!-- META | Korak 14 | Opus 5.5 | effort: xhigh | sesija: NOVA | mode: auto -->
# Step 14 — Mechanics portal (B2B, rabat)

Build the part of the product that turns mechanics into loyal repeat buyers. Speed and trust above all — many use it on a phone in the workshop.

## Read first
pipeline/BRIEF.md §3 (mechanic), §5 (Mechanics), §6 · docs/DATA-MODEL.md (pricing, mechanic profiles, tiers) · docs/ROUTES.md · docs/design/DESIGN-SYSTEM.md · docs/NOTIFICATIONS.md · docs/progress/*.md.

## Skills to invoke (by name)
convex · convex-authz · convex-test · impeccable · design-taste-frontend · ui-ux-pro-max · text-reveal · gsap-react.

## Build
1. **/za-majstore** landing (rabat, brza porudžbina, dostava u servis, prioritetni upiti; how approval works; FAQ) + registration form (firma, PIB with checksum, MB, kontakt osoba, telefon, e-mail, grad, adresa, vrsta servisa, marke) → mechanic profile `pending` → domain event for staff → confirmation page.
2. **Staff approval UI** (under /admin/majstori; step 15 integrates it into the full admin shell): approve with a tier (+ optional personal override and credit flag) / reject with a reason → domain events for the e-mails.
3. **Role-aware pricing everywhere** (product, cards, search, 3D panel, cart, checkout): approved mechanics see „Vaša cena" with the retail price crossed out, computed only server-side through the single pricing function. Verify no query payload leaks mechanic prices or cost to any other role.
4. **/majstor dashboard**: quick order (paste „OEM količina" lines or upload a small CSV → parse, normalize, match → exact / ambiguous / not found → add all to cart; not-found lines → one-click prefilled inquiry); order history with statuses and „Poruči ponovo"; favorites; saved customer vehicles (VIN, plate, note, link to the filtered catalog); downloadable personal price list (XLSX with the Excel library chosen in the plan); profile and company data.
5. **Deferred payment** („odloženo plaćanje") shows in checkout only for approved mechanics with the credit flag.
6. **Mobile-first polish**: sticky quick-order entry, large touch targets, instant feedback.

## Verify
convex-test: pricing and visibility matrix, quick-order matching, approval authorization. Playwright: register → approve through a test helper → log in → discounted prices across pages → quick order with mixed lines → order placed with deferred payment when the credit flag is set. Screenshots at 390 and 1440 reviewed. tsc, lint, build and tests pass · commit · Step report.
