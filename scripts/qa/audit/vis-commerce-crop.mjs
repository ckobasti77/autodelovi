// vis-commerce: crop a region of a saved capture for close review.
// node scripts/qa/audit/vis-commerce-crop.mjs <in.webp> <out-name> <top> <height> [left] [width]
import sharp from "sharp";
const [, , inp, out, top, height, left = "0", width] = process.argv;
const meta = await sharp(inp).metadata();
const w = width ? Number(width) : meta.width - Number(left);
const h = Math.min(Number(height), meta.height - Number(top));
await sharp(inp)
  .extract({ left: Number(left), top: Number(top), width: w, height: h })
  .webp({ quality: 75 })
  .toFile(`docs/qa/audit/vis-commerce/${out}.webp`);
console.log(`docs/qa/audit/vis-commerce/${out}.webp`, meta.width, meta.height);
