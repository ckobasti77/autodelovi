// verify motion-3d-01 (skeptic): hero framing at the reviewer's screen-size viewports AND at real
// browser viewports (Playwright device descriptors: browser chrome excluded), poster + canvas.
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { BASE, launch, newContext, watch, shot } from "./kit.mjs";

const CONFIGS = [
  { tag: "360x780", w: 360, h: 780, canvas: false, shots: false },
  { tag: "390x844", w: 390, h: 844, canvas: true, shots: true },
  { tag: "430x932", w: 430, h: 932, canvas: false, shots: false },
  { tag: "768x1024", w: 768, h: 1024, canvas: false, shots: true },
  { tag: "iphone13-390x664", w: 390, h: 664, canvas: true, shots: true },
  { tag: "iphone15pm-430x739", w: 430, h: 739, canvas: false, shots: false },
  { tag: "pixel7-412x839", w: 412, h: 839, canvas: false, shots: true },
  { tag: "galaxys8-360x740", w: 360, h: 740, canvas: false, shots: false },
  { tag: "motog4-360x640", w: 360, h: 640, canvas: false, shots: false },
  { tag: "1440x900", w: 1440, h: 900, canvas: false, shots: true, mobile: false },
];
const only = process.argv.slice(2);
const OUT = "verify/motion-3d/motion-3d-01-skeptic";

async function measure(page) {
  const box = await page.evaluate(() => {
    const track = document.querySelector('[data-testid="hero-track"]');
    const media = track.querySelector('[role="img"]').getBoundingClientRect();
    const capP = [...track.querySelectorAll("p, h2, h3, span")].filter((e) => e.closest(".px-page") && e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().top < media.top + media.height / 2);
    let capBottom = media.top;
    for (const e of capP) capBottom = Math.max(capBottom, e.getBoundingClientRect().bottom);
    const img = track.querySelector('[data-testid] picture img') ?? track.querySelector("picture img");
    const src = img?.currentSrc ?? "";
    return { x: media.x, y: media.y, w: media.width, h: media.height, capBottom, src: src.split("/").pop(), header: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")), vh: innerHeight };
  });
  const buf = await page.screenshot({ type: "png", clip: { x: box.x, y: box.y, width: box.w, height: box.h } });
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ch = info.channels;
  const y0 = Math.ceil(box.capBottom - box.y) + 4; // ignore caption rows
  const y1 = H - 30; // ignore the honesty line
  const bg = [data[(y0 * W + 2) * ch], data[(y0 * W + 2) * ch + 1], data[(y0 * W + 2) * ch + 2]];
  const diff = (i) => Math.max(Math.abs(data[i] - bg[0]), Math.abs(data[i + 1] - bg[1]), Math.abs(data[i + 2] - bg[2]));
  let minY = H, maxY = -1, minX = W, maxX = -1;
  const minPix = Math.max(3, Math.round(W * 0.006));
  for (let y = y0; y < y1; y++) { let c = 0; for (let x = 0; x < W; x++) if (diff((y * W + x) * ch) > 14) c++; if (c >= minPix) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); } }
  const col = new Array(W).fill(0);
  for (let y = minY; y <= maxY; y++) for (let x = 0; x < W; x++) if (diff((y * W + x) * ch) > 14) col[x]++;
  const minPixC = Math.max(3, Math.round((maxY - minY) * 0.006));
  for (let x = 0; x < W; x++) if (col[x] >= minPixC) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  const cw = maxX - minX + 1, chh = maxY - minY + 1;
  return {
    stage: { w: Math.round(box.w), h: Math.round(box.h), aspect: +(box.w / box.h).toFixed(3) },
    header: box.header, poster: box.src,
    captionBottomInStage: Math.round(box.capBottom - box.y),
    car: { x: minX, y: minY, w: cw, h: chh },
    emptyBandCaptionToCar: minY - Math.round(box.capBottom - box.y),
    carTopPctOfStage: +((minY / H) * 100).toFixed(1),
    carPctStageH: +((chh / H) * 100).toFixed(1),
    carPctStageW: +((cw / W) * 100).toFixed(1),
    carCentreOffsetX: Math.round(minX + cw / 2 - W / 2),
    carBottomAboveViewportBottom: Math.round(box.vh - (box.y + maxY)),
    _buf: buf,
  };
}

const browser = await launch();
const results = [];
for (const c of CONFIGS) {
  if (only.length && !only.includes(c.tag)) continue;
  const mobile = c.mobile ?? true;
  const ctx = await newContext(browser, { width: c.w, height: c.h, mobile, tag: `v-m3d01-${c.w}` });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  // First screen as a visitor lands (scroll 0): is the car visible at all, and where?
  const first = await page.evaluate(() => {
    const media = document.querySelector('[data-testid="hero-track"] [role="img"]').getBoundingClientRect();
    return { stageTopAtScroll0: Math.round(media.top), vh: innerHeight };
  });
  if (c.shots) await shot(page, `${OUT}-${c.tag}-scroll0`);
  const trackTop = await page.evaluate(() => {
    const t = document.querySelector('[data-testid="hero-track"]');
    const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 64;
    return t.getBoundingClientRect().top + scrollY - h;
  });
  await page.evaluate((y) => window.scrollTo(0, y), trackTop);
  await page.waitForTimeout(600);
  const st = await page.evaluate(() => window.__sklop3d?.getState?.());
  const p = await measure(page);
  if (c.shots) await shot(page, `${OUT}-${c.tag}-poster-at-stage`);
  const pBuf = p._buf; delete p._buf;
  const row = { config: c.tag, viewport: `${c.w}x${c.h}`, trackTop: Math.round(trackTop), ...first, statusAtPoster: st?.status, poster: p };
  // Car visible in the first screen at scroll 0?
  row.carTopAtScroll0 = first.stageTopAtScroll0 + p.car.y;
  row.carVisibleAtScroll0 = row.carTopAtScroll0 < first.vh;
  if (c.canvas) {
    try {
      await page.evaluate(() => document.querySelector('[data-testid="home-hero"]')?.dispatchEvent(new FocusEvent("focusin", { bubbles: true })));
      await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 150_000 });
      await page.waitForTimeout(3000);
      const s2 = await page.evaluate(() => window.__sklop3d.getState());
      const cv = await measure(page);
      const cBuf = cv._buf; delete cv._buf;
      const a = await sharp(pBuf).raw().toBuffer(); const b = await sharp(cBuf).raw().toBuffer();
      let sum = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) sum += Math.abs(a[i] - b[i]);
      row.canvas = { tier: s2.tier, progress: s2.progress, status: s2.status, ...cv, meanAbsDiffVsPoster: +(sum / Math.min(a.length, b.length)).toFixed(2) };
      if (c.shots) await shot(page, `${OUT}-${c.tag}-canvas-at-stage`);
    } catch (e) { row.canvasError = String(e).slice(0, 200); }
  }
  row.errors = { console: log.console.length, page: log.pageErrors.length };
  results.push(row);
  console.log(JSON.stringify(row));
  await ctx.close();
}
await browser.close();
writeFileSync(`docs/qa/audit/${OUT}${only.length ? "-" + only.join("_") : ""}.json`, JSON.stringify(results, null, 2));
