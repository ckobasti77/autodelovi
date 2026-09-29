# SKLOP — Excel import and exports

> Part of the SKLOP docs — index: [README](README.md) · source: [master plan](plans/01-master-plan.md). Business intent: `pipeline/BRIEF.md`.

Related: [DATA-MODEL §C10](DATA-MODEL.md) · [ARCHITECTURE §E](ARCHITECTURE.md) · [TESTING](TESTING.md) (fixtures).

## K. Excel import

### K1. Formats and parsing (browser, Web Worker)
- Inputs: `.xlsx`, `.xls`, `.csv` (UTF-8 with/without BOM or Windows-1250; delimiter `;`, `,` or tab), ≤ 25 MB, ≤ 50 000 rows.
- `lib/excel/import.worker.ts` (`new Worker(new URL("./import.worker.ts", import.meta.url), { type: "module" })`): xlsx/xls via `XLSX.read(bytes, { type: "array", cellDates: true, dense: true })`; CSV via bytes → BOM check → `new TextDecoder("utf-8", { fatal: true })`, on failure `new TextDecoder("windows-1250")` (user can override) → `XLSX.read(text, { type: "string", FS: detectedDelimiter })`. Delimiter = the most consistent of `;` `,` `\t` over the first 20 lines outside quotes. Header row = first of the first 10 rows with ≥ 3 cells matching known synonyms (override possible). Text is NFC-normalized so č ć ž š đ survive.
- The worker posts headers, a 50-row preview and the row count, then streams normalized rows in chunks of 500. Writing files (template, error report, exports on the client) uses `XLSX.write(…, { type: "array" })` + a Blob download on the main thread.

### K2. Target fields and header synonyms (headers normalized: lowercase, diacritics folded, punctuation/spaces removed; exact → alias → Levenshtein ≤ 2)
| Field | Synonyms |
|---|---|
| `sku` | šifra, sifra, šifra artikla, šifra proizvoda, sku, artikal, kod, kod artikla, id artikla, interna šifra, broj artikla |
| `name` | naziv, naziv artikla, naziv proizvoda, ime, opis kratki, name, product name |
| `oem` | oem, oe, oe broj, oem broj, kataloški broj, kat. br., kat br, originalni broj, orig. broj, vag broj, broj dela |
| `mpn` | broj proizvođača, šifra proizvođača, kataloški broj proizvođača, mpn, ref, referenca, part number |
| `cross` | zamenski, zamenski broj, zamenski brojevi, cross, cross reference, uporedni broj, ekvivalent, alternativa |
| `manufacturer` | proizvođač, proizvodjac, brend, brand, marka dela, manufacturer |
| `quality` | kvalitet, tip, vrsta |
| `priceRetail` (with PDV) | mp cena, mpc, maloprodajna cena, cena sa pdv, cena, cena rsd, price, retail price |
| `priceNet` (without PDV) | vp cena, vpc, veleprodajna cena, cena bez pdv, net price (→ retail = round(net × 1.2), warning) |
| `cost` (net) | nabavna cena, nc, nabavna, cost, purchase price |
| `stock` | količina, kolicina, stanje, lager, zaliha, na stanju, stock, qty, quantity, kom |
| `category` | kategorija, grupa, grupa artikala, podgrupa, category |
| `fitment` | primena, vozilo, vozila, odgovara za, model, kompatibilnost, fits, applications |
| `description` | opis, opis artikla, description, napomena |
| `images` | slika, slike, slika url, url slike, image, image url, fotografija |
| `weight` | težina, tezina, masa, weight (kg; `g` suffix accepted) |
| `ean` | ean, barkod, bar kod, gtin |
| `leadTimeDays` | rok isporuke, isporuka dana, lead time |
| `active` | aktivan, status, active (da/ne, 1/0, true/false) |
| `lowStockThreshold` | minimalna zaliha, min. količina, prag |

Mapping UI: auto-mapped columns with confidence, manual override, „Ne uvozi", saved presets (`importMappingPresets`; a preset is suggested when ≥ 80 % of its headers match).

