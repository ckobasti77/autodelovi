/** verify vis-store-02: ads landing for brake pads at 390 (where ad traffic lands). */
import { BASE, launch, newContext, scrollThrough, shot } from "./kit.mjs";
const browser = await launch("chromium");
const ctx = await newContext(browser, { width: 390, height: 844, deviceScaleFactor: 2, tag: "v02-land" });
const page = await ctx.newPage();
await page.goto(`${BASE}/ponuda/kocione-plocice-golf`, { waitUntil: "networkidle" });
await scrollThrough(page);
const img = page.locator('img[src*="kocione-plocice"]').first();
console.log("pad imgs", await page.locator('img[src*="kocione-plocice"]').count());
await img.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -140));
await page.waitForTimeout(1200);
await shot(page, "verify/vis-store/vis-store-02-reproduce-landing-390");
await browser.close();
