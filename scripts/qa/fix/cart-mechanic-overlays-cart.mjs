/** cart-mechanic-overlays: A11Y-09 (focus + announcement on line removal / quantity), VIS-10 stepper size, VIS-27 layout. */
import { BASE, launch, newContext, shot } from "../audit/kit.mjs";
const browser = await launch();
const act = (page) => page.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return "BODY";
  return `${a.tagName}[${(a.getAttribute("aria-label") ?? a.textContent).trim().slice(0, 50)}]`;
});
const live = (page) => page.evaluate(() => document.getElementById("cart-live")?.textContent ?? "(none)");
try {
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const ctx = await newContext(browser, { width: w, height: h, tag: "fix-cart" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    const hrefs = await page.locator("a[href^='/deo/']").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")))].slice(0, 3));
    for (const href of hrefs) {
      await page.goto(BASE + href, { waitUntil: "load" });
      await page.waitForTimeout(1200);
      await page.getByTestId("product-add-to-cart").first().click();
      await page.waitForTimeout(1500);
      await page.keyboard.press("Escape");
    }
    await page.goto(`${BASE}/korpa`, { waitUntil: "load" });
    await page.getByTestId("cart-line").first().waitFor({ timeout: 60000 });
    await page.waitForTimeout(1500);
    const sizes = await page.evaluate(() => [...document.querySelectorAll('[aria-label="Povećaj količinu"], [aria-label^="Ukloni "]')].slice(0, 2).map((b) => `${b.getAttribute("aria-label").slice(0, 12)} ${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`));
    const lineH = await page.getByTestId("cart-line").first().evaluate((e) => Math.round(e.getBoundingClientRect().height));
    console.log(w, "lines", await page.getByTestId("cart-line").count(), "sizes", sizes, "lineH", lineH);
    await shot(page, `../fix/cart-mechanic-overlays/cart-page-${w}`);
    // Quantity +1 with the keyboard.
    await page.getByRole("button", { name: "Povećaj količinu" }).first().focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);
    console.log(w, "after +1 live:", await live(page));
    // Remove the first line with the keyboard.
    await page.getByRole("button", { name: /^Ukloni / }).first().focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);
    console.log(w, "after remove first: focus", await act(page), "live:", await live(page));
    // Remove the remaining lines; the last removal lands on the empty-state heading.
    for (let i = 0; i < 5; i++) {
      const b = page.getByRole("button", { name: /^Ukloni / }).last();
      if (!(await b.count())) break;
      await b.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);
      console.log(w, `remove #${i + 2}: focus`, await act(page), "live:", await live(page));
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
