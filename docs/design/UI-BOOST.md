# UI boost — critique, target and plan (steps 26–27)

> Part of the Euromotors Plus docs — index: [../README.md](../README.md). Design system: [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md). Decisions: D317–D329 in [../DECISIONS.md](../DECISIONS.md).
> Step 26 (2026-10-11) built **the system**: tokens, shared components, the shell and the site-wide reveal. Step 27 applies it to every page — its work list is §7 and §8.
> The owner asked for a site that feels much more modern, polished and premium („brutalno“ = outstanding, not the brutalist style), with three fixed requirements: small soft corners on every box, staggered reveals on scroll, a modern look that stays „Rendgen“.

**Contents** — 1 How the critique was run · 2 Scores · 3 Problems · 4 Target · 5 What step 26 changed · 6 Components: done and open · 7 Templates: the work list for step 27 · 8 How to apply the system · 9 Performance: measured, fixed, open · 10 How to check

---

## 1. How the critique was run

`impeccable critique`, two assessments that did not see each other, on screenshots of the state before this step.

| | What | Evidence |
|---|---|---|
| Screens | 23 pages × 390 and 1440 px, first screen and full page (46 + 46 files): home, category, parts, product, search and empty search, cart, checkout, VIN inquiry, `/za-majstore`, vehicles, contact, sign-in, styleguide, mechanic portal (3), account (2), admin dashboard, orders, products, settings | `docs/qa/screens/step-26/before/` |
| Assessment A — design review | An isolated reviewer looked at every first screen and at the full pages of 13 templates at both widths, read the token file and the shared components, and scored the storefront + portal and the admin separately | summarised in §2–§4 |
| Assessment B — detector | `node .claude/skills/impeccable/scripts/detect.mjs --json` over `components/ui`, `components/shell`, catalog/product/cart/checkout/home, mechanic/account/admin and `app/` | 2 advisory findings, both justified: `components/ui/Tabs.tsx:78` uses `#000` as the opaque stop of a CSS mask (a mask has no colour), `components/admin/print/OrderPrint.tsx:62` uses the fixed 24 px print ramp of DESIGN-SYSTEM §4.3 |
| Assessment B — measured browser evidence | **Not usable.** The reviewer's measuring run overlapped with the first token changes (several pages answered 500 while files were being rewritten) and the pipeline restarted before it reported. Its numbers were discarded | replaced by the audits of §10, run on the finished code |

Not seen by the reviewer (no captures): open dialogs, sheets, menus, toasts, tooltips, the mobile menu, storefront pagination, form error states. They were checked in code and on `/styleguide`.

## 2. Scores (Nielsen, 0–4 each)

| # | Heuristic | Storefront + portal | Admin | Key issue before |
|---|---|---|---|---|
| 1 | Visibility of system status | 3 | 3 | Cart skeleton did not match the final layout; ten identical red „3 d 12 h“ timers in the admin queue |
| 2 | Match with the real world | 4 | 4 | — (mechanic vocabulary, forgiving OEM input, the VIN drawing) |
| 3 | User control and freedom | 3 | 3 | „Odjavi se“ in the primary slot of the portal and account tab rows |
| 4 | Consistency and standards | 2 | 3 | Two H1 styles without a rule; four container styles in one portal view |
| 5 | Error prevention | 3 | 3 | Disabled selects look almost like enabled ones (inquiry) |
| 6 | Recognition rather than recall | 3 | 2 | Mark-only mobile header; status change hidden behind „…“ in admin rows |
| 7 | Flexibility and efficiency | 3 | 3 | Mobile search one tap away; no in-row status control |
| 8 | Aesthetic and minimalist design | 2 | 3 | One flat plane, outline walls, dead zones |
| 9 | Error recovery | 3 | 3 | — |
| 10 | Help and documentation | 3 | 2 | VIN help after the submit button on phones; no legend for admin flags |
| | **Total** | **29 / 40** | **29 / 40** | Good foundation, weak on consistency and on how it looks |

## 3. Problems, by impact

**Verdict on specificity.** The site is authored in about five places and category-interchangeable everywhere else. Authored, and to be protected: the X-ray car with its title block and stage index, Archivo Expanded caps, condensed tabular prices and mono OEM codes, the dimensioned disc drawing and the VIN locator drawing, corner ticks, the single orange on cool graphite with warm ink, the paper admin with the night sidebar. Interchangeable: category grid, search results, portal, account, cart, sign-in and every form — with the logo covered they were any dark admin kit.

