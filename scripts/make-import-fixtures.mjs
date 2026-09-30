/**
 * Import fixtures (docs/IMPORT.md §K5, docs/TESTING.md) → tests/fixtures/import/:
 *   proizvodi-500.xlsx  500 rows in accounting-export style (synonym headers, a title block
 *                       above the header row, Serbian number formats) with deliberate errors:
 *                       bad price ×2, unknown category ×2, duplicate SKU ×2, negative stock ×2,
 *                       missing name ×2 (error only for new products), invalid image URL ×2
 *                       (warning), unknown vehicle ×3 (warning). All rows are „Aktivan: ne“,
 *                       so a test import never shows on the storefront.
 *   proizvodi-1250.csv  Windows-1250, `;`, every Serbian letter, sr numbers (20 rows, inactive)
 *   lager-cene.xlsx     stock / price only for seeded demo SKUs + 2 unknown SKUs
 * Deterministic: re-running produces the same content.
 *   node scripts/make-import-fixtures.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

const out = path.resolve("tests/fixtures/import");
mkdirSync(out, { recursive: true });

// Seeded reference names (lib/catalog/taxonomy.ts, convex/seedData/manufacturers.ts).
const CATEGORIES = [
  "Kočioni diskovi",
  "Kočione pločice",
  "Filter ulja",
  "Filter vazduha",
  "Filter goriva",
  "Alternator",
  "Kaiš alternatora i zatezači",
  "Set zupčastog kaiša i vodena pumpa",
];
const MAKERS = ["ATE", "Brembo", "Bosch", "Febi Bilstein", "Mann-Filter", "TRW", "Valeo", "Gates"];
const VEHICLES = [
  "VW Golf VII",
  "Škoda Octavia III 2013-2020",
  "VW Passat B6",
  "Audi A4 B8",
  "VW Golf V; Škoda Octavia II",
  "Audi A3 (8P)",
];

// Small deterministic PRNG (mulberry32).
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(16_2026);
const pick = (list) => list[Math.floor(rand() * list.length)];
const srMoney = (dinars) =>
  `${Math.floor(dinars).toLocaleString("de-DE")},${String(Math.round((dinars % 1) * 100)).padStart(2, "0")}`;

// ── proizvodi-500.xlsx ──────────────────────────────────────────────────────────────────
const HEADERS = [
  "Šifra artikla",
  "Naziv artikla",
  "Grupa",
  "Brend",
  "Kat. br.",
  "MPC",
  "Lager",
  "Primena",
  "Slika URL",
  "Aktivan",
];
const NAMES = {
  "Kočioni diskovi": ["Kočioni disk prednji", "Kočioni disk zadnji"],
  "Kočione pločice": ["Kočione pločice prednje", "Kočione pločice zadnje"],
  "Filter ulja": ["Filter ulja"],
  "Filter vazduha": ["Filter vazduha"],
  "Filter goriva": ["Filter goriva"],
  Alternator: ["Alternator 140 A", "Alternator 110 A"],
  "Kaiš alternatora i zatezači": ["Rebrasti kaiš 6PK", "Zatezač kaiša alternatora"],
  "Set zupčastog kaiša i vodena pumpa": ["Set zupčastog kaiša sa vodenom pumpom"],
};

const rows = [];
for (let i = 1; i <= 500; i++) {
  const category = CATEGORIES[i % CATEGORIES.length];
  const maker = MAKERS[i % MAKERS.length];
  const sku = `IMP-T-${String(i).padStart(4, "0")}`;
  const price = 900 + Math.round(rand() * 40_000);
  const oem = `${pick(["1K0", "5Q0", "03L", "04E", "06J"])} ${100 + (i % 800)} ${String(100 + ((i * 7) % 900))} ${pick(["A", "B", "C", "AA", "F"])}`;
  rows.push([
    sku,
    `${pick(NAMES[category])} ${maker} (test uvoza ${i})`,
    category,
    maker,
    oem,
    i % 3 === 0 ? price : srMoney(price),
    String(Math.floor(rand() * 25)),
    i % 4 === 0 ? pick(VEHICLES) : "",
    "",
    "ne",
  ]);
}
// Deliberate problems (row index in `rows` = file row - title rows - header - 1).
const set = (n, col, value) => {
  rows[n - 1][col] = value;
};
set(11, 5, "12,99a"); // bad price
set(12, 5, "osam hiljada");
set(21, 2, "Nepostojeća kategorija"); // unknown category
set(22, 2, "Kocnice ostalo");
set(31, 0, "IMP-T-0001"); // duplicate SKU
set(32, 0, "IMP-T-0002");
set(41, 6, "-3"); // negative stock
set(42, 6, "-10");
set(51, 1, ""); // missing name (error for a new product)
set(52, 1, "");
set(61, 8, "slika.jpg"); // invalid image URL → warning
set(62, 8, "ftp://slike.primer.rs/x.jpg");
set(71, 7, "Opel Astra H"); // unknown vehicle → warning
set(72, 7, "VW Golf VII; Fiat Punto");
set(73, 7, "Lada Niva");

const title = [["Cenovnik — izvoz iz knjigovodstvenog programa"], ["Datum: 29.09.2026."], []];
const sheet = XLSX.utils.aoa_to_sheet([...title, HEADERS, ...rows]);
sheet["!cols"] = [16, 50, 26, 16, 22, 12, 8, 34, 26, 8].map((wch) => ({ wch }));
const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book, sheet, "Cenovnik");
writeFileSync(
  path.join(out, "proizvodi-500.xlsx"),
  XLSX.write(book, { type: "buffer", bookType: "xlsx", compression: true }),
);

// ── proizvodi-1250.csv ──────────────────────────────────────────────────────────────────
const CP1250 = {
  Š: 0x8a,
  š: 0x9a,
  Ž: 0x8e,
  ž: 0x9e,
  Č: 0xc8,
  č: 0xe8,
  Ć: 0xc6,
  ć: 0xe6,
  Đ: 0xd0,
  đ: 0xf0,
  "„": 0x84,
  "“": 0x93,
  "–": 0x96,
};
function encode1250(text) {
  const bytes = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < 0x80) bytes.push(code);
    else if (CP1250[ch] !== undefined) bytes.push(CP1250[ch]);
    else throw new Error(`Nema u Windows-1250: ${ch}`);
  }
  return Buffer.from(bytes);
}
const csvRows = [
  ["Šifra", "Naziv", "Kategorija", "Proizvođač", "OEM broj", "Cena sa PDV", "Količina", "Aktivan"],
];
const words = ["Čep", "Ćevap", "Žica", "Šelna", "Đon", "ČĆŽŠĐ"];
for (let i = 1; i <= 20; i++) {
  csvRows.push([
    `IMP-C-${String(i).padStart(3, "0")}`,
    `${words[i % words.length]} držač „test“ – čćžšđ ${i}`,
    CATEGORIES[i % CATEGORIES.length],
    MAKERS[i % MAKERS.length],
    `1K0 ${200 + i} 301 A`,
    srMoney(1_000 + i * 123.45),
    String(i),
    "ne",
  ]);
}
const csv = csvRows
  .map((r) => r.map((c) => (/[;"\r\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";"))
  .join("\r\n");
writeFileSync(path.join(out, "proizvodi-1250.csv"), encode1250(`${csv}\r\n`));

// ── lager-cene.xlsx ─────────────────────────────────────────────────────────────────────
const stock = [["Šifra", "Količina", "MP cena"]];
for (let i = 1; i <= 20; i++)
  stock.push([`DEMO-${String(i).padStart(4, "0")}`, (i * 3) % 17, 1_000 + i * 250]);
stock.push(["NEPOSTOJI-001", 5, 1000], ["NEPOSTOJI-002", 7, 2000]);
const stockBook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(stockBook, XLSX.utils.aoa_to_sheet(stock), "Lager");
writeFileSync(
  path.join(out, "lager-cene.xlsx"),
  XLSX.write(stockBook, { type: "buffer", bookType: "xlsx", compression: true }),
);

console.log("tests/fixtures/import: proizvodi-500.xlsx, proizvodi-1250.csv, lager-cene.xlsx");
