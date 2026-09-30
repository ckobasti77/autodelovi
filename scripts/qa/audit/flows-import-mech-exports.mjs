/**
 * Step 21 audit (flows-import-mech): exports — products xlsx (with demo), orders / customers /
 * mechanics csv. Checks BOM, separator, Serbian letters, formula-injection escaping, and runs the
 * products file back through the importer as a dry run (expect 0 changes), then cancels it.
 *   node scripts/qa/audit/flows-import-mech-exports.mjs
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

import { BASE, launch, newContext, shot, watch } from "./kit.mjs";
import { FIX } from "./flows-import-mech-fixtures.mjs";
import { loginAdminSafe } from "./flows-import-mech-lib.mjs";

const T = "flows-import-mech";
const out = {};
const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "fim-exp" });
const page = await ctx.newPage();
const log = watch(page);
await loginAdminSafe(page);
await page.goto(`${BASE}/admin/izvoz`, { waitUntil: "load" });
await page.getByTestId("export-products").waitFor({ timeout: 60000 });
await page.waitForTimeout(1500);
await shot(page, `${T}/export-page-1440`, { fullPage: true });
out.hrefs = await page.$$eval("[data-testid^=export-]", (as) => as.map((a) => [a.dataset.testid, a.getAttribute("href")]));

const csvInfo = (buf) => {
  const text = buf.toString("utf8");
  const bom = text.charCodeAt(0) === 0xfeff;
  const lines = text.replace(/^﻿/, "").split(/\r\n/);
  const header = lines[0];
  const letters = [..."čćžšđČĆŽŠĐ"].filter((l) => text.includes(l));
  const suspicious = [];
  for (const line of lines.slice(1)) {
    // naive split on ; outside quotes
    const cells = [];
    let cur = "";
    let q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === ";" && !q) {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    for (const c of cells) if (/^[=+\-@]/.test(c)) suspicious.push(c.slice(0, 80));
  }
  return {
    bytes: buf.length,
    bom,
    crlf: text.includes("\r\n"),
    header,
    rows: lines.length - 1,
    sample: lines.slice(1, 4),
    letters,
    cellsStartingWithFormulaChar: [...new Set(suspicious)].slice(0, 30),
  };
};

for (const [id, href] of out.hrefs) {
  const url = `${BASE}${href}${id === "export-products" ? "?demo=1" : ""}`;
  let res;
  for (let a = 0; a < 4; a++) {
    try {
      res = await ctx.request.get(url, { timeout: 180000 });
      break;
    } catch (e) {
      if (a === 3) throw e;
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  const buf = Buffer.from(await res.body());
  const entry = { url, status: res.status(), type: res.headers()["content-type"], disposition: res.headers()["content-disposition"] };
  const file = path.join(FIX, `export-${id}${id === "export-products" ? ".xlsx" : ".csv"}`);
  writeFileSync(file, buf);
  if (id === "export-products") {
    const wb = XLSX.read(buf, { type: "buffer", cellFormula: true });
    entry.sheets = wb.SheetNames;
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 });
    entry.header = aoa[0];
    entry.rows = aoa.length - 1;
    entry.sample = aoa.slice(1, 3);
    entry.formulas = Object.entries(ws).filter(([k, c]) => !k.startsWith("!") && c?.f).length;
    entry.types = Object.fromEntries((aoa[0] ?? []).map((h, i) => [h, ws[XLSX.utils.encode_cell({ r: 1, c: i })]?.t]));
  } else {
    Object.assign(entry, csvInfo(buf));
  }
  out[id] = entry;
  console.log(id, JSON.stringify(entry).slice(0, 1500));
}

// Round trip: products export (incl. demo) → importer dry run → expect all „Bez promena“.
await page.goto(`${BASE}/admin/uvoz`, { waitUntil: "load" });
await page.getByTestId("import-template").waitFor({ timeout: 30000 });
await page.waitForTimeout(800);
await page.getByTestId("import-file-input").setInputFiles(path.join(FIX, "export-export-products.xlsx"));
await page.getByTestId("import-row-count").waitFor({ timeout: 60000 });
out.roundtripRowCount = await page.getByTestId("import-row-count").textContent();
await page.getByTestId("import-to-mapping").click();
await page.getByTestId("import-mapping").waitFor({ timeout: 30000 });
await page.waitForTimeout(1000);
await shot(page, `${T}/roundtrip-2-mapping-1440`, { fullPage: true });
out.roundtripMappingProblems = await page.locator("main").innerText().then((t) => t.split("\n").filter((l) => /nije mapiran|obavez|Nedostaje|mora/i.test(l)));
await page.getByTestId("import-to-check").click();
await page.waitForTimeout(6000);
await shot(page, `${T}/roundtrip-3-check-1440`, { fullPage: true });
out.roundtripCheck = (await page.locator("main").innerText()).split("Provera")[1]?.slice(0, 2500);
await page.getByTestId("import-start-dry-run").click();
await page.getByTestId("import-commit").waitFor({ timeout: 300000 });
await page.waitForTimeout(3000);
await shot(page, `${T}/roundtrip-4-dryrun-1440`, { fullPage: true });
out.roundtripDry = (await page.locator("main").innerText()).split("Upis\n")[1]?.slice(0, 2500);
for (const tab of await page.getByRole("tab").all()) {
  const name = (await tab.innerText()).trim();
  if (!/Izmene|Greške|Preskočeni/.test(name)) continue;
  await tab.click();
  await page.waitForTimeout(800);
  out[`roundtripTab ${name}`] = (await page.getByRole("tabpanel").innerText().catch(() => "")).slice(0, 3000);
}
out.roundtripBatch = new URL(page.url()).searchParams.get("uvoz");
// cancel the dry run (nothing written)
await page.getByRole("button", { name: "Otkaži uvoz" }).click();
await page.getByRole("alertdialog").getByRole("button", { name: "Otkaži uvoz" }).click();
await page.waitForTimeout(2000);
out.cancelled = page.url();
out.log = log;
writeFileSync(`docs/qa/audit/${T}/exports.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2).slice(0, 12000));
await browser.close();
