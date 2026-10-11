# Critique of the three finalists (impeccable `critique`)

Method: dual-agent (A: isolated design review of the contact sheets and the brief · B: isolated detector and measured evidence). Neither saw the other's output or the author's scores. Target: `docs/brand/concepts/critique.html` (K2 E-plus, K6 Etiketa, K7 Izvučen plus). Date: 2026-10-11, step 24.

The playbook is written for interfaces; a logo has no states, flows or error handling. Heuristics that cannot apply are marked n/a and the total is renormalised, as the playbook allows.

## Design health score — K2 E-plus as rendered in the concept stage

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | n/a | A logo has no states. |
| 2 | Match between system and the real world | 2 | A bold cross centred in a frame is read as first aid, a pharmacy or an „add“ control before it is read as „E plus“. |
| 3 | User control and freedom | n/a | — |
| 4 | Consistency and standards | 2 | Five unrelated stroke weights in one lockup (bracket, plus, letters, rule, outline); 16 px files were downsampled, not pixel-set. |
| 5 | Error prevention | n/a | — |
| 6 | Recognition rather than recall | 2 | The name people know, OEM Parts, is half the cap height with a hair-thin outline: at header size only „by OEM“ survives. |
| 7 | Flexibility and efficiency | n/a | Scored on the system instead (see priority issue 4). |
| 8 | Aesthetic and minimalist design | 3 | One mark, one accent, nothing decorative; the long single-line name is the weak spot. |
| 9 | Error recovery | n/a | — |
| 10 | Help and documentation | n/a | — |
| **Total** | | **9/16** | Fair — the right structure, not yet a finished logo. |

Weighted scores on the brief's own criteria (maximum 70): reviewer **K2 49 · K7 44 · K6 36**; author's pre-critique scores K2 63 · K7 53 · K6 53. Same ranking, the reviewer stricter on distinctiveness and on how clearly both names are carried.

## Design specificity verdict

**Reviewer (A):** none of the three was ready. K2 could be used unchanged by any „E… Plus“ company; K6 is a user-interface component, not a logo; K7 has the only authored idea (a part pulled out of an assembly, in the colour that means „yours“) but that idea belongs to the site more than to the client, and it withholds the word „Plus“. All three marks are built from „Plus“, the least ownable word in the name, and none carries anything of the OEM Parts lettering. Recommendation: take K2's structure, move K7's gesture into its mark, retire K6 as a logo.

**Deterministic scan (B):** the detector ran in its regex fallback (its HTML parser modules are not installed with the skill), so its result is an undercount: one advisory finding, `em-dash-overuse` (32, of which 30 sit in SVG `<title>` names) — a false positive for this target. Measured on the page and the PNG renders:

| | K2 E-plus | K6 Etiketa | K7 Izvučen plus |
|---|---|---|---|
| Ink coverage at 16 px | 50.8 % | 67.6 % | 39.8 % |
| Separate shapes at 16 px (resvg / Chromium) | 1 / 2 | 1 / 1 | 1 / 1 |
| Gap between ink and accent at 16 px | 0.93 px | — | 0.93 px |
| Shapes in two colours → one colour (256 / 128 px) | 2 → 2 | 1 → 1 | 2 → 2 |
| Mark SVG | 423 B, 2 paths | 448 B, 1 path | 357 B, 2 paths |

No shape boundary in any concept exists only as a colour difference, so nothing merges in one colour. At 16 px the 14-unit gap of K2 and K7 falls on a fraction of a pixel: whether the plus stays separate depends on the renderer — it has to be set on the pixel grid by hand. Page checks: no console messages, no request besides the document, no horizontal scroll at 1440 and 390 px, the SVGs contain only `title` and `path`. Contrast: ink on night 16.32 : 1, accent on night 6.74 : 1, ink on white 18.32 : 1, accent on white 2.85 : 1, accent against night ink 2.42 : 1.

## Overall impression

K2 has the right skeleton — a sign on the left that opens towards a fully spelled name, and a signature that redraws the shop's logo — but the concept render was still a sketch: a cross that says „medical“, strokes that do not belong to one family, and a signature too small to do its job. The biggest opportunity is the signature: solid „OEM“ beside outlined „Parts“ is already the site's own idea (a body and its X-ray outline) and deserves more room.

## What is working

