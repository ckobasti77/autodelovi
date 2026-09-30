/** Step 21 verification (flows-import-mech-06): logged „primljena“ e-mail of SK-2026-000131, HTML + text. */
import { writeFileSync } from "node:fs";

import { BASE, launch, newContext, shot, watch } from "./kit.mjs";
import { loginAdminSafe } from "./flows-import-mech-lib.mjs";

const V = "verify/flows-import-mech";
const out = {};
const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-fim-c" });
const page = await ctx.newPage();
const log = watch(page);
await loginAdminSafe(page);
try {
  await page.goto(`${BASE}/admin/mejlovi?sablon=order_received`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(6000);
  let row = page.getByRole("row").filter({ hasText: "SK-2026-000131" }).first();
  for (let i = 0; i < 8 && !(await row.count()); i++) {
    const more = page.getByRole("button", { name: /Učitaj još|Prikaži još|Još/i }).first();
    if (!(await more.count())) break;
    await more.click();
    await page.waitForTimeout(2500);
    row = page.getByRole("row").filter({ hasText: "SK-2026-000131" }).first();
  }
  out.found = await row.count();
  if (out.found) {
    await row.click();
    await page.waitForTimeout(4000);
    const dlg = page.getByRole("dialog").first();
    out.html = await dlg.evaluate((d) => {
      const f = d.querySelector("iframe");
      try { return f?.contentDocument?.body?.innerText?.slice(0, 3000) ?? null; } catch { return null; }
    });
    await shot(page, `${V}/flows-import-mech-06-reproduce-email-html`);
    const tekst = dlg.getByRole("radio", { name: /Tekst/i }).or(dlg.getByRole("tab", { name: /Tekst/i })).first();
    if (await tekst.count()) {
      await tekst.click();
      await page.waitForTimeout(1500);
      out.text = (await dlg.innerText()).slice(0, 4000);
      await shot(page, `${V}/flows-import-mech-06-reproduce-email-text`);
    }
  } else out.list = (await page.locator("main").innerText()).slice(0, 2000);
} catch (e) {
  out.ERROR = String(e).slice(0, 600);
} finally {
  out.log = log;
  writeFileSync(`docs/qa/audit/${V}/flows-import-mech-06-reproduce-email.json`, JSON.stringify(out, null, 2));
  await browser.close();
}
