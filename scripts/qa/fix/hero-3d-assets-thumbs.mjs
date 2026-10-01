// hero-3d-assets (step 22, VIS-01): part-only metrics of the category renders and a contact sheet
// on the real tile ground. Same metric as scripts/qa/audit/verify-vis-store-02-metrics.mjs:
// part pixels = alpha >= 230 (the contact shadow is excluded), contrast vs #23282E (surface-3).
// Usage: node scripts/qa/fix/hero-3d-assets-thumbs.mjs [--sheet name] [slug …]
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const sheetName = args.includes("--sheet") ? args[args.indexOf("--sheet") + 1] : "";
const only = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--sheet");
const dir = path.resolve("public/images/parts");
const OUT = "docs/qa/fix/hero-3d-assets";
mkdirSync(OUT, { recursive: true });
const lin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const G3 = L(0x23, 0x28, 0x2e);
const cr = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const rows = [];
const files = readdirSync(dir).filter((x) => x.endsWith(".webp")).sort();
for (const f of files) {
  const { data, info } = await sharp(path.join(dir, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let pb = [w, h, 0, 0];
  let cy = 0;
  const lums = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 230) continue;
      cy += y;
      lums.push(L(data[i], data[i + 1], data[i + 2]));
      pb = [Math.min(pb[0], x), Math.min(pb[1], y), Math.max(pb[2], x), Math.max(pb[3], y)];
    }
  lums.sort((a, b) => a - b);
  const mean = lums.reduce((s, v) => s + v, 0) / lums.length;
  const pct = (p) => lums[Math.min(lums.length - 1, Math.floor(p * lums.length))];
  rows.push({
    file: f,
    partBboxMax: Math.round((Math.max(pb[2] - pb[0] + 1, pb[3] - pb[1] + 1) / w) * 100),
    contrastMean: +cr(mean, G3).toFixed(2),
    p50: +cr(pct(0.5), G3).toFixed(2),
    p90: +cr(pct(0.9), G3).toFixed(2),
    shareGe1_5: Math.round((lums.filter((v) => cr(v, G3) >= 1.5).length / lums.length) * 100),
    centroidY: Math.round((cy / lums.length / h) * 100),
    bboxCentreY: Math.round(((pb[1] + pb[3]) / 2 / h) * 100),
  });
}
rows.sort((a, b) => a.contrastMean - b.contrastMean);
const hdr = "file                              partBB meanCR p50CR p90CR >=1.5% centY bbCY";
const lines = [
  hdr,
  ...rows.map(
    (r) =>
      `${r.file.padEnd(34)}${String(r.partBboxMax).padStart(6)}${String(r.contrastMean).padStart(7)}${String(r.p50).padStart(6)}${String(r.p90).padStart(6)}${String(r.shareGe1_5).padStart(7)}${String(r.centroidY).padStart(6)}${String(r.bboxCentreY).padStart(5)}`,
  ),
];
const under2 = rows.filter((r) => r.contrastMean < 2).map((r) => r.file);
lines.push("", `renders under 2:1 mean part contrast: ${under2.length}${under2.length ? ` (${under2.join(", ")})` : ""}`);
const bb = rows.map((r) => r.partBboxMax).sort((a, b) => a - b);
lines.push(`part longest side: min ${bb[0]} %, median ${bb[Math.floor(bb.length / 2)]} %, max ${bb[bb.length - 1]} %`);
writeFileSync(`${OUT}/thumbs-metrics.txt`, lines.join("\n") + "\n");
writeFileSync(`${OUT}/thumbs-metrics.json`, JSON.stringify(rows, null, 1));
console.log(lines.slice(0, 12).join("\n"));
console.log(lines.slice(-2).join("\n"));

if (sheetName) {
  const pick = only.length ? only.map((s) => `${s}.webp`) : files;
  const T = 240;
  const cols = Math.min(pick.length, 8);
  const rowsN = Math.ceil(pick.length / cols);
  const tiles = [];
  for (const [n, f] of pick.entries()) {
    // tile ground: radial surface-3 centre → surface-1 edge, like the category tiles
    const ground = Buffer.from(
      `<svg width="${T}" height="${T}"><defs><radialGradient id="g" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#23282E"/><stop offset="1" stop-color="#16191D"/></radialGradient></defs><rect width="${T}" height="${T}" fill="url(#g)"/></svg>`,
    );
    const part = await sharp(path.join(dir, f)).resize(T, T).png().toBuffer();
    const tile = await sharp(ground).composite([{ input: part }]).png().toBuffer();
    tiles.push({ input: tile, left: (n % cols) * T, top: Math.floor(n / cols) * T });
  }
  await sharp({ create: { width: cols * T, height: rowsN * T, channels: 3, background: "#0D0F11" } })
    .composite(tiles)
    .webp({ quality: 80 })
    .toFile(`${OUT}/thumbs-${sheetName}.webp`);
  console.log(`sheet: ${OUT}/thumbs-${sheetName}.webp`);
}