| # | Sev. | Problem | Where it showed | Answer |
|---|---|---|---|---|
| 1 | P0 | **Sharp corners.** 2 px on buttons, inputs, chips, tooltips and tab segments, 4 px on cards; the styleguide stated „Svet tehničkog crteža je četvrtast“ | everywhere (130 uses of 2 px, 101 of 4 px) | §5.1 — done |
| 2 | P0 | **No depth.** Page `#0D0F11`, cards `#16191D` and a 2.14 : 1 hairline put header, cards, panels and footer on one plane; hover was a border tint | category, search, portal, account | §5.1 — done for the system; panels on pages: §7 |
| 3 | P1 | **Outline as design.** The brightest things on a category page were nine identical outlined „U korpu“ boxes; header search and „Izaberite vozilo“ added two grey rectangles to every page | category, search, portal orders, header | §5.3, §5.4 — done |
| 4 | P1 | **Nothing announces arrival.** Only copy moved; cards, images and panels were simply there. The design system forbade block entrances (§8.1 principle 5) | whole site | §5.2 — done (the rule is rewritten) |
| 5 | P1 | **Mobile chrome.** Mark-only header, search behind an icon, no vehicle state, no persistent action | every page at 390 | §5.4 — done |
| 6 | P1 | **Product page on a phone** breaks „fits, in stock, how much“: price at y ≈ 800, button at y ≈ 925 | product 390 | §7 |
| 7 | P1 | **Product card anatomy.** The render fills about a quarter of its 4 : 3 frame; the phone list card is ~270 px tall with a 104 px column around a ~50 px render | category, search, related parts | §7 |
| 8 | P1 | **Category and search on a phone.** H1, a four-line lead and „Više o kategoriji“ push the first product to y ≈ 500 | category 390, search 390 | §7 |
| 9 | P1 | **Several panel languages.** Solid card, dashed box, hairline strip and bare rows in one view; a dashed border means a prompt on product, an explainer in the portal and a dropzone on inquiry; two H1 styles | portal, cart, product, inquiry | `panel` utilities exist (§5.1); applying them: §7 |
| 10 | P2 | **Dead zones.** Product right column ends ~360 px above the left; a one-line cart on an empty page; contact is one card in 60 % void; account's right half is empty | product 1440, cart, contact, account | §7 |
| 11 | P2 | **Portal chrome.** Eight tabs plus „Odjavi se“, clipped at „Omiljen…“ without a fade | portal | §7 |
| 12 | P2 | **Admin lists.** No status control in the row, „Prikazano: 50“ without a total, row heights jump with flags, all-caps chips shout | admin orders, products | §7 |
| 13 | P3 | Skeleton geometry, centred empty state on a left-aligned page, right-aligned footer intro, orphaned last chip on phones | cart, search empty, footer, portal orders | footer done; rest §7 |

Cognitive load: more than four visible choices at the portal tab row (8 + 1), the admin sidebar (17), the admin order filter (8), the settings tabs (10), the home hero at 1440 (13 targets) and the 44-link directory on the phone home page. Single focus fails on the category page (nine equal actions), grouping on the product buy column (ten stacked items, no buy box), chunking on the inquiry form (one sheet of 12 fields).

## 4. Target, in words

Still night: a cool graphite field, warm ink, one orange. But the sheet now has thickness. Three planes can be told apart in a bright workshop — the page, a resting panel, a raised or interactive panel — because light falls from above: a hairline lit edge on every surface, and a short dark contact shadow only under what floats. No glows, no glass beyond the header and the mobile bar, no gradients on controls.

Edges are drawn and then softened: 4 px on what you tag, 6 px on what you press, 8 px on what you read, 10 px on pictures, 12–14 px on what floats. Nested corners are concentric. The only square marks left are drawings: corner ticks, rules, dimension lines.

Orange appears once per region and is always the next step or something of yours. Repeated actions are quiet filled buttons, so a grid of cards is a grid of parts and not a wall of outlines. Display caps announce places, a calm sans runs tasks, condensed numerals own prices, mono owns part numbers.

