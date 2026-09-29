# SKLOP — Concept critique log (`/lab/koncept`)

> Part of the design docs: [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) · [design-dna.json](design-dna.json). Method: impeccable `critique` (two isolated assessments: A = design review, B = detector + browser evidence), design-taste-frontend rules, craft floor. Captures: `docs/design/screens/round-N/`. Viewports: 1440×900 (DPR 1) and 390×844 (DPR 2) in every round; 360, 768, 1024, 1280, 1366, 2560 where noted.
> Unattended pipeline: no human answered; findings were acted on by the build step itself and re-verified by a fresh reviewer.

---

## Round 1 — first build (2026-09-29)

**Method: dual-agent (A: design-review sub-agent · B: detector + Playwright evidence sub-agent), synthesised with my own review.**
Captures: `screens/round-1/koncept-1440.png`, `koncept-390.png`, `koncept-full-*.png`, reviewer extras `agent-a-*.png`, `agent-b-*.png` (raw data `agent-b-evidence.json`).

### Design health score (Assessment A, Nielsen)
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | No selected-vehicle context; no stage indicator on phones |
| 2 | Match system / real world | 3 | Fluent mechanic language |
| 3 | User control and freedom | 3 | Callout cannot be deselected |
| 4 | Consistency and standards | 3 | One outline style for three priorities; orange = both selection and „Nova" |
| 5 | Error prevention | 2 | Cards showed no fitment |
| 6 | Recognition rather than recall | 2 | Icon-only mobile buttons, hidden quality label |
| 7 | Flexibility and efficiency | 2 | No quantity / reorder paths |
| 8 | Aesthetic and minimalist design | 3 | Restrained, but the hero carried 6 actions + 8 stages + a title block |
| 9 | Error recovery | 2 | Out of stock only offered „Javi mi" |
| 10 | Help and documentation | 2 | No phone/Viber entry point |
| **Total** | | **24/40 (Acceptable)** | 20/32 with 7 and 10 as n/a |

### Design specificity verdict
- **A:** authored for this product in ornament and content (true-scale side view with real 4280/2620/1450 mm, centre-mark logo, stage index, OEM numbers, mechanic voice) but the page skeleton was generic (split hero, 4-up grid, table); the car filled only ≈ ⅕ of the hero.
- **B (deterministic):** `detect.mjs --json` on page/XrayCar/Art/CSS → `[]` (clean). Injected browser detector: 9 findings at 1440 / 8 at 390 — true: undersized UI text (10–10.5 px tags), **hairline border + 32 px shadow on the callout** (generated-UI signature), assembled-SVG illustration (declared placeholder); false positives: text occlusion at glyph level, cramped padding on a 48 px button and on the table wrapper, `gradient-text` from Tailwind's unused `.bg-clip-text`.

### What was working
1. The first viewport said what the product is: an uppercase technical statement, the search field as the CTA, a car you can see into.
2. Ornament that measures (true dimensions, oblique ticks, leader line), expanded caps + Public Sans + mono only for data, status as icon + word, tabular numerals, themed selection/caret, visible 2 px focus ring (5.3–6.7:1).
3. Voice: „razmaci, tačke i crtice ne smetaju", „Čeka deo", „Za slanje".

