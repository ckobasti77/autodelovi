/**
 * vis-store: measures every category render in public/images/parts (transparent WebP):
 * occupied bounding box (share of frame by alpha > 24), filled pixel share, mean luminance of
 * the opaque pixels and their contrast against the card ground (#16191D .. #23282E).
 * DESIGN-SYSTEM §6.3: part at 70 % of the frame, optical centre at 48 % height.
 */
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const dir = path.resolve("public/images/parts");
const rows = [];
const lin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ground = L(0x1c, 0x20, 0x25); // radial centre surface-3-ish
for (const f of readdirSync(dir).filter((x) => x.endsWith(".webp"))) {
  const { data, info } = await sharp(path.join(dir, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let minX = w, minY = h, maxX = 0, maxY = 0, filled = 0, lumSum = 0, cy = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a > 24) {
        filled++;
        cy += y;
        lumSum += L(data[i], data[i + 1], data[i + 2]);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  const bw = (maxX - minX + 1) / w;
  const bh = (maxY - minY + 1) / h;
  const lum = filled ? lumSum / filled : 0;
  rows.push({
    file: f,
    size: `${w}x${h}`,
    bboxMaxSide: Math.round(Math.max(bw, bh) * 100),
    bboxArea: Math.round(bw * bh * 100),
    filled: Math.round((filled / (w * h)) * 1000) / 10,
    meanLum: Math.round(lum * 1000) / 1000,
    contrastVsGround: Math.round(((Math.max(lum, ground) + 0.05) / (Math.min(lum, ground) + 0.05)) * 100) / 100,
    centreY: filled ? Math.round((cy / filled / h) * 100) : null,
  });
}
rows.sort((a, b) => a.bboxMaxSide - b.bboxMaxSide);
writeFileSync("docs/qa/audit/vis-store/renders-metrics.json", JSON.stringify(rows, null, 1));
console.log("file                              bboxMax% bboxArea% filled% meanLum contrast centreY%");
for (const r of rows)
  console.log(`${r.file.padEnd(34)} ${String(r.bboxMaxSide).padStart(6)} ${String(r.bboxArea).padStart(8)} ${String(r.filled).padStart(7)} ${String(r.meanLum).padStart(7)} ${String(r.contrastVsGround).padStart(8)} ${String(r.centreY).padStart(6)}`);
