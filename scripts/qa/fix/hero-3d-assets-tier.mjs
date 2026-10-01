// hero-3d-assets (step 22, PERF-23 / PERF-16): tier on SwiftShader with and without the QA
// override, and the context's antialias attribute at DPR 1 and DPR 2 on the high tier.
// Usage: AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/hero-3d-assets-tier.mjs
import { BASE, launch, newContext } from "../audit/kit.mjs";

const browser = await launch();
try {
  for (const [query, dpr] of [["", 1], ["?3d=high", 1], ["?3d=high", 2]]) {
    const ctx = await newContext(browser, { width: 1440, height: 900, deviceScaleFactor: dpr, tag: "fix-tier" });
    try {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/${query}`, { waitUntil: "networkidle" });
      await page.evaluate(() =>
        document.querySelector('[data-testid="home-hero"]').dispatchEvent(new FocusEvent("focusin", { bubbles: true })),
      );
      await page.waitForFunction(() => {
        const s = window.__sklop3d?.getState();
        return s && (s.status === "ready" || s.tier === "low");
      }, null, { timeout: 120_000 });
      await page.waitForTimeout(1500);
      const r = await page.evaluate(() => {
        const s = window.__sklop3d.getState();
        const canvas = document.querySelector('[data-testid="hero-track"] canvas');
        const gl = canvas?.getContext("webgl2");
        return { tier: s.tier, status: s.status, canvas: Boolean(canvas), antialias: gl?.getContextAttributes()?.antialias ?? null, size: canvas ? `${canvas.width}x${canvas.height}` : null };
      });
      console.log(`${query || "(no override)"} dpr ${dpr}: ${JSON.stringify(r)}`);
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
