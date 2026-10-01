/**
 * admin-lists-shell (step 22): review screenshots (JPEG, small) of the changed admin screens.
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/admin-lists-shell-shots.mjs
 */
import { mkdirSync } from "node:fs";

import { BASE, launch, loginAdmin, newContext } from "../audit/kit.mjs";

const dir = "docs/qa/fix/admin-lists-shell";
mkdirSync(dir, { recursive: true });
const shots = [
  { name: "1440-proizvodi", w: 1440, h: 900, path: "/admin/proizvodi", wait: "main table tbody tr[data-row]" },
  { name: "1366-porudzbine-sve", w: 1366, h: 768, path: "/admin/porudzbine?status=sve", wait: "main table tbody tr[data-row]" },
  { name: "390-pregled-queue", w: 390, h: 844, path: "/admin", wait: "main h1", scrollTo: "Red čekanja" },
];
const browser = await launch("chromium");
try {
  for (const s of shots) {
    const ctx = await newContext(browser, { width: s.w, height: s.h });
    const page = await ctx.newPage();
    await loginAdmin(page);
    await page.goto(`${BASE}${s.path}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(s.wait, { timeout: 30000 });
    await page.waitForTimeout(2500);
    if (s.scrollTo) await page.getByText(s.scrollTo, { exact: true }).first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}/${s.name}.jpg`, type: "jpeg", quality: 55 });
    await ctx.close();
  }
} finally {
  await browser.close();
}
