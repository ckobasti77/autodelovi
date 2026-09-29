### Own review (design-taste-frontend + impeccable craft floor), before reading the reviewers

Captures: `screens/round-1/koncept-1440.png`, `koncept-390.png`, `koncept-full-1440.png`, `koncept-full-390.png`.

Working:
- The first viewport says what this is in one glance: an uppercase technical statement, a search field as the CTA and a car you can see into. It could not be mistaken for another parts shop.
- The orange discipline holds: search button, selected disc, callout action, active stage, cart count, „Vaša cena", admin selection — all "yours or next".
- The dimension lines and ruler use the real 4.280 / 2.620 / 1.450 mm — ornament that measures.
- The product card reads top-down in the right order for a mechanic (maker → name → OEM → stock → price), and the mechanic price variant is unambiguous.

Defects (severity as in impeccable P0–P3):
1. **P1 — hero composition collides**: the search field's orange button overlaps the car's nose (text column and stage share columns 4–5); the callout box sits on the hood/windscreen and its leader crosses the headlight; the title block floats above the stage frame's corner ticks without belonging to it.
2. **P1 — dead band under the car** (≈ 130 px between the dimension lines and the stage index at 1440×900): the stage is vertically centred in the grid row instead of sitting on the index, so the object looks small and the bottom of the hero is unresolved.
3. **P1 — X-ray story too faint**: the interior parts are drawn in `#1F2328`/`#2B3138` with `#6E767F` hairlines — at 1440 they almost disappear behind the glass; the drawing reads "car outline", not "parts inside".
4. **P1 (a11y) — icon-only card button on mobile loses its name**: `.cardButtonLabel { display:none }` removes the label from the accessibility tree.
5. **P2 — mobile stage caption missing**: `.stageCompact { display:none }` is declared after the media query and wins by source order; the 390 capture shows the buttons without „00/07 Sklopljeno".
6. **P2 — mobile dims collide**: „2.620" and „4.280" overlap at 390 px; the callout covers the roof.
7. **P2 — admin table overflows at 1440**: the Izvor column is cut; „Spremna za preuzimanje" badge is clipped; tabs wrap inside a tab at 390 („Za / slanje").
8. **P2 — order numbers shout**: Martian Mono 500 at 12.5 px in `ink-1` is the heaviest thing in each admin row.
9. **P3 — placeholder truncates on mobile** („…ili koč").
10. **P3 — the hero-font file split**: `fonts.ts` preloads Expanded 600 and 700 together; the spec wants 600 without preload.
