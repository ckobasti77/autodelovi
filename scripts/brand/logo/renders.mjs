// Review sheets of the finished logo (PNG), composed from the built files (step 33: the star arc).
// Usage: node scripts/brand/logo/renders.mjs   (after build.mjs)
// Output: docs/brand/renders/logo-system-{night,paper,navy}.png, logo-one-colour.png,
//         logo-small-sizes.png
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { svgToPng } from "./lib/render.mjs";
import { THEMES, hintedIconSvg, iconSvg } from "./logo.mjs";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const OUT = path.join(ROOT, "docs/brand/renders");
const PUBLIC = path.join(ROOT, "public/brand");
await mkdir(OUT, { recursive: true });

const svgOf = (name) => readFile(path.join(PUBLIC, name), "utf8");
const ratio = (svg) => {
  const [, w, h] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  return w / h;
};
/** A kit file rendered at a height in px. */
const atHeight = async (name, height) => {
  const svg = await svgOf(name);
  return svgToPng(svg, Math.round(height * ratio(svg)));
};
const sheet = async (file, width, height, bg, layers) =>
  sharp({ create: { width, height, channels: 4, background: bg } })
    .composite(
      layers.map(([input, left, top]) => ({ input, left: Math.round(left), top: Math.round(top) })),
    )
    .png()
    .toFile(path.join(OUT, file));

// 1. The system on each ground: stacked (primary), horizontal, wordmark, both marks, OEM Parts.
for (const variant of ["night", "paper", "navy"]) {
  const layers = [
    [await atHeight(`logo-stacked-${variant}.svg`, 520), 80, 80],
    [await atHeight(`mark-${variant}.svg`, 200), 1040, 90],
    [await atHeight(`mark-small-${variant}.svg`, 120), 1300, 130],
    [await atHeight(`oem-parts-${variant}.svg`, 96), 1040, 380],
    [await atHeight(`logo-horizontal-${variant}.svg`, 112), 80, 700],
    [await atHeight(`logo-wordmark-${variant}.svg`, 64), 80, 880],
  ];
  if (variant === "night") layers.push([svgToPng(iconSvg(), 150), 1300, 340]);
  await sheet(`logo-system-${variant}.png`, 1600, 1020, THEMES[variant].bg, layers);
}

// 2. One colour: black on white, white on night.
{
  const W = 1600;
  const layers = [
    [{ create: { width: W, height: 420, channels: 4, background: THEMES.night.bg } }, 0, 420],
  ];
  for (const [i, variant] of ["black", "white"].entries()) {
    const y = i * 420;
    layers.push([await atHeight(`logo-stacked-${variant}.svg`, 300), 80, y + 60]);
    layers.push([await atHeight(`logo-horizontal-${variant}.svg`, 88), 640, y + 90]);
    layers.push([await atHeight(`mark-${variant}.svg`, 112), 640, y + 230]);
    layers.push([await atHeight(`mark-small-${variant}.svg`, 64), 800, y + 254]);
    layers.push([await atHeight(`oem-parts-${variant}.svg`, 64), 920, y + 254]);
  }
  await sheet("logo-one-colour.png", W, 840, "#FFFFFF", layers);
}

// 3. Small sizes: horizontal lockup at 64 / 56 / 48 / 44 px, the small mark at 32 / 24 / 16 px,
//    the tab icons at 1× and enlarged, night and paper side by side.
{
  const W = 1600;
  const H = 700;
  const layers = [
    [{ create: { width: W / 2, height: H, channels: 4, background: "#FFFFFF" } }, W / 2, 0],
  ];
  for (const [col, variant] of ["night", "paper"].entries()) {
    const ox = col * (W / 2) + 48;
    let y = 40;
    for (const px of [64, 56, 48, 44]) {
      layers.push([await atHeight(`logo-horizontal-${variant}.svg`, px), ox, y]);
      y += px + 24;
    }
    let x = ox;
    for (const px of [48, 32, 24, 16]) {
      const name = px >= 48 ? `mark-${variant}.svg` : `mark-small-${variant}.svg`;
      layers.push([await atHeight(name, px), x, 360 + (48 - px)]);
      x += px + 28;
    }
    x += 30;
    for (const px of [48, 32, 16]) {
      layers.push([svgToPng(hintedIconSvg(px), px), x, 360 + (48 - px)]);
      x += px + 16;
    }
    x = ox;
    for (const [px, zoom] of [
      [48, 4],
      [32, 5],
      [16, 9],
    ]) {
      const big = await sharp(svgToPng(hintedIconSvg(px), px))
        .resize(px * zoom, px * zoom, { kernel: "nearest" })
        .png()
        .toBuffer();
      layers.push([big, x, 450]);
      x += px * zoom + 24;
    }
  }
  await sheet("logo-small-sizes.png", W, H, THEMES.night.bg, layers);
}
console.log("wrote docs/brand/renders/*.png");
