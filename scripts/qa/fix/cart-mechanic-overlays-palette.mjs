/** cart-mechanic-overlays: A11Y-02 — admin command palette returns focus to its opener. */
import { BASE, launch, newContext } from "../audit/kit.mjs";
import { loginAdminSafe } from "../audit/flows-import-mech-lib.mjs";
const browser = await launch();
try {
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "fix-pal" });
  const page = await ctx.newPage();
  await loginAdminSafe(page);
  await page.goto(`${BASE}/admin`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const trig = page.locator("button:visible").filter({ hasText: /Broj porudžbine, OEM/ }).first();
  await trig.focus();
  const before = await page.evaluate(() => document.activeElement.textContent.trim().slice(0, 30) || document.activeElement.getAttribute("aria-label"));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
  const open = await page.locator("[role=dialog]").count();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => { const a = document.activeElement; return a === document.body ? "BODY" : a.textContent.trim().slice(0, 30) || a.getAttribute("aria-label"); });
  console.log(JSON.stringify({ before, dialogOpened: open, after }));
  await ctx.close();
} finally {
  await browser.close();
}
