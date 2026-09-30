/**
 * Step 21 audit (flows-import-mech): edge-case import (duplicates, formula-looking text, a real
 * formula cell, fractional stock, ambiguous number, long name, padded SKU, zero price, unknown
 * maker mapped to an existing one) → check → dry run → commit → record → error report →
 * stock/price-only import on the same SKUs → rollback both. Products are inactive IMP-T-9xxx.
 *   node scripts/qa/audit/flows-import-mech-edge.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

import { BASE, convexRun, launch, newContext, shot, watch } from "./kit.mjs";
import { loginAdminSafe as loginAdmin } from "./flows-import-mech-lib.mjs";
import { FIX } from "./flows-import-mech-fixtures.mjs";

const T = "flows-import-mech";
const out = { steps: [] };
const note = (k, v) => {
  out.steps.push({ k, v });
  console.log(k, typeof v === "string" ? v.slice(0, 1500) : JSON.stringify(v).slice(0, 1500));
};
const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "fim-edge" });
const page = await ctx.newPage();
const log = watch(page);
await loginAdmin(page);

async function openWizard() {
  await page.goto(`${BASE}/admin/uvoz`, { waitUntil: "load" });
  await page.getByTestId("import-template").waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
}

async function runToDryRun(file, { mode = "full", shots = "edge", mapMaker = null } = {}) {
  await openWizard();
  await page.getByTestId("import-file-input").setInputFiles(path.join(FIX, file));
  await page.getByTestId("import-row-count").waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  await shot(page, `${T}/${shots}-1-file-1440`);
  await page.getByTestId("import-to-mapping").click();
  await page.getByTestId("import-mapping").waitFor({ timeout: 30000 });
  if (mode === "stock_price") {
    await page.getByRole("radio", { name: /Samo lager i cene/ }).click();
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(800);
  await shot(page, `${T}/${shots}-2-mapping-1440`, { fullPage: true });
  note(`${shots}:mapping`, await page.locator("main").innerText());
  await page.getByTestId("import-to-check").click();
  await page.waitForTimeout(3000);
  if (mapMaker) {
    const sel = page.getByRole("combobox", { name: `Proizvođač za „${mapMaker.value}“` });
    if (await sel.count()) {
      const optVal = await sel.locator("option", { hasText: mapMaker.to }).first().getAttribute("value");
      await sel.selectOption(optVal);
      await page.waitForTimeout(2500);
    }
  }
  await shot(page, `${T}/${shots}-3-check-1440`, { fullPage: true });
  note(`${shots}:check`, await page.locator("main").innerText());
  await page.getByTestId("import-start-dry-run").click();
  await page.getByTestId("import-commit").waitFor({ timeout: 180000 });
  await page.waitForTimeout(2500);
  await shot(page, `${T}/${shots}-4-dryrun-1440`, { fullPage: true });
  note(`${shots}:dryrun`, await page.locator("main").innerText());
  // every diff tab
  for (const tab of await page.getByRole("tab").all()) {
    const name = (await tab.innerText()).trim();
    if (!/Nov|Menja|Bez|Presk|Greš|Upozor/i.test(name)) continue;
    await tab.click();
    await page.waitForTimeout(600);
    note(`${shots}:tab ${name}`, await page.getByRole("tabpanel").innerText().catch(() => ""));
  }
  return new URL(page.url()).searchParams.get("uvoz");
}

async function commitAndWait(shots) {
  await page.getByTestId("import-commit").click();
  await page.getByTestId("import-result").waitFor({ timeout: 300000 });
  await page.waitForTimeout(1500);
  await shot(page, `${T}/${shots}-5-committed-1440`, { fullPage: true });
  note(`${shots}:committed`, await page.locator("main").innerText());
}

async function rollback(batchId, shots) {
  await page.goto(`${BASE}/admin/uvoz?uvoz=${batchId}`, { waitUntil: "load" });
  await page.getByTestId("import-rollback").waitFor({ timeout: 60000 });
  await page.getByTestId("import-rollback").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Poništi uvoz" }).click();
  await page.getByTestId("import-rolled-back").waitFor({ timeout: 300000 });
  await page.waitForTimeout(1000);
  await shot(page, `${T}/${shots}-6-rolledback-1440`, { fullPage: true });
  note(`${shots}:rolledback`, await page.locator("main").innerText());
}

const skus = ["IMP-T-9001", "IMP-T-9002", "IMP-T-9003", "IMP-T-9004", "IMP-T-9005", "IMP-T-9006", "IMP-T-9007", "IMP-T-9008", "IMP-T-9009", "  IMP-T-9009  ", "IMP-T-9010", "IMP-T-9011"];
const probe = () => Object.fromEntries(skus.map((s) => [s, convexRun("testing:productBySku", { sku: s })]));

try {
  const edgeId = await runToDryRun("ivicni-slucajevi.xlsx", {
    shots: "edge",
    mapMaker: { value: "Nepoznati Proizvođač Audit", to: "ATE" },
  });
  note("edge:batchId", edgeId);
  await commitAndWait("edge");
  note("edge:probe-after-commit", probe());

  // Batch record + error report
  await page.goto(`${BASE}/admin/uvoz/${edgeId}`, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  await shot(page, `${T}/edge-7-record-1440`, { fullPage: true });
  note("edge:record", await page.locator("main").innerText());
  const report = await ctx.request.get(`${BASE}/admin/uvoz/${edgeId}/izvestaj`);
  note("edge:report-status", `${report.status()} ${report.headers()["content-type"]} ${report.headers()["content-disposition"]}`);
  if (report.ok()) {
    const buf = Buffer.from(await report.body());
    writeFileSync(path.join(FIX, "izvestaj-edge.xlsx"), buf);
    const wb = XLSX.read(buf, { type: "buffer", cellFormula: true });
    const summary = {};
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const formulas = Object.entries(ws).filter(([k, c]) => !k.startsWith("!") && c && c.f).map(([k, c]) => `${k}=${c.f}`);
      summary[name] = { rows: XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(0, 20), formulas };
    }
    note("edge:report", summary);
  }

  // Stock / price only on the committed SKUs
  const lagerId = await runToDryRun("lager-audit.xlsx", { mode: "stock_price", shots: "lager" });
  note("lager:batchId", lagerId);
  await commitAndWait("lager");
  note("lager:probe", {
    "IMP-T-9001": convexRun("testing:productBySku", { sku: "IMP-T-9001" }),
    "IMP-T-9004": convexRun("testing:productBySku", { sku: "IMP-T-9004" }),
  });
  await rollback(lagerId, "lager");
  note("lager:probe-after-rollback", {
    "IMP-T-9001": convexRun("testing:productBySku", { sku: "IMP-T-9001" }),
    "IMP-T-9004": convexRun("testing:productBySku", { sku: "IMP-T-9004" }),
  });
  await rollback(edgeId, "edge");
  note("edge:probe-after-rollback", probe());
} catch (e) {
  note("ERROR", String(e));
  await shot(page, `${T}/edge-error-1440`, { fullPage: true });
} finally {
  out.log = log;
  writeFileSync(`docs/qa/audit/${T}/edge-import.json`, JSON.stringify(out, null, 2));
  await browser.close();
}
