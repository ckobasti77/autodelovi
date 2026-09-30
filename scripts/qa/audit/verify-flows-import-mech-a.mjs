/**
 * Step 21 verification (flows-import-mech-05/06/07): admin side.
 *  - template gallery plain-text views (tel: links)
 *  - logged „primljena“ e-mail for SK-2026-000131 (deferred payment wording)
 *  - import check + dry run with formula-looking names (cancelled, nothing committed)
 *   node scripts/qa/audit/verify-flows-import-mech-a.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";

import { BASE, launch, newContext, shot, watch } from "./kit.mjs";
import { loginAdminSafe } from "./flows-import-mech-lib.mjs";

const V = "verify/flows-import-mech";
const OUT = `docs/qa/audit/${V}`;
const out = {};
const save = () => writeFileSync(`${OUT}/admin-verify.json`, JSON.stringify(out, null, 2));
const text = async (loc) => ((await loc.innerText().catch(() => "")) || "").replace(/\n{2,}/g, "\n");
const part = process.argv[2] ?? "all";

const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-fim-a" });
const page = await ctx.newPage();
const log = watch(page);
await loginAdminSafe(page);

try {
  if (part === "all" || part === "tpl") {
    for (const key of ["staff_order_new", "order_received", "mechanic_approved", "staff_inquiry_new"]) {
      await page.goto(`${BASE}/admin/mejlovi/sabloni?sablon=${key}&prikaz=tekst`, { waitUntil: "load", timeout: 90000 });
      await page.waitForTimeout(4000);
      const sec = page.getByTestId("template-preview");
      const pre = await sec.evaluate((s) => s.querySelector("pre")?.textContent ?? null).catch((e) => `ERR ${e}`);
      out[`tpl_${key}`] = {
        url: page.url(),
        telLines: String(pre ?? "").split("\n").filter((l) => /tel:|viber:|mailto:|wa\.me/.test(l)),
        pre: String(pre ?? "").slice(0, 3000),
      };
      if (key === "staff_order_new" || key === "order_received") {
        const pre$ = sec.locator("pre").first();
        if (await pre$.count()) await shot(page, `${V}/flows-import-mech-05-reproduce-${key}-tekst`, { locator: pre$ });
      }
      save();
    }
  }

  if (part === "all" || part === "mail") {
    await page.goto(`${BASE}/admin/mejlovi`, { waitUntil: "load", timeout: 90000 });
    await page.waitForTimeout(6000);
    const row = page.getByRole("row").filter({ hasText: "SK-2026-000131" }).filter({ hasText: /primljena/i }).first();
    if (await row.count()) {
      await row.click();
      await page.waitForTimeout(3500);
      const dlg = page.getByRole("dialog").first();
      out.sheetHtmlText = await dlg.evaluate((d) => {
        const f = d.querySelector("iframe");
        try { return f?.contentDocument?.body?.innerText?.slice(0, 3000) ?? null; } catch { return null; }
      });
      await shot(page, `${V}/flows-import-mech-06-reproduce-email-html`);
      const tekst = dlg.getByRole("radio", { name: /Tekst/i }).or(dlg.getByRole("tab", { name: /Tekst/i })).first();
      if (await tekst.count()) {
        await tekst.click();
        await page.waitForTimeout(1500);
        out.sheetText = (await text(dlg)).slice(0, 4000);
        await shot(page, `${V}/flows-import-mech-06-reproduce-email-text`);
      }
      await page.keyboard.press("Escape");
    } else out.sheet = "row not found";
    save();
  }

  if (part === "all" || part === "import") {
    const FIX = path.join(os.tmpdir(), "sklop-verify-fim");
    mkdirSync(FIX, { recursive: true });
    const H = ["Šifra", "Naziv", "Kategorija", "Proizvođač", "MP cena (sa PDV)", "Količina", "Aktivan"];
    const rows = [
      H,
      ["IMP-V-9701", '=HYPERLINK("http://evil.example/x","Klikni")', "Kočioni diskovi", "ATE", "5.990,00", 1, "ne"],
      ["IMP-V-9702", "+cmd|' /C calc'!A0", "Kočioni diskovi", "ATE", "3.990,00", 1, "ne"],
      ["IMP-V-9703", "@SUM(A1:A2)", "Kočioni diskovi", "ATE", "3.990,00", 1, "ne"],
      ["IMP-V-9704", "Kočioni disk prednji verifikacija", "Kočioni diskovi", "ATE", "4.990,00", 1, "ne"],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Artikli");
    const file = path.join(FIX, "formule-verify.xlsx");
    writeFileSync(file, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    // what the cells are in the file: string cells, no formula
    const back = XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer", cellFormula: true });
    out.fixtureCells = ["B2", "B3", "B4"].map((a) => ({ a, t: back.Sheets.Artikli[a].t, v: back.Sheets.Artikli[a].v, f: back.Sheets.Artikli[a].f ?? null }));

    await page.goto(`${BASE}/admin/uvoz`, { waitUntil: "load", timeout: 90000 });
    await page.getByTestId("import-template").waitFor({ timeout: 60000 });
    await page.waitForTimeout(800);
    await page.getByTestId("import-file-input").setInputFiles(file);
    await page.getByTestId("import-row-count").waitFor({ timeout: 60000 });
    await page.waitForTimeout(800);
    await page.getByTestId("import-to-mapping").click();
    await page.getByTestId("import-mapping").waitFor({ timeout: 60000 });
    await page.waitForTimeout(800);
    await page.getByTestId("import-to-check").click();
    await page.waitForTimeout(4000);
    out.check = (await text(page.locator("main"))).slice(0, 3000);
    await shot(page, `${V}/flows-import-mech-07-reproduce-check`, { fullPage: true });
    save();
    await page.getByTestId("import-start-dry-run").click();
    await page.getByTestId("import-commit").waitFor({ timeout: 180000 });
    await page.waitForTimeout(2500);
    out.dryrun = (await text(page.locator("main"))).slice(0, 3000);
    out.batchUrl = page.url();
    await shot(page, `${V}/flows-import-mech-07-reproduce-dryrun`, { fullPage: true });
    for (const tab of await page.getByRole("tab").all()) {
      const name = (await tab.innerText()).trim();
      if (!/Nov|Upozor/i.test(name)) continue;
      await tab.click();
      await page.waitForTimeout(700);
      out[`tab ${name}`] = (await page.getByRole("tabpanel").innerText().catch(() => "")).slice(0, 1500);
    }
    save();
    // cancel: nothing written
    await page.getByRole("button", { name: "Otkaži uvoz" }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Otkaži uvoz" }).click();
    await page.waitForTimeout(3000);
    out.afterCancelUrl = page.url();
  }
} catch (e) {
  out.ERROR = String(e).slice(0, 800);
  await shot(page, `${V}/admin-error`, { fullPage: false });
} finally {
  out.log = log;
  save();
  await browser.close();
}