Motion is an instrument settling: copy arrives word by word, blocks rise a few pixels in sequence as their middle crosses one line near the bottom of the screen, rigid, once. Nothing a buyer needs is ever hidden for an effect. A page change is a short fade of the page area; the header and the bar do not move.

On a phone the search, the vehicle, the cart and a person to ask are always under the thumb. The admin stays paper: the same corners, a lighter entrance, work first.

## 5. What step 26 changed (the system)

### 5.1 Tokens (`app/globals.css`)

| Token | Before | Now | Use |
|---|---|---|---|
| `--radius-xs` | 2 px | **4 px** | chips, badges, tags, checkboxes, keys, inner elements (menu rows, segments, overlay buttons on thumbnails) |
| `--radius-sm` | 4 px | **6 px** | buttons, inputs, selects, comboboxes, steppers, icon buttons, tooltips, notes, thumbnails ≤ 64 px |
| `--radius-md` | 6 px | **8 px** | cards, panels, tables and their containers, alerts, toasts, popovers, menus, dropzones |
| `--radius-lg` | 10 px | **10 px** | media, drawing frames (new role; the old use moved to `2xl`) |
| `--radius-xl` | — | **12 px** | dialogs, large panels, document sheets, the e-mail panel |
| `--radius-2xl` | — | **14 px** | top corners of bottom sheets |
| `--radius-full` | 999 px | 999 px | counts, switches, radios, progress |

- Every one of the 255 sized `rounded-*` uses was re-mapped by role, not by name (105 × 2 → 6 px, 23 × 2 → 4 px, 2 × 2 → 8 px, 102 × 4 → 8 px, 1 × 4 → 6 px, 16 × 6 → 8 px, 4 × 6 → 12 px, 2 × 10 → 14 px); the 16 pills stay pills. Concentric pairs: menu 8 / rows 4 (4 px padding), segmented tabs 8 / segments 4, admin segmented filter 8 / segments 6 (2 px padding), input 6 / clear button 4.
- Focus rings follow the shape: the outline traces the border box, and a bare link or `summary` gets 4 px instead of square corners.
- E-mails: button 6 px, code box 6 px, panel 12 px (square and full-bleed on phones, where it meets the screen edge).
- Exceptions, as the owner allowed: edges that meet the viewport (full-bleed bands, the header, the mobile bar, drawers and sheets on their docked side, the admin sidebar) and hairline rules. Drawings stay square: corner ticks, dimension lines, the transparent stage poster.
- **Elevation for the night field** (D319): `--shadow-rest` (a lit top edge, warm ink at 4 %), `--shadow-raised` (lit edge + 1–2 px contact shadow + a short drop), `--shadow-overlay` and `--shadow-drawer` (deeper). Paper keeps edges for resting things and its soft shadows for floating ones.
- **Surfaces** — one panel language: `panel` (resting: surface-1, hairline, 8 px, lit edge), `panel-raised` (level 2), `panel-inset` (a well inside a panel), `card-interactive` (hover: surface step, firmer edge, raised shadow, 1 px lift; fine pointers only). 40 hand-written `rounded border border-line bg-surface-1` boxes now use `panel`.
- **Rhythm**: `--space-block` (24 → 40 px, heading block → content) and `--space-stack` (16 → 24 px) with `gap-block`, `gap-stack`, `mt-block`, `py-block`; `--space-section` unchanged.
- **Type**: the scale and the three families stay — the critique found no fault in them, only in how H1 styles were chosen. The rule is now written down (§8).
- **Motion tokens**: `--dur-rise` 520 ms (block reveal), `--dur-page` 280 ms (page transition), `REVEAL_LINE`, `BLOCK_REVEAL` (`constants/revealConfig.ts`).
- Browser autofill is themed (the field keeps its surface and ink).

### 5.2 Reveal system (D320–D323)

One engine (`components/TextRevealGlobal.tsx`), one observer, one line.

