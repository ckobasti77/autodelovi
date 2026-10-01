// Step 22 verifier (hero-3d-assets, MOT-01): poster ↔ canvas pixel parity for the phone and
// the new tablet crop (mid tier, p = 0). Screenshots the stage with the canvas, then with only
// the poster underneath, and reports the mean absolute difference (0–255) plus a diff image.
// Usage: AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/hero-3d-assets-verify-parity.mjs
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { BASE, launch, newContext } from "../audit/kit.mjs";

const OUT = "docs/qa/fix/hero-3d-assets/verify";
const HIDE = `[data-testid="hero-track"] .pointer-events-none.absolute.inset-0.px-page{visibility:hidden!important}
  [data-testid="hero-track"] span.h-0\.5, #hero-copy, [data-testid="hero-track"] .z-\[4\]{visibility:hidden!important}`;
const browser = await launch();
const out = [];
try {
  for (const [w, h] of [
    [390, 844],
    [768, 1024],
    [900, 1200],
  ]) {
    const ctx = await newContext(browser, { width: w, height: h, tag: `vfy-m01-parity-${w}` });
    try {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/?3d=mid`, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
      const y = await page.evaluate(() => {
        const t = document.querySelector('[data-testid="hero-track"]');
        const hh = document.querySelector("header")?.getBoundingClientRect().height ?? 64;
        return Math.round(t.getBoundingClientRect().top + scrollY - hh);
      });
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.evaluate(() =>
        document.querySelector('[data-testid="home-hero"]').dispatchEvent(new FocusEvent("focusin", { bubbles: true })),
      );
      await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 120_000 });
      await page.waitForTimeout(2500);
      const clip = await page.evaluate(() => {
        const r = document.querySelector('[data-testid="hero-track"] [role="img"]').getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });
      await page.addStyleTag({ content: HIDE });
      await page.waitForTimeout(200);
      const canvas = await page.screenshot({ type: "png", clip });
      await page.addStyleTag({
        content: `[data-testid="hero-canvas"]{visibility:hidden!important}[data-testid="hero-poster"]{opacity:1!important;visibility:visible!important}`,
      });
      await page.waitForTimeout(300);
      const poster = await page.screenshot({ type: "png", clip });
      const a = await sharp(canvas).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const b = await sharp(poster).removeAlpha().raw().toBuffer();
      const diff = Buffer.alloc(a.data.length);
      let sum = 0;
      for (let i = 0; i < a.data.length; i++) {
        const d = Math.abs(a.data[i] - b[i]);
        sum += d;
        diff[i] = Math.min(255, d * 4);
      }
      const mean = +(sum / a.data.length).toFixed(2);
      await sharp(diff, { raw: { width: a.info.width, height: a.info.height, channels: a.info.channels } })
        .webp({ quality: 70 })
        .toFile(`${OUT}/parity-${w}x${h}-diff-x4.webp`);
      const src = await page.evaluate(() => document.querySelector('[data-testid="hero-poster-image"] img')?.currentSrc?.replace(/^.*\/images\/hero\//, ""));
      const st = await page.evaluate(() => window.__sklop3d.getState());
      out.push({ viewport: `${w}x${h}`, poster: src, tier: st.tier, progress: st.progress, meanAbsDiff: mean });
      console.log(`${w}x${h}: poster ${src} tier ${st.tier} p ${st.progress} mean |canvas-poster| ${mean}/255`);
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/parity.json`, JSON.stringify(out, null, 2));
