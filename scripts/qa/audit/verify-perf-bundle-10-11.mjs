// Verifier (perf-bundle-10, perf-bundle-11): parse the GLBs by hand (no gltf-transform), list each
// embedded image with its WebP bitstream type (VP8L lossless/near-lossless vs VP8 lossy), size and
// dimensions; try alternative encodings of tex_cast_n; check how the HDR is served over HTTP.
//   node scripts/qa/audit/verify-perf-bundle-10-11.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gzipSync, brotliCompressSync, constants } from "node:zlib";
import http from "node:http";

import sharp from "sharp";

const OUT = "docs/qa/audit/verify/perf-bundle";
mkdirSync(OUT, { recursive: true });
const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const lines = [];
const log = (s) => {
  lines.push(s);
  console.log(s);
};

function parseGlb(file) {
  const b = readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error("not glb");
  let off = 12;
  let json;
  let bin;
  while (off < b.length) {
    const len = b.readUInt32LE(off);
    const type = b.readUInt32LE(off + 4);
    const data = b.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString("utf8"));
    else if (type === 0x004e4942) bin = data;
    off += 8 + len;
  }
  return { size: b.length, json, bin };
}

const images = {};
for (const f of ["car.glb", "car-lite.glb"]) {
  const { size, json, bin } = parseGlb(`public/models/${f}`);
  const gz = gzipSync(readFileSync(`public/models/${f}`), { level: 6 }).length;
  log(`${f}: ${size} B raw, ${gz} B gzip-6`);
  const texByImage = new Map();
  (json.textures ?? []).forEach((t, i) => {
    const src = t.extensions?.EXT_texture_webp?.source ?? t.source;
    texByImage.set(src, [...(texByImage.get(src) ?? []), i]);
  });
  const usage = new Map();
  (json.materials ?? []).forEach((m) => {
    const idx = m.normalTexture?.index;
    if (idx !== undefined) usage.set(idx, [...(usage.get(idx) ?? []), m.name]);
  });
  let total = 0;
  for (const [i, im] of (json.images ?? []).entries()) {
    const bv = json.bufferViews[im.bufferView];
    const data = bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength);
    const riff = data.subarray(0, 4).toString("ascii");
    const chunk = data.subarray(12, 16).toString("ascii");
    const meta = await sharp(data).metadata();
    const texIdx = texByImage.get(i) ?? [];
    const mats = texIdx.flatMap((t) => usage.get(t) ?? []);
    total += data.length;
    log(`   image ${i} ${im.name ?? "?"} ${im.mimeType} ${riff}/${chunk} ${meta.width}x${meta.height} ch=${meta.channels} ${data.length} B  normalTexture of: ${mats.join(", ") || "-"}`);
    images[`${f}:${im.name}`] = data;
  }
  log(`   total image bytes ${total} B = ${((total / size) * 100).toFixed(1)} % of raw file`);
}

// Alternative encodings of tex_cast_n (lite) to see what is on the table.
const cast = images["car-lite.glb:tex_cast_n"];
if (cast) {
  const raw = sharp(cast);
  const variants = [
    ["lossless 512", () => raw.clone().webp({ lossless: true, effort: 6 })],
    ["near-lossless q60 512", () => raw.clone().webp({ nearLossless: true, quality: 60, effort: 6 })],
    ["lossy q90 512", () => raw.clone().webp({ quality: 90, effort: 6 })],
    ["lossy q90 512 smartSubsample", () => raw.clone().webp({ quality: 90, effort: 6, smartSubsample: true })],
    ["near-lossless 256", () => raw.clone().resize(256, 256).webp({ nearLossless: true, effort: 6 })],
    ["lossless 256", () => raw.clone().resize(256, 256).webp({ lossless: true, effort: 6 })],
  ];
  log("tex_cast_n (car-lite) alternative encodings:");
  for (const [name, fn] of variants) {
    const buf = await fn().toBuffer();
    log(`   ${name.padEnd(30)} ${buf.length} B`);
  }
}

// HDR over HTTP (next start): headers with br/gzip accepted.
function head(url, enc) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers: { "Accept-Encoding": enc } }, (res) => {
      let n = 0;
      res.on("data", (c) => (n += c.length));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, wireBytes: n }));
    });
    req.on("error", reject);
  });
}
log("");
log(`HTTP (${BASE}), Accept-Encoding: br, gzip`);
for (const p of ["/models/env/studio-512.hdr", "/models/car-lite.glb", "/models/car.glb", "/models/car-shadow.webp"]) {
  const r = await head(BASE + p, "br, gzip");
  log(`   ${p} ${r.status} type=${r.headers["content-type"]} encoding=${r.headers["content-encoding"] ?? "(none)"} content-length=${r.headers["content-length"] ?? "-"} wire=${r.wireBytes} B cache-control=${r.headers["cache-control"]}`);
}
const hdr = readFileSync("public/models/env/studio-512.hdr");
log(`studio-512.hdr raw ${hdr.length} B, gzip-6 ${gzipSync(hdr, { level: 6 }).length} B, gzip-9 ${gzipSync(hdr, { level: 9 }).length} B, br-11 ${brotliCompressSync(hdr, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length} B`);
log(`   header: ${JSON.stringify(hdr.subarray(0, 120).toString("latin1").split("\n").slice(0, 6))}`);

writeFileSync(`${OUT}/perf-bundle-10-11-reproduce.txt`, lines.join("\n") + "\n");
