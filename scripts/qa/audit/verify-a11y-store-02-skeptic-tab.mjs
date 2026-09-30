/** verify a11y-store-02 (skeptic): real Tab walk to the header vehicle chip, Enter, Escape. */
import { launch, newContext, BASE } from "./kit.mjs";
const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "vfy02tab" });
const page = await ctx.newPage();
await page.goto(BASE + "/", { waitUntil: "load", timeout: 180000 });
await page.waitForTimeout(2500);
let tabs = 0, hit = false;
for (; tabs < 40; tabs++) {
  await page.keyboard.press("Tab");
  if (await page.evaluate(() => document.activeElement?.getAttribute("data-testid") === "vehicle-picker-trigger")) { hit = true; break; }
}
const fv = await page.evaluate(() => document.activeElement.matches(":focus-visible"));
await page.keyboard.press("Enter"); await page.waitForTimeout(1500);
await page.keyboard.press("Escape"); await page.waitForTimeout(1200);
const after = await page.evaluate(() => (document.activeElement === document.body ? "BODY" : document.activeElement.outerHTML.slice(0, 100)));
console.log(JSON.stringify({ tabsToChip: tabs + 1, hit, focusVisibleBefore: fv, after }));
await browser.close();
