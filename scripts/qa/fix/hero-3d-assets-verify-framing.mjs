// hero-3d-assets (step 22): hero framing — car bounding box vs stage, caption and honesty line,
// for the SSR poster and the live canvas (MOT-01, VIS-06).
// Usage: AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/hero-3d-assets-framing.mjs \
//          [--poster-only] [--canvas-only] [--exploded] [--shots] 390x664 390x844 768x1024 1920x1080 …
// Writes docs/qa/fix/hero-3d-assets/framing-<label>.json (+ bbox WebPs with --shots).
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { BASE, launch, newContext } from "../audit/kit.mjs";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const sizes = args.filter((a) => /^\d+x\d+$/.test(a)).map((a) => a.split("x").map(Number));
const OUT = "docs/qa/fix/hero-3d-assets/verify"; // verifier copy of hero-3d-assets-framing.mjs
mkdirSync(OUT, { recursive: true });

async function furniture(page) {
  return page.evaluate(() => {
    const media = document
      .querySelector('[data-testid="hero-track"] [role="img"]')
      .getBoundingClientRect();
    const rel = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return {
        top: Math.round(r.top - media.top),
        bottom: Math.round(r.bottom - media.top),
        left: Math.round(r.left - media.left),
        right: Math.round(r.right - media.left),
      };
    };
    const overlay = document.querySelector(
      '[data-testid="hero-track"] .pointer-events-none.absolute.inset-0.px-page',
    );
    const caption = overlay?.children[1] ?? null;
    const ticks = overlay?.querySelector(".corner-ticks") ?? null;
    const honesty =
      [...(overlay?.children ?? [])].find((e) => /Generi/.test(e.textContent ?? "")) ?? null;
    return {
      stage: { x: media.x, y: media.y, width: media.width, height: media.height },
      caption: rel(caption),
      ticks: rel(ticks),
      honesty: rel(honesty),
    };
  });
}

async function measure(page, label, tag) {
  const f = await furniture(page);
  const box = f.stage;
  await page.evaluate(() => {
    const style = document.createElement("style");
    style.id = "fix-hide";
    style.textContent = `[data-testid="hero-track"] .pointer-events-none.absolute.inset-0.px-page{visibility:hidden!important}
      [data-testid="hero-track"] span.h-0\\.5, #hero-copy, [data-testid="hero-track"] .z-\\[4\\]{visibility:hidden!important}`;
    document.head.appendChild(style);
  });
  await page.waitForTimeout(150);
  const buf = await page.screenshot({
    type: "png",
    clip: { x: box.x, y: box.y, width: box.width, height: box.height },
  });
  await page.evaluate(() => document.getElementById("fix-hide")?.remove());
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const ch = info.channels;
  const samples = [];
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < W; x += 4) {
      const i = (y * W + x) * ch;
      samples.push([data[i], data[i + 1], data[i + 2]]);
    }
  const med = [0, 1, 2].map(
    (c) => samples.map((s) => s[c]).sort((a, b) => a - b)[Math.floor(samples.length / 2)],
  );
  const T = 14;
  const diff = (x, y) => {
    const i = (y * W + x) * ch;
    return (
      Math.max(
        Math.abs(data[i] - med[0]),
        Math.abs(data[i + 1] - med[1]),
        Math.abs(data[i + 2] - med[2]),
      ) > T
    );
  };
  const rows = new Array(H).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (diff(x, y)) rows[y]++;
  const minPix = Math.max(3, Math.round(W * 0.006));
  let minY = H,
    maxY = -1;
  for (let y = 4; y < H; y++)
    if (rows[y] >= minPix) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  const cols = new Array(W).fill(0);
  for (let y = minY; y <= maxY; y++) for (let x = 0; x < W; x++) if (diff(x, y)) cols[x]++;
  const minPixC = Math.max(3, Math.round((maxY - minY) * 0.006));
  let minX = W,
    maxX = -1;
  for (let x = 0; x < W; x++)
    if (cols[x] >= minPixC) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  const carW = maxX - minX + 1;
  const carH = maxY - minY + 1;
  if (flags.has("--shots")) {
    const svg = Buffer.from(
      `<svg width="${W}" height="${H}"><rect x="${minX}" y="${minY}" width="${carW}" height="${carH}" fill="none" stroke="#ff3b30" stroke-width="2"/>` +
        (f.ticks
          ? `<rect x="${f.ticks.left}" y="${f.ticks.top}" width="${f.ticks.right - f.ticks.left}" height="${f.ticks.bottom - f.ticks.top}" fill="none" stroke="#30d158" stroke-width="2" stroke-dasharray="6 4"/>`
          : "") +
        `</svg>`,
    );
    await sharp(buf)
      .composite([{ input: svg, top: 0, left: 0 }])
      .webp({ quality: 70 })
      .toFile(`${OUT}/framing-${tag}-${label}.webp`);
  }
  const captionBottom = f.caption?.bottom ?? 0;
  const honestyTop = f.honesty?.top ?? H;
  return {
    label,
    stage: { w: Math.round(W), h: Math.round(H) },
    car: { x: minX, y: minY, w: carW, h: carH, right: maxX, bottom: maxY },
    pctStageHeight: +((carH / H) * 100).toFixed(1),
    pctStageWidth: +((carW / W) * 100).toFixed(1),
    gapCaptionToCar: minY - captionBottom,
    gapCarToHonesty: honestyTop - maxY,
    centreOffsetX: Math.round((minX + maxX) / 2 - W / 2),
    ticks: f.ticks,
    insideTicks: f.ticks ? minX >= f.ticks.left && maxX <= f.ticks.right : null,
    caption: f.caption,
    honesty: f.honesty,
  };
}

