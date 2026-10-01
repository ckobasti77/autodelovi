// Independent verification of motion-3d-01 (hero framing on phones/tablet).
// Method A (poster, analytic): decode the poster file the browser actually chose (currentSrc) with
// sharp, find the car bbox in image pixels, map it through object-fit: contain + object-position to
// stage coordinates. No overlay hiding, no screenshot thresholds.
// Method B (canvas, pixel): after the 3D is ready at progress 0, hide the drawing furniture and
// diff the stage screenshot against its background.
// Usage: AUDIT_BASE=http://localhost:3001 TIER=mid node scripts/qa/fix/hero-3d-assets-verify-mot01.mjs [widths...]
// Step 22 verifier copy of scripts/qa/audit/verify-motion-3d-01.mjs: same method, output to
// docs/qa/fix/hero-3d-assets/verify, optional TIER forces ?3d=<tier> (SwiftShader is classified low since PERF-23).
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { BASE, launch, newContext, watch, shot } from "../audit/kit.mjs";

const SIZES = {
  360: [360, 780],
  390: [390, 844],
  412: [412, 915],
  430: [430, 932],
  768: [768, 1024],
  820: [820, 1180],
  1024: [1024, 768],
  1440: [1440, 900],
};
const widths = process.argv.slice(2).length
  ? process.argv.slice(2).map(Number)
  : [360, 390, 412, 430, 768, 1024, 1440];
const OUT = "../fix/hero-3d-assets/verify"; // verifier copy: evidence goes to docs/qa/fix/hero-3d-assets/verify
const SFX = process.env.ENGINE && process.env.ENGINE !== "chromium" ? `-${process.env.ENGINE}` : "";
mkdirSync(`docs/qa/audit/${OUT}`, { recursive: true });

function bboxOf(data, W, H, ch, bg, T = 18) {
  let minX = W, minY = H, maxX = -1, maxY = -1;
  const rows = new Array(H).fill(0);
  const cols = new Array(W).fill(0);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch;
      const a = ch === 4 ? data[i + 3] : 255;
      const d = Math.max(
        Math.abs(data[i] - bg[0]),
        Math.abs(data[i + 1] - bg[1]),
        Math.abs(data[i + 2] - bg[2]),
      );
      if (d > T && a > 20) {
        rows[y]++;
        cols[x]++;
      }
    }
  const minR = Math.max(2, Math.round(W * 0.004));
  const minC = Math.max(2, Math.round(H * 0.004));
  for (let y = 0; y < H; y++) if (rows[y] >= minR) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let x = 0; x < W; x++) if (cols[x] >= minC) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  return { minX, minY, maxX, maxY };
}
function cornerBg(data, W, H, ch) {
  const s = [];
  for (const [x0, y0] of [[0, 0], [W - 12, 0]])
    for (let y = y0; y < y0 + 12; y++)
      for (let x = x0; x < x0 + 12; x++) {
        const i = (y * W + x) * ch;
        s.push([data[i], data[i + 1], data[i + 2]]);
      }
  return [0, 1, 2].map((c) => s.map((p) => p[c]).sort((a, b) => a - b)[s.length >> 1]);
}

