# Admin panel QA (step 15)

> Every admin screen at 1440 and 1024 px (the 64 px icon rail takes over below 1366 px), reviewed against DESIGN-SYSTEM §3.8, §9.14–§9.21, §10.10–§10.12, the impeccable craft floor (Operate mode) and the step brief. Captured on `next dev` with the seeded owner: `node scripts/qa/admin-shots.mjs <base> <paths…>` (full pages) and `node scripts/qa/admin-states.mjs <base> <order> <inquiry> <productId>` (interaction states) into `docs/qa/screens/step-15/` and `…/states/`.

Severity: **P0** blocks the flow or breaks the page · **P1** visible defect or wrong information · **P2** polish · **P3** nice to have.

## Pages captured (console errors: 0 on every page)

| Screen | Files |
|---|---|
| Pregled (KPIs, orders per day, „Traženo, a nemamo“, SLA queue, activity, orders by system) | `pregled-*` |
| Porudžbine list · detail · predračun · otpremnica | `porudzbine-*`, `porudzbine_SK-2026-*`, `…_predracun-*`, `…_otpremnica-*` |
| Upiti list · detail | `upiti-*`, `upiti_UP-2026-000001-*` |
| Proizvodi list · editor | `proizvodi-*`, `proizvodi_<id>-*` |
| Kategorije (tree + editor + 3D mapping) · Vozila · Proizvođači · Lager | `kategorije-*`, `vozila-*`, `proizvodjaci-*`, `lager-*` |
| Kupci · Majstori · Cenovni razredi | `kupci-*`, `majstori-*`, `cenovni-razredi-*` |
| Podešavanja (Firma, Dostava i plaćanje, Pravni tekstovi) | `podesavanja_tab_*` |
| Korisnici · Revizija · E-pošta · Pretrage · Obaveštenja | `korisnici-*`, `revizija-*`, `mejlovi-*`, `pretrage-*`, `obavestenja-*` |
| States: command palette with results, bell, order status menu and dialog, quote composer, products bulk bar, product editor with the dirty save bar, new product | `states/*` |

## Automated checks

