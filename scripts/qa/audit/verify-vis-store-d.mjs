// vis-store-05: drawn-car bbox vs corner-tick frame on the home hero (poster + whatever is on stage).
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { BASE, launch, newContext, shot } from "./kit.mjs";

const browser = await launch("chromium");
const res = [];
try {
  for (const [w, h] of [[1440, 900], [1680, 1050], [1920, 1080], [2560, 1440], [3440, 1440]]) {
    const ctx = await newContext(browser, { width: w, height: h, tag: "vfy-vs05" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    await shot(page, `verify/vis-store/vis-store-05-reproduce-${w}`);
    const geo = await page.evaluate(() => {
      const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) }; };
      const canvas = document.querySelector('[data-testid="hero-canvas"]');
      const cart = document.querySelector('header a[href="/korpa"], header [aria-label*="orp"]');
      return {
        ticks: r(document.querySelector(".hero-frame .corner-ticks")),
        titleBlock: r([...document.querySelectorAll(".hero-frame *")].find((e) => /^Prikaz/.test(e.textContent.trim()) && e.children.length > 1)),
        posterImg: r(document.querySelector('[data-testid="hero-poster"] img')),
        posterSrc: document.querySelector('[data-testid="hero-poster"] img')?.currentSrc,
        canvasOpacity: canvas ? getComputedStyle(canvas).opacity : null,
        canvasStatus: canvas?.dataset.status,
        cart: r(cart),
        frame: r(document.querySelector(".hero-frame")),
      };
    });
    // Hide everything but the stage media, then measure the drawn car.
    await page.addStyleTag({ content: `header, [data-testid=home-hero] * { visibility: hidden !important } [data-testid=hero-poster], [data-testid=hero-poster] *, [data-testid=hero-canvas], [data-testid=hero-canvas] * { visibility: visible !important }` });
    await page.waitForTimeout(400);
    const fr = geo.frame;
    const buf = await page.screenshot({ type: "png", clip: { x: 0, y: fr.y, width: w, height: fr.b - fr.y } });
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    // Background reference: median of the left 2 % column.
    const lum = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    const bgSamples = [];
    for (let y = 0; y < info.height; y += 7) for (let x = 0; x < Math.max(8, info.width * 0.02); x += 3) bgSamples.push(lum((y * info.width + x) * info.channels));
    bgSamples.sort((a, b) => a - b);
    const bg = bgSamples[Math.floor(bgSamples.length / 2)];
    const colHits = new Array(info.width).fill(0);
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (lum((y * info.width + x) * info.channels) - bg > 40) colHits[x]++;
    const minHits = Math.max(4, info.height * 0.01);
    let minX = -1, maxX = -1;
    for (let x = 0; x < info.width; x++) if (colHits[x] >= minHits) { if (minX < 0) minX = x; maxX = x; }
    res.push({ w, h, bg: Math.round(bg), drawnCar: { minX, maxX }, overRightTicks: geo.ticks ? maxX - geo.ticks.r : null, ...geo });
    await shot(page, `verify/vis-store/vis-store-05-reproduce-${w}-mediaonly`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync("docs/qa/audit/verify/vis-store/vis-store-05-reproduce.json", JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
