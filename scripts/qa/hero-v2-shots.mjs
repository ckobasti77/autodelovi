// Hero v2 captures (docs/3d/HERO-V2.md): the assembled car, every page of the grid at rest and
// the end state, at 1440×900 and 390×844, after one real scroll through the whole track.
//
//   node scripts/qa/hero-v2-shots.mjs [--base http://localhost:3210] [--out docs/qa/screens/hero-v2]
//        [--only desktop|mobile] [--mode 3d|reduced|low] [--flight] [--prefix name-]
//
// Prints, per page: what the scene reports for every docked slot (projected size, distance from
// its cell, angle off the optical axis), label line counts, draw calls are not read here.
// Exits 1 on a console error. Needs the dev build or a NEXT_PUBLIC_TEST_HOOKS=1 build.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = arg("--base", "http://localhost:3210");
const OUT = join(process.cwd(), arg("--out", "docs/qa/screens/hero-v2"));
const ONLY = arg("--only", null);
const MODE = arg("--mode", "3d");
const PREFIX = arg("--prefix", "");
const FLIGHT = args.includes("--flight");
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VIEWPORTS = [
  { name: "desktop", tier: "high", context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  {
    name: "mobile",
    tier: "mid",
    context: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  },
].filter((v) => !ONLY || v.name === ONLY);

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
let failed = false;

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    ...vp.context,
    locale: "sr-Latn-RS",
    reducedMotion: MODE === "reduced" ? "reduce" : "no-preference",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 240)));
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 240)));
  const shot = async (name) => {
    const png = await page.screenshot({ type: "png" });
    await sharp(png).webp({ quality: 82 }).toFile(join(OUT, `${PREFIX}${vp.name}-${name}.webp`));
  };

  await page.goto(`${BASE}/?3d=${MODE === "low" ? "low" : vp.tier}`, { waitUntil: "load" });
  await sleep(1500);
  const decline = page.getByRole("button", { name: "Odbij sve" });
  if (await decline.count()) await decline.first().click();
  await sleep(600);
  await page.evaluate(() => window.scrollTo(0, 0));
  if (vp.name === "desktop") await page.mouse.move(980, 620);
  else await page.touchscreen.tap(195, 150);
  if (MODE !== "low") {
    await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 90000 });
  }
  await sleep(1400);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);

  // one real scroll through the track and back
  if (MODE !== "reduced") {
    const distance = await page.evaluate(() => {
      const track = document.querySelector('[data-testid="hero-track"]');
      return track.offsetHeight - track.querySelector(".hero-frame").offsetHeight;
    });
    for (let y = 0; y < distance + 200; y += 240) {
      await page.mouse.wheel(0, 240);
      await sleep(60);
    }
    await sleep(500);
    await page.evaluate(() => window.__sklop3d.explode(0));
    await sleep(900);
  }

  await shot("0-assembled");
  for (let n = 1; n <= 6; n += 1) {
    if (FLIGHT) {
      for (const [i, f] of [0.2, 0.32, 0.45].entries()) {
        await page.evaluate(([k, t]) => window.__sklop3d.explode(0.06 + (k - 1 + t) * (0.88 / 6)), [n, f]);
        await sleep(900);
        await shot(`${n}-flight-${i + 1}`);
      }
    }
    await page.evaluate((k) => window.__sklop3d.page(k), n);
    await sleep(1500);
    await shot(`${n}-page`);
    const info = await page.evaluate(() => {
      const state = window.__sklop3d.getState();
      const slots = window.__sklop3d.slots();
      const labels = [...document.querySelectorAll("[data-page-active] [data-label]")].map((el) => {
        const cs = getComputedStyle(el);
        return Math.round(el.getBoundingClientRect().height / parseFloat(cs.lineHeight));
      });
      return { page: state.page, found: state.found, mode: state.slotMode, slots, labels };
    });
    const size = info.slots.map((s) => Math.max(s.w, s.h));
    console.log(
      `${vp.name} page ${n}: page=${info.page} found=${info.found} mode=${info.mode} slots=${info.slots.length}` +
        (size.length
          ? ` size ${Math.min(...size)}–${Math.max(...size)} px, drift ≤ ${Math.max(...info.slots.map((s) => Math.hypot(s.dx, s.dy))).toFixed(0)} px, angle ≤ ${Math.max(...info.slots.map((s) => s.angle))}°`
          : "") +
        ` label lines max ${Math.max(0, ...info.labels)}`,
    );
  }
  await page.evaluate(() => window.__sklop3d.explode(1));
  await sleep(1600);
  await shot("7-end");
  if (errors.length) {
    failed = true;
    console.log(`${vp.name} console errors:`, errors.slice(0, 6));
  }
  await context.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
