/**
 * Step 21 audit (flows-import-mech): malformed import files → which message the admin sees.
 *   node scripts/qa/audit/flows-import-mech-malformed.mjs
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

import { BASE, launch, loginAdmin, newContext, shot, watch } from "./kit.mjs";
import { FIX } from "./flows-import-mech-fixtures.mjs";

const T = "flows-import-mech";
const files = [
  "prazan.csv",
  "prazan.xlsx",
  "samo-zaglavlje.xlsx",
  "ostecen.xlsx",
  "beleske.txt",
  "cenovnik.pdf",
  "bez-zaglavlja.csv",
];
const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "fim-mal" });
const page = await ctx.newPage();
const log = watch(page);
await loginAdmin(page);
const out = [];
for (const f of files) {
  await page.goto(`${BASE}/admin/uvoz`, { waitUntil: "load" }); await page.getByTestId("import-template").waitFor({ timeout: 30000 }); await page.waitForTimeout(800);
  await page.getByTestId("import-file-input").setInputFiles(path.join(FIX, f));
  await page.waitForTimeout(3500);
  const text = await page.locator("main").innerText();
  const alerts = await page.locator('[role="alert"], [role="status"]').allInnerTexts();
  const rowCount = await page.getByTestId("import-row-count").textContent().catch(() => null);
  const nextDisabled = await page
    .getByTestId("import-to-mapping")
    .isDisabled()
    .catch(() => null);
  out.push({
    file: f,
    rowCount,
    nextDisabled,
    alerts,
    snippet: text.slice(0, 900),
  });
  await shot(page, `${T}/malformed-${f.replace(/\./g, "_")}-1440`);
}
// Proceed with the header-less CSV to the mapping step to see what the user is told.
await page.goto(`${BASE}/admin/uvoz`, { waitUntil: "load" }); await page.getByTestId("import-template").waitFor({ timeout: 30000 }); await page.waitForTimeout(800);
await page.getByTestId("import-file-input").setInputFiles(path.join(FIX, "bez-zaglavlja.csv"));
await page.waitForTimeout(2500);
if (await page.getByTestId("import-to-mapping").isEnabled().catch(() => false)) {
  await page.getByTestId("import-to-mapping").click();
  await page.waitForTimeout(2000);
  out.push({ file: "bez-zaglavlja.csv (mapping)", snippet: (await page.locator("main").innerText()).slice(0, 1500) });
  await shot(page, `${T}/malformed-bez-zaglavlja-mapping-1440`, { fullPage: true });
}
out.push({ log });
writeFileSync(`docs/qa/audit/${T}/malformed.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await browser.close();
