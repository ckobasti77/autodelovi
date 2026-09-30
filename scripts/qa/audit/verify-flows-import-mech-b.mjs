/**
 * Step 21 verification (flows-import-mech-06/08): mechanic side.
 *  - price-list download with unknown / missing / valid / mixed category slugs
 *  - thank-you page of SK-2026-000131 and the portal history line for the same order
 *   node scripts/qa/audit/verify-flows-import-mech-b.mjs
 */
import { writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

import { BASE, convexRun, launch, newContext, shot, watch } from "./kit.mjs";
import { loginMechanic } from "./flows-import-mech-lib.mjs";

const V = "verify/flows-import-mech";
const OUT = `docs/qa/audit/${V}`;
const out = {};
const save = () => writeFileSync(`${OUT}/mech-verify.json`, JSON.stringify(out, null, 2));
const text = async (loc) => ((await loc.innerText().catch(() => "")) || "").replace(/\n{2,}/g, "\n");

const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-fim-b" });
const page = await ctx.newPage();
const log = watch(page);
await loginMechanic(page, "/majstor");

try {
  out.pricelist = {};
  for (const q of ["ne-postoji", "", "kocioni-diskovi", "kocioni-diskovi,ne-postoji", "stari-slug-kategorije,jos-jedan", "kocnice"]) {
    const url = `${BASE}/majstor/cenovnik/preuzmi${q === "" ? "" : `?kategorije=${q}`}`;
    const r = await page.request.get(url, { maxRedirects: 0 });
    const h = r.headers();
    const entry = { status: r.status(), type: h["content-type"], disposition: h["content-disposition"] ?? null };
    const buf = Buffer.from(await r.body());
    if (/spreadsheet/.test(h["content-type"] ?? "")) {
      const wb = XLSX.read(buf, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
      entry.sheets = wb.SheetNames;
      entry.range = ws["!ref"];
      entry.nonEmptyRows = aoa.length;
      entry.firstRows = aoa.slice(0, 6);
    } else entry.body = buf.toString("utf8").slice(0, 200);
    out.pricelist[q || "(none)"] = entry;
    save();
  }

  // Thank-you page and portal history for the deferred order
  const token = convexRun("testing:orderStatusToken", { number: "SK-2026-000131" });
  out.token = typeof token === "string" ? `${token.slice(0, 6)}…` : token;
  await page.goto(`${BASE}/porudzbina/hvala/${token}`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(4000);
  out.thanks = (await text(page.locator("main"))).slice(0, 2500);
  await shot(page, `${V}/flows-import-mech-06-reproduce-thanks`);
  await page.goto(`${BASE}/porudzbina/${token}`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(4000);
  out.statusPage = (await text(page.locator("main"))).slice(0, 2500);
  await shot(page, `${V}/flows-import-mech-06-reproduce-status`);
  await page.goto(`${BASE}/majstor/porudzbine`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(4000);
  const t = await text(page.locator("main"));
  const i = t.indexOf("SK-2026-000131");
  out.history = i >= 0 ? t.slice(Math.max(0, i - 200), i + 400) : t.slice(0, 1200);
  await shot(page, `${V}/flows-import-mech-06-reproduce-history`);
} catch (e) {
  out.ERROR = String(e).slice(0, 800);
} finally {
  out.log = log;
  save();
  await browser.close();
}
