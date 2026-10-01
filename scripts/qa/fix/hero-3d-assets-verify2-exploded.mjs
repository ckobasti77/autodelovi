// Step 22 re-verification (round 2), hero-3d-assets / MOT-01: the re-solved exploded phone and
// tablet cameras still fit the stage. Live canvas (?3d=mid) and the low-tier exploded poster
// (?3d=low), both at progress 1, with the stage furniture hidden; bbox of non-background pixels.
// Usage: AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/hero-3d-assets-verify2-exploded.mjs
import { mkdirSync, writeFileSync } from "node:fs";

import sharp from "sharp";

import { BASE, launch, newContext } from "../audit/kit.mjs";

const OUT = "docs/qa/fix/hero-3d-assets/verify/r2";
mkdirSync(OUT, { recursive: true });

function bbox(data, W, H, ch) {
  const bg = [0, 1, 2].map((c) => data[(2 * W + 2) * ch + c]);
  let minX = W, minY = H, maxX = -1, maxY = -1;
  const rows = new Array(H).fill(0);
  const cols = new Array(W).fill(0);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch;
      const d = Math.max(...[0, 1, 2].map((c) => Math.abs(data[i + c] - bg[c])));
      if (d > 18) {
        rows[y]++;
        cols[x]++;
      }
    }
  for (let y = 0; y < H; y++) if (rows[y] >= 2) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let x = 0; x < W; x++) if (cols[x] >= 2) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, right: W - 1 - maxX, bottom: H - 1 - maxY };
}

const browser = await launch("chromium");
const rows = [];
try {
  for (const [width, height] of [[390, 844], [768, 1024]]) {
    for (const tier of ["mid", "low"]) {
      const ctx = await newContext(browser, { width, height, tag: `vfy2-expl-${width}-${tier}` });
      const page = await ctx.newPage();
      try {
        await page.goto(`${BASE}/?3d=${tier}`, { waitUntil: "load", timeout: 90_000 });
        await page.waitForFunction(() => Boolean(window.__sklop3d), null, { timeout: 60_000 });
        const trackTop = await page.evaluate(() => {
          const t = document.querySelector('[data-testid="hero-track"]');
          const hh = document.querySelector("header")?.getBoundingClientRect().height ?? 64;
          return Math.round(t.getBoundingClientRect().top + scrollY - hh);
        });
        await page.evaluate((y) => window.scrollTo(0, y), trackTop);
        if (tier === "mid") await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 120_000 });
        else await page.waitForFunction(() => window.__sklop3d?.tier === "low");
        await page.evaluate(() => window.__sklop3d.explode(1));
        await page.waitForFunction(() => window.__sklop3d.getState().progress > 0.99, null, { timeout: 30_000 });
        await page.waitForTimeout(2000);
        await page.addStyleTag({
          content: `[data-testid="hero-track"] .pointer-events-none.absolute.inset-0.px-page{visibility:hidden!important}`,
        });
        await page.waitForTimeout(200);
        const S = await page.evaluate(() => {
          const r = document.querySelector('[data-testid="hero-track"] [role="img"]').getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        });
        const png = await page.screenshot({ type: "png", clip: { x: S.x, y: S.y, width: S.w, height: S.h } });
        const r = await sharp(png).raw().toBuffer({ resolveWithObject: true });
        const b = bbox(r.data, r.info.width, r.info.height, r.info.channels);
        const state = await page.evaluate(() => window.__sklop3d.getState());
        await sharp(png).webp({ quality: 70 }).toFile(`${OUT}/exploded-${width}x${height}-${tier}.webp`);
        const row = {
          viewport: `${width}x${height}`,
          tier: state.tier,
          status: state.status,
          progress: state.progress,
          stage: { w: Math.round(S.w), h: Math.round(S.h) },
          bbox: b,
          insideStage: b.x > 0 && b.y > 0 && b.right > 0 && b.bottom > 0,
        };
        rows.push(row);
        console.log(JSON.stringify(row));
      } catch (e) {
        rows.push({ viewport: `${width}x${height}`, tier, error: String(e).slice(0, 200) });
        console.log(JSON.stringify(rows.at(-1)));
      } finally {
        await ctx.close();
      }
    }
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/exploded-fit.json`, JSON.stringify(rows, null, 2));