const ENGINE = process.env.ENGINE ?? "chromium";
const NO_CANVAS = process.env.NO_CANVAS === "1";
const browser = await launch(ENGINE);
const results = [];
for (const w of widths) {
  const [width, height] = SIZES[w];
  const ctx = await newContext(browser, { width, height, tag: `vfy-m3d01-${w}`, engine: ENGINE });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(`${BASE}/${process.env.TIER ? `?3d=${width >= 1024 ? "high" : process.env.TIER}` : ""}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  // First screen as a visitor sees it (scrollY 0).
  const first = await page.evaluate(() => {
    const stage = document.querySelector('[data-testid="hero-track"] [role="img"]').getBoundingClientRect();
    return { stageTop: Math.round(stage.top), vh: innerHeight };
  });
  await shot(page, `${OUT}/motion-3d-01-reproduce${SFX}-${w}-first-screen`);

  // Scroll the track under the header (sticky position, progress 0). > 40 px = 3D intent.
  const trackTop = await page.evaluate(() => {
    const t = document.querySelector('[data-testid="hero-track"]');
    const hh = document.querySelector("header")?.getBoundingClientRect().height ?? 64;
    return Math.round(t.getBoundingClientRect().top + scrollY - hh);
  });
  await page.evaluate((y) => window.scrollTo(0, y), trackTop);
  await page.waitForTimeout(400);

  // Method A: analytic poster geometry.
  const geo = await page.evaluate(() => {
    const media = document.querySelector('[data-testid="hero-track"] [role="img"]');
    const img = document.querySelector('[data-testid="hero-poster"] img');
    const st = media.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    const cs = getComputedStyle(img);
    const layer = document.querySelector('[data-testid="hero-track"] .pointer-events-none.absolute.inset-0.px-page');
    let capBottom = null;
    let capText = null;
    if (layer) {
      for (const el of layer.children) {
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.top - st.top < st.height / 2 && getComputedStyle(el).display !== "none") {
          capBottom = Math.max(capBottom ?? 0, r.bottom - st.top);
          capText = (capText ?? "") + el.textContent.trim().slice(0, 60) + " | ";
        }
      }
    }
    const frame = document.querySelector('[data-testid="hero-track"] .hero-frame').getBoundingClientRect();
    return {
      src: img.currentSrc,
      stage: { x: st.x, y: st.y, w: st.width, h: st.height },
      img: { x: ir.x, y: ir.y, w: ir.width, h: ir.height },
      fit: cs.objectFit,
      pos: cs.objectPosition,
      captionBottom: capBottom,
      captionText: capText,
      frameH: frame.height,
      scrollY,
      status: window.__sklop3d?.getState?.()?.status,
    };
  });
  const res = await page.request.get(geo.src);
  const buf = Buffer.from(await res.body());
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bg = cornerBg(data, info.width, info.height, info.channels);
  const bb = bboxOf(data, info.width, info.height, info.channels, bg);
  const scale = Math.min(geo.img.w / info.width, geo.img.h / info.height);
  const dw = info.width * scale;
  const dh = info.height * scale;
  const [px, py] = geo.pos.split(" ").map((v) => parseFloat(v) / 100);
  const ox = geo.img.x - geo.stage.x + (geo.img.w - dw) * px;
  const oy = geo.img.y - geo.stage.y + (geo.img.h - dh) * py;
  const car = {
    x: ox + bb.minX * scale,
    y: oy + bb.minY * scale,
    w: (bb.maxX - bb.minX + 1) * scale,
    h: (bb.maxY - bb.minY + 1) * scale,
  };
  const S = geo.stage;
  const poster = {
    file: decodeURIComponent(geo.src).replace(/^.*\/images\/hero\//, "").slice(0, 60),
    natural: [info.width, info.height],
    posterDrawn: { x: Math.round(ox), y: Math.round(oy), w: Math.round(dw), h: Math.round(dh) },
    car: { x: Math.round(car.x), y: Math.round(car.y), w: Math.round(car.w), h: Math.round(car.h) },
    pctH: +((car.h / S.h) * 100).toFixed(1),
    pctW: +((car.w / S.w) * 100).toFixed(1),
    pctArea: +(((car.w * car.h) / (S.w * S.h)) * 100).toFixed(1),
    carTopPctOfStage: +((car.y / S.h) * 100).toFixed(1),
    carCentreXOffset: Math.round(car.x + car.w / 2 - S.w / 2),
    carCentreYPct: +(((car.y + car.h / 2) / S.h) * 100).toFixed(1),
    gapCaptionToCar: geo.captionBottom != null ? Math.round(car.y - geo.captionBottom) : null,
  };
  await shot(page, `${OUT}/motion-3d-01-reproduce${SFX}-${w}-poster-at-stage`);

  // Method B: live canvas at progress 0.
  let canvas = null;
  try {
    if (NO_CANVAS) throw new Error("canvas skipped");
    await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 120_000 });
    await page.waitForTimeout(2500);
    const state = await page.evaluate(() => window.__sklop3d.getState());
    await shot(page, `${OUT}/motion-3d-01-reproduce${SFX}-${w}-canvas-at-stage`);
    await page.addStyleTag({
      content: `[data-testid="hero-track"] .pointer-events-none.absolute.inset-0.px-page{visibility:hidden!important}`,
    });
    await page.waitForTimeout(200);
    const png = await page.screenshot({ type: "png", clip: { x: S.x, y: S.y, width: S.w, height: S.h } });
    const r = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const bg2 = cornerBg(r.data, r.info.width, r.info.height, r.info.channels);
    const b2 = bboxOf(r.data, r.info.width, r.info.height, r.info.channels, bg2);
    const cw = b2.maxX - b2.minX + 1;
    const chh = b2.maxY - b2.minY + 1;
    canvas = {
      tier: state.tier,
      progress: state.progress,
      status: state.status,
      car: { x: b2.minX, y: b2.minY, w: cw, h: chh },
      pctH: +((chh / r.info.height) * 100).toFixed(1),
      pctW: +((cw / r.info.width) * 100).toFixed(1),
    };
    const svg = Buffer.from(
      `<svg width="${r.info.width}" height="${r.info.height}"><rect x="${b2.minX}" y="${b2.minY}" width="${cw}" height="${chh}" fill="none" stroke="#00e0ff" stroke-width="2"/></svg>`,
    );
    await sharp(png)
      .composite([{ input: svg, top: 0, left: 0 }])
      .webp({ quality: 70 })
      .toFile(`docs/qa/audit/${OUT}/motion-3d-01-reproduce${SFX}-${w}-canvas-bbox.webp`);
  } catch (e) {
    canvas = { error: String(e).slice(0, 200) };
  }
  results.push({
    width: w,
    viewport: `${width}x${height}`,
    firstScreen: first,
    trackTop,
    geo: { ...geo, src: undefined },
    poster,
    canvas,
    errors: { console: log.console.slice(0, 5), pageErrors: log.pageErrors.slice(0, 5) },
  });
  console.log(
    JSON.stringify({
      w,
      stage: { w: Math.round(S.w), h: Math.round(S.h) },
      captionBottom: geo.captionBottom && Math.round(geo.captionBottom),
      firstStageTop: first.stageTop,
      poster,
      canvas,
    }),
  );
  await ctx.close();
}
await browser.close();
writeFileSync(
  `docs/qa/audit/${OUT}/motion-3d-01-reproduce${SFX}-${widths.join("-")}.json`,
  JSON.stringify(results, null, 2),
);
