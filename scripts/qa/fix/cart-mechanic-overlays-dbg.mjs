import { launch, newContext, BASE } from "../audit/kit.mjs";
const browser = await launch();
try {
  const ctx = await newContext(browser, { width: 1440, height: 844, tag: "fixdbg" });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.text().startsWith("FOCUS")) console.log(m.text().slice(0, 900)); });
  await page.addInitScript(() => {
    const orig = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (...a) { console.log("FOCUS " + this.tagName + "#" + this.id + " " + (this.getAttribute("aria-expanded") ?? "") + "\n" + new Error().stack.split("\n").slice(2, 7).join("\n")); return orig.apply(this, a); };
  });
  await page.goto(BASE + "/delovi/kocioni-diskovi", { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.locator("header [aria-keyshortcuts='/']:visible").first().focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
  console.log("EXP", await page.evaluate(() => [...document.querySelectorAll('[aria-haspopup="dialog"]')].map(e => e.getAttribute("aria-expanded") + ":" + e.getClientRects().length).join(",")));
  await page.keyboard.press("Escape"); await page.waitForTimeout(900);
  await ctx.close();
} finally { await browser.close(); }