- **Copy** arrives word by word as before. **Blocks** — `data-reveal="block"`, and the direct children of `data-reveal-group` — rise 16 px (12 px on phones) with opacity over 520 ms, `sk.out`, once. Components: `Reveal`, `RevealGroup`, `RevealItem` (`components/reveal/Reveal.tsx`).
- **Trigger**: the element's vertical centre crosses the line 18 % above the bottom edge. Elements taller than 60 % of the viewport use their top on the same line. Copy moved from „top at 15 %“ to the same rule.
- **Why 18 % and not 15 %** (looked at on the category page and the reveal lab, frames in `docs/qa/screens/step-26/reveal/`): on phones the new action bar covers the bottom 60 px, so 15 % of the screen is only 67 px above what is visible — a line of copy or a 46 px row started right on top of the bar. At 18 % the line is 92 px clear of it. On desktop each step up widens the empty band under a product grid (a 454 px card stays hidden until 355 px of it are on screen at 15 %, 387 px at 18 %, 410 px at 22 %), so it goes no higher than the phones need. One constant: `REVEAL_LINE`.
- **Stagger**: blocks that cross the line in the same frame form one batch per group and start 60 ms apart in document order; the last starts at most 180 ms after the first, so a batch is over in 700 ms. A grid reveals row by row, card by card.
- **First screen**: `data-reveal-eager` (the `eager` prop) is a CSS-only entrance from a visible frame (opacity 0.4, 10 px), so the LCP element is never hidden.
- **Admin**: `data-reveal-tone="lite"` on the shell — 6 px, 320 ms, 30 ms apart; tables fade without a lift (`data-reveal-variant="fade"`).
- **Never stuck**: server HTML is visible without JS; the failsafe shows everything after 3.5 s; content above the viewport is shown at once; content on the last screen of a page, which can never reach the line, starts 48 px into view; `content-visibility: auto` sections wait until the browser draws them (before this step their copy was silently marked done and never animated — the footer, for one); items added later are picked up; focus moving into hidden content shows it.
- **Reduced motion**: nothing is hidden and nothing moves.
- Copy inside a block arrives with the block — one entrance per thing.

### 5.3 Shared components

| Component | Change |
|---|---|
| Button, IconButton | 6 px. `primary`: lit top edge, lost on press. `quiet`: now a **filled** surface (surface-3, soft edge) for repeated actions — card and row buttons — instead of a bright outline. `secondary` stays the single outline beside a primary. Loading keeps label and width |
| Input, Select, Combobox, Textarea, stepper | 6 px frame, list 8 px, inner buttons 4 px; focus ring and error unchanged (crisp 2 px, no glow); themed autofill |
| Card, product card, category tile | `panel` + `card-interactive`: surface step, firmer edge, 1 px lift, image zoom 1.03 inside its mask. The quick action (add to cart) is always visible, never hover-only |
| Product grid | a reveal group; the first four cards of a first-screen grid are eager |
| Badge, stock badge, chips | 4 px |
| Tabs | segmented: 8 px track, 4 px segments; underline tabs unchanged |
| Dialog 12 px · Sheet 14 px top corners · Menu and popovers 8 px · Tooltip 6 px · Toast 8 px | all with the night overlay shadow; toasts sit above the mobile bar |
| Skeleton | 6 px |
| Pagination, breadcrumbs, price block, empty state | new radii on hit areas; structure unchanged (price and stock stay live values, never revealed) |
| Data table (admin) | `panel`, fades in as one block |

### 5.4 Shell

- **Header** (D324): sticky; at the top of a page it is taller, has no surface and the logo is 8 % larger; over the first 96 px of scroll it condenses to 64 px (56 px below 1024) and takes its surface — the field at 84 % with a 14 px blur and a hairline. A CSS scroll timeline drives it: no script, no layout change. **Search is the primary action**: the widest control, a filled field at every width (it was an icon on phones). The vehicle chip is a filled field-like chip; chosen, it is orange-tinted (yours). On a page that opens with its own search field (home, search, 404) the header field steps back until the page scrolls.
- **Mobile action bar** (D325, `components/shell/BottomActionBar.tsx`): Pretraga · Vozilo · Korpa · Kontakt, docked below 1024 px on every storefront page without a bottom bar of its own (product, cart, checkout and the portal keep theirs). Server-rendered, and its height (`--bottom-bar-h`) is declared at the very start of the document (`BottomBarSpace`), so the space is known before anything is laid out: the hero frame, toasts, the consent banner and the offline notice sit above it. A chosen vehicle and a filled cart are orange. „Kontakt“ opens a sheet with one-tap rows for every channel in settings, then the inquiry; with no channels it is a link to the inquiry. It replaces the scroll-up contact bar.
- **Mobile menu**: rows are soft press targets; the divider belongs to the row.
- **Footer**: the intro is left-aligned under the logo; the columns are a reveal group.
- **Page transition** (D326, `components/shell/PageTransition.tsx`): on a link navigation the page area fades in with a 6 px rise in 280 ms (View Transitions API; nothing elsewhere). Header, bar and banner are separate groups and do not move. Filters, sorting and back/forward do not animate.

