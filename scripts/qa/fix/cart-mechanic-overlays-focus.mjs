/** cart-mechanic-overlays: A11Y-02 focus return for trigger-less overlays (vehicle picker, cart drawer, header search). */
import { launch, newContext, BASE } from "../audit/kit.mjs";
const active = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return "BODY";
    return `${a.tagName}#${a.id}[${a.getAttribute("aria-label") ?? a.textContent.trim().slice(0, 40)}]`;
  });
const browser = await launch();
const out = [];
try {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    // Vehicle picker: header chip and hero trigger, Escape and „Zatvori“.
    for (const which of ["first", "last"]) {
      for (const how of ["Escape", "Zatvori"]) {
        const ctx = await newContext(browser, { width: w, height: h, tag: "fixfocus" });
        const page = await ctx.newPage();
        await page.goto(BASE + "/", { waitUntil: "load", timeout: 180000 });
        await page.waitForTimeout(2000);
        const trigs = page.locator("[data-testid=vehicle-picker-trigger]:visible");
        const t = which === "first" ? trigs.first() : trigs.last();
        await t.focus();
        const before = await active(page);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(1500);
        if (how === "Escape") await page.keyboard.press("Escape");
        else {
          await page.locator("[role=dialog]").last().getByRole("button", { name: "Zatvori" }).focus();
          await page.keyboard.press("Enter");
        }
        await page.waitForTimeout(900);
        out.push({ overlay: "vehicle", w, which, how, before, after: await active(page) });
        await ctx.close();
      }
    }
    // Cart drawer from the header cart button.
    {
      const ctx = await newContext(browser, { width: w, height: h, tag: "fixfocus" });
      const page = await ctx.newPage();
      await page.goto(BASE + "/delovi/kocioni-diskovi", { waitUntil: "load", timeout: 180000 });
      await page.waitForTimeout(1500);
      const href = await page.locator("a[href^='/deo/']").first().getAttribute("href");
      await page.goto(BASE + href, { waitUntil: "load", timeout: 180000 });
      await page.waitForTimeout(1500);
      await page.getByTestId("product-add-to-cart").first().click();
      await page.waitForTimeout(1500);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
      const cart = page.locator("header a[href='/korpa'], header button[aria-label^='Korpa']").first();
      await cart.focus();
      const before = await active(page);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1200);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(900);
      out.push({ overlay: "cart", w, before, after: await active(page) });
      await ctx.close();
    }
    // Header search.
    {
      const ctx = await newContext(browser, { width: w, height: h, tag: "fixfocus" });
      const page = await ctx.newPage();
      await page.goto(BASE + "/delovi/kocioni-diskovi", { waitUntil: "load", timeout: 180000 });
      await page.waitForTimeout(1500);
      const s = page.locator("header [aria-keyshortcuts='/']:visible").first();
      await s.focus();
      const before = await active(page);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1200);
      await page.keyboard.type("disk");
      await page.waitForTimeout(600);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(900);
      out.push({ overlay: "search", w, before, after: await active(page) });
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
for (const r of out) console.log(JSON.stringify(r));
console.log("BODY count:", out.filter((r) => r.after === "BODY").length, "of", out.length);
