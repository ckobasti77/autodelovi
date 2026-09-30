// Hero QA extras (step 10): hover callout (desktop), vehicle picker and parts list at 1440 and
// 390, the low tier and reduced motion, 360 px overflow and 2560 px framing. Needs a server
// built with NEXT_PUBLIC_TEST_HOOKS=1.
//
//   node scripts/qa/hero-extras.mjs [--base http://localhost:3100] [--out docs/3d/web-qa]
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = arg("base", "http://localhost:3100");
const OUT = resolve(arg("out", "docs/3d/web-qa"));
mkdirSync(OUT, { recursive: true });

/** Screenshots are stored as WebP (q 85) — QA evidence in git at a fraction of the PNG size. */
async function shot(page, file) {
  const png = await page.screenshot();
  await sharp(png).webp({ quality: 85 }).toFile(`${OUT}/${file}.webp`);
}


const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const errors = [];
const settle = (page, ms = 900) =>
  page
    .waitForTimeout(ms)
    .then(() => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));

async function open(options, path = "/", extra = {}) {
  const context = await browser.newContext({ ...options, locale: "sr-Latn-RS", ...extra });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${path}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${path}: ${m.text()}`);
  });
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await settle(page, 1000);
  return { context, page };
}

async function ready(page) {
  await page.evaluate(() => window.scrollTo(0, 60));
  await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 180_000 });
}

try {
  // Hover callout: sweep the pointer over the exploded car until a part is hovered.
  {
    const { context, page } = await open(DESKTOP);
    await ready(page);
    await page.evaluate(() => window.__sklop3d.explode(1));
    await settle(page, 1400);
    let hovered = null;
    for (const [fx, fy] of [[0.62, 0.55], [0.7, 0.5], [0.55, 0.6], [0.75, 0.62], [0.66, 0.45]]) {
      await page.mouse.move(1440 * fx, 900 * fy, { steps: 4 });
      await settle(page, 700);
      hovered = (await page.evaluate(() => window.__sklop3d.getState())).hovered;
      if (hovered) break;
    }
    await shot(page, `desktop-5-hover`);
    console.log(`hover: ${hovered ?? "nothing under the pointer"}`);
    await context.close();
  }

  // Vehicle picker and parts list at both widths.
  for (const [name, options] of [["desktop", DESKTOP], ["mobile", MOBILE]]) {
    const { context, page } = await open(options);
    await page.getByTestId("vehicle-picker-trigger").filter({ visible: true }).first().click();
    await page.getByRole("dialog").waitFor({ timeout: 20_000 });
    await settle(page, 900);
    await shot(page, `${name}-6-vehicle-picker`);
    await page.keyboard.press("Escape");
    await settle(page, 600);
    await page.getByTestId("parts-list-trigger").click();
    await page.getByRole("dialog").waitFor({ timeout: 20_000 });
    await settle(page, 900);
    await shot(page, `${name}-7-parts-list`);
    await context.close();
  }

  // Low tier (posters only) on a phone, exploded.
  {
    const { context, page } = await open(MOBILE, "/?3d=low");
    await page.evaluate(() => window.scrollTo(0, 400));
    await settle(page, 500);
    await page.evaluate(() => window.__sklop3d.explode(1));
    await settle(page, 1200);
    await shot(page, `mobile-8-low-tier-exploded`);
    await context.close();
  }

  // Reduced motion: no track, stage buttons cut.
  {
    const { context, page } = await open(DESKTOP, "/", { reducedMotion: "reduce" });
    await shot(page, `desktop-9-reduced-motion`);
    await context.close();
  }

  // 360 px: no horizontal overflow on the home page; 2560 px framing.
  {
    const { context, page } = await open({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await shot(page, `mobile360-0-poster`);
    console.log(`360 px horizontal overflow: ${overflow} px`);
    await context.close();
  }
  {
    const { context, page } = await open({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
    await shot(page, `desktop2560-0-poster`);
    await ready(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page, 1500);
    await shot(page, `desktop2560-1-assembled`);
    await context.close();
  }
} catch (error) {
  errors.push(String(error));
} finally {
  await browser.close();
}
console.log(errors.length ? `ERRORS:\n  ${errors.join("\n  ")}` : "no console errors");
process.exit(errors.length ? 1 : 0);