## 6. Components: done and open

| Component | State | Open for step 27 |
|---|---|---|
| Buttons | done | replace hand-written button classes (about 20 places in the admin import and settings screens) with `Button` |
| Inputs, selects, comboboxes | done | disabled selects need a clearly different fill (inquiry); admin inline inputs (`h-9 … border-control`) should use `Input` |
| Cards | system done | product card anatomy (§7.2) |
| Chips and badges | done | admin chips to sentence case; one pattern for status filters (track, as in the admin) |
| Tabs | done | portal: four tabs + „Još“, edge fade |
| Dialogs, sheets, menus, tooltips, toasts | done | — |
| Skeletons | radius done | geometry must mirror the final layout (cart) |
| Pagination, breadcrumbs | done | — |
| Price block | unchanged by design | „sa PDV-om“ once per grid header instead of on every card (to decide) |
| Empty states | unchanged | left-align on left-aligned pages; a part glyph instead of the magnifier; echo the query in mono |
| Header, mobile bar, footer, page transition | done | — |

## 7. Templates: the work list for step 27, by impact

1. **Product (`/deo/[slug]`)** — phone: price, stock and the add-to-cart row above the codes; cap the image height; the buy bar visible until the inline button is on screen. Desktop: a real buy box (`panel-raised`: price, stock, stepper, primary, inquiry), sticky, which also removes the dead column. Gallery and drawing frames 10 px. Reveal: gallery and buy box eager, everything below as blocks and groups.
2. **Product card and the grids that use it** — render at about 70 % of its frame; phone list card with an 88 px thumbnail, about 170 px tall, price and action on one row; two name lines reserved so rows align. Every grid of category tiles, car models and brands becomes a `RevealGroup`.
3. **Category and search** — phone: clamp the lead to two lines, one sticky toolbar under the header (vehicle chip, Filteri, sort), first product by y ≈ 300. Desktop: stronger filter group titles, SEO link clouds as chips, no orphaned last card. Search: the button merged into the field on phones; the empty state left-aligned.
4. **Home** — the phone first screen shows at least 40 % of the car; the 44-link directory becomes system rows with a render and a count; sections get heading blocks and reveal groups; brands and „za majstore“ band as blocks.
5. **Cart and checkout** — cart lines in one `panel`, no duplicate subtotal on phones, a skeleton with the real geometry; checkout: full-width primary on phones, form groups as blocks.
6. **VIN inquiry** — three panels (Vozilo, Šta vam treba, Kontakt), the VIN help beside the field on phones, form groups as blocks.
7. **Mechanic portal and account** — one panel language, the format explainer behind „Kako se upisuje“, real hierarchy in the level / rabat / credit strip, four tabs + „Još“; account as a two-column dashboard or capped at about 960 px; „Odjavi se“ moves to the profile.
8. **Admin** — dashboard: graded waiting-time severity, KPI cells linked to their filtered lists; lists: in-row status control, „50 od 209“, fixed row height with inline flags, labelled icon buttons; detail pages: `Section panel` already reveals in the lite tone.
9. **Hollow pages** — contact, single-line cart, account: cap widths and compose two columns; hide blocks that depend on empty settings rather than leaving one card.
10. **Legal and static pages** — nothing but the new tokens; long copy already fades as a block.

## 8. How to apply the system (rules for step 27)

