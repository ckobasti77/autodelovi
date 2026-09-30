/** Step 21 audit (flows-import-mech): download the mechanic price list (all / none / bogus categories) and inspect XLSX cell formats. */
import { writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { BASE, launch, newContext } from "./kit.mjs";
import { loginMechanic } from "./flows-import-mech-lib.mjs";
const browser = await launch();
const ctx = await newContext(browser, { tag: "fim-pl" });
const page = await ctx.newPage();
const out = {};
// anonymous first
const anon = await ctx.request.get(`${BASE}/majstor/cenovnik/preuzmi?kategorije=kocioni-diskovi`, { maxRedirects: 0 });
out.anon = { status: anon.status(), location: anon.headers()["location"], type: anon.headers()["content-type"] };
await loginMechanic(page);
for (const [k, q] of [["two", "kocioni-diskovi,kocione-plocice"], ["none", ""], ["bogus", "nepostoji,%3Cscript%3E"]]) {
  const r = await page.request.get(`${BASE}/majstor/cenovnik/preuzmi?kategorije=${q}`, { maxRedirects: 0 });
  const h = r.headers();
  const e = { status: r.status(), type: h["content-type"], disp: h["content-disposition"], cache: h["cache-control"] };
  if ((h["content-type"] ?? "").includes("sheet")) {
    const wb = XLSX.read(await r.body(), { cellStyles: true, cellNF: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    e.ref = ws["!ref"]; e.cols = ws["!cols"] ?? null; e.merges = ws["!merges"] ?? null;
    e.cells = {};
    for (const a of ["A1", "A5", "B6", "G6", "H6", "I6", "J6", "K6", "L6"]) if (ws[a]) e.cells[a] = { t: ws[a].t, v: ws[a].v, z: ws[a].z ?? null, w: ws[a].w, l: ws[a].l?.Target ?? null };
    e.rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).length;
  } else e.body = (await r.text()).slice(0, 300);
  out[k] = e;
}
writeFileSync("docs/qa/audit/flows-import-mech/pricelist-xlsx.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
await browser.close();
