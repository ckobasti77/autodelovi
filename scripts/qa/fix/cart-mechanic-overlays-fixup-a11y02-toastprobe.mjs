/**
 * A11Y-02 fix-up probe: cart drawer opened from the add-to-cart toast action (390), run twice
 * in one page to separate "tracker installed late (lazy chunk)" from other causes.
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/cart-mechanic-overlays-fixup-a11y02-toastprobe.mjs
 */
import { BASE, launch, newContext } from "../audit/kit.mjs";

const PRODUCT = "/deo/kocioni-disk-prednji-276-24-mm-demo-0004";
const act = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    return `${el.tagName.toLowerCase()}[${el.getAttribute("data-testid") || ""}] "${(el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30)}"`;
  });
const browser = await launch("chromium");
try {
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "fx02t" });
  const page = await ctx.newPage();
  await page.goto(BASE + PRODUCT, { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(2500);
  for (let round = 1; round <= 2; round++) {
    const add = page.getByTestId("product-add-to-cart").first();
    await add.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Pogledaj korpu" }).first().focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2200);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1200);
    const addRect = await add.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), connected: el.isConnected, vh: innerHeight };
    });
    console.log(JSON.stringify({ round, after: await act(page), addRect }));
  }
  await ctx.close();
} finally {
  await browser.close();
}
