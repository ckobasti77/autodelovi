// Step 22 (hero-stage, MOT-01): measures the car against the 3D stage at phone/tablet widths.
// The stage is the media box ([data-testid=hero-track] [role=img]). Overlays inside the stage
// (caption, honesty line, callout, scrim, hairline) are hidden before the pixel pass, so only
// the poster / canvas is measured; the caption box is reported separately.
//
// usage: AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/hero-stage-framing.mjs
//          [--canvas] [--shots] [--out dir] [--progress p] 390x844 360x780 ...
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { launch, newContext } from "../audit/kit.mjs";

const base = process.env.AUDIT_BASE ?? "http://localhost:3001";
const args = process.argv.slice(2);
const canvas = args.includes("--canvas");
const shots = args.includes("--shots");
const outIdx = args.indexOf("--out");
const outDir = outIdx >= 0 ? args[outIdx + 1] : "docs/qa/fix/hero-stage";
const pIdx = args.indexOf("--progress");
const progress = pIdx >= 0 ? Number(args[pIdx + 1]) : 0;
const sIdx = args.indexOf("--select");
const select = sIdx >= 0 ? args[sIdx + 1] : null;
const sizes = args.filter((a, i) => /^\d+x\d+$/.test(a) && args[i - 1] !== "--out");
if (!sizes.length) sizes.push("360x780", "390x844", "412x915", "430x932", "390x664", "768x1024", "820x1180");
fs.mkdirSync(outDir, { recursive: true });

const browser = await launch();
try {
  for (const size of sizes) {
    const [width, height] = size.split("x").map(Number);
    const ctx = await newContext(browser, { width, height, deviceScaleFactor: 1, tag: "herostage" });
    try {
      const page = await ctx.newPage();
      const tier = width >= 1024 ? "high" : "mid";
      await page.goto(`${base}/${canvas ? `?3d=${tier}` : ""}`, { waitUntil: "load" });
      await page.waitForTimeout(1200);
      // Track top under the header.
      await page.evaluate(() => {
        const track = document.querySelector("[data-testid=hero-track]");
        const frame = track.querySelector(".hero-frame");
        const top = parseFloat(getComputedStyle(frame).top) || 0;
        window.scrollTo(0, track.getBoundingClientRect().top + window.scrollY - top);
      });
      if (canvas) {
        await page.mouse.wheel(0, 60);
        await page.waitForTimeout(300);
        await page.evaluate(() => {
          const track = document.querySelector("[data-testid=hero-track]");
          const frame = track.querySelector(".hero-frame");
          const top = parseFloat(getComputedStyle(frame).top) || 0;
          window.scrollTo(0, track.getBoundingClientRect().top + window.scrollY - top);
        });
        await page.waitForFunction(() => window.__sklop3d?.getState?.().ready === true, null, { timeout: 120000 });
        if (progress > 0) await page.evaluate((p) => window.__sklop3d.explode(p), progress);
        if (select) await page.evaluate((slug) => window.__sklop3d.selectPart(slug), select);
        await page.waitForTimeout(2500);
      } else {
        await page.waitForTimeout(1500);
      }
      const layout = await page.evaluate(() => {
        const r = (el) => {
          if (!el) return null;
          const b = el.getBoundingClientRect();
          return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
        };
        const track = document.querySelector("[data-testid=hero-track]");
        const media = track.querySelector("[role=img]");
        const frame = track.querySelector(".hero-frame");
        const caption = track.querySelector("[data-stage-caption]");
        const strip = track.querySelector("[data-stage-strip]");
        const img = media.querySelector("picture img");
        const state = window.__sklop3d?.getState?.() ?? null;
        return {
          viewportH: window.innerHeight,
          frame: r(frame),
          media: r(media),
          caption: r(caption),
          captionText: caption?.textContent?.trim().slice(0, 60) ?? null,
          strip: r(strip),
          poster: img?.currentSrc?.split("/").pop() ?? null,
          state: state && { progress: state.progress, stage: state.stage, tier: state.tier, status: state.status },
        };
      });
      const media = page.locator("[data-testid=hero-track] [role=img]").first();
      let full = null;
      if (shots) full = await page.screenshot({ type: "png" });
      await page.evaluate(() => {
        const media = document.querySelector("[data-testid=hero-track] [role=img]");
        for (const el of media.parentElement.children) if (el !== media) el.style.visibility = "hidden";
      });
      const buf = await media.screenshot({ type: "png" });
      if (args.includes("--raw")) {
        const tag = `${size}-${canvas ? `canvas-p${progress}` : "poster"}`;
        fs.writeFileSync(path.join(outDir, `stage-${tag}.png`), buf);
      }
      const { data, info: m } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const bg = [data[0], data[1], data[2]];
      let minY = 1e9, maxY = -1, minX = 1e9, maxX = -1;
      for (let y = 0; y < m.height; y++)
        for (let x = 0; x < m.width; x++) {
          const i = (y * m.width + x) * m.channels;
          const d = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
          if (d > 60) {
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
          }
        }
      const H = m.height, W = m.width;
      const capBottom = layout.caption ? layout.caption.y + layout.caption.h - layout.media.y : 0;
      const res = {
        size,
        mode: canvas ? `canvas p=${progress}${select ? ` ${select}` : ""}` : "poster",
        ...layout,
        car: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
        carHPct: +(((maxY - minY + 1) / H) * 100).toFixed(1),
        carWPct: +(((maxX - minX + 1) / W) * 100).toFixed(1),
        emptyAbovePct: +((minY / H) * 100).toFixed(1),
        emptyAboveBesideCaptionPct: +((Math.max(0, minY - Math.max(0, capBottom)) / H) * 100).toFixed(1),
        emptyBelowPct: +(((H - 1 - maxY) / H) * 100).toFixed(1),
        dxFromCentre: Math.round((minX + maxX) / 2 - W / 2),
      };
      console.log(JSON.stringify(res));
      if (shots) {
        const tag = `${size}-${canvas ? `canvas-p${progress}${select ? `-${select}` : ""}` : "poster"}`;
        await sharp(full).webp({ quality: 70 }).toFile(path.join(outDir, `framing-${tag}.webp`));
      }
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
