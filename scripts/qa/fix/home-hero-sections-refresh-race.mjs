// MOT-05 mechanism check (home-hero-sections): a ScrollTrigger refresh that lands while the
// scrubbed explode is still catching up must not freeze the hero on a stale progress.
// Scrolls / to 1500, jumps back to 0 and forces a refresh (viewport resize) mid-scrub.
// Usage: AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/home-hero-sections-refresh-race.mjs
import { BASE, launch, newContext } from "../audit/kit.mjs";

const browser = await launch();
const rows = [];
try {
  for (const delay of [60, 150, 300, 450]) {
    const ctx = await newContext(browser, { width: 1440, height: 900, tag: "hh-race" });
    try {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/`, { waitUntil: "load" });
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.scrollTo(0, 1500));
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(delay);
      await page.setViewportSize({ width: 1440, height: 899 });
      await page.waitForTimeout(80);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(3000);
      const s = await page.evaluate(() => ({ y: window.scrollY, ...window.__sklop3d.getState() }));
      rows.push({ delay, y: s.y, p: s.progress, stage: s.stage, ok: s.y === 0 && s.progress === 0 && s.stage === 0 });
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
for (const r of rows) console.log(r.ok ? "ok " : "BAD", `refresh ${r.delay}ms after scroll-to-top → y${r.y} p${r.p} stage ${r.stage}`);
console.log(`SUMMARY ${rows.filter((r) => r.ok).length}/${rows.length} ok`);