- **K2 is the best small-size shape**: 12 × 14 px of mass at 16 px, still an E when the plus fuses with the spine.
- **K2 is the only one the client can read as his logo evolved**: one sign left of the name, open towards it, the name spelled in full, „OEM Parts“ signing it.
- **The redrawn signature** keeps the character of the known logo (wide heavy italic, hairline, outlined „Parts“) in every concept.

## Priority issues (K2) and what was done

1. **[P1] The cross in a frame reads as first aid / „add“.** It hurts trust (a parts shop that looks like a pharmacy) and collides with the site's own orange actions. *Fix applied:* bars at the letters' arm weight (bar ÷ span 0.26, was 0.35), plus seated against the spine instead of centred, bracket at the letters' stem weight so it is a letter and not a box. The reviewer's alternative — the E's own middle arm pulled out in orange — was drawn and rejected: beside the word PLUS an orange bar reads as a minus (`studies/pulled-arm-vs-plus.png`).
2. **[P1] „OEM Parts“ vanishes.** The mechanic who knows the shop by that name does not find it. *Fix applied:* second line at 56 % of the cap height, outline of „Parts“ = the hairline (never thinner than the rule), minimum height 56 px for any lockup with the signature, the **dual lockup** (both names at the same height) for the sign and the van, and the redrawn OEM Parts logo as its own file.
3. **[P2] Five stroke weights.** The brief asks for one stroke logic. *Fix applied:* three weights, all from the letters — stem (bracket spine), arm (bracket arms, plus), one fifth of the stem (rule, divider, outline). Checked by `scripts/brand/logo/verify.mjs`.
4. **[P2] Length and stutter.** The one-line name was 19.5 : 1 and 266 px wide at 28 px; „E EUROMOTORS“ doubles the E. *Fix applied:* two-line wordmark (whole logo 8 : 1), a wider gap between mark and name (5 units), stacked and mark-only versions for phones.
5. **[P2] 16 px files were downsampled.** *Fix applied:* separate pixel grids for 16, 32 and 48 px; the check finds 0 blended pixels inside the mark.
6. **[P3] „by“ says OEM Parts made Euromotors Plus.** Kept, because the owner asked for the name to read „Euromotors Plus by OEM Parts“; it is now set in the signature's own face (two type voices instead of three), the dual lockup avoids the word, and the wording is listed for the client to confirm in `docs/HUMAN-TODO.md`.

## Persona red flags

- **Mechanic, 55, sees the van:** in the concept he read „EUROMOTORS“, a name he does not know, and found OEM Parts small and thin at the bottom right. → The van and the sign use the dual lockup, where the OEM Parts logo stands at full height in its known arrangement.
- **Car owner, sees only the favicon:** an anonymous „E“ in a tab when he searched for „OEM Parts“. → Accepted: the tab title carries the name; the favicon has to be one solid, recognisable shape, and the E with the orange plus is that.
- **The client:** the ring, the navy and the serif are gone, and „Parts“ was the smallest thing on the sheet. → The brand board shows what was kept from each of his logos (the open sign left of the name, „PLUS“ with its rule, the OEM Parts grammar) and gives „Parts“ a larger, firmer outline.

## Minor observations

- The hairline in the concept belonged to nothing for most of its length; in the finished lockup it runs from PLUS to the signature and stops there (the „PLUS between two rules“ of the current logo and the OEM Parts hairline become one line).
- The letters of the outlined „Parts“ touched; they now stand at one constant distance, so the outlines never merge at small sizes.
- Spacing of EUROMOTORS: T was loose on both sides. Pair corrections bring every pair within ±1.0 % of the cap height of the mean.

## Questions to consider (from the reviewer, for the owner and the client)

1. On the shop's own van and sign, should OEM Parts lead and Euromotors Plus follow? The dual lockup gives both the same height; a version led by OEM Parts is a small step from there.
2. Solid „OEM“ beside outlined „Parts“ is a body and its X-ray. Should that pair, rather than the plus, become the sign of the brand over time?
3. Is „by“ the right word, or would „Euromotors Plus · OEM Parts“ describe the relationship more truthfully?

Questions skipped: unattended pipeline run (no one to ask). The answers chosen are recorded in `docs/DECISIONS.md` D301–D306 and the open points in `docs/HUMAN-TODO.md`.