- impeccable detector: `components/admin` 3 advisory findings (`design-system-font-size`), `app/admin` 0 — see IDs AD-01…AD-03.
- axe (wcag2a/aa, 21aa, 22aa) on `/admin`, `/admin/porudzbine`, `/admin/proizvodi`: 0 violations; the only „incomplete“ item is 19 SVG chart labels axe cannot resolve (ink-3 #5D6570 on white = 5.9:1, value label 18:1 — pass on manual check). The e2e spec re-runs axe on the dashboard, orders list, product editor and settings.

## Findings

Two isolated reviews: the impeccable detector plus axe (B) and an impeccable critique in Operate mode (A, 28/40 before fixes). Everything below was fixed in one batch and re-captured (second round, same scripts); no P0/P1 remains open.

| ID | Sev | Screen | Finding | Fix |
|---|---|---|---|---|
| AD-01 | P2 | Cenovni razredi | Example price used a raw font size outside the type ramp | `type-numeral-l` |
| AD-02 | P2 | Sidebar (rail) | Count badge text at 10 px | 11 px, the smallest ramp step |
| AD-03 | P3 | Print views | Print sizes not in the ramp | Print ramp documented in DESIGN-SYSTEM (A4, black on white) |
| AD-04 | P1 | Pregled | Stock KPI („Malo na stanju“) disagreed with the sidebar count and Lager | KPI „Bez zaliha N“ with „još M sa malo zaliha“, linked to Lager (D160) |
| AD-05 | P1 | Pregled @1024 | SLA queue sat below the charts, off the first screen | Queue and activity first, charts after |
| AD-06 | P1 | Pregled, predračun, otpremnica | Empty seller data went unnoticed; documents printed with blank lines | Warning with the missing fields and a link to Podešavanja → Firma, screen only (D156) |
| AD-07 | P1 | Porudžbine @1024 | Table scrolled sideways; list opened on „Sve“ | Date folds under the number, „Kom.“ hides, backorder tag stacks; opens on „Nove“ (D155, D159) |
| AD-08 | P1 | Upiti | Status in the last column; „Traži“ clipped at 1024; „Foto“ column mostly empty | Status next to the number, photo count inside „Traži“, tags stack and „Preuzeo“ hides below 1280 |
| AD-09 | P2 | Proizvodi | Price and stock far from the name; eight columns by default | Artikal → Stanje → Cena → OEM → Kategorija (truncated) → Proizvođač; „Vozila“, „Izmenjen“ in the chooser |
| AD-10 | P2 | Upiti, E-pošta, Vozila, Korisnici, Lager | Select widths ignored (the field frame is `w-full`) | Width wrappers |
| AD-11 | P1 | Revizija, Aktivnost | Summaries showed keys („company“, „retailPricePara“), „ponuda v1“, double parentheses | Serbian labels, „ponuda br. 1“, „· razred Partner (20 %)“ (D157) |
| AD-12 | P2 | Revizija | „Radnja“ was a free-text key field | Select with Serbian actions; key shown in the expanded row |
| AD-13 | P2 | Pregled, Upiti | „novo“ / „čeka od otvaranja“ for items that arrived outside working hours | „van radnog vremena“ / „upravo“ + received time; warning icon and sr-only „kasni“ on late rows (D158) |
| AD-14 | P2 | Lager | One list mixing empty and low stock, an outlined button per row | Separate tabs; quantity is an inline button, threshold inline input (D160) |
| AD-15 | P2 | Confirm dialogs | Focus landed on the close button | Safe actions focus „Potvrdi“, destructive ones „Odustani“; inputs keep focus when present |
| AD-16 | P2 | Sidebar (rail) | Icons only; the label came from `title` after a long delay | Tooltip on hover and focus while the rail is shown |
| AD-17 | P3 | Palette | All hits in one „Rezultati“ group | Grouped: Porudžbine, Upiti, Artikli, Kupci, Majstori |
| AD-18 | P3 | Pregled chart | Last x label clipped at the right edge | End-anchored |
| AD-19 | P3 | Kategorije | 3D glyph on tree rows added noise | Removed (the mapping lives in the editor) |
| AD-20 | P3 | Proizvod, Kategorije | Counters inconsistent („52/60“, none on descriptions) | `CharCount` „52 / 60“, warning past the limit |
| AD-21 | P2 | Porudžbina | No call / Viber / WhatsApp as on inquiries | Shared `ContactActions` |
| AD-22 | P3 | Upit | „Odgovor“ label ambiguous | „Želi odgovor“ |
| AD-23 | P2 | Proizvodi (+ storefront CTAs) | Icons passed to `Button asChild` never rendered | Rendered through `Slot.Slottable` (D154) |
| AD-24 | P2 | Details @1024 | Two-column detail pages started only at xl | Two columns from lg |
| AD-25 | P2 | Pravni tekstovi | Markdown editor in the UI font | Monospace editor |
| AD-26 | P2 | Korisnici | „Poslednja aktivnost“ never updated | `staff.touchStaffActivity` (≤ once per 10 min, not audited) |
| AD-27 | P2 | All forms | „(neobavezno)“ on most admin fields | Required fields marked „(obavezno)“ instead (D153) |
| AD-28 | P2 | Tables | No hint that a table scrolls sideways | Edge shadows while overflowing |
| AD-29 | P3 | Menus | Danger items used the default ink | Danger colour |
| AD-30 | P3 | Lists | „Prikazano: 1 porudžbina“ forms; footer shown on empty lists | Plural forms; hidden at 0 |
| AD-31 | P3 | Editors | Save bar let content show through | Opaque |
| AD-32 | P2 | Proizvodi, Lager, editor | Stock state by colour only | `StockStateBadge` with shape icons (DS §3.6) |

Open (P3, accepted): date inputs show the browser's own placeholder (`mm/dd/yyyy` in the English headless Chromium used for the captures; a Serbian browser shows `dd.mm.gggg.`); audit entries written before D157 keep their original wording (append-only).

## Verification after the fixes

- Second capture round at 1440 and 1024 (pages + states): lists fit at 1024 without sideways scrolling, palette grouped, dialogs and contact buttons correct, 0 console errors.
- `tests/e2e/admin.spec.ts` 6/6 on `next dev`, then the full suite on the production build (see docs/PROGRESS.md).
