// Step 22 verifier (hero-3d-assets, MOT-01): regressions around the new phone/tablet hero crops.
//   A. Which hero posters each viewport downloads and preloads (no cross-crop double download).
//   B. Low tier (SwiftShader is classified low, PERF-23): the assembled → exploded poster crossfade
//      along the track uses the crop's own exploded poster, framed like the assembled one.
//   C. Reduced motion (low and mid tier): no pin, „Rasklopi“ toggles, car framed in the stage.
//   D. Live crop switch: a mid-tier canvas resized across 768 and 1024 px re-frames with the new
//      crop's camera and still matches the poster underneath (bbox difference).
// Usage: AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/hero-3d-assets-verify-mot01-regress.mjs [A] [B] [C] [D]
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { BASE, launch, newContext } from "../audit/kit.mjs";

const OUT = "docs/qa/fix/hero-3d-assets/verify";
mkdirSync(OUT, { recursive: true });
const want = new Set(process.argv.slice(2));
const run = (k) => want.size === 0 || want.has(k);

const HIDE_FURNITURE = `[data-testid="hero-track"] .pointer-events-none.absolute.inset-0.px-page{visibility:hidden!important}
  [data-testid="hero-track"] span.h-0\\.5, #hero-copy, [data-testid="hero-track"] .z-\\[4\\]{visibility:hidden!important}`;

async function scrollToTrack(page) {
  const y = await page.evaluate(() => {
    const t = document.querySelector('[data-testid="hero-track"]');
    const h = document.querySelector("header")?.getBoundingClientRect().height ?? 64;
    return Math.round(t.getBoundingClientRect().top + scrollY - h);
  });
  await page.evaluate((v) => window.scrollTo(0, Math.max(0, v)), y);
  await page.waitForTimeout(500);
  return y;
}

/** Car bbox inside the stage (furniture hidden), pixel diff against the stage's top rows. */
async function carBox(page, file, extraCss = "") {
  const st = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="hero-track"] [role="img"]').getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const tag = await page.addStyleTag({ content: HIDE_FURNITURE + extraCss });
  await page.waitForTimeout(250);
  const buf = await page.screenshot({ type: "png", clip: st });
  await tag.evaluate((n) => n.remove());
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const ch = info.channels;
  const s = [];
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < W; x += 4) {
      const i = (y * W + x) * ch;
      s.push([data[i], data[i + 1], data[i + 2]]);
    }
  const bg = [0, 1, 2].map((c) => s.map((p) => p[c]).sort((a, b) => a - b)[s.length >> 1]);
  const on = (x, y) => {
    const i = (y * W + x) * ch;
    return Math.max(...[0, 1, 2].map((c) => Math.abs(data[i + c] - bg[c]))) > 14;
  };
  const rows = new Array(H).fill(0);
  const cols = new Array(W).fill(0);
  for (let y = 4; y < H; y++)
    for (let x = 0; x < W; x++)
      if (on(x, y)) {
        rows[y]++;
        cols[x]++;
      }
  const mr = Math.max(3, Math.round(W * 0.006));
  const mc = Math.max(3, Math.round(H * 0.006));
  let minY = H, maxY = -1, minX = W, maxX = -1;
  rows.forEach((n, y) => n >= mr && ((minY = Math.min(minY, y)), (maxY = Math.max(maxY, y))));
  cols.forEach((n, x) => n >= mc && ((minX = Math.min(minX, x)), (maxX = Math.max(maxX, x))));
  if (file) {
    const svg = Buffer.from(
      `<svg width="${W}" height="${H}"><rect x="${minX}" y="${minY}" width="${maxX - minX + 1}" height="${maxY - minY + 1}" fill="none" stroke="#ff3b30" stroke-width="2"/></svg>`,
    );
    await sharp(buf).composite([{ input: svg }]).webp({ quality: 70 }).toFile(`${OUT}/${file}.webp`);
  }
  return {
    stage: [Math.round(W), Math.round(H)],
    car: [minX, minY, maxX - minX + 1, maxY - minY + 1],
    pctH: +(((maxY - minY + 1) / H) * 100).toFixed(1),
    pctW: +(((maxX - minX + 1) / W) * 100).toFixed(1),
  };
}

