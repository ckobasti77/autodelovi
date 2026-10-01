/**
 * A11Y-02 re-verification: does closing a trigger-less overlay move the page scroll?
 * Opens the cart drawer / header search / vehicle picker from the sticky header while the page
 * is scrolled, closes it, and logs scrollY and focus events over time.
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/cart-mechanic-overlays-verify-a11y02-scroll.mjs [chromium|webkit]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext } from "../audit/kit.mjs";

const engine = process.argv[2] ?? "chromium";
const OUT = "docs/qa/fix/cart-mechanic-overlays/verify";
mkdirSync(OUT, { recursive: true });
const results = [];

const instrument = (page) =>
  page.evaluate(() => {
    window.__log = [];
    const t0 = performance.now();
    const d = (el) =>
      !el || el === document.body
        ? "BODY"
        : `${el.tagName.toLowerCase()}[${el.getAttribute("data-testid") || ""}]"${(el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 20)}"`;
    let lastY = Math.round(scrollY);
    window.addEventListener("scroll", () => {
      const y = Math.round(scrollY);
      if (y !== lastY) window.__log.push(`${Math.round(performance.now() - t0)} scroll ${lastY}->${y} active=${d(document.activeElement)}`);
      lastY = y;
    });
    document.addEventListener("focusin", (e) => window.__log.push(`${Math.round(performance.now() - t0)} focusin ${d(e.target)} y=${Math.round(scrollY)}`), true);
  });

const browser = await launch(engine);
try {
  for (const overlay of ["cart", "search", "vehicle"]) {
    for (const how of ["mouse", "keyboard"]) {
      const ctx = await newContext(browser, { width: 1440, height: 900, tag: "vfy02s", engine });
      const page = await ctx.newPage();
      try {
        await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "load", timeout: 180000 });
        await page.waitForTimeout(3000);
        await page.evaluate(() => window.scrollTo(0, 1200));
        await page.waitForTimeout(800);
        await instrument(page);
        const opener =
          overlay === "cart"
            ? page.locator("[data-testid=cart-button]:visible").first()
            : overlay === "search"
              ? page.getByTestId("header-search-trigger")
              : page.locator("header [data-testid=vehicle-picker-trigger]:visible").first();
        const y0 = await page.evaluate(() => Math.round(scrollY));
        if (how === "mouse") await opener.click();
        else {
          await opener.focus();
          await page.keyboard.press("Enter");
        }
        await page.waitForTimeout(2200);
        const dialog = await page.locator("[role=dialog]:visible").count();
        const yOpen = await page.evaluate(() => Math.round(scrollY));
        if (how === "mouse") await page.locator("[role=dialog]:visible").last().getByRole("button", { name: "Zatvori" }).first().click();
        else await page.keyboard.press("Escape");
        await page.waitForTimeout(1500);
        const rec = {
          engine,
          overlay,
          how,
          url: page.url().replace(BASE, ""),
          dialog,
          y0,
          yOpen,
          yAfter: await page.evaluate(() => Math.round(scrollY)),
          log: await page.evaluate(() => window.__log),
        };
        results.push(rec);
        console.log(JSON.stringify(rec));
      } catch (e) {
        results.push({ engine, overlay, how, error: String(e).slice(0, 300) });
        console.log("ERR", overlay, how, String(e).slice(0, 200));
      } finally {
        await ctx.close();
      }
    }
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/a11y02-scroll-${engine}.json`, JSON.stringify(results, null, 1));
