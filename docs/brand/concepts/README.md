# Logo concepts — Euromotors Plus by OEM Parts

> Step 24 (2026-10-11). Seven directions explored against [../BRAND-BRIEF.md](../BRAND-BRIEF.md). Built by `node scripts/brand/logo/concepts.mjs`. The chosen logo is **not** in this folder: it lives in `../export/` and `public/brand/` (see [../LOGO.md](../LOGO.md)). This folder is the record of the alternatives, for showing the client what else was on the table.

## Files

| Per concept `<id>-<slug>` | What |
|---|---|
| `<id>-<slug>-primary-{night,paper}.svg` | Primary lockup, for dark and for white grounds (paths only, no live text). |
| `<id>-<slug>-mark-{night,paper}.svg` | Compact mark on a 240-unit square. |
| `renders/<id>-<slug>-primary-{night,paper}.png` | Lockup at 1200 px. |
| `renders/<id>-<slug>-mark-{night,paper}-{16,32,64,256}.png` | Mark at the four sizes (plain downsampling, no pixel hinting — an honest test of the raw shape). |
| `renders/<id>-<slug>-…-mono-{white,black}….png` | One-colour proofs. |
| `sheets/<id>-<slug>.png` | Contact sheet composed from those PNG files: lockup · mark at 256/64/32/16 and the 32/16 px files enlarged without smoothing · one-colour proofs; dark ground left, white right. |

`critique.html` is the page the design critique ran on (three finalists, self-contained). `studies/` holds the refinement tests made after the critique.

## The seven directions

| # | Name | Idea in one line | Primary lockup | Compact mark |
|---|---|---|---|---|
| K1 | **Orbita** | The partial ring of stars from the current logo, redrawn: every star is a plus, sized on one curve, the largest in orange. | Crescent of pluses around EUROMOTORS / PLUS + rule / by OEM Parts. | Crescent of seven pluses. |
| K2 | **E-plus** | A monogram: the E of Euromotors is a bracket, its middle arm is the orange plus — a part seated in its housing. | Mark + EUROMOTORS PLUS, rule, signature right-aligned. | Bracket-E with the plus. |
| K3 | **Kurziv** | Wordmark only, in the voice of the OEM Parts logo: solid bold italic, hairline, outlined „Parts“. | EUROMOTORS PLUS in wide italic, rule overshooting left, signature. | Solid E + outlined P over a rule. |
| K4 | **Vijak** | A part silhouette: a bolt head from above with the twelve-point triple-square drive used all over VAG cars. | Bolt head + EUROMOTORS PLUS / signature. | Ring + twelve-point star. |
| K5 | **Pečat** | A seal: the redrawn OEM Parts logo in the centre, Euromotors Plus around it. | The seal. | Ring + EM + plus. |
| K6 | **Etiketa** | The logo as a part label and a drawing title block: frame, cells, the plus in an orange tag, a ruler. | The label. | Orange tag with a cut corner and a knocked-out plus. |
| K7 | **Izvučen plus** | The name ends in a sign: EUROMOTORS followed by a plus whose upper arm is lifted out in orange. | EUROMOTORS + sign, rule, signature. | The plus with the lifted arm. |

## Scores against the brief (1–5, weights from brief §6, maximum 70)

Scored on the renders in `sheets/` before any refinement.

