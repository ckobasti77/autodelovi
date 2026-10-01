/** cart-mechanic-overlays: XB-02 picker panel stays put across steps; A11Y-02 parts list focus return; VIS-23 sticky cart bar. */
import { BASE, launch, newContext, shot } from "../audit/kit.mjs";
const browser = await launch();
try {
  // XB-02 + parts list at 1440.
  {
    const ctx = await newContext(browser, { width: 1440, height: 900, tag: "fix-misc" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    const pickerReq = [];
    page.on("request", (r) => { if (/VehiclePickerDialog|vehicle_VehiclePicker/i.test(r.url())) pickerReq.push(r.url().slice(-60)); });
    await page.locator("[data-testid=vehicle-picker-trigger]:visible").first().click();
    await page.waitForTimeout(1500);
    const top = () => page.evaluate(() => Math.round(document.querySelector("[role=dialog] h2")?.getBoundingClientRect().top ?? -1));
    const tops = [await top()];
    for (let step = 0; step < 2; step++) {
      const opt = page.locator("[role=dialog] button, [role=dialog] [role=option]").filter({ hasText: /\S/ }).nth(2);
      await opt.click().catch(() => {});
      await page.waitForTimeout(1500);
      tops.push(await top());
    }
    console.log("XB-02 title top per step", tops);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
    const pl = page.getByTestId("parts-list-trigger").first();
    if (await pl.count()) {
      await pl.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1500);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(900);
      console.log("A11Y-02 parts list focus after Escape:", await page.evaluate(() => { const a = document.activeElement; return a === document.body ? "BODY" : `${a.tagName}[${a.getAttribute("data-testid") ?? a.textContent.trim().slice(0, 30)}]`; }));
    } else console.log("parts list trigger not found");
    await ctx.close();
  }
  // VIS-23 at 390 with 5 lines.
  {
    const ctx = await newContext(browser, { width: 390, height: 844, tag: "fix-misc" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    const hrefs = await page.locator("a[href^='/deo/']").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")))].slice(0, 5));
    for (const href of hrefs) {
      await page.goto(BASE + href, { waitUntil: "load" });
      await page.waitForTimeout(1000);
      await page.getByTestId("product-add-to-cart").first().click();
      await page.waitForTimeout(1200);
      await page.keyboard.press("Escape");
    }
    await page.goto(`${BASE}/korpa`, { waitUntil: "load" });
    await page.getByTestId("cart-line").first().waitFor({ timeout: 60000 });
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const cta = [...document.querySelectorAll('[data-testid="cart-checkout"]')];
      const r = cta[0]?.getBoundingClientRect();
      return { ctaCount: cta.length, ctaTop: r ? Math.round(r.top) : null, vh: innerHeight, spb: document.documentElement.style.scrollPaddingBottom };
    });
    console.log("VIS-23", JSON.stringify(m));
    await shot(page, "../fix/cart-mechanic-overlays/vis23-cart-sticky-390");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
    await shot(page, "../fix/cart-mechanic-overlays/vis23-cart-sticky-390-end");
    await ctx.close();
  }
} finally {
  await browser.close();
}
