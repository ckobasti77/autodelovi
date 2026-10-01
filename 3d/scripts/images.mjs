// Composites the poster layers rendered by 3d/blender/posters.py and encodes the web images.
//
// Posters: background #0D0F11 -> contact shadow (black, alpha x 0.45) -> opaque layer -> x-ray
// shell layer, blended "over" in display space (sRGB, straight alpha) — the same blend three.js
// performs for the transparent shell over the tone-mapped opaque pass (PLAN §8.2).
// Outputs public/images/hero/car-{assembled,exploded}{,-1920,-1440,-1080,-t-1536,-t-1080,-t-768,-m-1080,-m-828,-m-640}.{avif,webp}
// Contact shadows: 3d/renders/posters/shadow-*.png (top-down, rendered with the vehicle rear at
// the top) -> rotated 180 degrees (vehicle front up, vehicle left on the left), blurred 3 px,
// alpha capped at 45 % -> public/models/car-shadow{,-exploded}.webp
//
// Run: node 3d/scripts/images.mjs

import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const LAYERS = resolve(ROOT, "3d/renders/posters");
const HERO = resolve(ROOT, "public/images/hero");
const MODELS = resolve(ROOT, "public/models");
const BG = { r: 0x0d, g: 0x0f, b: 0x11, alpha: 1 };
const SHADOW_MAX = 0.45;

const layer = (name) => {
  const p = resolve(LAYERS, name);
  if (!existsSync(p)) throw new Error(`missing layer ${p} (run 3d/blender/posters.py)`);
  return p;
};

/** Black image whose alpha is the source alpha scaled by `k` (straight alpha). */
async function scaledShadow(path, k, { rotate = 0, blur = 0 } = {}) {
  let img = sharp(path).ensureAlpha();
  if (rotate) img = img.rotate(rotate);
  const { data, info } = await img
    .extractChannel("alpha")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) out[i * 4 + 3] = Math.round(data[i] * k);
  let s = sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } });
  if (blur) s = s.blur(blur);
  return { buffer: await s.png().toBuffer(), width: info.width, height: info.height };
}

async function poster(state, vp) {
  const tag = `${state}-${vp}`;
  const meta = await sharp(layer(`${tag}-opaque.png`)).metadata();
  const { width, height } = meta;
  const shadow = await scaledShadow(layer(`${tag}-shadow.png`), SHADOW_MAX);
  const base = await sharp({ create: { width, height, channels: 4, background: BG } })
    .composite([
      { input: shadow.buffer, blend: "over" },
      { input: layer(`${tag}-opaque.png`), blend: "over" },
      { input: layer(`${tag}-shell.png`), blend: "over" },
    ])
    .removeAlpha()
    .png()
    .toBuffer();
  const name = `car-${state}`;
  const variants = {
    desktop: [
      ["", width],
      ["-1920", 1920],
      ["-1440", 1440],
      ["-1080", 1080],
    ],
    tablet: [
      ["-t-1536", 1536],
      ["-t-1080", 1080],
      ["-t-768", 768],
    ],
    mobile: [
      ["-m-1080", 1080],
      ["-m-828", 828],
      ["-m-640", 640],
    ],
  }[vp];
  const written = [];
  for (const [suffix, w] of variants) {
    const img = () => sharp(base).resize({ width: w, withoutEnlargement: true });
    const stem = resolve(HERO, `${name}${suffix}`);
    await img().webp({ quality: 82, effort: 6 }).toFile(`${stem}.webp`);
    await img().avif({ quality: 55, effort: 6 }).toFile(`${stem}.avif`);
    written.push(`${name}${suffix}`);
  }
  console.log(`${tag}: ${width}x${height} -> ${written.join(", ")}`);
}

async function contactShadow(state, file) {
  const src = layer(`shadow-${state}.png`);
  const s = await scaledShadow(src, SHADOW_MAX, { rotate: 180, blur: 1.5 });
  await sharp(s.buffer)
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toFile(resolve(MODELS, file));
  console.log(`${file}: ${s.width}x${s.height}`);
}

mkdirSync(HERO, { recursive: true });
mkdirSync(MODELS, { recursive: true });
for (const state of ["assembled", "exploded"])
  for (const vp of ["desktop", "tablet", "mobile"]) await poster(state, vp);
await contactShadow("assembled", "car-shadow.webp");
await contactShadow("exploded", "car-shadow-exploded.webp");
