// motion-3d (second reviewer): feedback between a link click and the new page — 3 runs per path at
// 390 (touch). Records click→URL and click→new <h1> and whether anything signals the pending
// navigation meanwhile (aria-busy, [role=progressbar], a changed cursor/opacity on the clicked link).
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";

const OUT = "docs/qa/audit/motion-3d";
const browser = await launch();
const rows = [];
const paths = [
  ["/delovi/kocioni-diskovi", 'main a[href^="/deo/"]', "category-to-product"],
  ["/deo/kocioni-disk-prednji-276-24-mm-demo-0004", 'main a[href="/delovi/kocioni-diskovi"]', "product-to-category"],
];
for (const [from, sel, label] of paths) {
  for (let run = 1; run <= 3; run++) {
    const ctx = await newContext(browser, { width: 390, height: 844, tag: `m3d-navfb-${label}-${run}` });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${from}`, { waitUntil: "load", timeout: 90_000 });
    await page.waitForTimeout(2500);
    const link = page.locator(sel).first();
    await link.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const oldH1 = (await page.locator("main h1").first().textContent())?.trim();
    await page.evaluate((old) => {
      window.__nf = { t0: performance.now(), url: null, h1: null, busy: 0, progress: 0 };
      const loop = () => {
        const now = performance.now() - window.__nf.t0;
        if (!window.__nf.url && location.pathname !== window.__nfStart) window.__nf.url = Math.round(now);
        const h = document.querySelector("main h1")?.textContent?.trim();
        if (!window.__nf.h1 && h && h !== old) window.__nf.h1 = Math.round(now);
        if (!window.__nf.h1) {
          if (document.querySelector('[aria-busy="true"]')) window.__nf.busy++;
          if (document.querySelector('[role="progressbar"], [data-nav-pending]')) window.__nf.progress++;
        }
        if (now < 12000 && !window.__nf.h1) requestAnimationFrame(loop);
      };
      window.__nfStart = location.pathname;
      requestAnimationFrame(loop);
    }, oldH1);
    await link.tap();
    await page.waitForTimeout(400);
    if (run === 1) await shot(page, `motion-3d/v2-navfb-${label}-400ms`, {});
    await page.waitForFunction(() => window.__nf.h1 !== null, null, { timeout: 15_000 }).catch(() => {});
    const r = await page.evaluate(() => window.__nf);
    rows.push({ label, run, ...r });
    console.log(label, run, JSON.stringify(r));
    await ctx.close();
  }
}
writeFileSync(`${OUT}/v2-navfeedback-390.json`, JSON.stringify(rows, null, 2));
await browser.close();
