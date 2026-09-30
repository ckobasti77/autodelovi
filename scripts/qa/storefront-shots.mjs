/**
 * Storefront screenshots for review (docs/qa/STOREFRONT.md):
 *   node scripts/qa/storefront-shots.mjs [baseUrl] [name=path ...]
 * Full-page PNGs at 1440 and 390 into docs/qa/screens/step-12/, after scrolling to the end
 * (so the site-wide text reveal has run), plus a console-error and stuck-copy report.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3000";
const pairs = process.argv.slice(3).map((arg) => {
  const i = arg.indexOf("=");
  return { name: arg.slice(0, i), path: arg.slice(i + 1) };
});
const outDir = path.resolve("docs/qa/screens/step-12");
mkdirSync(outDir, { recursive: true });

const widths = [
  { tag: "1440", width: 1440, height: 900 },
  { tag: "390", width: 390, height: 844 },
];

const browser = await chromium.launch();
for (const w of widths) {
  const context = await browser.newContext({
    viewport: { width: w.width, height: w.height },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  if (process.env.CART_SLUG) {
    const prep = await context.newPage();
    await prep.goto(`${base}/deo/${process.env.CART_SLUG}`, { waitUntil: "networkidle", timeout: 90_000 });
    await prep.locator("#buy-box").getByTestId("product-add-to-cart").click();
    await prep.getByText("Dodato").first().waitFor({ timeout: 20_000 });
    await prep.close();
  }
  for (const p of pairs) {
    const page = await context.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${base}${p.path}`, { waitUntil: "networkidle", timeout: 90_000 });
    // Scroll end to end so every reveal fires, then back to the top.
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.6;
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise((r) => setTimeout(r, 900));
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 600));
    });
    const stuck = await page.evaluate(
      () =>
        [...document.querySelectorAll("*")].filter(
          (e) => e.offsetParent && e.textContent.trim() && getComputedStyle(e).opacity === "0",
        ).length,
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    const file = path.join(outDir, `${p.name}-${w.tag}.png`);
    if (p.name.endsWith("-drawer")) {
      await page.getByTestId("cart-button").click();
      await page.getByTestId("cart-drawer").waitFor({ timeout: 20_000 });
      await page.waitForTimeout(900);
      await page.screenshot({ path: file, fullPage: false });
    } else {
      await page.screenshot({ path: file, fullPage: true });
    }
    console.log(
      `${p.name}@${w.tag}: stuck=${stuck} overflowX=${overflow} errors=${errors.length}${errors.length ? ` → ${errors.slice(0, 3).join(" | ")}` : ""}`,
    );
    await page.close();
  }
  await context.close();
}
await browser.close();
