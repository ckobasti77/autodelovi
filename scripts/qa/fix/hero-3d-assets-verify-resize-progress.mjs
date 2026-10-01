// Step 22 verifier (hero-3d-assets, MOT-01): after a live resize from the tablet crop to the
// desktop crop, is the canvas at the progress the scroll position implies? Separates a crop/camera
// problem from a ScrollTrigger refresh timing problem.
// Usage: AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/hero-3d-assets-verify-resize-progress.mjs
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext } from "../audit/kit.mjs";

const browser = await launch();
const out = [];
try {
  const ctx = await newContext(browser, { width: 800, height: 1000, mobile: true, tag: "vfy-m01-rp" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?3d=mid`, { waitUntil: "networkidle" });
  await page.evaluate(() =>
    document.querySelector('[data-testid="home-hero"]').dispatchEvent(new FocusEvent("focusin", { bubbles: true })),
  );
  await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 120_000 });
  const probe = async (label) => {
    const r = await page.evaluate(() => {
      const t = document.querySelector('[data-testid="hero-track"]');
      const h = document.querySelector("header")?.getBoundingClientRect().height ?? 64;
      const s = window.__sklop3d.getState();
      return {
        scrollY: Math.round(scrollY),
        trackTopDoc: Math.round(t.getBoundingClientRect().top + scrollY - h),
        trackH: Math.round(t.getBoundingClientRect().height),
        progress: +s.progress.toFixed(3),
        stage: s.stage,
      };
    });
    out.push({ label, ...r });
    console.log(label, JSON.stringify(r));
  };
  const toTrack = async () => {
    const y = await page.evaluate(() => {
      const t = document.querySelector('[data-testid="hero-track"]');
      const h = document.querySelector("header")?.getBoundingClientRect().height ?? 64;
      return Math.round(t.getBoundingClientRect().top + scrollY - h);
    });
    await page.evaluate((v) => window.scrollTo(0, v), y);
  };
  await toTrack();
  await page.waitForTimeout(1500);
  await probe("800x1000 at track top");
  await page.setViewportSize({ width: 1100, height: 800 });
  for (const ms of [300, 1500, 4000]) {
    await page.waitForTimeout(ms);
    await probe(`1100x800 +${ms}ms (no re-scroll)`);
  }
  await toTrack();
  for (const ms of [300, 1500, 4000]) {
    await page.waitForTimeout(ms);
    await probe(`1100x800 re-scrolled to track top +${ms}ms`);
  }
  await page.evaluate(() => window.scrollBy(0, 40));
  await page.waitForTimeout(800);
  await toTrack();
  await page.waitForTimeout(1500);
  await probe("1100x800 after a small user scroll back to the track top");
  await ctx.close();
} finally {
  await browser.close();
}
writeFileSync("docs/qa/fix/hero-3d-assets/verify/regress-resize-progress.json", JSON.stringify(out, null, 2));
