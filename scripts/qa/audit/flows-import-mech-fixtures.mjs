/**
 * Step 21 audit (flows-import-mech): edge-case import fixtures in the OS temp dir (never in the repo).
 *   node scripts/qa/audit/flows-import-mech-fixtures.mjs  → prints the folder
 * All product rows use IMP-T-9xxx SKUs (purged by testing:purgeImportFixtures) and „Aktivan: ne“.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";

export const FIX = path.join(os.tmpdir(), "sklop-audit-fim");
mkdirSync(FIX, { recursive: true });

const book = (aoa, name = "Proizvodi") => {
  const b = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(b, XLSX.utils.aoa_to_sheet(aoa), name);
  return XLSX.write(b, { type: "buffer", bookType: "xlsx" });
};

// Malformed inputs
writeFileSync(path.join(FIX, "prazan.csv"), "");
writeFileSync(path.join(FIX, "prazan.xlsx"), book([[]]));
writeFileSync(path.join(FIX, "samo-zaglavlje.xlsx"), book([["Šifra", "Naziv", "Kategorija", "Proizvođač", "MP cena", "Količina"]]));
writeFileSync(path.join(FIX, "ostecen.xlsx"), Buffer.from("PK\u0003\u0004 not really a zip file at all ".repeat(20)));
writeFileSync(path.join(FIX, "beleske.txt"), "Šifra;Naziv\nIMP-T-9999;Test\n");
writeFileSync(path.join(FIX, "cenovnik.pdf"), Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"));
// A CSV without any recognizable header (random columns)
writeFileSync(path.join(FIX, "bez-zaglavlja.csv"), "a;b;c\n1;2;3\n4;5;6\n");

// Edge-case rows: duplicates, formula-looking text, a real formula cell, fractional stock,
// ambiguous number, too-long name, lowercase/space SKU, 0 price.
const H = ["Šifra", "Naziv", "Kategorija", "Proizvođač", "OEM brojevi", "MP cena (sa PDV)", "Količina", "Opis", "Aktivan"];
const rows = [
  H,
  ["IMP-T-9001", "Audit disk 9001 prednji", "Kočioni diskovi", "ATE", "5Q0 615 301 F", "4.990,00", 3, "Običan red", "ne"],
  ["IMP-T-9002", '=HYPERLINK("http://evil.example/x","Klikni")', "Kočioni diskovi", "ATE", "", "5.990,00", 2, "=1+1", "ne"],
  ["IMP-T-9003", "+cmd|' /C calc'!A0", "Kočioni diskovi", "ATE", "", "3.990,00", 1, "@SUM(1+1)", "ne"],
  ["IMP-T-9004", "-2+3 test naziv", "Kočioni diskovi", "ATE", "", "2.990,00", 1, "", "ne"],
  ["IMP-T-9001", "Duplikat šifre", "Kočioni diskovi", "ATE", "", "1.990,00", 1, "", "ne"],
  ["IMP-T-9005", "Audit formula cena", "Kočioni diskovi", "ATE", "", 1234, 4, "", "ne"],
  ["IMP-T-9006", "Audit razlomljena količina", "Kočioni diskovi", "ATE", "", "1.500,00", "2,5", "", "ne"],
  ["IMP-T-9007", "Audit dvosmislen broj", "Kočioni diskovi", "ATE", "", "12.990", 1, "", "ne"],
  ["IMP-T-9008", "X".repeat(170), "Kočioni diskovi", "ATE", "", "990,00", 1, "", "ne"],
  ["  IMP-T-9009  ", "Audit šifra sa razmacima", "Kočioni diskovi", "ATE", "", "990,00", 1, "", "ne"],
  ["IMP-T-9010", "Audit nula cena", "Kočioni diskovi", "ATE", "", "0", 1, "", "ne"],
  ["IMP-T-9011", "Audit čćžšđ ČĆŽŠĐ", "Kočione pločice", "Nepoznati Proizvođač Audit", "", "1.100,00", 1, "", "ne"],
];
const ws = XLSX.utils.aoa_to_sheet(rows);
// A real formula cell with a cached value (as Excel would save it): F7 = 1000+234
ws.F7 = { t: "n", v: 1234, f: "1000+234" };
const b2 = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(b2, ws, "Proizvodi");
writeFileSync(path.join(FIX, "ivicni-slucajevi.xlsx"), XLSX.write(b2, { type: "buffer", bookType: "xlsx" }));

// Stock/price update for the edge-case SKUs (+ one unknown)
writeFileSync(
  path.join(FIX, "lager-audit.xlsx"),
  book([
    ["Šifra", "Količina", "MP cena"],
    ["IMP-T-9001", 11, "5.490,00"],
    ["IMP-T-9004", 0, "3.100,00"],
    ["IMP-T-NEMA-1", 5, "1.000,00"],
  ], "Lager"),
);

// CSV with formulas, UTF-8 BOM, comma delimiter
writeFileSync(
  path.join(FIX, "formule.csv"),
  "﻿Šifra,Naziv,Kategorija,Proizvođač,MP cena,Količina,Aktivan\r\n" +
    'IMP-T-9101,"=HYPERLINK(""http://evil.example"",""x"")",Kočioni diskovi,ATE,1990,1,ne\r\n' +
    "IMP-T-9102,Audit CSV zarez,Kočioni diskovi,ATE,2990,1,ne\r\n",
);

console.log(FIX);