### K3. Values, validation, upsert keys, modes
- Shared rules in `lib/validation/importRow.ts` (also used by the manual product editor, so both paths validate identically).
- Numbers: `numberFormat` `sr` (default: `1.234,56`) or `en` (`1,234.56`), chosen per batch; ambiguous cells (e.g. `12.990`) produce a warning; prices → integer para (half-up); negative prices → error; stock must be an integer ≥ 0.
- Text: trim, collapse whitespace, strip control characters, max lengths (name 160, description 5 000).
- Codes: split multi-values on `;`, `|`, `,` or newlines (never `/` or space — they occur inside codes), normalize, each 4–25 chars.
- Category: slug, folded name or alias; unknown → error with top-3 suggestions and a one-time „mapiranje vrednosti" step (map each unknown value to an existing category for the whole file). Manufacturer: name/alias; unknown → warning + „Kreiraj proizvođača" on commit. Quality: original/orig/vag → `original`, oem/oe → `oem`, aftermarket/zamenski/zamena → `aftermarket`, default from the manufacturer.
- Fitment text: segments split on `;`, `|` or newlines, each `Marka Model Generacija [godine] [motori]` (e.g. `VW Golf VII 2012-2020 [CRLB, CUNA]`, `Škoda Octavia III`, `Audi A4 B8 1.8 TFSI`), matched via aliases; unmatched segments → warning (row still importable).
- Images: http(s) URLs only, ≤ 12.
- Row errors block the row; warnings don't. Duplicate SKU within the file → error on later rows.
- Upsert key: `sku`; fallback `oem (normalized) + manufacturer` only in full mode and only with exactly one match (else error „Više proizvoda sa istim OEM brojem i proizvođačem").
- Modes: **full** (create + update mapped fields; unmapped fields untouched), **stock_price** (only stock, prices, cost, active, lead time for existing SKUs; unknown SKUs skipped with a warning), optional **deactivateMissing** (full mode only, typed confirmation „DEAKTIVIRAJ": active non-demo products absent from the file are deactivated).

### K4. Pipeline within Convex limits
1. `createBatch` (file metadata, mapping, mode; original file stored for records) → `batchId`.
2. `stageRows` in chunks of 500 (client-normalized) → server re-validates, matches existing products (`by_sku` / codes), computes `action` + `changedFields`, writes `importRows`, updates counts (≈ 2 000 reads / 501 writes per call — far below 32 000 / 16 000).
3. `finalizeStaging` → `validated`; UI shows the dry-run diff (counts, sample rows per action, filterable errors/warnings) and „Preuzmi izveštaj o greškama" (.xlsx).
4. `commit` → `committing`; `commitChunk` handles ≤ 100 rows or until any `getTransactionMetrics()` remaining value drops below 25 %, then `runAfter(0)` with the cursor; every row goes through `productWriter` (products, productContent, productCodes, fitments, productPrivate, stockMovements, priceChanges, importChanges) and is idempotent (`committed` flag). Live progress via reactive query.
5. After commit: image fetch jobs (workpool, 3 parallel, 10 s timeout, ≤ 10 MB, sniffed), deactivate-missing chunks, category counts + landing stats refresh, `import.completed` event, audit entry.
6. **Rollback** → `rolling_back`; `rollbackChunk` walks `importChanges` newest → oldest: update → restore `before` if the product's `updatedAt` still equals `productUpdatedAtAfter`, else skip („izmenjeno posle uvoza"); create → delete with children when untouched and not referenced by order items, else deactivate; deactivate → reactivate; stock restored with `import_rollback` movements; final `rolled_back` (skips listed).

Target: 50 000 rows staged + committed in ≤ 15 minutes; resumable after interruptions.

### K5. Templates, exports, fixtures
- `/admin/uvoz/sablon` (.xlsx): sheet „Proizvodi" with canonical Serbian headers (Šifra, Naziv, Kategorija, Proizvođač, Kvalitet, OEM brojevi, Broj proizvođača, Zamenski brojevi, MP cena (sa PDV), Nabavna cena (bez PDV), Količina, Rok isporuke (dana), Primena (vozila), Opis, Slike (URL), Težina (kg), EAN, Aktivan) and header cell comments; „Uputstvo"; „Kategorije"; „Proizvođači"; „Vozila" (names the fitment parser accepts).
- Exports (staff route handlers `/admin/izvoz/*`, server-generated from paginated queries): products .xlsx (round-trips with the template), orders .csv and customers/mechanics .csv (UTF-8 BOM + `;` for Serbian Excel), offline conversions .csv (§J8).
- Fixtures (`scripts/make-import-fixtures.mjs` → `tests/fixtures/import/`): `proizvodi-500.xlsx` (seeded errors: bad price, unknown category, duplicate SKU, negative stock, invalid URL, missing name), `proizvodi-1250.csv` (Windows-1250, `;`, all of č ć ž š đ), `lager-cene.xlsx` (stock/price only).