const diffBox = (a, b) => Math.max(...a.car.map((v, i) => Math.abs(v - b.car[i])));
const report = {};
const browser = await launch();
try {
  // ---------------------------------------------------------------- A. downloads + preloads
  if (run("A")) {
    report.A = [];
    for (const [w, h] of [
      [360, 780],
      [390, 844],
      [767, 1024],
      [768, 1024],
      [1023, 768],
      [1024, 768],
      [1440, 900],
    ]) {
      const ctx = await newContext(browser, { width: w, height: h, tag: `vfy-m01-net-${w}` });
      try {
        const page = await ctx.newPage();
        const hero = [];
        page.on("request", (r) => {
          const u = r.url();
          if (u.includes("/images/hero/")) hero.push(u.replace(/^.*\/images\/hero\//, ""));
        });
        await page.goto(`${BASE}/?3d=low`, { waitUntil: "networkidle" });
        await page.waitForTimeout(600);
        const info = await page.evaluate(() => ({
          preloads: [...document.querySelectorAll('link[rel="preload"][as="image"]')].map((l) => ({
            href: l.getAttribute("href"),
            media: l.getAttribute("media"),
            fetchpriority: l.getAttribute("fetchpriority"),
          })),
          current: document.querySelector('[data-testid="hero-poster-image"] img')?.currentSrc?.replace(/^.*\/images\/hero\//, ""),
        }));
        const crops = new Set(
          hero.map((f) => (/-m-\d/.test(f) ? "mobile" : /-t-\d/.test(f) ? "tablet" : "desktop")),
        );
        const row = { viewport: `${w}x${h}`, current: info.current, requests: hero, crops: [...crops], preloads: info.preloads };
        report.A.push(row);
        console.log(`A ${row.viewport}: current ${row.current}; requests ${hero.join(", ")}; preloads ${info.preloads.map((p) => `${p.href} [${p.media}]`).join(" | ")}`);
      } finally {
        await ctx.close();
      }
    }
  }

  // ---------------------------------------------------------------- B. low tier crossfade
  if (run("B")) {
    report.B = [];
    for (const [w, h] of [
      [390, 844],
      [768, 1024],
    ]) {
      const ctx = await newContext(browser, { width: w, height: h, tag: `vfy-m01-low-${w}` });
      try {
        const page = await ctx.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
        await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
        await page.waitForTimeout(800);
        const y0 = await scrollToTrack(page);
        const tier = await page.evaluate(() => window.__sklop3d?.getState().tier);
        const assembled = await carBox(page, `regress-low-${w}-p0`);
        // scroll to the end of the track (p = 1)
        const end = await page.evaluate(() => {
          const t = document.querySelector('[data-testid="hero-track"]');
          return Math.round(t.getBoundingClientRect().bottom + scrollY - innerHeight);
        });
        for (let y = y0; y <= end; y += 120) {
          await page.evaluate((v) => window.scrollTo(0, v), y);
          await page.waitForTimeout(60);
        }
        await page.evaluate((v) => window.scrollTo(0, v - 2), end);
        await page.waitForTimeout(1800);
        const st = await page.evaluate(() => {
          const s = window.__sklop3d?.getState();
          const imgs = [...document.querySelectorAll('[data-testid="hero-track"] picture img')].map((i) => ({
            src: i.currentSrc.replace(/^.*\/images\/hero\//, ""),
            opacity: getComputedStyle(i.closest("[style]") ?? i).opacity,
          }));
          return { progress: s?.progress, status: s?.status, imgs };
        });
        const exploded = await carBox(page, `regress-low-${w}-p1`);
        const row = { viewport: `${w}x${h}`, tier, assembled, exploded, state: st, errors };
        report.B.push(row);
        console.log(`B ${row.viewport}: tier ${tier}; p0 car ${assembled.car} (${assembled.pctH}% H); end progress ${st.progress}, posters ${JSON.stringify(st.imgs)}; p1 car ${exploded.car} (${exploded.pctH}% H); errors ${errors.length}`);
      } finally {
        await ctx.close();
      }
    }
  }

  // ---------------------------------------------------------------- C. reduced motion
  if (run("C")) {
    report.C = [];
    for (const [w, h, tierQ] of [
      [390, 844, "low"],
      [390, 844, "mid"],
      [768, 1024, "low"],
      [768, 1024, "mid"],
    ]) {
      const ctx = await newContext(browser, { width: w, height: h, reducedMotion: "reduce", tag: `vfy-m01-rm-${w}-${tierQ}` });
      try {
        const page = await ctx.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
        await page.goto(`${BASE}/?3d=${tierQ}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(800);
        const trackH = await page.evaluate(() => document.querySelector('[data-testid="hero-track"]').getBoundingClientRect().height);
        await scrollToTrack(page);
        if (tierQ === "mid") {
          await page.evaluate(() =>
            document.querySelector('[data-testid="home-hero"]').dispatchEvent(new FocusEvent("focusin", { bubbles: true })),
          );
          await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 120_000 });
          await page.waitForTimeout(1500);
        }
        const before = await carBox(page, `regress-rm-${w}-${tierQ}-assembled`);
        const btn = page.getByRole("button", { name: /^Rasklopi/ }).first();
        await btn.focus();
        await page.keyboard.press("Enter");
        await page.waitForTimeout(1200);
        const after = await carBox(page, `regress-rm-${w}-${tierQ}-exploded`);
        const state = await page.evaluate(() => window.__sklop3d?.getState());
        const row = { viewport: `${w}x${h}`, tier: tierQ, trackH: Math.round(trackH), before, after, state: { tier: state?.tier, progress: state?.progress, reducedMotion: state?.reducedMotion }, errors };
        report.C.push(row);
        console.log(`C ${row.viewport} ${tierQ}: track ${row.trackH}px; assembled ${before.car} (${before.pctH}%); after Rasklopi ${after.car} (${after.pctH}%); state ${JSON.stringify(row.state)}; errors ${errors.length}`);
      } finally {
        await ctx.close();
      }
    }
  }

  // ---------------------------------------------------------------- D. live crop switch
  if (run("D")) {
    report.D = [];
    const ctx = await newContext(browser, { width: 390, height: 844, mobile: true, tag: "vfy-m01-resize" });
    try {
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
      await page.goto(`${BASE}/?3d=mid`, { waitUntil: "networkidle" });
      await page.waitForTimeout(600);
      await scrollToTrack(page);
      await page.evaluate(() =>
        document.querySelector('[data-testid="home-hero"]').dispatchEvent(new FocusEvent("focusin", { bubbles: true })),
      );
      await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 120_000 });
      await page.waitForTimeout(1500);
      for (const [w, h] of [
        [390, 844],
        [800, 1000],
        [1100, 800],
        [800, 1000],
        [390, 844],
      ]) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(900);
        await scrollToTrack(page);
        await page.waitForTimeout(1200);
        const canvas = await carBox(page, `regress-resize-${w}x${h}-canvas`);
        // the poster stays underneath the canvas (context-loss fallback): show it alone
        const poster = await carBox(
          page,
          `regress-resize-${w}x${h}-poster`,
          `[data-testid="hero-canvas"]{visibility:hidden!important}[data-testid="hero-poster"]{opacity:1!important;visibility:visible!important}`,
        );
        const src = await page.evaluate(() => document.querySelector('[data-testid="hero-poster-image"] img')?.currentSrc?.replace(/^.*\/images\/hero\//, ""));
        const row = { viewport: `${w}x${h}`, posterSrc: src, canvas, poster, maxDiffPx: diffBox(canvas, poster) };
        report.D.push(row);
        console.log(`D ${row.viewport}: poster ${src}; canvas ${canvas.car} (${canvas.pctH}%); poster ${poster.car} (${poster.pctH}%); max diff ${row.maxDiffPx}px`);
      }
      report.Derrors = errors;
      if (errors.length) console.log("D errors", errors.slice(0, 3));
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/regress-${[...want].join("") || "ABCD"}.json`, JSON.stringify(report, null, 2));
