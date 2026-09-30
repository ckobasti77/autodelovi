// perf-3d track: adaptive DPR on a 3x phone. Poster (before intent) vs live canvas after one
// scroll through the explode and back to the top, at a CPU throttle. Saves device-pixel crops
// of the same stage area and logs the canvas backing-store ratio.
//
//   node scripts/qa/audit/perf-3d-dpr.mjs [--cpu 4] [--runs 3]
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { GPU_ARGS } from "./perf-3d-gl.mjs";

const args = process.argv.slice(2);
const arg = (n, f) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : f;
};
const BASE = process.env.AUDIT_BASE ?? "http://localhost:3200";
const CPU = Number(arg("cpu", "4"));
const RUNS = Number(arg("runs", "3"));
const OUT = "docs/qa/audit/perf-3d";
mkdirSync(OUT, { recursive: true });
const vp = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "sr-Latn-RS" };
const browser = await chromium.launch({ args: GPU_ARGS });
const log = [];
const cookie = () => ({
  name: "sk_consent",
  value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: "audit-perf-3d-0006" })),
  domain: new URL(BASE).hostname,
  path: "/",
});
const crop = async (page, file) => {
  await page.evaluate(() => {
    const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64;
    const t = document.querySelector('[data-testid="hero-track"]').getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, t - h);
  });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="hero-poster"]');
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.left + b.width * 0.2), y: Math.round(b.top + b.height * 0.42), width: Math.round(b.width * 0.6), height: Math.round(b.height * 0.3) };
  });
  const buf = await page.screenshot({ type: "png", clip: r });
  await sharp(buf).webp({ quality: 82 }).toFile(file);
  return r;
};
try {
  // Poster reference (no intent).
  {
    const ctx = await browser.newContext(vp);
    await ctx.addCookies([cookie()]);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/?3d=low`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    await crop(page, `${OUT}/dpr-mobile390x3-poster.webp`);
    await ctx.close();
  }
  for (let run = 0; run < RUNS; run++) {
    const ctx = await browser.newContext(vp);
    await ctx.addCookies([cookie()]);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForTimeout(800);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
    const b = await page.evaluate(() => {
      const r = document.querySelector('[data-testid="hero-track"]').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: Math.min(r.top + r.height / 2, 500) };
    });
    await page.touchscreen.tap(b.x, b.y);
    await page.waitForFunction(() => window.__sklop3d?.getState().status === "ready", null, { timeout: 180_000 });
    const ratio = () =>
      page.evaluate(() => {
        const c = document.querySelector('[data-testid="hero-track"] canvas');
        return +(c.width / c.clientWidth).toFixed(2);
      });
    const atReady = await ratio();
    await page.waitForTimeout(1500);
    const afterCrossfade = await ratio();
    const distance = await page.evaluate(() => {
      const t = document.querySelector('[data-testid="hero-track"]');
      return t.getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
    });
    await page.mouse.move(200, 400);
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, distance / 30);
      await page.waitForTimeout(110);
    }
    await page.waitForTimeout(1200);
    const afterScroll = await ratio();
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, -distance / 30);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(1500);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await page.waitForTimeout(500);
    const afterBack = await ratio();
    await crop(page, `${OUT}/dpr-mobile390x3-canvas-run${run}.webp`);
    const row = { run, cpu: CPU, deviceScaleFactor: 3, tierMax: 1.5, ratioAtReady: atReady, afterCrossfade, afterScroll, afterBackToTop: afterBack };
    log.push(row);
    console.log(JSON.stringify(row));
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/dpr-mobile.json`, JSON.stringify(log, null, 1));
