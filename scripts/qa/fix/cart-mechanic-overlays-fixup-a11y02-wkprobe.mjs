/**
 * A11Y-02 fix-up probe: WebKit header search opened by a raw mouse click at y=1200 (waits for the
 * lazy panel), closed with Escape; logs focus() calls and the scroll position.
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/cart-mechanic-overlays-fixup-a11y02-wkprobe.mjs
 */
import { BASE, launch, newContext } from "../audit/kit.mjs";
const browser = await launch("webkit");
try {
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "fx02wk", engine: "webkit" });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__log = [];
    const orig = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (opts) {
      const r = this.getBoundingClientRect();
      orig.call(this, opts);
      window.__log.push(`${this.tagName}[${this.getAttribute("data-testid") || this.id || ""}] top=${Math.round(r.top)} h=${Math.round(r.height)} ok=${document.activeElement === this}`);
    };
    document.addEventListener("focusin", (e) => window.__log.push(`in ${e.target.tagName}[${e.target.getAttribute?.("data-testid") || ""}]`), true);
  });
  await page.goto(BASE + "/delovi/kocioni-diskovi", { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(3000);
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(1200);
  const yStart = await page.evaluate(() => Math.round(scrollY));
  const box = await page.locator("[data-testid=header-search-trigger]:visible").first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForSelector("[role=dialog]", { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1500);
  await page.evaluate(() => window.__log.push("--- open done, active=" + document.activeElement?.tagName + " dialogs=" + document.querySelectorAll("[role=dialog]").length + " expanded=" + document.querySelector("[data-testid=header-search-trigger]")?.getAttribute("aria-expanded")));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  const open = await page.locator("[role=dialog]:visible").count();
  if (open) await page.keyboard.press("Escape");
  await page.waitForTimeout(1500);
  const dlg = await page.evaluate(() => [...document.querySelectorAll("[role=dialog]")].map((d) => d.getAttribute("aria-label") + ":" + d.getBoundingClientRect().height));
  const yAfter = await page.evaluate(() => Math.round(scrollY));
  console.log(JSON.stringify({ yStart, yAfter, jump: yAfter - yStart, dlg, secondEscape: !!open, active: await page.evaluate(() => document.activeElement?.tagName + "[" + (document.activeElement?.getAttribute("data-testid") || "") + "]"), log: await page.evaluate(() => window.__log) }, null, 1));
  await ctx.close();
} finally {
  await browser.close();
}
