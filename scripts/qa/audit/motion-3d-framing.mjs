// motion-3d: objective hero framing — car bounding box vs stage box, poster and live canvas.
// Usage: node scripts/qa/audit/motion-3d-framing.mjs [widths...]
import { writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";
import { BASE, launch, newContext, watch, shot } from "./kit.mjs";

const SIZES = {
  360: [360, 780],
  390: [390, 844],
  412: [412, 915],
  430: [430, 932],
  768: [768, 1024],
  1024: [1024, 768],
  1280: [1280, 800],
  1440: [1440, 900],
};
const widths = process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [360, 390, 412, 430, 768, 1440];

async function measure(page, label, w) {
  // Hide the drawing furniture (caption, honesty line, ticks, title block), the strip and hairline so
  // only the car + floor remain; measure the media box (the stage the car is framed in).
  const box = await page.evaluate(() => {
    const media = document.querySelector('[data-testid="hero-track"] [role="img"]');
    const r = media.getBoundingClientRect();
    const frame = document.querySelector('[data-testid="hero-track"] .hero-frame').getBoundingClientRect();
    const style = document.createElement("style");
    style.id = "audit-hide";
    style.textContent = `[data-testid="hero-track"] .pointer-events-none.absolute.inset-0.px-page{visibility:hidden!important}
      [data-testid="hero-track"] span.h-0\\.5, #hero-copy, [data-testid="hero-track"] .z-\\[4\\]{visibility:hidden!important}`;
    document.head.appendChild(style);
    return { x: r.x, y: r.y, width: r.width, height: r.height, frameH: frame.height, frameY: frame.y, vh: innerHeight };
  });
  await page.waitForTimeout(150);
  const buf = await page.screenshot({
    type: "png",
    clip: { x: box.x, y: box.y, width: box.width, height: box.height },
  });
  await page.evaluate(() => document.getElementById("audit-hide")?.remove());
  const img = sharp(buf);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const ch = info.channels;
  // Background = median of the top 8 rows.
  const samples = [];
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < W; x += 4) {
      const i = (y * W + x) * ch;
      samples.push([data[i], data[i + 1], data[i + 2]]);
    }
  const med = [0, 1, 2].map((c) => samples.map((s) => s[c]).sort((a, b) => a - b)[Math.floor(samples.length / 2)]);
  const T = 14;
  let minX = W, minY = H, maxX = -1, maxY = -1;
  const rowCount = new Array(H).fill(0);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch;
      const d = Math.max(Math.abs(data[i] - med[0]), Math.abs(data[i + 1] - med[1]), Math.abs(data[i + 2] - med[2]));
      if (d > T) rowCount[y]++;
    }
  // A row belongs to the car when ≥ 0.6 % of its pixels differ (ignores AA noise / specks).
  const minPix = Math.max(3, Math.round(W * 0.006));
  for (let y = 4; y < H; y++) if (rowCount[y] >= minPix) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const colCount = new Array(W).fill(0);
  for (let y = minY; y <= maxY; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch;
      const d = Math.max(Math.abs(data[i] - med[0]), Math.abs(data[i + 1] - med[1]), Math.abs(data[i + 2] - med[2]));
      if (d > T) colCount[x]++;
    }
  const minPixC = Math.max(3, Math.round((maxY - minY) * 0.006));
  for (let x = 0; x < W; x++) if (colCount[x] >= minPixC) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  const carW = maxX - minX + 1;
  const carH = maxY - minY + 1;
  // Draw the bbox for evidence.
  const svg = Buffer.from(
    `<svg width="${W}" height="${H}"><rect x="${minX}" y="${minY}" width="${carW}" height="${carH}" fill="none" stroke="#ff3b30" stroke-width="2"/>` +
      `<rect x="0" y="0" width="${W}" height="${minY}" fill="#ff3b30" fill-opacity="0.12"/></svg>`,
  );
  const dir = "docs/qa/audit/motion-3d";
  mkdirSync(dir, { recursive: true });
  await sharp(buf)
    .composite([{ input: svg, top: 0, left: 0 }])
    .webp({ quality: 70 })
    .toFile(`${dir}/framing-${w}-${label}-bbox.webp`);
  return {
    label,
    stage: { w: Math.round(box.width), h: Math.round(box.height), top: Math.round(box.y) },
    frameH: Math.round(box.frameH),
    viewportH: box.vh,
    bg: med,
    car: { x: minX, y: minY, w: carW, h: carH },
    emptyBandAbovePx: minY,
    emptyBelowPx: H - 1 - maxY,
    pctStageHeight: +((carH / H) * 100).toFixed(1),
    pctStageWidth: +((carW / W) * 100).toFixed(1),
    pctStageArea: +(((carW * carH) / (W * H)) * 100).toFixed(1),
  };
}

const browser = await launch();
const results = [];
for (const w of widths) {
  const [width, height] = SIZES[w];
  const ctx = await newContext(browser, { width, height, tag: `m3d-frame-${w}` });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  // Bring the stage into full view (mobile: the stage follows the copy). Scroll the stage's frame
  // to the top of the viewport minus header — i.e. the sticky position at progress 0.
  const trackTop = await page.evaluate(() => {
    const t = document.querySelector('[data-testid="hero-track"]');
    const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 64;
    return t.getBoundingClientRect().top + scrollY - h;
  });
  // Scroll the stage to its sticky position (progress 0). This is scroll intent, so the 3D starts
  // loading; the poster stays on screen while the model downloads (SwiftShader: several seconds).
  await page.evaluate((y) => window.scrollTo(0, y), trackTop);
  await page.waitForTimeout(350);
  const st0 = await page.evaluate(() => window.__sklop3d?.getState());
  const poster = await measure(page, "poster", w);
  results.push({ width: w, viewport: `${width}x${height}`, trackTop: Math.round(trackTop), status: st0?.status, ...poster });
  await shot(page, `motion-3d/framing-${w}-poster-at-stage`);
  await page.evaluate(() =>
    document.querySelector('[data-testid="home-hero"]').dispatchEvent(new FocusEvent("focusin", { bubbles: true })),
  );
  await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 120_000 });
  await page.waitForTimeout(2500);
  const state = await page.evaluate(() => window.__sklop3d.getState());
  const canvas = await measure(page, "canvas", w);
  results.push({ width: w, viewport: `${width}x${height}`, tier: state.tier, progress: state.progress, ...canvas });
  await shot(page, `motion-3d/framing-${w}-canvas-at-stage`);
  results.push({ width: w, errors: log });
  await ctx.close();
}
await browser.close();


writeFileSync(`docs/qa/audit/motion-3d/framing-${widths.join("-")}.json`, JSON.stringify(results, null, 2));
for (const r of results) if (r.car) console.log(JSON.stringify({ w: r.width, label: r.label, stage: r.stage, car: r.car, band: r.emptyBandAbovePx, below: r.emptyBelowPx, h: r.pctStageHeight, wd: r.pctStageWidth, area: r.pctStageArea, tier: r.tier }));
