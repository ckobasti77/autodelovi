<!-- META | Korak 15 | Opus 5.5 | effort: xhigh | sesija: NOVA | mode: auto -->
# Step 15 — Admin panel

Build the owner's command center: fast, dense, calm, hard to misuse. Staff will live in it all day.

## Read first
pipeline/BRIEF.md §5 (Admin panel, Records), §6 · docs/ROUTES.md (admin) · docs/DATA-MODEL.md · docs/SECURITY.md · docs/design/DESIGN-SYSTEM.md (admin sections) · docs/NOTIFICATIONS.md · docs/progress/*.md.

## Skills to invoke (by name)
convex · convex-authz · convex-test · impeccable · ui-ux-pro-max · design-taste-frontend · motion-design (restrained in admin).

## Build — /admin, staff and owner only, guarded server-side
1. **Shell** — sidebar organized by task; global command/search (order number, OEM, SKU, phone, e-mail); realtime notification bell (Convex subscription); role-aware menu; keyboard shortcuts for frequent actions.
2. **Dashboard** — KPIs (today / this week orders and value, open inquiries with SLA timers, pending mechanics, low stock), „Traženo, a nemamo" (top zero-result searches with trend), recent activity, simple accessible charts (orders per day for 30 days, orders by category).
3. **Orders** — list with filters (status, date, delivery, payment, customer type, source/campaign); detail (items, customer, company data, delivery, payment, attribution, timeline, internal notes, e-mail log); status transitions with confirmations and guards (each emits a domain event); edit before confirmation; courier tracking number; cancel with reason; print views (predračun, otpremnica) as clean print-CSS pages.
4. **Inquiries** — list and detail with photos; compose a quote (catalog items via search or free lines with price, availability, lead time, validity); send (domain event); convert an accepted quote into an order.
5. **Products** — data table (search, filters, column chooser, bulk activate / deactivate / change category / adjust price %); editor (all fields, drag-drop image upload with reorder, OEM/cross editor with normalization preview, fitment editor with the vehicle tree, stock change with reason → stock movement, price and cost with a margin indicator, SEO fields with a SERP preview); duplicate; per-product audit history.
6. **Categories & 3D mapping** (tree editor, SEO texts, thumbnail, part ids from the manifest) · **vehicles** (brands / models / generations / engines) · **stock movements** log · low-stock thresholds.
7. **Customers & mechanics** (detail with orders, inquiries and notes; approve / reject; tier, override, credit flag; block) · **price tiers** CRUD with a live example-price preview.
8. **Settings** — company data, working hours, delivery and payment methods, notification recipients and toggles, SEO defaults, tracking IDs (GA4, Google Ads conversion ID and labels, Meta Pixel), legal texts (Markdown editor with preview), feature flags (public prices, guest checkout, …), „Obriši demo podatke" (owner only, typed confirmation).
9. **Users & roles** (owner / staff; an invite flow that works without e-mail delivery by showing a one-time setup link) · **audit log** viewer with filters · **e-mail outbox** page (filled in step 18) · **search analytics**.
10. Every staff write goes through the audit helper; every destructive action has a confirmation and, where possible, an undo.

## Verify
convex-test: staff vs. owner permissions, audit entries, transitions. Playwright: admin login; create and edit a product with an image; order status nova → potvrđena → poslata with a tracking number; answer an inquiry with a quote; approve a mechanic with a tier; save settings. Screenshots at 1440 and 1024 reviewed with impeccable and fixed; log in docs/qa/ADMIN.md. tsc, lint, build and tests pass · commit · Step report.