const browser = await launch();
try {
  for (const [width, height] of sizes) {
    const tag = `${width}x${height}`;
    const ctx = await newContext(browser, { width, height, tag: `fix-frame-${tag}` });
    try {
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));
      // SwiftShader is classified low (PERF-23): force the tier the device class would get.
      await page.goto(`${BASE}/?3d=${width >= 1024 ? "high" : "mid"}`, {
        waitUntil: "networkidle",
      });
      await page.waitForTimeout(800);
      const trackTop = await page.evaluate(() => {
        const t = document.querySelector('[data-testid="hero-track"]');
        const h =
          parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) ||
          64;
        return t.getBoundingClientRect().top + scrollY - h;
      });
      await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, trackTop));
      await page.waitForTimeout(400);
      const result = { viewport: tag, results: [] };
      if (!flags.has("--canvas-only")) {
        result.posterSrc = await page.evaluate(
          () => document.querySelector('[data-testid="hero-poster-image"] img')?.currentSrc,
        );
        result.results.push(await measure(page, "poster", tag));
      }
      if (!flags.has("--poster-only")) {
        await page.evaluate(() =>
          document
            .querySelector('[data-testid="home-hero"]')
            .dispatchEvent(new FocusEvent("focusin", { bubbles: true })),
        );
        await page.waitForFunction(() => window.__sklop3d?.ready === true, null, {
          timeout: 120_000,
        });
        await page.waitForTimeout(2000);
        result.state = await page.evaluate(() => {
          const s = window.__sklop3d.getState();
          return { tier: s.tier, progress: s.progress, status: s.status };
        });
        result.results.push(await measure(page, "canvas", tag));
        if (flags.has("--exploded")) {
          await page.evaluate(() => window.__sklop3d.explode(1));
          await page.waitForTimeout(2500);
          result.results.push(await measure(page, "canvas-exploded", tag));
        }
      }
      result.errors = errors;
      writeFileSync(`${OUT}/framing-${tag}.json`, JSON.stringify(result, null, 2));
      for (const r of result.results)
        console.log(
          `${tag} ${r.label}: car ${r.car.w}x${r.car.h} at (${r.car.x},${r.car.y}) = ${r.pctStageHeight}% H ${r.pctStageWidth}% W; stage ${r.stage.w}x${r.stage.h}; caption→car ${r.gapCaptionToCar}px car→honesty ${r.gapCarToHonesty}px; dx ${r.centreOffsetX}; insideTicks ${r.insideTicks}`,
        );
      if (errors.length) console.log(`${tag} errors:`, errors.slice(0, 3));
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