- **Radius by role, never by taste**: tag 4 · press 6 · read 8 · picture 10 · float 12 · sheet 14. A new box gets `panel`, not three utilities.
- **One outline per region.** Repeated actions are `quiet`; the one alternative beside a primary is `secondary`.
- **H1 rule**: display caps (`type-display-l`) for places — catalog, category, vehicle hubs, landings, inquiry; sans (`type-h1`) for tasks and records — product name, cart, checkout, search results, portal, account.
- **Dashed borders** only for dropzones.
- **Reveal**:
  - copy needs nothing;
  - a card, image, CTA block or form group gets `<Reveal>`; a grid or list gets `<RevealGroup>` (its direct children are the items);
  - everything on the first screen at 390 **and** 1440 is `eager` (or, for copy, `RevealText`) — check with the test in §10;
  - never nest block targets, never put them on chrome (header, dialogs, menus, toasts) or on an element GSAP transforms;
  - live values (price, stock, counters) stay `data-reveal="off"` when they stand alone; inside a block they arrive with it.
- **Bottom bars**: a page that adds its own bottom bar must be listed in `OWN_BOTTOM_BAR` (`lib/shell/bottomBar.ts`) and register with `useBottomInset`; anything else fixed to the bottom uses `bottom-bar-offset`.
- **Page with its own search field**: its form carries `data-own-search` (the hero variant of `SearchBox` does).

## 9. Performance: measured, fixed, open

Lighthouse, mobile, applied throttling (`tests/lighthouse/run.mjs --throttling devtools`), production build. Another project's pipeline was running on the same PC during this step, so runs are noisier than in step 25 (benchmarkIndex 2350–3770 against 3975 then).

| Run | Home | Category | Product (no action bar) | Note |
|---|---|---|---|---|
| Step 25 (reference, quiet machine, 3 runs) | perf 95 | perf 95–96 | perf 96–97 · TBT 75 ms | from `docs/PROGRESS.md` |
| First build of this step, 3 runs | perf 90 · TBT 280 ms · LCP 2383 ms | perf 91 · TBT 294 ms · LCP 1963 ms | perf 96 · TBT 103 ms · LCP 2155 ms | product unchanged, home and category 4–5 points lower |
| After the two fixes below, 5 runs, machine under heavy load | perf 75 · TBT 809 ms | perf 86 · TBT 472 ms | perf 91 · TBT 252 ms (runs 58–430 ms) | the control page swung by a factor of seven inside one series: **not a usable measurement** |

Accessibility, best practices and SEO were 100 on all three pages in every run; CLS 0.000–0.001; first-load JS 303 / 295 / 284 KB (298 / 290 / 280 KB in step 25: +5 KB for the action bar and the search store).

What the trace of the first build showed (category page): after first paint the whole document (685 elements) was restyled five times, 50–130 ms each. Two of those passes were new in this step and are removed:

1. `--bottom-bar-h` was derived with `:root:has([data-bottom-bar])` while the bar is the last element of the document — replaced by a one-rule `<style>` at the very start of the shop layout (`BottomBarSpace`, D328).
2. `useBottomInset` published `--bottom-inset` on `<html>` when the action bar registered at hydration — an inherited custom property nothing read (D329). The trace after the fix shows no full-document pass after hydration.

The other passes are older than this step: two when the stylesheets and fonts arrive, and one each when the reveal failsafe class is added and the boot class removed — on a throttled phone hydration finishes after the 3.5 s failsafe (PERF-06).

**Open for step 27 (first thing, on an idle machine):** re-run the Lighthouse gate on home, category and product. Budgets: TBT ≤ 200 ms home, ≤ 150 ms catalog. If home or category is still over, the next candidates are, in this order: the two failsafe passes (set the failsafe from a `performance.now()` check when the engine mounts instead of a class toggle before it), then the cost of one full pass (the copy boot rule with `:has()`).

## 10. How to check

```
node scripts/qa/ui-boost/corners.mjs [--only=home,admin] [--check]   # no visible box with 90° corners; radius values in use
node scripts/qa/ui-boost/shots.mjs <outDir> [--fold] [--only=…]      # 390 + 1440, after scrolling; reveal contract per page
MSYS_NO_PATHCONV=1 node scripts/qa/ui-boost/reveal-frames.mjs /delovi/kocioni-diskovi [--line=0.15]   # where reveals start
npx playwright test tests/e2e/reveal.spec.ts                          # the reveal rule (16 tests on two viewports)
```

Page set, viewports and sign-ins are in `scripts/qa/ui-boost/kit.mjs`. Screenshots: `docs/qa/screens/step-26/before/` and `after/`; the reveal lab is `/styleguide/otkrivanje`.
