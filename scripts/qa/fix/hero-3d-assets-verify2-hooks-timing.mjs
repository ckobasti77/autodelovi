// Step 22 re-verification (round 2), hero-3d-assets / MOT-01 fix-up: how long after
// `page.goto()` resolves (load event) does `window.__sklop3d` (installed by HeroStage's effect
// after hydration) exist? tests/e2e/hero-3d.spec.ts calls `window.__sklop3d!.getState()` right
// after a few poster assertions without waiting for it, so a slow hydration fails the test with
// "Cannot read properties of undefined (reading 'getState')".
// Usage: AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/hero-3d-assets-verify2-hooks-timing.mjs [runs]
import { writeFileSync } from "node:fs";

import { BASE, launch, newContext } from "../audit/kit.mjs";

const RUNS = Number(process.argv[2] ?? 3);
const browser = await launch("chromium");
const rows = [];
try {
  for (const [width, height, query] of [
    [1440, 900, "?3d=high"],
    [390, 844, "?3d=mid"],
  ]) {
    for (let run = 0; run < RUNS; run++) {
      const ctx = await newContext(browser, { width, height, tag: `vfy2-hooks-${width}-${run}` });
      const page = await ctx.newPage();
      try {
        const t0 = Date.now();
        await page.goto(`${BASE}/${query}`);
        const gotoMs = Date.now() - t0;
        const atGoto = await page.evaluate(() => Boolean(window.__sklop3d));
        const t1 = Date.now();
        await page.waitForFunction(() => Boolean(window.__sklop3d), null, { timeout: 30_000 });
        const hooksAfterGotoMs = Date.now() - t1;
        const nav = await page.evaluate(() => {
          const e = performance.getEntriesByType("navigation")[0];
          return { loadEventEnd: Math.round(e.loadEventEnd), domContentLoaded: Math.round(e.domContentLoadedEventEnd) };
        });
        const row = { viewport: `${width}x${height}${query}`, run, gotoMs, hooksPresentWhenGotoResolved: atGoto, hooksAfterGotoMs, ...nav };
        rows.push(row);
        console.log(JSON.stringify(row));
      } finally {
        await ctx.close();
      }
    }
  }
} finally {
  await browser.close();
}
writeFileSync("docs/qa/fix/hero-3d-assets/verify/r2/hooks-timing.json", JSON.stringify(rows, null, 2));
