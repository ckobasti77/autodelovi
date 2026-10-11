---
target: storefront, mechanic portal and admin (step 26, before the UI boost)
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 7
timestamp: 2026-10-11T17-53-15Z
slug: app-shop-layout-tsx
---
Method: dual-agent (A: isolated design review; B: isolated detector run — its measured browser part was discarded, see section 1)

## 1. How the critique was run

`impeccable critique`, two assessments that did not see each other, on screenshots of the state before this step.

| | What | Evidence |
|---|---|---|
| Screens | 23 pages × 390 and 1440 px, first screen and full page (46 + 46 files): home, category, parts, product, search and empty search, cart, checkout, VIN inquiry, `/za-majstore`, vehicles, contact, sign-in, styleguide, mechanic portal (3), account (2), admin dashboard, orders, products, settings | `docs/qa/screens/step-26/before/` |
| Assessment A — design review | An isolated reviewer looked at every first screen and at the full pages of 13 templates at both widths, read the token file and the shared components, and scored the storefront + portal and the admin separately | summarised in §2–§4 |
| Assessment B — detector | `node .claude/skills/impeccable/scripts/detect.mjs --json` over `components/ui`, `components/shell`, catalog/product/cart/checkout/home, mechanic/account/admin and `app/` | 2 advisory findings, both justified: `components/ui/Tabs.tsx:78` uses `#000` as the opaque stop of a CSS mask (a mask has no colour), `components/admin/print/OrderPrint.tsx:62` uses the fixed 24 px print ramp of DESIGN-SYSTEM §4.3 |
| Assessment B — measured browser evidence | **Not usable.** The reviewer's measuring run overlapped with the first token changes (several pages answered 500 while files were being rewritten) and the pipeline restarted before it reported. Its numbers were discarded | replaced by the audits of §9, run on the finished code |

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
