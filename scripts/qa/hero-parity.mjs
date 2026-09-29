// Poster ↔ canvas parity (DESIGN-SYSTEM §7.8): screenshots the SSR poster and the first live
// frame (before the idle edge lines) at the same viewport, and writes a side-by-side + a
// difference image of the stage so the crossfade can be judged.
//
//   node scripts/qa/hero-parity.mjs [--base http://localhost:3000] [--out 3d/renders/web-qa]
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = arg("base", "http://localhost:3000");
const OUT = resolve(arg("out", "3d/renders/web-qa"));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const cases = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { name: "mobile", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
];
try {
  for (const c of cases) {
    const context = await browser.newContext({ ...c, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    // Bring the stage frame to the top (phones) — the explode does not move under reduced motion.
    await page.evaluate(() => {
      const track = document.querySelector('[data-testid="hero-track"]');
      if (track && window.innerWidth < 1024) {
        window.scrollTo(0, track.getBoundingClientRect().top + window.scrollY - 56);
      }
    });
    await page.waitForTimeout(800);
    const stage = page.locator('[data-testid="hero-track"] [role="img"]');
    const box = await stage.boundingBox();
    const posterShot = await page.screenshot({ clip: box });
    await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
    await page.mouse.move(c.viewport.width / 2, c.viewport.height / 2);
    await page.evaluate(() => document.querySelector("section")?.dispatchEvent(new Event("pointerover")));
    await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 180_000 });
    // First live frame, poster hidden, before the idle edge lines fade in.
    await page.evaluate(() => {
      const poster = document.querySelector('[data-testid="hero-poster"]');
      if (poster) poster.style.visibility = "hidden";
      const canvas = document.querySelector('[data-testid="hero-canvas"]');
      if (canvas) canvas.style.opacity = "1";
    });
    await page.waitForTimeout(120);
    const canvasShot = await page.screenshot({ clip: box });
    const a = sharp(posterShot);
    const meta = await a.metadata();
    const w = meta.width;
    const h = meta.height;
    await sharp({ create: { width: w * 2 + 8, height: h, channels: 3, background: "#ff6b1a" } })
      .composite([
        { input: posterShot, left: 0, top: 0 },
        { input: canvasShot, left: w + 8, top: 0 },
      ])
      .png()
      .toFile(`${OUT}/parity-${c.name}-side.png`);
    const [pa, pb] = await Promise.all([
      sharp(posterShot).removeAlpha().raw().toBuffer(),
      sharp(canvasShot).removeAlpha().raw().toBuffer(),
    ]);
    const diff = Buffer.alloc(pa.length);
    let sum = 0;
    for (let i = 0; i < pa.length; i++) {
      const d = Math.abs(pa[i] - pb[i]);
      sum += d;
      diff[i] = Math.min(255, d * 4);
    }
    await sharp(diff, { raw: { width: w, height: h, channels: 3 } })
      .png()
      .toFile(`${OUT}/parity-${c.name}-diff.png`);
    console.log(`${c.name}: mean abs difference ${(sum / pa.length).toFixed(2)} / 255`);
    await context.close();
  }
} finally {
  await browser.close();
}
