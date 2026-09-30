/**
 * verify vis-store-02 (skeptic): re-measure category renders properly.
 * - separates part pixels (alpha >= 230) from contact-shadow / AA pixels (alpha < 230)
 * - composites over the actual tile ground centre (#23282E, surface-3) and edge (#16191D, surface-1)
 * - reports mean, p50, p90 luminance of part pixels and share of part pixels >= 1.5:1 / 3:1 vs ground
 * - bbox of part pixels only (shadow excluded) and bbox including alpha>24
 * - centroid Y of part pixels and bbox centre Y
 */
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const dir = path.resolve("public/images/parts");
const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const G3 = L(0x23, 0x28, 0x2e);
const cr = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const rows = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith(".webp")).sort()) {
  const { data, info } = await sharp(path.join(dir, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let pb = [w, h, 0, 0], ab = [w, h, 0, 0];
  let part = 0, shadowish = 0, cy = 0; const lums = [];
  let dark24 = 0, any24 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; const a = data[i + 3];
    if (a > 24) {
      any24++;
      const l = L(data[i], data[i + 1], data[i + 2]);
      if (a < 230 && l < 0.01) dark24++;
      ab = [Math.min(ab[0], x), Math.min(ab[1], y), Math.max(ab[2], x), Math.max(ab[3], y)];
    }
    if (a >= 230) {
      part++; cy += y;
      lums.push(L(data[i], data[i + 1], data[i + 2]));
      pb = [Math.min(pb[0], x), Math.min(pb[1], y), Math.max(pb[2], x), Math.max(pb[3], y)];
    }
  }
  lums.sort((a, b) => a - b);
  const pct = (p) => lums[Math.min(lums.length - 1, Math.floor(p * lums.length))];
  const mean = lums.reduce((s, v) => s + v, 0) / lums.length;
  const share15 = lums.filter((v) => cr(v, G3) >= 1.5).length / lums.length;
  const share3 = lums.filter((v) => cr(v, G3) >= 3).length / lums.length;
  const bwP = (pb[2] - pb[0] + 1) / w, bhP = (pb[3] - pb[1] + 1) / h;
  const bwA = (ab[2] - ab[0] + 1) / w, bhA = (ab[3] - ab[1] + 1) / h;
  rows.push({
    file: f, size: `${w}x${h}`,
    partBboxMax: Math.round(Math.max(bwP, bhP) * 100), allBboxMax: Math.round(Math.max(bwA, bhA) * 100),
    shadowShareOfAlpha24: Math.round((dark24 / any24) * 100),
    meanPartLum: +mean.toFixed(3), contrastMean: +cr(mean, G3).toFixed(2),
    p50: +cr(pct(0.5), G3).toFixed(2), p90: +cr(pct(0.9), G3).toFixed(2),
    shareGe1_5: Math.round(share15 * 100), shareGe3: Math.round(share3 * 100),
    centroidY: Math.round((cy / part / h) * 100), bboxCentreY: Math.round(((pb[1] + pb[3]) / 2 / h) * 100),
  });
}
rows.sort((a, b) => a.shareGe1_5 - b.shareGe1_5);
writeFileSync("docs/qa/audit/verify/vis-store/vis-store-02-skeptic-metrics.json", JSON.stringify(rows, null, 1));
const hdr = "file                              partBB allBB shadow% meanCR p50CR p90CR >=1.5% >=3% centY bbCY";
const lines = [hdr, ...rows.map((r) => `${r.file.padEnd(34)}${String(r.partBboxMax).padStart(6)}${String(r.allBboxMax).padStart(6)}${String(r.shadowShareOfAlpha24).padStart(8)}${String(r.contrastMean).padStart(7)}${String(r.p50).padStart(6)}${String(r.p90).padStart(6)}${String(r.shareGe1_5).padStart(7)}${String(r.shareGe3).padStart(5)}${String(r.centroidY).padStart(6)}${String(r.bboxCentreY).padStart(5)}`)];
writeFileSync("docs/qa/audit/verify/vis-store/vis-store-02-skeptic-metrics.txt", lines.join("\n"));
console.log(lines.join("\n"));
