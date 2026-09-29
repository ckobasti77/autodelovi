// Encodes the transparent 1024 px thumbnail masters (3d/renders/thumbs/<slug>.png, rendered by
// 3d/blender/thumbs.py) into public/images/parts/<slug>.webp at 768 px with alpha.
// Run: node 3d/scripts/thumbs.mjs
import { mkdirSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = resolve(ROOT, "3d/renders/thumbs");
const DST = resolve(ROOT, "public/images/parts");
mkdirSync(DST, { recursive: true });
const files = readdirSync(SRC).filter((f) => f.endsWith(".png"));
for (const f of files) {
  const slug = f.replace(/\.png$/, "");
  await sharp(resolve(SRC, f))
    .resize(768, 768, { kernel: "lanczos3" })
    .webp({ quality: 86, alphaQuality: 90, effort: 6, smartSubsample: true })
    .toFile(resolve(DST, `${slug}.webp`));
}
console.log(`thumbnails: ${files.length} -> ${DST}`);
