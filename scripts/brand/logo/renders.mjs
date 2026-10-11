// Step 24 — review sheets of the finished logo (PNG), composed from the built files.
// Usage: node scripts/brand/logo/renders.mjs   (after build.mjs)
// Output: docs/brand/renders/logo-system-{night,paper}.png, logo-one-colour.png, logo-small-sizes.png
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { svgToPng } from "./lib/render.mjs";
import { THEMES, hintedIconSvg, iconSvg, lockupSvg } from "./logo.mjs";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const OUT = path.join(ROOT, "docs/brand/renders");
const PUBLIC = path.join(ROOT, "public/brand");
await mkdir(OUT, { recursive: true });

const fromFile = async (name, width) => svgToPng(await readFile(path.join(PUBLIC, name), "utf8"), width);
const sheet = async (file, width, height, bg, layers) =>
  sharp({ create: { width, height, channels: 4, background: bg } })
    .composite(layers.map(([input, left, top]) => ({ input, left: Math.round(left), top: Math.round(top) })))
    .png()
    .toFile(path.join(OUT, file));
const heightOf = async (buf) => (await sharp(buf).metadata()).height;

// 1. The system on each ground
for (const variant of ["night", "paper"]) {
  const layers = [];
  let y = 80;
  for (const [file, width] of [
    [`logo-horizontal-${variant}.svg`, 1280],
    [`logo-dual-${variant}.svg`, 1280],
    [`logo-header-${variant}.svg`, 860],
    [`logo-wordmark-${variant}.svg`, 760],
  ]) {
    const png = await fromFile(file, width);
    layers.push([png, 80, y]);
    y += (await heightOf(png)) + 90;
  }
  const stacked = await fromFile(`logo-stacked-${variant}.svg`, 620);
  layers.push([stacked, 80, y]);
  layers.push([await fromFile(`mark-${variant}.svg`, 172), 820, y]);
  layers.push([await fromFile(`oem-parts-${variant}.svg`, 420), 1090, y + 20]);
  layers.push([svgToPng(iconSvg(), 150), 1090, y + 230]);
  y += Math.max(await heightOf(stacked), 380) + 80;
  await sheet(`logo-system-${variant}.png`, 1600, y, THEMES[variant].bg, layers);
}

// 2. One colour: black on white, white on night, orange on night
{
  const W = 1600;
  const rows = [
    ["black", "#FFFFFF"],
    ["white", THEMES.night.bg],
    ["orange", THEMES.night.bg],
  ];
  const layers = [];
  rows.forEach(([, bg], i) => layers.push([{ create: { width: W, height: 300, channels: 4, background: bg } }, 0, i * 300]));
  for (const [i, [variant]] of rows.entries()) {
    const lock = await fromFile(`logo-horizontal-${variant}.svg`, 900);
    layers.push([lock, 80, i * 300 + (300 - (await heightOf(lock))) / 2]);
    layers.push([await fromFile(`mark-${variant}.svg`, 112), 1080, i * 300 + 80]);
    layers.push([await fromFile(`oem-parts-${variant}.svg`, 300), 1250, i * 300 + 88]);
  }
  await sheet("logo-one-colour.png", W, 900, "#FFFFFF", layers);
}

// 3. Small sizes: header lockup at 40 / 32 / 28 px, mark at 64 / 32 / 24 / 16 px, favicon tiles 1× and ×8
{
  const W = 1600;
  const H = 560;
  const layers = [[{ create: { width: W / 2, height: H, channels: 4, background: "#FFFFFF" } }, W / 2, 0]];
  for (const [col, variant] of ["night", "paper"].entries()) {
    const ox = col * (W / 2) + 48;
    const header = await readFile(path.join(PUBLIC, `logo-header-${variant}.svg`), "utf8");
    const horizontal = await readFile(path.join(PUBLIC, `logo-horizontal-${variant}.svg`), "utf8");
    const ratio = (svg) => {
      const [, w, h] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
      return w / h;
    };
    layers.push([svgToPng(horizontal, Math.round(56 * ratio(horizontal))), ox, 40]);
    let y = 130;
    for (const px of [40, 32, 28]) {
      layers.push([svgToPng(header, Math.round(px * ratio(header))), ox, y]);
      y += px + 28;
    }
    const mark = await readFile(path.join(PUBLIC, `mark-${variant}.svg`), "utf8");
    let x = ox;
    for (const px of [64, 32, 24, 16]) {
      layers.push([svgToPng(mark, Math.round(px * 0.8)), x, 330 + (64 - px)]);
      x += px + 24;
    }
    x += 30;
    for (const px of [48, 32, 16]) {
      layers.push([svgToPng(hintedIconSvg(px), px), x, 330 + (64 - px)]);
      x += px + 16;
    }
    x = ox;
    for (const [px, zoom] of [
      [48, 3],
      [32, 4],
      [16, 8],
    ]) {
      const big = await sharp(svgToPng(hintedIconSvg(px), px)).resize(px * zoom, px * zoom, { kernel: "nearest" }).png().toBuffer();
      layers.push([big, x, 410]);
      x += px * zoom + 24;
    }
  }
  await sheet("logo-small-sizes.png", W, H, THEMES.night.bg, layers);
}
console.log("wrote docs/brand/renders/*.png");
