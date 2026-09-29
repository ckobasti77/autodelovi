// Hero QA captures (step 10): poster, live 3D assembled / exploded / part selected, at 1440 × 900
// and 390 × 844 (DPR 2, touch). Headless Chromium renders WebGL through SwiftShader.
//
//   node scripts/qa/hero-shots.mjs [--base http://localhost:3000] [--out docs/3d/web-qa] [--only desktop|mobile]
//
// Prints console errors and timing; exits 1 when the page logs errors or the 3D never gets ready.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = arg("base", "http://localhost:3000");
const OUT = resolve(arg("out", "docs/3d/web-qa"));
const ONLY = arg("only", "");
const PART = arg("part", "turbina");
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  {
    name: "mobile",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
].filter((v) => !ONLY || v.name === ONLY);

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
let failed = false;

async function settle(page, ms = 900) {
  await page.waitForTimeout(ms);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
  );
}

try {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ ...vp, locale: "sr-Latn-RS" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console: ${m.text()}`);
    });
    const t0 = Date.now();
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await settle(page, 1200);
    await page.screenshot({ path: `${OUT}/${vp.name}-0-poster.png` });

    // Intent: pointer over the hero (desktop) / touch (mobile) starts the 3D.
    if (vp.name === "desktop") await page.mouse.move(vp.viewport.width * 0.7, vp.viewport.height * 0.5);
    else await page.evaluate(() => window.scrollTo(0, 60));
    await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 180_000 });
    const readyMs = Date.now() - t0;
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page, 1400);
    if (vp.name === "mobile") {
      await page.evaluate(() => {
        const track = document.querySelector('[data-testid="hero-track"]');
        if (track) window.scrollTo(0, track.getBoundingClientRect().top + window.scrollY - 56);
      });
      await settle(page, 1200);
    }
    await page.screenshot({ path: `${OUT}/${vp.name}-1-assembled.png` });

    for (const p of [0.3, 0.6]) {
      await page.evaluate((v) => window.__sklop3d.explode(v), p);
      await settle(page, 900);
      await page.screenshot({ path: `${OUT}/${vp.name}-2-explode-${Math.round(p * 100)}.png` });
    }
    await page.evaluate(() => window.__sklop3d.explode(1));
    await settle(page, 1200);
    await page.screenshot({ path: `${OUT}/${vp.name}-3-exploded.png` });

    await page.evaluate((slug) => window.__sklop3d.selectPart(slug), PART);
    await page.waitForSelector('[data-testid="part-panel"]', { timeout: 20_000 });
    await page
      .waitForSelector('[data-testid="part-panel-product"]', { timeout: 20_000 })
      .catch(() => null);
    await settle(page, 1500);
    await page.screenshot({ path: `${OUT}/${vp.name}-4-selected-${PART}.png` });
    const state = await page.evaluate(() => window.__sklop3d.getState());
    const products = await page.locator('[data-testid="part-panel-product"]').count();

    console.log(
      `${vp.name}: 3D ready in ${readyMs} ms, tier ${state.tier}, stage ${state.stage}, selected ${state.selected}, ${products} products, ${errors.length} errors`,
    );
    if (errors.length) {
      failed = true;
      for (const e of errors.slice(0, 10)) console.log("  ", e);
    }
    await context.close();
  }
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
