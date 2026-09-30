/** a11y-store: vehicle picker focus return (Escape and „Zatvori“) from header chip and hero trigger. */
import { launch, newContext, BASE, shot } from "./kit.mjs";
const browser = await launch();
const out = [];
for (const [w, h] of [[1440, 900], [390, 844]]) {
  for (const which of ["first", "last"]) {
    for (const how of ["Escape", "Zatvori"]) {
      const ctx = await newContext(browser, { width: w, height: h, tag: "a11yvehf" });
      const page = await ctx.newPage();
      await page.goto(BASE + "/", { waitUntil: "load", timeout: 180000 }); await page.waitForTimeout(1500);
      await page.waitForTimeout(800);
      const trigs = page.locator("[data-testid=vehicle-picker-trigger]:visible");
      const n = await trigs.count();
      const t = which === "first" ? trigs.first() : trigs.last();
      await t.focus();
      const before = await page.evaluate(() => document.activeElement.outerHTML.slice(0, 120));
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1500);
      if (how === "Escape") await page.keyboard.press("Escape");
      else {
        await page.locator("[role=dialog]").last().getByRole("button", { name: "Zatvori" }).focus();
        await page.keyboard.press("Enter");
      }
      await page.waitForTimeout(900);
      const after = await page.evaluate(() => {
        const a = document.activeElement;
        return a === document.body ? "BODY" : a.outerHTML.slice(0, 120);
      });
      out.push({ w, triggers: n, which, how, before, after });
      if (after === "BODY" && w === 1440 && which === "first" && how === "Escape") await shot(page, "a11y-store/vehicle-escape-focus-lost-1440");
      await ctx.close();
    }
  }
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
