/**
 * verify vis-store-02: re-measure the category renders separating the part (alpha >= 200) from the
 * contact shadow (shadow catcher, black with partial alpha), and composite every render at
 * tile size on the real CSS ground (radial surface-3 #23282E -> surface-1 #16191D) for a visual sheet.
 */
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const dir = path.resolve("public/images/parts");
const out = path.resolve("docs/qa/audit/verify/vis-store");
const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const cr = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const g3 = L(0x23, 0x28, 0x2e); // ground at the radial centre
const g1 = L(0x16, 0x19, 0x1d);
const rows = [];
const files = readdirSync(dir).filter((x) => x.endsWith(".webp")).sort();
for (const f of files) {
  const { data, info } = await sharp(path.join(dir, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let minX = w, minY = h, maxX = 0, maxY = 0, n = 0, cy = 0, shadowN = 0;
  let aMinX = w, aMinY = h, aMaxX = 0, aMaxY = 0;
  const lums = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a > 24) { if (x < aMinX) aMinX = x; if (y < aMinY) aMinY = y; if (x > aMaxX) aMaxX = x; if (y > aMaxY) aMaxY = y; }
      if (a >= 200) {
        n++; cy += y;
        lums.push(L(data[i], data[i + 1], data[i + 2]));
        if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      } else if (a > 24) shadowN++;
    }
  lums.sort((a, b) => a - b);
  const q = (p) => lums[Math.min(lums.length - 1, Math.floor(p * lums.length))];
  const mean = lums.reduce((s, v) => s + v, 0) / lums.length;
  const bw = (maxX - minX + 1) / w, bh = (maxY - minY + 1) / h;
  // share of part pixels that reach >= 3:1 against the ground centre (i.e. clearly readable detail)
  const readable = lums.filter((v) => cr(v, g3) >= 3).length / lums.length;
  const invisible = lums.filter((v) => cr(v, g3) < 1.5).length / lums.length;
  rows.push({
    file: f, size: `${w}x${h}`,
    partMaxSide: Math.round(Math.max(bw, bh) * 100),
    partW: Math.round(bw * 100), partH: Math.round(bh * 100),
    withShadowMaxSide: Math.round(Math.max((aMaxX - aMinX + 1) / w, (aMaxY - aMinY + 1) / h) * 100),
    partBoxCentreY: Math.round(((minY + maxY) / 2 / h) * 100),
    partMassCentreY: Math.round((cy / n / h) * 100),
    meanLumCr: Math.round(cr(mean, g3) * 100) / 100,
    p50Cr: Math.round(cr(q(0.5), g3) * 100) / 100,
    p90Cr: Math.round(cr(q(0.9), g3) * 100) / 100,
    readablePct: Math.round(readable * 100),
    below15Pct: Math.round(invisible * 100),
  });
}
rows.sort((a, b) => a.p90Cr - b.p90Cr);
writeFileSync(path.join(out, "vis-store-02-reproduce-metrics.json"), JSON.stringify(rows, null, 1));
const head = "file                              part% (w x h) +shadow% boxCY massCY meanCr p50Cr p90Cr >=3:1% <1.5:1%";
const lines = [head, ...rows.map((r) => `${r.file.padEnd(34)}${String(r.partMaxSide).padStart(4)} (${String(r.partW).padStart(3)}x${String(r.partH).padStart(3)}) ${String(r.withShadowMaxSide).padStart(7)} ${String(r.partBoxCentreY).padStart(5)} ${String(r.partMassCentreY).padStart(6)} ${String(r.meanLumCr).padStart(6)} ${String(r.p50Cr).padStart(5)} ${String(r.p90Cr).padStart(5)} ${String(r.readablePct).padStart(6)} ${String(r.below15Pct).padStart(7)}`)];
writeFileSync(path.join(out, "vis-store-02-reproduce-metrics.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));

// contact sheet: each render at tile size (4:3 280x210, p-10%) on the CSS radial ground, with label
const TW = 280, TH = 210, COLS = 8;
const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${TH}"><defs><radialGradient id="g" cx="50%" cy="45%" r="${Math.hypot(TW, TH) / 2}" gradientUnits="userSpaceOnUse" fx="${TW / 2}" fy="${TH * 0.45}"><stop offset="0" stop-color="#23282e"/><stop offset="0.7" stop-color="#16191d"/><stop offset="1" stop-color="#16191d"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
const tiles = [];
const order = files; // alphabetical
for (const f of order) {
  const inner = Math.round(TH * 0.8);
  const img = await sharp(path.join(dir, f)).resize(inner, inner).png().toBuffer();
  const label = `<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${TH}"><text x="6" y="${TH - 6}" font-family="Arial" font-size="12" fill="#9aa0a6">${f.replace(".webp", "")}</text></svg>`;
  tiles.push(await sharp(Buffer.from(bgSvg)).composite([{ input: img, left: Math.round((TW - inner) / 2), top: Math.round(TH * 0.1) }, { input: Buffer.from(label) }]).png().toBuffer());
}
const rowsN = Math.ceil(tiles.length / COLS);
const sheet = sharp({ create: { width: COLS * (TW + 4), height: rowsN * (TH + 4), channels: 3, background: "#0d0f11" } }).composite(
  tiles.map((t, i) => ({ input: t, left: (i % COLS) * (TW + 4), top: Math.floor(i / COLS) * (TH + 4) })),
);
await sheet.webp({ quality: 72 }).toFile(path.join(out, "vis-store-02-reproduce-sheet.webp"));
