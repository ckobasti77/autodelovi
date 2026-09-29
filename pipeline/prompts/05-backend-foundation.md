<!-- META | Korak 05 | Opus 5.5 | effort: xhigh | sesija: NOVA | mode: auto -->
# Step 05 — Convex backend foundation

You are a senior Convex backend engineer. Implement the backend core exactly per docs/DATA-MODEL.md and docs/ARCHITECTURE.md — production-grade and tested.

## Read first
convex/_generated/ai/guidelines.md (mandatory) · docs/DATA-MODEL.md · docs/ARCHITECTURE.md · docs/SECURITY.md · docs/3D-CONTRACT.md (category ↔ part ids) · pipeline/BRIEF.md §5–§6 · pipeline/env/ENVIRONMENT.md.

## Skills to invoke (by name)
convex · convex-design · convex-expert · convex-auth · convex-authz · convex-seed · convex-test · convex-docs · convex-env · convex-suggest.

## Build
1. **Dependencies** — convex (current), convex-helpers if useful, the auth library chosen in the plan (via the convex-auth skill), @convex-dev/rate-limiter, @convex-dev/resend (installed now, used in step 18), convex-test + a Vitest setup for Convex functions (environment per the convex-test docs).
2. **Schema** (convex/schema.ts) — every table, validator, index and search index from DATA-MODEL. Money in integer para. Normalized OEM arrays for exact lookup plus a search index for names.
3. **Auth & roles** — set auth up fully non-interactively: generate keys yourself, set deployment variables with `npx convex env set` (SITE_URL=http://localhost:3000). Roles: customer, mechanic (profile status pending / approved / rejected), staff, owner. Helpers: getViewer, requireUser, requireRole, requireStaff, requireOwner. Create the owner account from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (set them as Convex env vars, then run an internal seed action). Never hard-code credentials.
4. **Modules** (queries / mutations / actions / internal functions) per the docs:
   - settings (singleton with defaults + typed getter)
   - vehicles (brands, models, generations, engines) and categories (tree, slugs, 3D part ids, SEO fields)
   - products — public read models that never expose cost or other roles' prices; list by category with vehicle / manufacturer / quality / stock / price filters and pagination; by slug; exact OEM lookup; text search; related parts
   - pricing — tier resolution (default %, per category, per manufacturer, personal override, margin guard) as **one pure function** used everywhere, fully unit-tested
   - carts; orders (create from cart or guest payload with server-side re-pricing and validation, atomic numbering counter, snapshots, status machine with guards and history, attribution fields, tokenized public status lookup)
   - inquiries (create with uploaded photos, quote model, accept → order)
   - stock movements (every change recorded), back-in-stock subscriptions, search log
   - **domain events outbox** (every business event inserts an event; step 18 consumes them), in-app notifications, an audit-log helper used by all staff writes
   - file uploads (generateUploadUrl with type/size checks) and rate limits on every public write
5. **Seed** — idempotent, re-runnable, everything flagged `isDemo` / `source: "seed"`:
   - brands VW, Audi, Škoda, SEAT, Cupra; common models and generations sold in Serbia 1998–2025 with years (Golf IV–VIII, Passat B5–B8, Polo, Caddy, Touran, Tiguan, Octavia I–IV, Fabia I–IV, Superb I–III, Rapid, Kodiaq, Karoq, Leon I–IV, Ibiza III–V, Ateca, A3 8L–8Y, A4 B5–B9, A6 C5–C8, …) and the most common engine codes with kW / KS and fuel — list them as "seed – proveriti" in docs/HUMAN-TODO.md
   - categories exactly from docs/3D-CONTRACT.md, Serbian names, SEO-ready descriptions
   - ~150 demo products across categories: manufacturers such as Bosch, Valeo, LuK, Sachs, TRW, ATE, Brembo, Febi Bilstein, Meyle, Lemförder, Mann-Filter, Mahle, Garrett, NGK, Gates, ContiTech, INA, SKF, Hella and "Original VAG"; `DEMO-` SKUs; plausible VAG-style OEM formats clearly marked as demo; prices in para; varied stock
   - price tiers (Majstor 10 %, Majstor Plus 15 %, Partner 20 %), one approved demo mechanic, a few demo orders and inquiries
   - an internal `removeDemoData` mutation
6. Push with `npx convex dev --once` until it is clean; fix every type error.

## Tests (convex-test + Vitest), aim for 40+ meaningful tests
Pricing resolution (every override combination, margin guard) · price visibility (anonymous / customer / mechanic pending / mechanic approved / staff) · order creation (re-pricing, stock rules, unique numbering, invalid payloads rejected) · order state machine (illegal transitions rejected) · inquiry → quote → accept → order · authorization negatives (customer reading another customer's order, non-staff calling admin functions, mechanic reading others' data) · normalized OEM lookups · seed idempotency.

## Verify and report
`npx convex dev --once` ✓ · `npx tsc --noEmit` ✓ · tests ✓ · `npx convex run` of a stats query printing counts per table ✓ · docs/DATA-MODEL.md updated where the implementation refined it · docs/PROGRESS.md · commit · Step report.
