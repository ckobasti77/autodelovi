/**
 * UI boost contact sheets (step 27, docs/design/UI-BOOST.md §10):
 *   node scripts/qa/ui-boost/sheets.mjs <outDir> [--base=http://localhost:3000] [--only=home,cart]
 *                                       [--max=12] [--widths=390,768,1440,1920] [--main] [--reduced]
 *
 * A full-page capture of a long page is unreadable when it is scaled to fit a screen. This
 * script scrolls every page of kit.mjs end to end (so the reveals have run), then captures it
 * as viewport-sized tiles and lays them out as contact sheets a reviewer can actually read:
 * 1440 and 1920 px tiles at 780 px, two per row; 390 and 768 px tiles at 360 / 380 px, four per
 * row (default widths: 390 and 1440; `--main` = one page per main template). Tiles follow the
 * scroll order, left to right, top to bottom. Prints the reveal contract per page (hidden /
 * pending / leftover words), horizontal overflow and console errors, like shots.mjs.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import { ALL_VIEWPORTS, VIEWPORTS, forEachPage, launch, parseArgs, scrollThrough } from "./kit.mjs";

const args = parseArgs();
const outDir = path.resolve(args.positional[0] ?? "docs/qa/screens/step-27");
const maxTiles = Number(args.flag("max") ?? "12");
const widths = args.flag("widths")?.split(",");
const viewports = widths ? ALL_VIEWPORTS.filter((v) => widths.includes(v.tag)) : VIEWPORTS;
mkdirSync(outDir, { recursive: true });

const LAYOUT = {
  1440: { tileWidth: 780, columns: 2, rows: 3 },
  390: { tileWidth: 360, columns: 4, rows: 2 },
  768: { tileWidth: 380, columns: 4, rows: 2 },
  1920: { tileWidth: 780, columns: 2, rows: 3 },
};
const GAP = 6;
const GROUND = { r: 60, g: 20, b: 80, alpha: 1 };

async function contract(page) {
  return page.evaluate(() => ({
    hidden: [...document.querySelectorAll("*")].filter(
      (e) => e.offsetParent && e.textContent.trim() && getComputedStyle(e).opacity === "0",
    ).length,
    pending: document.querySelectorAll('[data-reveal-state="pending"]').length,
    words: document.querySelectorAll(".reveal-word").length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    height: document.documentElement.scrollHeight,
  }));
}

/** Viewport tiles from the top of the page down, at most `maxTiles`. */
async function tiles(page, viewport) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = Math.round(viewport.height * 0.9);
  const last = Math.max(0, height - viewport.height);
  const offsets = [];
  for (let y = 0; y < last; y += step) offsets.push(y);
  offsets.push(last);
  const out = [];
  for (const y of offsets.slice(0, maxTiles)) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(350);
    out.push(await page.screenshot({ type: "png" }));
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return out;
}

async function compose(buffers, viewport, file) {
  const { tileWidth, columns, rows } = LAYOUT[viewport.tag];
  const tileHeight = Math.round((tileWidth * viewport.height) / viewport.width);
  const perSheet = columns * rows;
  const files = [];
  for (let s = 0; s * perSheet < buffers.length; s++) {
    const chunk = buffers.slice(s * perSheet, (s + 1) * perSheet);
    const usedRows = Math.ceil(chunk.length / columns);
    const composites = await Promise.all(
      chunk.map(async (buffer, i) => ({
        input: await sharp(buffer).resize({ width: tileWidth, height: tileHeight }).toBuffer(),
        left: (i % columns) * (tileWidth + GAP),
        top: Math.floor(i / columns) * (tileHeight + GAP),
      })),
    );
    const target = buffers.length > perSheet ? file.replace(/\.webp$/, `-${s + 1}.webp`) : file;
    await sharp({
      create: {
        width: columns * tileWidth + (columns - 1) * GAP,
        height: usedRows * tileHeight + (usedRows - 1) * GAP,
        channels: 4,
        background: GROUND,
      },
    })
      .composite(composites)
      .webp({ quality: 80 })
      .toFile(target);
    files.push(path.basename(target));
  }
  return files;
}

const browser = await launch();
const errors = new Map();
await forEachPage(
  browser,
  { ...args, viewports, reducedMotion: args.has("reduced") ? "reduce" : undefined },
  async (page, name, _spec, viewport) => {
    if (!errors.has(page)) {
      const list = [];
      errors.set(page, list);
      page.on("console", (m) => m.type() === "error" && list.push(m.text().slice(0, 200)));
      page.on("pageerror", (e) => list.push(`pageerror: ${String(e).slice(0, 200)}`));
    }
    const list = errors.get(page);
    await scrollThrough(page);
    const c = await contract(page);
    const files = await compose(
      await tiles(page, viewport),
      viewport,
      path.join(outDir, `${name}-${viewport.tag}.webp`),
    );
    console.log(
      `${name}@${viewport.tag}: h=${c.height} hidden=${c.hidden} pending=${c.pending} words=${c.words} overflowX=${c.overflow} errors=${list.length}${list.length ? ` → ${list.slice(0, 2).join(" | ")}` : ""} [${files.join(", ")}]`,
    );
    list.length = 0;
  },
);
await browser.close();
