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
