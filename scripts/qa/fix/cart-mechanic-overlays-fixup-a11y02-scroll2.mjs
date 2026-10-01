/**
 * A11Y-02 re-verification: scroll jump on close, isolated from Playwright auto-scrolling.
 * The opener in the sticky header is clicked with page.mouse at its coordinates (no
 * scrollIntoViewIfNeeded) and the overlay is closed with a real Escape key press.
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/cart-mechanic-overlays-verify-fixup-a11y02-scroll2.mjs [chromium|firefox|webkit]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "../audit/kit.mjs";

const engine = process.argv[2] ?? "chromium";
const OUT = "docs/qa/fix/cart-mechanic-overlays/fixup";
const SHOT = "../fix/cart-mechanic-overlays/fixup";
mkdirSync(OUT, { recursive: true });
const results = [];
const y = (page) => page.evaluate(() => Math.round(scrollY));
const active = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return !el || el === document.body ? "BODY" : `${el.tagName.toLowerCase()}[${el.getAttribute("data-testid") || ""}]`;
  });

const browser = await launch(engine);
try {
  const cases = [
    { w: 1440, h: 900, url: "/delovi/kocioni-diskovi", overlay: "vehicle", sel: "header [data-testid=vehicle-picker-trigger]" },
    { w: 1440, h: 900, url: "/delovi/kocioni-diskovi", overlay: "search", sel: "[data-testid=header-search-trigger]" },
    { w: 1440, h: 900, url: "/delovi/kocioni-diskovi", overlay: "cart", sel: "[data-testid=cart-button]" },
    { w: 1440, h: 900, url: "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", overlay: "vehicle", sel: "header [data-testid=vehicle-picker-trigger]" },
    ...(engine === "chromium"
      ? [
          { w: 390, h: 844, url: "/delovi/kocioni-diskovi", overlay: "search", sel: "header button[aria-label='Pretraga delova']" },
          { w: 390, h: 844, url: "/delovi/kocioni-diskovi", overlay: "mobile-menu", sel: "[data-testid=mobile-menu-trigger]" },
        ]
      : []),
  ];
  for (const c of cases) {
    const ctx = await newContext(browser, { width: c.w, height: c.h, tag: "vfy02s2", engine });
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + c.url, { waitUntil: "load", timeout: 180000 });
      await page.waitForTimeout(3000);
      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(1200);
      const box = await page.locator(`${c.sel}:visible`).first().boundingBox();
      if (!box) {
        results.push({ engine, ...c, skipped: "opener not visible" });
        continue;
      }
      const yStart = await y(page);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(3500);
      const yOpen = await y(page);
      const dialogs = await page.locator("[role=dialog]:visible").count();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
      if (await page.locator("[role=dialog]:visible").count()) await page.keyboard.press("Escape");
      await page.waitForTimeout(1500);
      const rec = { engine, w: c.w, url: c.url, overlay: c.overlay, openerTop: Math.round(box.y), yStart, yOpen, dialogs, yAfterClose: await y(page), activeAfter: await active(page) };
      rec.jump = rec.yAfterClose - rec.yOpen;
      if (c.overlay === "vehicle" && c.w === 1440 && c.url.startsWith("/delovi")) rec.shot = await shot(page, `${SHOT}/fixup-a11y02-scrolljump-${engine}-${c.overlay}-${c.w}`);
      results.push(rec);
      console.log(JSON.stringify(rec));
    } catch (e) {
      results.push({ engine, ...c, error: String(e).slice(0, 300) });
      console.log("ERR", c.overlay, String(e).slice(0, 200));
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/fixup-a11y02-scrolljump-${engine}.json`, JSON.stringify(results, null, 1));