| Concept | 16 px ×3 | One colour ×2 | Distinct ×2 | Rendgen ×2 | Memorable ×2 | Both names ×3 | **Total** | Main reason |
|---|---|---|---|---|---|---|---|---|
| K1 Orbita | 1 | 4 | 3 | 3 | 3 | 4 | **41** | Closest to the client's current logo, but the crescent is a smudge at 16–32 px and a ring of repeated marks still recalls both the EU emblem and a loading spinner. |
| **K2 E-plus** | 5 | 5 | 4 | 5 | 4 | 4 | **63** | One solid shape that survives 16 px and one colour; says „E“ and „Plus“; leaves the full name spelled out. Weakness: a cross in a frame can read as first aid. |
| K3 Kurziv | 2 | 4 | 2 | 2 | 3 | 4 | **40** | Recognisably OEM Parts, but all-italic wide type is the racing cliché the design system rejected; the outlined P dies at 16 px. |
| K4 Vijak | 3 | 4 | 3 | 4 | 4 | 2 | **45** | A handsome object with an insider reference, but a ring with a centre is too close to a car badge, the star is lost at 16 px, and the mark says neither name. |
| K5 Pečat | 1 | 5 | 3 | 2 | 3 | 5 | **44** | Carries both names best, but a seal suggests certification („official“), cannot live in a 28 px header and makes OEM the dominant name. |
| K6 Etiketa | 5 | 3 | 2 | 5 | 3 | 4 | **53** | The best fit with the interface — and that is the problem: the tag with a plus is the „new document“ / „add“ icon, and a large orange fill spends the signal colour on decoration. |
| K7 Izvučen plus | 4 | 3 | 4 | 5 | 4 | 3 | **53** | The most authored idea (a part lifted out, in the colour that means „yours“), but „PLUS“ is no longer written, and the lifted block over a bar reads as a figure icon or a „T“ with a dot. |

Finalists for the critique: **K2, K6, K7**.

## Critique and selection

The three finalists went through an impeccable critique (two isolated assessments: a design review and measured evidence). Full record: [CRITIQUE.md](CRITIQUE.md).

The independent reviewer scored the finalists lower than the table above but ranked them the same way: **K2 49 · K7 44 · K6 36**, verdict „take K2's structure forward“.

**Chosen: K2 E-plus**, refined into the finished logo with these changes (each traced to a finding):

| Finding | Change in the finished logo |
|---|---|
| The fat, centred cross in a frame reads as first aid or an „add“ control. | The bars are drawn at the weight of the letters' arms (bar ÷ span 0.26, was 0.35), the plus sits against the spine (1 unit) instead of floating in the middle, and the bracket is drawn at the letters' stem weight, so it reads as a letter E, not as a box. |
| Five unrelated stroke weights. | Three, all taken from the letters of EUROMOTORS: stem, arm, and a hairline of one fifth of the stem (rule, divider, outline of „Parts“). |
| „OEM Parts“ nearly disappears; the outline of „Parts“ is too thin. | The second line is 56 % of the cap height (was 50 %), the outline is the hairline (26 % heavier), and a new **dual lockup** shows the OEM Parts logo at full height for the sign and the van. Lockups with the signature have a minimum height of 56 px; below it the header lockup (no signature) is used. |
| The one-line name is 19.5 times longer than tall. | Two-line wordmark (EUROMOTORS over PLUS — rule — signature): the whole logo is 8 : 1; stacked and mark-only versions for narrow places. |
| Three type voices. | Two: Archivo for the company, Saira italic for the whole signature including „by“. |
| 16 px renders were only downsampled. | Hand-set pixel grids for 16, 32 and 48 px; `scripts/brand/logo/verify.mjs` checks that no pixel inside the mark is blended. |

Tested and **not** adopted: replacing the plus with the E's own middle arm, pulled out in orange (the reviewer's proposal, `studies/pulled-arm-vs-plus.png`). It removes the cross, but an orange bar beside the word PLUS reads as a minus sign.

Borrowed from the runners-up: from **K7** the idea that the orange piece is a *part* that belongs in a housing (the plus is a separate piece seated in the bracket, never joined to it); from **K5** the redrawn OEM Parts logo, kept as its own file for places where only the shop name appears; from **K6** the title-block discipline — one hairline weight, everything on one grid.

## Runners-up, for the client

1. **K7 Izvučen plus** — `sheets/k7-izvucen-plus.png`. The bolder option: shorter (the sign replaces the word), closest to the site's exploded-view idea. Would need the lifted arm redrawn and a test that people read the sign as „plus“.
2. **K6 Etiketa** — `sheets/k6-etiketa.png`. Works well as a secondary device: a label for boxes, document tables and price tags, in ink rather than orange.
3. **K5 Pečat** — `sheets/k5-pecat.png`. Not a logo for the site, but a good stamp or sticker for packaging.