### Priority issues (synthesis of A, B and my own pass)
| # | Sev. | Issue | Evidence | Fix applied in round 2 |
|---|---|---|---|---|
| 1 | P1 | Hero copy overlapped the drawing (copy cols 1–5, stage 4/−1) | Search covered the car's nose by 117 px at 1440; at 1024–1280 „Pretraži" 4 px from the selected disc; the transparent `h1` layer swallowed clicks on the callout link (B hit-test) | Separate columns (copy 1–5, stage 6–12 with right bleed), stage bottom-aligned; callout moved to an annotation lane above the roof |
| 2 | P1 | Card did not answer „fits my car?"; mechanic price without PDV qualifier; „sa PDV" (grammar) | A | Fitment line (✓ „Odgovara za Golf VII · 2.0 TDI" / ? „Proverite oznaku motora"); „sa PDV-om" under every price incl. „Vaša cena" |
| 3 | P1 | Mobile card buttons lost their names (`display:none` label); quality hidden; backorder = in-stock icon | A accessibility snapshot | Full-width labelled 44 px buttons on mobile, accessible name includes the product, „Brembo · OEM kvalitet" next to the maker |
| 4 | P1 | Admin table overflowed at 1366–1440 | Table 1 222 px in a 1 076 px area; chips cut mid-word; „Izvor" hidden (B) | Merged „Plaćanje · dostava", compact dates „29.09. 11:42", „Za preuzimanje", order number 400 weight with a dimmed `SK-2026-` prefix, row-actions button |
| 5 | P2 | Phones had no stage state; dimension labels overlapped; callout touched the VIN link | `.stageCompact{display:none}` declared after the media query (source order); 2.620/4.280 overlap 45×3 px (B) | Base rule moved before media queries; wheelbase dimension hidden < 640 px; callout lane |
| 6 | P2 | Orange diluted (≈ 9 orange elements, orange logo); admin selected row and „Nova" chip shared `#FFEADD` | A | Mark = ink with an orange centre point; callout action ink-1 with accent underline; neutral `selected #EEF1F4` token for rows |
| 7 | P2 | Dead ends, no trust entry | Out of stock → only „Javi mi"; no phone/Viber | „Obavesti me" + „Zamena na stanju: 2 →"; header „Pozovite" / „Viber" (numbers from settings, hidden while empty) |
| 8 | P2 | Ornament without purpose | Stage strip not clickable; numeric coordinates read as HUD; „Sistema 10" vs 7 stages; 10 px keys at 3.41:1; honesty note aria-hidden and hidden < 1280 | Stage items became buttons; coordinates replaced by a mechanic note („Pre zamene proverite broj na kućištu turbine."); title block „Faza 00 / 07"; keys 11 px `ink-3`; note visible under the drawing on narrow screens and exposed to AT (`<dl>`) |
| 9 | P2 | Evidence items | Callout 1 px + 32 px shadow; sidebar focus ring 3.61:1; `→` rendered in Arial (Public Sans has no arrows); native search clear unthemed; no `scroll-padding-top`; dimensions formatted like prices („4.280") | Callout: edge only; sidebar ring = night accent; `ArrowRight` icon; cancel button hidden; `scroll-padding-top: 80px`; ungrouped mm values |
| 10 | P3 | Fonts | Expanded 600 preloaded with 700 | Split: 600 `preload: false` |

### Persona red flags (A)
- **Mechanic, phone, bright workshop:** card surfaces (1.09:1) and borders (1.48:1) vanish in glare → mobile list cards use `line-strong` borders; content contrast stays ≥ 4.5:1.
- **Retail driver from an ad:** his real path (vehicle) looked like „Rasklopi" → vehicle became a field-like control with its own label.
- **Staff at a counter PC:** status clipped at 1366, „Nova" invisible on a selected row, number outweighing the customer → fixed as above.

### Spec changes triggered
DESIGN-SYSTEM §2.2 (mark colours), §3.3 (`selected`), §3.5 rules 6–8, §3.7 („sa PDV-om"), §4.4 (dash, ungrouped measurements), §5.5 (commit to one: edge or elevation), §5.7 (ruler without numbers, plain-language positions, callout anatomy, title block, stage buttons), §6.1 (no descendant `svg` sizing), §9.4, §9.7, §9.15, §10.1, §11.

---

## Round 2 — after the first fix batch (2026-09-29)

**Method: single-context review of fresh captures** (`screens/round-2/koncept-{1440,390,1280,1024}.png`, `koncept-full-*.png`) against the round-1 list and the craft floor. (The reviewers of round 1 were not reused, so this pass is mine; round 3 goes back to a fresh reviewer.)

Resolved: hero columns no longer overlap at any width; cards show fitment, alternatives and „sa PDV-om"; mobile buttons are labelled; the admin table fits 1440 with every column; the „Nova" chip is distinct from the selected row; the stage strip is interactive; the callout is edge-only.

New or remaining issues:
| # | Sev. | Issue | Evidence | Fix (round 3) |
|---|---|---|---|---|
| 1 | P0 | The callout's `ArrowRight` rendered at full drawing size over the callout | `.drawing svg { position:absolute; inset:0; width:100% }` matched the icon nested in the callout (visible in `koncept-1440.png`, `koncept-390.png`) | Rule scoped to `.drawing > svg`; spec §6.1 rule added |
| 2 | P1 | On phones the car appeared only after search, vehicle field and VIN link (≈ 740 px down) | `koncept-390.png` | Grid areas: copy (statement + search) → stage → aside (vehicle + VIN link) → strip below 1024 px |
| 3 | P1 | At 1024 the stacked layout pushed the car below the fold | `koncept-1024.png` | Two-column hero from 1024 px (columns no longer overlap, so it fits) |
| 4 | P2 | Ruler numbers collided with the wheelbase value („2000 2620") | `koncept-1440.png` | Ruler numbers removed; dimension lines carry the values |
| 5 | P2 | Em dash started a line („— po OEM broju") | 1440 and 390 | No-break space before the dash |
| 6 | P2 | Vehicle name truncated on phones and at 1024 („VW Golf VII 2.0 TDI (…") | `koncept-390.png` | „Promeni" text visually hidden below 1280 px (caret stays, AT keeps the word) |
| 7 | P2 | At 2560 header and hero stretched edge to edge | `koncept-2560.png` (first capture) | `--pad: max(var(--margin), calc((100% - 1440px) / 2))` on header, hero, sections |
| 8 | P3 | Footer note line length ≈ 88 characters | browser detector `line-length` | `max-width: 60ch` |

Detector after round 2 fixes: static `detect.mjs --json` → `[]`; browser detector 3 findings per viewport, all false positives or accepted: `cramped-padding` on the table wrapper (tables are edge-to-edge by design), `gradient-text` (Tailwind's unused `.bg-clip-text` in the global CSS), `clipped-overflow-container` on the admin frame (the visually-hidden search label), `shape-assembled-illustration` (the declared SVG placeholder for the 3D).

---

## Round 3 — verdict pass (fresh reviewer)

@@ROUND3@@
