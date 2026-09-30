/**
 * a11y-store: visual focus indicator on the quantity stepper input (product page + cart page),
 * captured as a zoomed element screenshot with computed styles of the input and its group.
 *   node scripts/qa/audit/a11y-store-qtyfocus.mjs
 */
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { launch, newContext, BASE } from "./kit.mjs";

const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "a11yqty", deviceScaleFactor: 2 });
const page = await ctx.newPage();
const out = {};
await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "domcontentloaded", timeout: 240000 });
await page.getByTestId("product-add-to-cart").first().waitFor({ timeout: 120000 });
await page.waitForTimeout(2500);
const grp = page.locator('[role=group][aria-label^="Količina"]').first();
await grp.scrollIntoViewIfNeeded();
const styles = () =>
  page.evaluate(() => {
    const el = document.activeElement;
    const g = el.closest("[role=group]");
    const cs = (e) => {
      const s = getComputedStyle(e);
      return { outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, shadow: s.boxShadow.slice(0, 120), border: `${s.borderTopWidth} ${s.borderTopColor}`, bg: s.backgroundColor };
    };
    return { focused: `${el.tagName} ${el.getAttribute("aria-label")}`, input: cs(el), group: g ? cs(g) : null, focusVisible: el.matches(":focus-visible") };
  });
// unfocused baseline
const box = await grp.boundingBox();
const clip = { x: box.x - 16, y: box.y - 16, width: box.width + 32, height: box.height + 32 };
const base = await page.screenshot({ clip, type: "png" });
// keyboard focus: tab from the button before the stepper
await page.getByRole("button", { name: /Izaberite vozilo da proverimo/ }).first().focus();
for (let i = 0; i < 6; i++) {
  await page.keyboard.press("Tab");
  await page.waitForTimeout(80);
  const ok = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Količina");
  if (ok) break;
}
out.product = await styles();
const foc = await page.screenshot({ clip, type: "png" });
await sharp({ create: { width: Math.round(clip.width * 2), height: Math.round(clip.height * 4) + 20, channels: 3, background: "#ffffff" } })
  .composite([
    { input: base, top: 0, left: 0 },
    { input: foc, top: Math.round(clip.height * 2) + 20, left: 0 },
  ])
  .webp({ quality: 80 })
  .toFile("docs/qa/audit/a11y-store/qty-focus-product-1440.webp");
console.log(JSON.stringify(out, null, 1));
writeFileSync("docs/qa/audit/a11y-store/qty-focus.json", JSON.stringify(out, null, 1));
await browser.close();
